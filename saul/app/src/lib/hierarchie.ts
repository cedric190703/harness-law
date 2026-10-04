import type { SourceCitee } from "./types";

/**
 * Hierarchy of norms (simplified) — to be confirmed by the team's lawyers.
 * The lower the rank number, the higher the norm.
 */
export const RANGS = [
  { rang: 1, libelle: "Constitution" },
  { rang: 2, libelle: "Treaties and EU law" },
  { rang: 3, libelle: "Statute / ordinance" },
  { rang: 4, libelle: "Decree" },
  { rang: 5, libelle: "Ministerial order" },
  { rang: 6, libelle: "Circular / instruction" },
  { rang: 7, libelle: "Case law (interpretation)" },
] as const;

export function libelleRang(rang: number): string {
  return RANGS.find((r) => r.rang === rang)?.libelle ?? "Unknown";
}

/** Rank of a code article from its prefix: L = statute, R/D = decree, A = ministerial order. */
export function rangArticle(numero: string): number {
  const p = numero.trim().toUpperCase()[0];
  if (p === "R" || p === "D") return 4;
  if (p === "A") return 5;
  return 3;
}

export function rangSource(s: SourceCitee): number {
  switch (s.type) {
    case "article_code":
      return rangArticle(s.numero ?? "");
    case "loi":
    case "ordonnance":
      return 3;
    case "decret":
      return 4;
    case "arrete":
      return 5;
    case "circulaire":
      return 6;
    case "decision":
      return 7;
    default:
      return 7;
  }
}
