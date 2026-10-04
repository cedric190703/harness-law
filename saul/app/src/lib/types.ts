import type { Boucle } from "./boucle";

export type Statut = "vert" | "orange" | "rouge" | "gris";

export type TypeSource =
  | "article_code"
  | "decision"
  | "loi"
  | "ordonnance"
  | "decret"
  | "arrete"
  | "circulaire"
  | "piece"
  | "autre";

/** Une source telle que citée dans le texte de l'IA. */
export interface SourceCitee {
  brut: string;
  type: TypeSource;
  code?: string | null;
  numero?: string | null;
  juridiction?: string | null;
  date?: string | null;
  numero_affaire?: string | null;
  titre?: string | null;
}

export interface Affirmation {
  id: string;
  /** Copie exacte du passage dans le texte soumis (sert au surlignage). */
  passage: string;
  resume: string;
  sources: SourceCitee[];
}

export interface VersionTexte {
  debut: string | null;
  fin: string | null;
  etat: string | null;
  texte: string;
}

/** Une source retrouvée dans une base officielle (ou une pièce du dossier). */
export interface SourceOfficielle {
  base: "Légifrance" | "Judilibre" | "Dossier";
  id: string;
  titre: string;
  url: string | null;
  rang: number;
  rangLibelle: string;
  etat: string | null;
  date: string | null;
  /** Texte de la version courante (ou de la décision). */
  texte: string;
  versions: VersionTexte[];
}

export interface Controle {
  nom: "existe" | "date" | "rang" | "contenu";
  statut: Statut;
  message: string;
}

export interface Jugement {
  verdict: "SOUTIENT" | "PARTIEL" | "NE_SOUTIENT_PAS" | "HORS_SUJET";
  raisonnement: string[];
  extrait: string;
  extraitRetrouve: boolean;
  correction: string;
}

export interface VerificationSource {
  citee: SourceCitee;
  officielle: SourceOfficielle | null;
  versionApplicable: VersionTexte | null;
  controles: Controle[];
  jugement: Jugement | null;
  statut: Statut;
}

/** La source qui fonde une réécriture : toujours une source déjà retrouvée, jamais une source inventée. */
export interface NoteSource {
  /** La référence à écrire dans le mémo, ex. « article L. 1235-3 du Code du travail, dans sa rédaction en vigueur au 15 mars 2016 ». */
  citation: string;
  titre: string;
  base: SourceOfficielle["base"];
  url: string | null;
  /** « en vigueur du 01/05/2008 au 24/09/2017 » ; null pour une décision ou une pièce. */
  version: string | null;
  /** Passage du texte officiel, retrouvé mot pour mot. */
  extrait: string;
}

/** Ce que Saul propose pour une affirmation orange ou rouge. */
export interface Reecriture {
  /**
   * remplacer : passage réécrit, fondé sur un extrait vérifié mot pour mot ;
   * source_a_trouver : la référence introuvable (ou qui ne dit pas cela) est retirée du passage ;
   * supprimer : le passage ne tient que par cette référence, on propose de le retirer ;
   * rang_superieur : circulaire, sans texte de rang supérieur vérifié dans le mémo pour l'appuyer ;
   * a_la_main : aucune proposition sûre.
   */
  type: "remplacer" | "source_a_trouver" | "supprimer" | "rang_superieur" | "a_la_main";
  /** Le passage à mettre à la place de l'original (vide : à supprimer) ; null quand il faut le réécrire à la main. */
  propose: string | null;
  source: NoteSource | null;
  /** Pourquoi, en une ou deux phrases pour l'avocat. */
  motif: string;
}

export interface ResultatAffirmation {
  affirmation: Affirmation;
  verifications: VerificationSource[];
  statut: Statut;
  message: string;
  /** Proposition du rédacteur (affirmations orange ou rouges). */
  reecriture?: Reecriture | null;
}

export interface EntreeJournal {
  t: string;
  acteur: "Extracteur" | "Chercheur" | "Règles" | "Avocat adverse" | "Rédacteur" | "Saul";
  action: string;
  detail?: string;
  modele?: string;
  empreinte?: string;
}

export type Evenement =
  | { type: "journal"; entree: EntreeJournal }
  | { type: "boucle"; boucle: Boucle }
  | { type: "affirmations"; affirmations: Affirmation[]; dateFaits: string }
  | { type: "resultat"; resultat: ResultatAffirmation }
  | { type: "fin"; synthese: Record<Statut, number> }
  | { type: "erreur"; message: string };
