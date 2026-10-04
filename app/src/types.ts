// Le vocabulaire de l'audit, tel que le serveur le renvoie.
//
// Un seul mot d'ordre : chaque constat porte sa provenance. Sans elle, le
// juriste doit rouvrir les documents — et on n'a rien résolu.

export type Gravite = "critique" | "élevée" | "moyenne" | "faible";

export type RoleDocument =
  | "retenu"
  | "avenant"
  | "ecarte"
  | "illisible"
  | "liste-demandes"
  | "reponses-vendeur";

export type Document = {
  id: string;
  nom: string;
  chemin: string;
  dossier: string;
  extension: string;
  octets: number;
  empreinte: string;
  role: RoleDocument;
  /** Pourquoi ce document a été écarté, ou ce qui le rend illisible. */
  motifTri: string | null;
  /** Le contrat qu'un avenant modifie. */
  parentDe: string | null;
  /** Les avenants rattachés à ce contrat. */
  avenants?: string[];
  lisible: boolean;
  aReconnaitre?: boolean;
  /** D'où vient le texte : le fichier, ou une reconnaissance de caractères. */
  origineTexte: OrigineTexte | null;
  lignes: number;
  pages: number;
};

/**
 * Un passage lu par machine sur une image n'a pas la force d'un passage lu dans
 * un fichier texte. `aConfirmer` porte cette différence jusqu'à l'écran.
 */
export type OrigineTexte = {
  par: "fichier" | "reconnaissance";
  modele: string | null;
  aConfirmer: boolean;
};

/** Ce qui a été écarté pour un constat donné, et pourquoi. */
export type Ecarte = { document: string; nom: string; pourquoi: string };

/**
 * Le chemin qui mène à une information du rapport. C'est le cœur du produit :
 * le juriste suit un raisonnement déjà tracé au lieu de refaire la recherche.
 */
export type Provenance = {
  /** Tous les documents parcourus pour cette question. */
  parcourus: string[];
  /** Ceux qui contenaient un passage pertinent. */
  consultes: string[];
  /** Celui sur lequel le constat repose. */
  retenu: string | null;
  nomRetenu: string | null;
  cheminRetenu: string | null;
  page: number | null;
  ligne: number | null;
  clause: string | null;
  /** Le passage, copié du document. Jamais reformulé. */
  extrait: string | null;
  motif: string | null;
  origineTexte: OrigineTexte | null;
  ecartes: Ecarte[];
};

/** Le droit applicable, vérifié sur Légifrance et Judilibre. */
export type Droit = {
  demande: { article?: { code: string; numero: string }; jurisprudence?: string };
  resultat:
    | null
    | {
        verifie: true;
        article: {
          reference: string;
          identifiant: string;
          etat: string;
          texte: string;
          lien: string;
          versionApplicable: { debut: string; fin: string | null; texte: string } | null;
          nombreVersions: number;
        } | null;
        jurisprudence: {
          total: number;
          decisions: { numero: string; date: string; juridiction: string; chambre: string; resume: string; lien: string | null }[];
        } | null;
        base: string;
        a: string;
      }
    | { verifie: false; motif: string; a: string };
};

/** Ce qui en découle au contrat de cession. */
export type Mecanisme = {
  mecanisme: "garantie" | "condition suspensive" | "ajustement de prix";
  redaction: string;
};

export type Constat = {
  id: string;
  sonde: string;
  chantier: string;
  question: string;
  pourquoi: string;
  /** La valeur relevée, en une ligne : c'est la cellule du tableau. */
  valeur: string;
  /** Le texte rédigé qui paraîtra au rapport. */
  redaction: string;
  gravite: Gravite;
  impact: string | null;
  liens: string[];
  spa: Mecanisme | null;
  /** Vrai quand le dossier ne permet pas d'établir le fait. */
  nonEtabli: boolean;
  droit: Droit | null;
  provenance: Provenance;
  relu: boolean;
};

export type Chantier = { id: string; nom: string; quoi: string };

export type LigneDemande = {
  code: string;
  quoi: string;
  etat: "reçu" | "partiel" | "manquant";
  detail: string;
};

export type Epreuve = {
  question: string;
  affirmation: string;
  verdict: "inexacte" | "exacte" | "non vérifiable" | "non éprouvée";
  pourquoi: string;
  appuis: { constat: string; document: string | null; clause: string | null; page: number | null; extrait: string | null }[];
};

export type Couverture = {
  total: number;
  depouilles: number;
  ecartes: { id: string; nom: string; pourquoi: string }[];
  illisibles: { id: string; nom: string; pourquoi: string; aReconnaitre: boolean }[];
  procedure: number;
  demandesManquantes: number;
  demandesTotal: number;
};

export type Etape = { id: string; titre: string; quoi: string };

export type Audit = {
  id: string;
  operation: string;
  cible: string;
  cote: string;
  dateReference: string;
  lanceLe: string;
  dureeMs: number;
  moteur: {
    extraction: string;
    /** La reconnaissance de caractères a-t-elle servi, et sur quels documents ? */
    reconnaissance:
      | { employee: true; modele: string; documents: string[] }
      | { employee: false; motif: string };
    modele: { disponible: boolean; cause: string | null; message: string };
    droit: string;
  };
  etapes: Etape[];
  journal: { etape: string; etat: string; detail: string; a: string }[];
  documents: Document[];
  chantiers: Chantier[];
  demandes: { lignes: LigneDemande[]; manquants: LigneDemande[]; document?: string };
  constats: Constat[];
  sansReponse: { sonde: string; chantier: string; question: string; pourquoi: string; motif: string }[];
  rejets: { sonde: string; rang: number; motif: string }[];
  epreuves: Epreuve[];
  mecanismes: (Mecanisme & {
    constat: string;
    chantier: string;
    question: string;
    gravite: Gravite;
    appui: { document: string | null; clause: string | null; page: number | null };
  })[];
  couverture: Couverture;
};

/** Le texte d'un document, pour le lire à côté de la rédaction. */
export type TexteDocument = {
  id: string;
  nom: string;
  chemin: string;
  role: RoleDocument;
  lisible: boolean;
  texte: string;
  pages: { numero: number; lignes: string; premiereLigne: number }[];
};
