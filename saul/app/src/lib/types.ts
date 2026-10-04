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

export interface ResultatAffirmation {
  affirmation: Affirmation;
  verifications: VerificationSource[];
  statut: Statut;
  message: string;
}

export interface EntreeJournal {
  t: string;
  acteur: "Extracteur" | "Chercheur" | "Règles" | "Avocat adverse" | "Saul";
  action: string;
  detail?: string;
  modele?: string;
  empreinte?: string;
}

export type Evenement =
  | { type: "journal"; entree: EntreeJournal }
  | { type: "affirmations"; affirmations: Affirmation[]; dateFaits: string }
  | { type: "resultat"; resultat: ResultatAffirmation }
  | { type: "fin"; synthese: Record<Statut, number> }
  | { type: "erreur"; message: string };
