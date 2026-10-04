// L'état de l'application, tenu dans un petit magasin maison.
//
// Visa n'a que trois choses à retenir : l'écran affiché, le dossier en cours,
// et jusqu'où le contrôle est allé. Tout le reste se recalcule.

import { useEffect, useState } from "react";
import { DOSSIER_DEMO } from "./data/dossier";
import { construireEtapes } from "./engine/etapes";
import type { Affirmation, Dossier, EtapeId } from "./types";

export type Ecran = "accueil" | "nouvelle" | "controle" | "rapport" | "journal";

/** 0 : rien de lancé. 6 : les six étapes sont passées. */
export type Avancement = 0 | 1 | 2 | 3 | 4 | 5 | 6;

type Etat = {
  ecran: Ecran;
  dossier: Dossier;
  avancement: Avancement;
  /** L'étape dépliée sur le schéma du contrôle. */
  etapeOuverte: EtapeId | null;
  /** L'affirmation ouverte dans le rapport. */
  affirmationOuverte: string | null;
  /** Le contrôle est-il en train de se dérouler sous les yeux du juriste ? */
  enCours: boolean;
};

function dossierDemo(avancement: Avancement): Dossier {
  return {
    ...DOSSIER_DEMO,
    affirmations: avancement >= 3 ? DOSSIER_DEMO.affirmations : [],
    etapes: construireEtapes(DOSSIER_DEMO.affirmations, DOSSIER_DEMO.dateDesFaits, avancement),
  };
}

let etat: Etat = {
  ecran: "accueil",
  dossier: dossierDemo(6),
  avancement: 6,
  etapeOuverte: null,
  affirmationOuverte: null,
  enCours: false,
};

const abonnes = new Set<() => void>();

function diffuser() {
  abonnes.forEach((f) => f());
}

export function lire(): Etat {
  return etat;
}

export function poser(partiel: Partial<Etat>) {
  etat = { ...etat, ...partiel };
  diffuser();
}

/** S'abonner à une tranche de l'état, comme le ferait un store minimal. */
export function useEtat<T>(selecteur: (e: Etat) => T): T {
  const [valeur, setValeur] = useState(() => selecteur(etat));
  useEffect(() => {
    const ecouter = () => setValeur(selecteur(etat));
    abonnes.add(ecouter);
    ecouter();
    return () => {
      abonnes.delete(ecouter);
    };
    // Le sélecteur est recréé à chaque rendu : on ne s'abonne qu'une fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return valeur;
}

export function aller(ecran: Ecran) {
  poser({ ecran });
}

/** Rejoue le contrôle étape par étape, pour que le juriste le voie se faire. */
export function lancerLeControle() {
  if (etat.enCours) return;
  poser({ ecran: "controle", avancement: 0, enCours: true, etapeOuverte: null, dossier: dossierDemo(0) });
  // Le découpage et la recherche des sources prennent plus longtemps que le
  // reste : les durées ci-dessous reflètent l'ordre de grandeur réel.
  const durees = [900, 1600, 2200, 1500, 1800, 700];
  let cumul = 0;
  durees.forEach((duree, i) => {
    cumul += duree;
    setTimeout(() => {
      const avancement = (i + 1) as Avancement;
      poser({ avancement, dossier: dossierDemo(avancement), enCours: avancement < 6 });
    }, cumul);
  });
}

/** Repart d'un contrôle déjà passé, sans rejouer l'animation. */
export function afficherResultat() {
  poser({ ecran: "controle", avancement: 6, enCours: false, dossier: dossierDemo(6) });
}

export function ouvrirEtape(id: EtapeId | null) {
  poser({ etapeOuverte: etat.etapeOuverte === id ? null : id });
}

export function ouvrirAffirmation(id: string | null) {
  poser({ ecran: "rapport", affirmationOuverte: id });
}

/** La relecture du juriste : c'est elle qui clôt le journal. */
export function basculerValidation(id: string) {
  const affirmations: Affirmation[] = etat.dossier.affirmations.map((a) =>
    a.id === id ? { ...a, valideParLeJuriste: !a.valideParLeJuriste } : a,
  );
  poser({ dossier: { ...etat.dossier, affirmations } });
}

export function toutValider() {
  const affirmations = etat.dossier.affirmations.map((a) => ({ ...a, valideParLeJuriste: true }));
  poser({ dossier: { ...etat.dossier, affirmations } });
}
