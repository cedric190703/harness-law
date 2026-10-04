// Déclarations pour le jeu de test. Le module est en JavaScript.

export const ACTEURS: { id: string; quoi: string }[];
export function journal(surEntree?: (e: unknown) => void): {
  entrees: unknown[];
  dire(acteur: string, action: string, options?: Record<string, unknown>): unknown;
};
export function parcours(entrees: unknown[], documents: unknown[]): unknown;
