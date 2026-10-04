import { pire } from "@/lib/controles";
import type { Statut } from "@/lib/types";
import { normaliser } from "@/lib/verbatim";
import type { TypeCas } from "./jeu-fr";

/**
 * Calcul des taux de la preuve 1, sans réseau : rattachement des affirmations découpées par Saul
 * aux affirmations attendues, puis matrice et taux.
 */

export type StatutObtenu = Statut | "absent";

export const STATUTS: Statut[] = ["vert", "orange", "rouge", "gris"];
export const STATUTS_OBTENUS: StatutObtenu[] = [...STATUTS, "absent"];

export interface PassageAttendu {
  id: string;
  passage: string;
}

export interface AffirmationObtenue {
  id: string;
  passage: string;
  statut: Statut;
  nbSources: number;
}

/** Mots vides, et mots de citation communs à presque toutes les phrases (« article », « code »…). */
const MOTS_VIDES = new Set(
  [
    "a au aux ce ces cette d de des du elle en est et il l la le les leur n ne ou par pas pour qu que qui s sa se ses son sont sur un une y",
    "article code civil civile travail procedure consommation penal loi cass soc com civ",
  ]
    .join(" ")
    .split(" "),
);

/** Les mots porteurs d'un passage (sans accents, sans mots vides), sans doublon. */
export function mots(texte: string): Set<string> {
  return new Set(
    normaliser(texte)
      .split(" ")
      .filter((m) => m && !MOTS_VIDES.has(m)),
  );
}

/** Un passage obtenu qui couvre au moins cette part d'un passage attendu le recouvre. */
const SEUIL_COUVRE = 0.8;
/** Sinon, il est rattaché à l'attendu le plus proche si l'un des deux recouvre l'autre à ce point. */
const SEUIL_PROCHE = 0.5;
const MOTS_COMMUNS_MIN = 3;

export interface Rattachement {
  /** Pour chaque affirmation attendue, les affirmations obtenues qui s'y rattachent. */
  liens: Map<string, string[]>;
  /** Affirmations obtenues qui ne correspondent à aucune affirmation attendue. */
  enTrop: string[];
}

/**
 * Relie chaque affirmation découpée par Saul aux affirmations attendues, par recouvrement des mots.
 * Une affirmation obtenue qui en fusionne plusieurs est rattachée à chacune ;
 * des morceaux d'une même affirmation sont tous rattachés à elle.
 */
export function rattacher(attendus: PassageAttendu[], obtenus: Pick<AffirmationObtenue, "id" | "passage">[]): Rattachement {
  const liens = new Map<string, string[]>(attendus.map((a) => [a.id, []]));
  const motsAttendus = attendus.map((a) => ({ id: a.id, mots: mots(a.passage) }));
  const enTrop: string[] = [];

  for (const o of obtenus) {
    const mo = mots(o.passage);
    const scores = motsAttendus.map((a) => {
      let communs = 0;
      for (const m of mo) if (a.mots.has(m)) communs++;
      return {
        id: a.id,
        communs,
        couvre: a.mots.size ? communs / a.mots.size : 0,
        inclus: mo.size ? communs / mo.size : 0,
      };
    });
    const couverts = scores.filter((s) => s.communs >= MOTS_COMMUNS_MIN && s.couvre >= SEUIL_COUVRE);
    let cibles: string[];
    if (couverts.length >= 2) {
      cibles = couverts.map((s) => s.id);
    } else {
      const proche = scores
        .filter((s) => s.communs >= MOTS_COMMUNS_MIN && Math.max(s.couvre, s.inclus) >= SEUIL_PROCHE)
        .sort((x, y) => y.communs - x.communs || y.couvre - x.couvre)[0];
      cibles = proche ? [proche.id] : [];
    }
    if (cibles.length === 0) enTrop.push(o.id);
    for (const c of cibles) liens.get(c)?.push(o.id);
  }
  return { liens, enTrop };
}

/**
 * Le statut que Saul montre sur une affirmation attendue : le pire de ses morceaux.
 * Les morceaux qui citent une source l'emportent (un fragment de faits sans source ne compte pas).
 */
export function statutRattache(morceaux: Pick<AffirmationObtenue, "statut" | "nbSources">[]): StatutObtenu {
  if (morceaux.length === 0) return "absent";
  const sources = morceaux.filter((m) => m.nbSources > 0);
  return pire((sources.length ? sources : morceaux).map((m) => m.statut));
}

export interface Ligne {
  id: string;
  type: TypeCas;
  attendu: Statut;
  obtenu: StatutObtenu;
}

export type Matrice = Record<Statut, Record<StatutObtenu, number>>;

export function matrice(lignes: Ligne[]): Matrice {
  const m = Object.fromEntries(
    STATUTS.map((a) => [a, Object.fromEntries(STATUTS_OBTENUS.map((o) => [o, 0]))]),
  ) as Matrice;
  for (const l of lignes) m[l.attendu][l.obtenu]++;
  return m;
}

/** Affirmation fausse : la source ne soutient pas l'affirmation à la date des faits. */
export const estFausse = (l: Ligne) => l.attendu === "rouge" || l.attendu === "orange";
/** Saul ne la met pas en vert (rouge, orange ou gris « à vérifier »). Une affirmation non découpée n'est pas détectée. */
export const estSignalee = (l: Ligne) => l.obtenu === "rouge" || l.obtenu === "orange" || l.obtenu === "gris";
/** Faux vert : Saul met en vert ce qui ne devait pas l'être (rouge, orange ou gris attendu). */
export const estFauxVert = (l: Ligne) => l.attendu !== "vert" && l.obtenu === "vert";
/** Faux rouge : Saul met en rouge une affirmation juste. */
export const estFauxRouge = (l: Ligne) => l.attendu === "vert" && l.obtenu === "rouge";

export interface Taux {
  n: number;
  sur: number;
  taux: number | null;
}

function taux(n: number, sur: number): Taux {
  return { n, sur, taux: sur ? n / sur : null };
}

export interface ParType {
  n: number;
  exactes: number;
  signalees: number;
  fauxVerts: number;
  fauxRouges: number;
  absentes: number;
}

export interface Mesures {
  total: number;
  parEtiquette: Record<Statut, number>;
  /** Fausses (rouge ou orange attendu) que Saul ne met pas en vert. */
  detection: Taux;
  /** Fausses que Saul met en rouge ou orange (le gris « à vérifier » ne compte pas). */
  detectionStricte: Taux;
  /** Fausses que Saul met en vert. */
  fauxVertsSurFausses: Taux;
  /** Toutes les attendues non vertes (rouge, orange, gris) que Saul met en vert. */
  fauxVerts: Taux;
  fauxRouges: Taux;
  /** Justes que Saul met bien en vert. */
  vertsConfirmes: Taux;
  exactitude: Taux;
  absentes: Taux;
  matrice: Matrice;
  parType: Record<string, ParType>;
}

export function calculerMesures(lignes: Ligne[]): Mesures {
  const fausses = lignes.filter(estFausse);
  const justes = lignes.filter((l) => l.attendu === "vert");
  const nonVertes = lignes.filter((l) => l.attendu !== "vert");
  const parEtiquette = Object.fromEntries(STATUTS.map((s) => [s, lignes.filter((l) => l.attendu === s).length])) as Record<
    Statut,
    number
  >;

  const parType: Record<string, ParType> = {};
  for (const l of lignes) {
    const t = (parType[l.type] ??= { n: 0, exactes: 0, signalees: 0, fauxVerts: 0, fauxRouges: 0, absentes: 0 });
    t.n++;
    if (l.obtenu === l.attendu) t.exactes++;
    if (estSignalee(l)) t.signalees++;
    if (estFauxVert(l)) t.fauxVerts++;
    if (estFauxRouge(l)) t.fauxRouges++;
    if (l.obtenu === "absent") t.absentes++;
  }

  return {
    total: lignes.length,
    parEtiquette,
    detection: taux(fausses.filter(estSignalee).length, fausses.length),
    detectionStricte: taux(fausses.filter((l) => l.obtenu === "rouge" || l.obtenu === "orange").length, fausses.length),
    fauxVertsSurFausses: taux(fausses.filter(estFauxVert).length, fausses.length),
    fauxVerts: taux(nonVertes.filter(estFauxVert).length, nonVertes.length),
    fauxRouges: taux(justes.filter(estFauxRouge).length, justes.length),
    vertsConfirmes: taux(justes.filter((l) => l.obtenu === "vert").length, justes.length),
    exactitude: taux(lignes.filter((l) => l.obtenu === l.attendu).length, lignes.length),
    absentes: taux(lignes.filter((l) => l.obtenu === "absent").length, lignes.length),
    matrice: matrice(lignes),
    parType,
  };
}
