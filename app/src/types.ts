// Le vocabulaire de Visa. Un seul principe : rien n'est vert sans preuve.
// Tous les libellés visibles sont en français, écrits pour un juriste.

/** Le feu tricolore, plus le gris « on ne sait pas ». */
export type Verdict = "vert" | "orange" | "rouge" | "gris";

/** Les quatre questions posées à chaque affirmation, toujours dans cet ordre. */
export type ControleId = "existence" | "vigueur" | "rang" | "portee";

/** Où une source se situe dans la hiérarchie des normes. */
export type Rang =
  | "constitution"
  | "international"
  | "loi"
  | "reglement"
  | "circulaire"
  | "jurisprudence";

/** L'état d'un texte chez Légifrance, traduit en français courant. */
export type EtatTexte = "en vigueur" | "abrogé" | "pas encore en vigueur" | "inconnu";

/** Une version datée d'un article, pour la frise. */
export type Version = {
  /** Début d'application, au format ISO (AAAA-MM-JJ). */
  debut: string;
  /** Fin d'application, ou null si le texte est toujours applicable. */
  fin: string | null;
  /** Ce qui change dans cette version, en une phrase. */
  resume: string;
  /** Le passage caractéristique de cette version. */
  extrait: string;
};

/** Une source officielle retrouvée dans une base publique. */
export type Source = {
  /** La référence telle qu'un juriste l'écrit. */
  reference: string;
  intitule: string;
  /** La base où Visa l'a trouvée. */
  base: "Légifrance" | "Judilibre" | "introuvable";
  /** L'identifiant dans la base (LEGIARTI…, JURITEXT…), notre preuve. */
  identifiant: string | null;
  rang: Rang;
  etat: EtatTexte;
  /** Le texte officiel, copié tel quel. Jamais reformulé. */
  texte: string;
  /** Le passage que Visa a surligné, mot pour mot présent dans `texte`. */
  passage: string | null;
  /** Les versions connues, de la plus ancienne à la plus récente. */
  versions: Version[];
  lien: string | null;
};

/** Le résultat d'un des quatre contrôles. */
export type Controle = {
  id: ControleId;
  verdict: Verdict;
  /** La réponse en une phrase, sans jargon. */
  reponse: string;
  /** Ce qui permet de l'affirmer : un identifiant, une date, un extrait. */
  preuve: string | null;
};

/** La passe de contradiction : un second agent joue l'avocat adverse. */
export type Contradiction = {
  /** Ce que l'adversaire opposerait, en une phrase. */
  argument: string;
  /** Le passage exact qu'il cite à l'appui. */
  passage: string;
  /** Visa a-t-il retrouvé ce passage, mot pour mot, dans le texte officiel ? */
  passageRetrouve: boolean;
};

/** Une affirmation extraite du texte à vérifier. */
export type Affirmation = {
  id: string;
  /** La phrase du mémo, telle quelle. */
  phrase: string;
  /** La référence citée par l'auteur, ou null s'il n'en cite aucune. */
  citation: string | null;
  /** Le verdict d'ensemble : le plus sévère de ses contrôles. */
  verdict: Verdict;
  /** Le verdict résumé en une phrase pour la liste. */
  resume: string;
  controles: Controle[];
  source: Source | null;
  contradiction: Contradiction | null;
  /** Le juriste a-t-il relu et validé cette ligne ? Entre dans le journal. */
  valideParLeJuriste: boolean;
};

/** Les six étapes du contrôle, dans l'ordre où Visa les exécute. */
export type EtapeId =
  | "texte"
  | "decoupage"
  | "recherche"
  | "controles"
  | "contradiction"
  | "journal";

export type EtatEtape = "en attente" | "en cours" | "terminée" | "impossible";

/** Une étape du déroulé, telle qu'elle apparaît sur le schéma. */
export type Etape = {
  id: EtapeId;
  /** Le titre lu par le juriste. */
  titre: string;
  /** Ce que l'étape fait, en une phrase courte. */
  explication: string;
  /** La base ou le modèle employé, pour la transparence. */
  outil: string;
  etat: EtatEtape;
  /** Le compte affiché sur la carte (« 12 affirmations »). */
  compte: string | null;
  /** Les tâches de l'étape, séparées, telles qu'elles se déroulent. */
  taches: Tache[];
};

/** Une tâche élémentaire : le grain que le juriste peut suivre et auditer. */
export type Tache = {
  id: string;
  /** Ce qui est fait, à la troisième personne. */
  libelle: string;
  etat: EtatEtape;
  /** Le détail consultable : identifiant retrouvé, date comparée, extrait. */
  detail: string | null;
  /** L'affirmation concernée, quand la tâche en vise une. */
  affirmationId: string | null;
};

/** Un dossier : un texte soumis, sa date des faits, son résultat. */
export type Dossier = {
  id: string;
  /** Le nom donné par le juriste. */
  nom: string;
  /** Le client ou la matière, pour s'y retrouver. */
  matiere: string;
  /** L'outil qui a rédigé le texte soumis, déclaré par le juriste. */
  redigePar: string;
  /** La date des faits : c'est elle qui décide quelle version s'applique. */
  dateDesFaits: string;
  /** Quand la vérification a été lancée. */
  verifieLe: string;
  texte: string;
  affirmations: Affirmation[];
  etapes: Etape[];
};

/** Le compte des verdicts, pour les bandeaux et le tableau de bord. */
export type Compte = Record<Verdict, number>;
