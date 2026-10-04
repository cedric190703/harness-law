// Déclarations pour le jeu de test. Le module est en JavaScript.
// Le résultat est typé côté interface dans `src/types.ts` (type `Audit`).

export const ETAPES: { id: string; titre: string; quoi: string }[];

export function auditer(options?: {
  /** Le dossier à auditer. */
  dossier?: string;
  /** Un répertoire de pièces hors dossier, pour les contrôles isolés. */
  racine?: string | null;
  dateReference?: string;
  avancer?: (pas: { etape: string; etat: string; detail: string }) => void;
  /** Reçoit le corpus exact qui a servi, texte reconnu compris. */
  surCorpus?: (documents: import("./documents.mjs").DocumentLu[]) => void;
}): Promise<unknown>;

export function texteDocument(dossier: string, quoi: string): Promise<unknown>;

/** Ajoute le rapport en blocs et le schéma du parcours à un audit. */
export function enrichir(audit: unknown): unknown;
