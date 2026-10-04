/** Aggressive normalisation, to compare two legal texts word for word. */
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
 * Does the quoted passage really appear in the official text?
 * This is the safeguard that stops the judge itself from hallucinating.
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
