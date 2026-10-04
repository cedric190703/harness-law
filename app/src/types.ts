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
  /** Le numéro affiché. Il se décale quand des pièces arrivent. */
  id: string;
  /**
   * L'identité du constat, stable d'un passage à l'autre : la question posée et
   * le document retenu. C'est elle qui porte la relecture et les notes.
   */
  cle: string;
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
  /** La relecture du juriste. Elle vit dans le dossier, pas dans la page. */
  relu: boolean;
  /** Sa note, conservée d'un passage à l'autre. */
  note: string | null;
  /** Sa correction de la rédaction. L'originale n'est jamais effacée. */
  correction: string | null;
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

/** Un dossier : une opération, ses pièces, son historique d'audits. */
export type Dossier = {
  id: string;
  nom: string;
  operation: string;
  cible: string;
  cote: string;
  dateReference: string;
  ouvertLe: string;
  responsable: string;
  demonstration?: boolean;
  pieces: number;
  nombreAudits: number;
  dernierAudit: string | null;
  relus: number;
};

/** Un constat vu en abrégé, dans la liste des changements. */
export type ConstatBref = {
  id: string;
  cle: string;
  chantier: string;
  question: string;
  valeur: string;
  gravite: Gravite;
  quoi?: { champ: string; avant: string | null; apres: string | null }[];
};

/**
 * Ce qui a changé depuis le passage précédent.
 *
 * `aRevoir` est le champ qui compte : les constats que le juriste avait relus et
 * qu'une pièce arrivée depuis a changés. Sans cela, sa validation mentirait.
 */
export type Changements = {
  premier: boolean;
  depuis: string | null;
  documents: {
    ajoutes: { id: string; nom: string; chemin: string; role: string }[];
    disparus: { id: string; nom: string; chemin: string; role: string }[];
    modifies: { id: string; nom: string; chemin: string; role: string }[];
  };
  constats: { nouveaux: ConstatBref[]; disparus: ConstatBref[]; modifies: ConstatBref[] };
  aRevoir: ConstatBref[];
};

/** Une entrée du journal des agents. */
export type EntreeJournal = {
  t: string;
  acteur: string;
  action: string;
  detail: string | null;
  /** Les pièces touchées. « droit » et « rapport » ne sont pas des pièces. */
  pistes: string[];
  constat: string | null;
  outil: string | null;
};

export type Acteur = { id: string; quoi: string };

/** Le schéma du parcours : une ligne par pièce, un point par passage. */
export type Parcours = {
  lignes: { id: string; nom: string; role: string; piece: boolean; ouverte: boolean; exploitee: boolean }[];
  pas: {
    rang: number;
    t: string;
    acteur: string;
    action: string;
    detail: string | null;
    constat: string | null;
    exploite: boolean;
    pistes: string[];
  }[];
  /** Lues, et dont rien n'a été tiré. */
  sansSuite: { id: string; nom: string; role: string }[];
};

/** Un bloc du rapport, tel qu'il se lit à l'écran. */
export type Bloc =
  | { type: "titre"; niveau: number; texte: string }
  | { type: "paragraphe"; texte: string; discret?: boolean }
  | {
      type: "bornes";
      lu: number;
      verse: number;
      illisibles: { id: string; nom: string; pourquoi: string }[];
      ecartes: { id: string; nom: string; pourquoi: string }[];
      manquants: LigneDemande[];
    }
  | {
      type: "constat";
      id: string;
      cle: string;
      gravite: Gravite;
      question: string;
      texte: string;
      corrige: boolean;
      impact: string | null;
      note: string | null;
      relu: boolean;
      nonEtabli: boolean;
      renvoi: { document: string | null; clause: string | null; page: number | null; reconnaissance: boolean };
      spa: Mecanisme | null;
    }
  | { type: "epreuve"; question: string; affirmation: string; verdict: Epreuve["verdict"]; texte: string; appuis: string[] }
  | { type: "clause"; constat: string; gravite: Gravite; question: string; texte: string };

/** Un passage de l'audit dans l'historique du dossier. */
export type PassageAudit = { fichier: string; a: string; id: string; constats: number; pieces: number };

export type Audit = {
  id: string;
  dossier: string;
  nomDossier: string;
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
  acteurs: Acteur[];
  journal: EntreeJournal[];
  /** Le rapport en blocs, ajouté par le serveur à la lecture. */
  blocs: Bloc[];
  parcours: Parcours;
  documents: Document[];
  chantiers: Chantier[];
  demandes: { lignes: LigneDemande[]; manquants: LigneDemande[]; document?: string };
  constats: Constat[];
  sansReponse: { sonde: string; chantier: string; question: string; pourquoi: string; motif: string }[];
  rejets: { sonde: string; rang: number; motif: string }[];
  epreuves: Epreuve[];
  changements: Changements;
  travail: { relus: number; notes: number; corrections: number; modifieLe: string | null };
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
