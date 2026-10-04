// L'état de l'application. L'audit vient du serveur ; le reste n'est que la
// position du juriste dans le dossier : l'écran, le constat ouvert, le filtre.

import { useEffect, useState } from "react";
import type { Audit, Chantier, Constat, Gravite, TexteDocument } from "./types";

export type Ecran = "dataroom" | "chantiers" | "tableau" | "constats" | "vendeur" | "spa";

type Etat = {
  ecran: Ecran;
  audit: Audit | null;
  /** Null tant que l'audit n'est pas arrivé ; porte le message en cas d'échec. */
  erreur: string | null;
  constatOuvert: string | null;
  documentOuvert: string | null;
  chantierFiltre: string | null;
  graviteFiltre: Gravite | null;
  /** L'avancement d'un relancement en cours, étape par étape. */
  enCours: { etape: string; detail: string }[] | null;
};

let etat: Etat = {
  ecran: "dataroom",
  audit: null,
  erreur: null,
  constatOuvert: null,
  documentOuvert: null,
  chantierFiltre: null,
  graviteFiltre: null,
  enCours: null,
};

const abonnes = new Set<() => void>();
export function poser(partiel: Partial<Etat>) {
  etat = { ...etat, ...partiel };
  abonnes.forEach((f) => f());
}
export const lire = () => etat;

export function useEtat<T>(selecteur: (e: Etat) => T): T {
  const [valeur, setValeur] = useState(() => selecteur(etat));
  useEffect(() => {
    const ecouter = () => setValeur(selecteur(etat));
    abonnes.add(ecouter);
    ecouter();
    return () => void abonnes.delete(ecouter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return valeur;
}

export const aller = (ecran: Ecran) => poser({ ecran });

export async function chargerAudit() {
  try {
    const r = await fetch("/api/audit");
    if (!r.ok) throw new Error(`Le serveur a répondu ${r.status}.`);
    poser({ audit: await r.json(), erreur: null });
  } catch (e) {
    poser({ erreur: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Relance l'audit et suit son avancement. Le juriste voit le travail se faire :
 * c'est aussi ce qui lui dit quelles étapes existent.
 */
export async function relancerAudit() {
  if (etat.enCours) return;
  poser({ enCours: [] });
  try {
    const r = await fetch("/api/audit/relancer", { method: "POST" });
    if (!r.body) throw new Error("Le serveur n'a rien diffusé.");
    const lecteur = r.body.getReader();
    const decodeur = new TextDecoder();
    let tampon = "";
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      tampon += decodeur.decode(value, { stream: true });
      const blocs = tampon.split("\n\n");
      tampon = blocs.pop() ?? "";
      for (const bloc of blocs) {
        const type = bloc.match(/^event:\s*(.+)$/m)?.[1];
        const donnees = bloc.match(/^data:\s*(.+)$/m)?.[1];
        if (!type || !donnees) continue;
        const d = JSON.parse(donnees);
        if (type === "etape" && d.etat === "terminée") {
          poser({ enCours: [...(etat.enCours ?? []), { etape: d.etape, detail: d.detail }] });
        } else if (type === "erreur") {
          poser({ erreur: d.message });
        }
      }
    }
    await chargerAudit();
  } catch (e) {
    poser({ erreur: e instanceof Error ? e.message : String(e) });
  } finally {
    poser({ enCours: null });
  }
}

/** Le cache des textes de documents : on ne les redemande pas deux fois. */
const textes = new Map<string, TexteDocument>();

export async function texteDocument(id: string): Promise<TexteDocument | null> {
  if (textes.has(id)) return textes.get(id)!;
  const r = await fetch(`/api/document?id=${encodeURIComponent(id)}`);
  if (!r.ok) return null;
  const d = (await r.json()) as TexteDocument;
  textes.set(id, d);
  return d;
}

export function ouvrirConstat(id: string | null) {
  poser({ ecran: etat.ecran === "constats" ? "constats" : "constats", constatOuvert: id });
}

export const ouvrirDocument = (id: string | null) => poser({ documentOuvert: id });

export function basculerRelu(id: string) {
  if (!etat.audit) return;
  const constats = etat.audit.constats.map((c) => (c.id === id ? { ...c, relu: !c.relu } : c));
  poser({ audit: { ...etat.audit, constats } });
}

// --------------------------------------------------------------------- aides

export const GRAVITES: Gravite[] = ["critique", "élevée", "moyenne", "faible"];

/** Compte les constats par gravité. */
export function compterGravites(constats: Constat[]): Record<Gravite, number> {
  const c = { critique: 0, "élevée": 0, moyenne: 0, faible: 0 } as Record<Gravite, number>;
  for (const x of constats) c[x.gravite] += 1;
  return c;
}

export function constatsDuChantier(audit: Audit, chantier: string): Constat[] {
  return audit.constats.filter((c) => c.chantier === chantier);
}

export function nomChantier(chantiers: Chantier[], id: string): string {
  return chantiers.find((c) => c.id === id)?.nom ?? id;
}

/** « 4 octobre 2026 » — les dates se lisent en français dans un dossier. */
export function formaterDate(iso: string): string {
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const d = new Date(iso);
  return `${d.getDate()}${d.getDate() === 1 ? "er" : ""} ${mois[d.getMonth()]} ${d.getFullYear()}`;
}

export function court(texte: string, max: number): string {
  return texte.length <= max ? texte : `${texte.slice(0, max - 1).trimEnd()}…`;
}
