import type { SourceCitee } from "./types";

/**
 * Pyramide des normes (simplifiée) — à faire valider par les juristes de l'équipe.
 * Plus le rang est petit, plus la norme est haute.
 */
export const RANGS = [
  { rang: 1, libelle: "Constitution" },
  { rang: 2, libelle: "Traités et droit de l'UE" },
  { rang: 3, libelle: "Loi / ordonnance" },
  { rang: 4, libelle: "Décret" },
  { rang: 5, libelle: "Arrêté" },
  { rang: 6, libelle: "Circulaire / instruction" },
  { rang: 7, libelle: "Jurisprudence (interprétation)" },
] as const;

export function libelleRang(rang: number): string {
  return RANGS.find((r) => r.rang === rang)?.libelle ?? "Inconnu";
}

/** Rang d'un article de code d'après son préfixe : L = loi, R/D = décret, A = arrêté. */
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
