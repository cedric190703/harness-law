/** Normalisation agressive pour comparer deux textes juridiques au mot près. */
export function normaliser(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Le passage cité figure-t-il réellement dans le texte officiel ?
 * C'est le garde-fou qui empêche le juge lui-même d'halluciner.
 */
export function contientVerbatim(texteOfficiel: string, extrait: string): boolean {
  const e = normaliser(extrait);
  if (e.length < 12) return false;
  return normaliser(texteOfficiel).includes(e);
}

export function texteBrut(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
