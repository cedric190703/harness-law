import type { Jugement } from "@/lib/types";
import { normaliser } from "@/lib/verbatim";
import type { Taux } from "./mesure";

/**
 * Benchmark ContractNLI (Koreeda et Manning 2021, CC BY 4.0), sans réseau : échantillon fixé par une graine,
 * correspondance des verdicts de Visa avec les étiquettes du jeu, taux, et qualité des preuves citées.
 */

export const LABELS = ["Entailment", "Contradiction", "NotMentioned"] as const;
export type Label = (typeof LABELS)[number];
/** « gris » : verdict écarté par le garde-fou mot pour mot. « invalide » : réponse sans étiquette lisible. */
export type Prediction = Label | "gris" | "invalide";
export const PREDICTIONS: Prediction[] = [...LABELS, "gris", "invalide"];

export interface Paire {
  /** `<id du document>:<clé de l'hypothèse>`, par exemple `1043:nda-11`. */
  id: string;
  document: number;
  hypothese: string;
  attendu: Label;
}

/** Générateur pseudo-aléatoire mulberry32 : même graine, même suite. */
export function aleatoire(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const numeroHypothese = (cle: string) => Number(cle.replace(/\D/g, ""));

/**
 * L'échantillon : `parLabel` paires de chaque étiquette, tirées par Fisher-Yates avec la graine,
 * puis entrelacées (E, C, N, E, C, N…) pour qu'un passage interrompu reste équilibré.
 * Le résultat ne dépend pas de l'ordre des paires reçues.
 */
export function echantillonner(paires: Paire[], graine: number, parLabel: number): Paire[] {
  const triees = [...paires].sort(
    (x, y) => x.document - y.document || numeroHypothese(x.hypothese) - numeroHypothese(y.hypothese),
  );
  const hasard = aleatoire(graine);
  const groupes = LABELS.map((label) => {
    const g = triees.filter((p) => p.attendu === label);
    if (g.length < parLabel) throw new Error(`Seulement ${g.length} paires ${label}, ${parLabel} demandées`);
    for (let i = g.length - 1; i > 0; i--) {
      const j = Math.floor(hasard() * (i + 1));
      [g[i], g[j]] = [g[j], g[i]];
    }
    return g.slice(0, parLabel);
  });
  return Array.from({ length: parLabel }, (_, i) => groupes.map((g) => g[i])).flat();
}

/** L'étiquette rendue par le modèle seul (condition A), tolérante sur la casse et les séparateurs. */
export function labelDuModele(brut: unknown): Prediction {
  const valeur = typeof brut === "object" && brut !== null ? (brut as Record<string, unknown>).label : brut;
  if (typeof valeur !== "string") return "invalide";
  const v = valeur.toLowerCase().replace(/[^a-z]/g, "");
  if (v === "entailment") return "Entailment";
  if (v === "contradiction") return "Contradiction";
  if (v === "notmentioned") return "NotMentioned";
  return "invalide";
}

/**
 * Le verdict de Visa (condition B) traduit en étiquette ContractNLI. Sans extrait retrouvé mot pour mot,
 * le verdict est écarté : « gris ». PARTIEL compte comme Contradiction (Visa ne le met pas en vert).
 */
export function labelDeVisa(j: Pick<Jugement, "verdict" | "extraitRetrouve">): Prediction {
  if (!j.extraitRetrouve) return "gris";
  switch (j.verdict) {
    case "SOUTIENT":
      return "Entailment";
    case "PARTIEL":
    case "NE_SOUTIENT_PAS":
      return "Contradiction";
    case "HORS_SUJET":
      return "NotMentioned";
    default:
      return "gris";
  }
}

/**
 * Variante tolérante du garde-fou, pour l'analyse seulement (Visa ne l'applique pas) : un extrait coupé
 * par « [...] » ou « … » est accepté si chaque morceau, d'au moins 12 caractères, figure mot pour mot
 * dans le texte, dans l'ordre.
 */
export function contientParMorceaux(texte: string, extrait: string): boolean {
  const morceaux = extrait
    .split(/\[\s*(?:\.{3}|…)\s*\]|…|\.{3}/)
    .map(normaliser)
    .filter(Boolean);
  if (morceaux.length === 0 || morceaux.some((m) => m.length < 12)) return false;
  const t = normaliser(texte);
  let depuis = 0;
  for (const m of morceaux) {
    const k = t.indexOf(m, depuis);
    if (k < 0) return false;
    depuis = k + m.length;
  }
  return true;
}

function taux(n: number, sur: number): Taux {
  return { n, sur, taux: sur ? n / sur : null };
}

export interface LignePaire {
  attendu: Label;
  predit: Prediction;
}

export interface ScoreLabel {
  precision: number;
  rappel: number;
  f1: number;
}

export type MatriceNli = Record<Label, Record<Prediction, number>>;

export interface MesuresNli {
  total: number;
  exactitude: Taux;
  /** Moyenne des F1 des trois étiquettes ; « gris » et « invalide » comptent comme des erreurs. */
  f1Macro: number;
  parLabel: Record<Label, ScoreLabel>;
  /** Lignes = étiquette attendue, colonnes = prédiction. */
  matrice: MatriceNli;
  /** Le chiffre clé de Visa : paires NON Entailment déclarées Entailment (un vert qui n'aurait pas dû l'être). */
  fauxVerts: Taux;
  fauxVertsSurContradiction: Taux;
  fauxVertsSurNonMentionne: Taux;
  /** Paires Entailment bien déclarées Entailment. */
  vertsConfirmes: Taux;
  gris: Taux;
  invalides: Taux;
  /** Exactitude sur les paires où un verdict a été retenu (ni gris, ni invalide). */
  exactitudeHorsGris: Taux;
}

export function mesurerNli(lignes: LignePaire[]): MesuresNli {
  const matrice = Object.fromEntries(
    LABELS.map((a) => [a, Object.fromEntries(PREDICTIONS.map((p) => [p, 0]))]),
  ) as MatriceNli;
  for (const l of lignes) matrice[l.attendu][l.predit]++;

  const parLabel = Object.fromEntries(
    LABELS.map((label) => {
      const vrais = matrice[label][label];
      const predits = LABELS.reduce((n, a) => n + matrice[a][label], 0);
      const attendus = lignes.filter((l) => l.attendu === label).length;
      const precision = predits ? vrais / predits : 0;
      const rappel = attendus ? vrais / attendus : 0;
      return [label, { precision, rappel, f1: precision + rappel ? (2 * precision * rappel) / (precision + rappel) : 0 }];
    }),
  ) as Record<Label, ScoreLabel>;

  const nonEntailment = lignes.filter((l) => l.attendu !== "Entailment");
  const fauxVertsParmi = (ls: LignePaire[]) => taux(ls.filter((l) => l.predit === "Entailment").length, ls.length);
  const retenues = lignes.filter((l) => l.predit !== "gris" && l.predit !== "invalide");

  return {
    total: lignes.length,
    exactitude: taux(lignes.filter((l) => l.predit === l.attendu).length, lignes.length),
    f1Macro: LABELS.reduce((s, label) => s + parLabel[label].f1, 0) / LABELS.length,
    parLabel,
    matrice,
    fauxVerts: fauxVertsParmi(nonEntailment),
    fauxVertsSurContradiction: fauxVertsParmi(lignes.filter((l) => l.attendu === "Contradiction")),
    fauxVertsSurNonMentionne: fauxVertsParmi(lignes.filter((l) => l.attendu === "NotMentioned")),
    vertsConfirmes: fauxVertsParmi(lignes.filter((l) => l.attendu === "Entailment")),
    gris: taux(lignes.filter((l) => l.predit === "gris").length, lignes.length),
    invalides: taux(lignes.filter((l) => l.predit === "invalide").length, lignes.length),
    exactitudeHorsGris: taux(retenues.filter((l) => l.predit === l.attendu).length, retenues.length),
  };
}

/**
 * Le texte normalisé exactement comme `normaliser`, avec, pour chaque caractère normalisé,
 * sa position dans le texte d'origine : de quoi retrouver où se trouve un extrait vérifié.
 */
export function positionsNormalisees(texte: string): { norm: string; origine: number[] } {
  const dansBalise = new Uint8Array(texte.length);
  for (const m of texte.matchAll(/<[^>]+>/g)) dansBalise.fill(1, m.index, m.index + m[0].length);
  let norm = "";
  const origine: number[] = [];
  let separe = false;
  for (let i = 0; i < texte.length; i++) {
    if (dansBalise[i]) {
      separe = true;
      continue;
    }
    for (const c of texte[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()) {
      if (!/[a-z0-9]/.test(c)) {
        separe = true;
        continue;
      }
      if (separe && norm) {
        norm += " ";
        origine.push(i);
      }
      separe = false;
      norm += c;
      origine.push(i);
    }
  }
  return { norm, origine };
}

/** Toutes les occurrences d'un extrait dans le texte, en positions [début, fin) du texte d'origine. */
export function localiserExtrait(texte: string, extrait: string): [number, number][] {
  const e = normaliser(extrait);
  if (e.length < 12) return [];
  const { norm, origine } = positionsNormalisees(texte);
  const occurrences: [number, number][] = [];
  for (let k = norm.indexOf(e); k >= 0; k = norm.indexOf(e, k + 1)) {
    occurrences.push([origine[k], origine[k + e.length - 1] + 1]);
  }
  return occurrences;
}

export interface QualitePreuve {
  /** L'extrait recoupe au moins un passage de preuve officiel. */
  recoupe: boolean;
  /** Part des caractères de l'extrait qui tombent dans un passage de preuve officiel. */
  precisionCaracteres: number;
  /** Passages du contrat (phrases ou items, découpage officiel) touchés par l'extrait. */
  passagesTouches: number[];
  /** Part des passages touchés qui sont des passages de preuve. */
  precisionPassages: number;
  /** Part des passages de preuve que l'extrait touche. */
  rappelPassages: number;
}

const recouvrement = (a: [number, number], b: [number, number]) => Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));

/**
 * L'extrait cité recoupe-t-il les passages de preuve du jeu ? On garde la meilleure occurrence.
 * `null` sans occurrence ou sans passage de preuve (paires NotMentioned).
 */
export function qualitePreuve(
  spans: [number, number][],
  preuve: number[],
  occurrences: [number, number][],
): QualitePreuve | null {
  if (occurrences.length === 0 || preuve.length === 0) return null;
  const officiels = new Set(preuve);
  let meilleure: { communs: number; qualite: QualitePreuve } | null = null;
  for (const occ of occurrences) {
    const communs = preuve.reduce((s, k) => s + recouvrement(occ, spans[k]), 0);
    if (meilleure && communs <= meilleure.communs) continue;
    const passagesTouches = spans.flatMap((s, k) => (recouvrement(occ, s) > 0 ? [k] : []));
    const touchesOfficiels = passagesTouches.filter((k) => officiels.has(k)).length;
    meilleure = {
      communs,
      qualite: {
        recoupe: communs > 0,
        precisionCaracteres: occ[1] > occ[0] ? communs / (occ[1] - occ[0]) : 0,
        passagesTouches,
        precisionPassages: passagesTouches.length ? touchesOfficiels / passagesTouches.length : 0,
        rappelPassages: touchesOfficiels / preuve.length,
      },
    };
  }
  return meilleure?.qualite ?? null;
}

export interface SyntheseQualite {
  /** Paires Entailment ou Contradiction dont l'extrait a été retrouvé. */
  n: number;
  recoupe: Taux;
  precisionCaracteresMoyenne: number | null;
  precisionPassagesMoyenne: number | null;
  rappelPassagesMoyen: number | null;
}

export function synthetiserQualite(qualites: QualitePreuve[]): SyntheseQualite {
  const moyenne = (f: (q: QualitePreuve) => number) =>
    qualites.length ? qualites.reduce((s, q) => s + f(q), 0) / qualites.length : null;
  return {
    n: qualites.length,
    recoupe: taux(qualites.filter((q) => q.recoupe).length, qualites.length),
    precisionCaracteresMoyenne: moyenne((q) => q.precisionCaracteres),
    precisionPassagesMoyenne: moyenne((q) => q.precisionPassages),
    rappelPassagesMoyen: moyenne((q) => q.rappelPassages),
  };
}
