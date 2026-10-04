// Déclarations pour le jeu de test. Le module est en JavaScript.
// Le résultat est typé côté interface dans `src/types.ts` (type `Audit`).

export const ETAPES: { id: string; titre: string; quoi: string }[];

export function auditer(options?: {
  racine?: string;
  dateReference?: string;
  avancer?: (pas: { etape: string; etat: string; detail: string }) => void;
  /** Reçoit le corpus exact qui a servi, texte reconnu compris. */
  surCorpus?: (documents: import("./documents.mjs").DocumentLu[]) => void;
}): Promise<unknown>;

export function enregistrer(resultat: unknown, dossier?: string): Promise<string>;
export function dernierAudit(dossier?: string): Promise<unknown>;
export function texteDocument(racine: string, chemin: string): Promise<unknown>;
