// L'état de l'application.
//
// Trois choses viennent du serveur et une seule est locale : les dossiers,
// l'audit du dossier ouvert, l'avancement d'un passage en cours — et la
// position du juriste dans l'écran.
//
// Le travail du juriste (relectures, notes, corrections) n'est jamais seulement
// local : chaque geste part au serveur, parce qu'un dossier d'audit se travaille
// sur plusieurs jours et à plusieurs.

import { useEffect, useState } from "react";
import type { Audit, Chantier, Constat, Dossier, Gravite, PassageAudit, TexteDocument } from "./types";

/** Les trois onglets du volet de droite. Rien de plus : le reste est du bruit. */
export type Onglet = "preuve" | "parcours" | "pieces";

type Etat = {
  dossiers: Dossier[];
  /** Le dossier ouvert. Null sur l'écran des dossiers. */
  dossierOuvert: string | null;
  audit: Audit | null;
  historique: PassageAudit[];
  chargement: boolean;
  erreur: string | null;
  onglet: Onglet;
  /** La clé du constat choisi dans le rapport. */
  choisi: string | null;
  documentOuvert: string | null;
  /** Ne montrer que les constats qu'une pièce récente a changés. */
  seulementARevoir: boolean;
  /** Le journal d'un passage en cours, tel qu'il arrive du serveur. */
  enCours: { acteur: string; action: string; detail: string | null }[] | null;
  /** Le dernier versement, pour l'annoncer. */
  dernierVersement: { lot: string; verses: { nom: string; octets?: number; refuse?: string }[] } | null;
};

let etat: Etat = {
  dossiers: [],
  dossierOuvert: null,
  audit: null,
  historique: [],
  chargement: true,
  erreur: null,
  onglet: "preuve",
  choisi: null,
  documentOuvert: null,
  seulementARevoir: false,
  enCours: null,
  dernierVersement: null,
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

async function demander<T>(chemin: string, options?: RequestInit): Promise<T> {
  const r = await fetch(chemin, options);
  const corps = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((corps as { erreur?: string }).erreur ?? `Le serveur a répondu ${r.status}.`);
  return corps as T;
}

// ------------------------------------------------------------------ dossiers

export async function chargerDossiers() {
  poser({ chargement: true });
  try {
    const { dossiers } = await demander<{ dossiers: Dossier[] }>("/api/dossiers");
    poser({ dossiers, erreur: null });
  } catch (e) {
    poser({ erreur: message(e) });
  } finally {
    poser({ chargement: false });
  }
}

export async function ouvrirDossier(id: string) {
  poser({
    dossierOuvert: id,
    chargement: true,
    audit: null,
    choisi: null,
    onglet: "preuve",
    seulementARevoir: false,
    dernierVersement: null,
  });
  try {
    const audit = await demander<Audit>(`/api/dossiers/${id}/audit`);
    const { audits } = await demander<{ audits: PassageAudit[] }>(`/api/dossiers/${id}/historique`);
    poser({ audit, historique: audits, erreur: null });
  } catch (e) {
    poser({ erreur: message(e) });
  } finally {
    poser({ chargement: false });
  }
}

export function fermerDossier() {
  poser({ dossierOuvert: null, audit: null, historique: [], choisi: null });
  chargerDossiers();
}

export async function creerDossier(champs: Partial<Dossier>) {
  const d = await demander<Dossier>("/api/dossiers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(champs),
  });
  await chargerDossiers();
  return d;
}

export async function supprimerDossier(id: string) {
  await demander(`/api/dossiers/${id}`, { method: "DELETE" });
  await chargerDossiers();
}

// --------------------------------------------------------------------- audit

/** Relance un passage et suit son avancement, étape par étape. */
export async function relancerAudit() {
  const id = etat.dossierOuvert;
  if (!id || etat.enCours) return;
  poser({ enCours: [], erreur: null });
  try {
    const r = await fetch(`/api/dossiers/${id}/audit`, { method: "POST" });
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
        if (type === "journal") {
          poser({ enCours: [...(etat.enCours ?? []), d.entree] });
        } else if (type === "erreur") {
          // Dire que l'écran montre encore le passage précédent : sans cela on
          // présenterait un audit périmé comme neuf.
          poser({
            erreur: d.auditInchange
              ? `${d.message} L'écran montre encore le passage précédent.`
              : d.message,
          });
        }
      }
    }
    await rafraichir();
  } catch (e) {
    poser({ erreur: message(e) });
  } finally {
    poser({ enCours: null });
  }
}

async function rafraichir() {
  const id = etat.dossierOuvert;
  if (!id) return;
  const audit = await demander<Audit>(`/api/dossiers/${id}/audit`);
  const { audits } = await demander<{ audits: PassageAudit[] }>(`/api/dossiers/${id}/historique`);
  poser({ audit, historique: audits });
}

/**
 * Verse des pièces. Le versement déclenche un passage : c'est tout l'intérêt —
 * le rapport se refait, et l'audit dit quelles relectures sont périmées.
 */
export async function verserPieces(fichiers: File[], lot?: string) {
  const id = etat.dossierOuvert;
  if (!id || !fichiers.length) return;
  poser({
    enCours: [{ acteur: "Visa", action: `verse ${fichiers.length} pièce(s)`, detail: "puis relance l'audit" }],
    erreur: null,
  });
  try {
    const charges = await Promise.all(
      fichiers.map(async (f) => ({ nom: f.name, contenu: await enBase64(f) })),
    );
    const r = await demander<{ lot: string; verses: { nom: string; octets?: number; refuse?: string }[] }>(
      `/api/dossiers/${id}/pieces`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fichiers: charges, lot }),
      },
    );
    poser({ dernierVersement: r });
    await rafraichir();
    await chargerDossiers();
  } catch (e) {
    poser({ erreur: message(e) });
  } finally {
    poser({ enCours: null });
  }
}

function enBase64(f: File): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => rejeter(new Error(`Lecture impossible : ${f.name}`));
    lecteur.onload = () => {
      const r = String(lecteur.result);
      resoudre(r.slice(r.indexOf(",") + 1));
    };
    lecteur.readAsDataURL(f);
  });
}

export function lienExport(quoi: "rapport.md" | "tableau.csv"): string {
  return `/api/dossiers/${etat.dossierOuvert}/${quoi}`;
}

// -------------------------------------------------------- le travail du juriste

/** Chaque geste part au serveur : un dossier se travaille sur plusieurs jours. */
async function enregistrerTravail(partiel: { relus?: string[]; notes?: Record<string, string>; corrections?: Record<string, string> }) {
  const id = etat.dossierOuvert;
  if (!id) return;
  try {
    await demander(`/api/dossiers/${id}/travail`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partiel),
    });
  } catch (e) {
    poser({ erreur: `Votre relecture n'a pas pu être enregistrée : ${message(e)}` });
  }
}

/**
 * Les gestes du juriste portent sur la **clé** du constat, pas sur son numéro
 * affiché : le numéro se décale quand des pièces arrivent, et la relecture
 * basculerait alors sur un autre constat.
 */
export function basculerRelu(id: string) {
  if (!etat.audit) return;
  const constats = etat.audit.constats.map((c) => (c.id === id ? { ...c, relu: !c.relu } : c));
  poser({ audit: { ...etat.audit, constats } });
  enregistrerTravail({ relus: constats.filter((c) => c.relu).map((c) => c.cle) });
}

export function poserNote(id: string, note: string) {
  if (!etat.audit) return;
  const vise = etat.audit.constats.find((c) => c.id === id);
  if (!vise) return;
  const constats = etat.audit.constats.map((c) => (c.id === id ? { ...c, note: note || null } : c));
  poser({ audit: { ...etat.audit, constats } });
  enregistrerTravail({ notes: { [vise.cle]: note } });
}

export function poserCorrection(id: string, correction: string) {
  if (!etat.audit) return;
  const vise = etat.audit.constats.find((c) => c.id === id);
  if (!vise) return;
  const constats = etat.audit.constats.map((c) => (c.id === id ? { ...c, correction: correction || null } : c));
  poser({ audit: { ...etat.audit, constats } });
  enregistrerTravail({ corrections: { [vise.cle]: correction } });
}

// ------------------------------------------------------------------ navigation

export const allerOnglet = (onglet: Onglet) => poser({ onglet });
export const ouvrirDocument = (id: string | null) => poser({ documentOuvert: id });

/** Choisit un constat dans le rapport, et montre sa preuve. */
export function choisir(cle: string | null) {
  poser({ choisi: etat.choisi === cle ? null : cle, onglet: "preuve" });
}

/** Le constat choisi, résolu depuis sa clé. */
export function constatChoisi(): Constat | null {
  if (!etat.audit || !etat.choisi) return null;
  return etat.audit.constats.find((c) => c.cle === etat.choisi) ?? null;
}

const textes = new Map<string, TexteDocument>();
export async function texteDocument(id: string): Promise<TexteDocument | null> {
  const cle = `${etat.dossierOuvert}/${id}`;
  if (textes.has(cle)) return textes.get(cle)!;
  const r = await fetch(`/api/dossiers/${etat.dossierOuvert}/document?id=${encodeURIComponent(id)}`);
  if (!r.ok) return null;
  const d = (await r.json()) as TexteDocument;
  textes.set(cle, d);
  return d;
}

// ----------------------------------------------------------------------- aides

export const GRAVITES: Gravite[] = ["critique", "élevée", "moyenne", "faible"];

export function compterGravites(constats: Constat[]): Record<Gravite, number> {
  const c = { critique: 0, "élevée": 0, moyenne: 0, faible: 0 } as Record<Gravite, number>;
  for (const x of constats) c[x.gravite] += 1;
  return c;
}

export function nomChantier(chantiers: Chantier[], id: string): string {
  return chantiers.find((c) => c.id === id)?.nom ?? id;
}

export function formaterDate(iso: string): string {
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const d = new Date(iso);
  return `${d.getDate()}${d.getDate() === 1 ? "er" : ""} ${mois[d.getMonth()]} ${d.getFullYear()}`;
}

/** « il y a 3 heures » — ce qu'on veut lire dans une liste de dossiers. */
export function depuis(iso: string | null): string {
  if (!iso) return "jamais";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "à l'instant";
  if (s < 5400) return `il y a ${Math.round(s / 60)} min`;
  if (s < 172800) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} jours`;
}

export function court(texte: string, max: number): string {
  return texte.length <= max ? texte : `${texte.slice(0, max - 1).trimEnd()}…`;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
