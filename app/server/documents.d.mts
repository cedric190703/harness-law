// Déclarations pour le jeu de test, écrit en TypeScript. Le module lui-même est
// en JavaScript : il tourne sous Node sans étape de compilation.

/** Un document de la data room, après lecture et triage. */
export type DocumentLu = {
  id: string;
  nom: string;
  chemin: string;
  cheminAbsolu?: string;
  dossier: string;
  extension: string;
  octets: number;
  empreinte: string;
  role: "retenu" | "avenant" | "ecarte" | "illisible" | "liste-demandes" | "reponses-vendeur";
  motifTri: string | null;
  motifIllisible?: string | null;
  parentDe: string | null;
  avenants?: string[];
  lisible: boolean;
  aReconnaitre?: boolean;
  origineTexte: { par: "fichier" | "reconnaissance"; modele: string | null; aConfirmer: boolean } | null;
  texte: string;
  pages: { numero: number; lignes: string; premiereLigne: number }[];
};

export const LIGNES_PAR_PAGE: number;

export function chargerDataRoom(
  racine: string,
  options?: { reconnaitre?: (doc: DocumentLu) => Promise<{ texte: string; modele: string } | null> },
): Promise<DocumentLu[]>;

export function situer(doc: DocumentLu, passage: string): { page: number; ligne: number } | null;
export function clauseDe(doc: DocumentLu, passage: string): string | null;
export function appliquerReconnaissance(doc: DocumentLu, texte: string, modele: string): boolean;
export function trier(documents: DocumentLu[]): DocumentLu[];
