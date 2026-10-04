import type { Probleme } from "./boucle";
import { dateLongue } from "./correction";
import { MODELE_REDACTEUR, mistralJson } from "./mistral";

/** L'IA qui a écrit le mémo, relancée par Visa avec la preuve de ce qui ne va pas. */
export const PROMPT_AUTEUR = `Tu es l'IA qui a écrit ce mémo juridique. Visa, un vérificateur, a contrôlé chaque affirmation sur le texte officiel (Légifrance, Judilibre) dans sa version applicable à la date des faits. Il te renvoie certains passages, chacun avec la preuve de ce qui ne va pas.

Corrige UNIQUEMENT ces passages. Le reste du mémo est gardé mot pour mot : ne le renvoie pas.

Règles :
- Appuie chaque correction sur les extraits et textes officiels fournis, dans la version applicable à la date des faits. N'utilise pas ta mémoire pour compléter un texte.
- N'invente jamais une source. Chaque passage corrigé sera revérifié : une référence introuvable, ou qui ne dit pas ce que tu écris, fera rejeter ta correction.
- Si une source est introuvable et qu'aucun texte officiel fourni ne fonde l'affirmation, supprime le passage : renvoie une chaîne vide.
- Garde le style du mémo et la place du passage dans le raisonnement. Quand le texte a changé depuis les faits, cite la version applicable (« dans sa rédaction en vigueur au … »).
- N'ajoute aucune condition, exception ou précision qui ne soit pas écrite dans les textes fournis.
- Si ta correction précédente a été rejetée, tiens compte de la raison.
Réponds en JSON : {"corrections": [{"id": "A3", "passage": "le passage corrigé, ou une chaîne vide pour le supprimer"}]}`;

const LIBELLE = { rouge: "faux", orange: "à revoir", vert: "vérifié", gris: "non vérifiable" } as const;

function decrire(p: Probleme): string {
  const preuves = p.preuves.map((x) =>
    [
      `Source citée : ${x.source}${x.officiel ? ` → retrouvée : ${x.officiel}` : " → non retrouvée"}${x.version ? `, ${x.version}` : ""}`,
      x.extrait ? `Extrait officiel vérifié mot pour mot : « ${x.extrait} »` : null,
      x.texte ? `Texte applicable à la date des faits (début) :\n${x.texte}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    `[${p.id}] « ${p.passage} »`,
    `Statut : ${LIBELLE[p.statut]}. Problème : ${p.message}`,
    ...preuves,
    p.rejet ? `Ta correction précédente « ${p.rejet.propose} » a été rejetée : ${p.rejet.raison}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Le passage corrigé par identifiant ; "" pour un passage supprimé. */
export async function corrigerMemo(texte: string, problemes: Probleme[], dateFaits: string): Promise<Record<string, string>> {
  const reponse = await mistralJson<{ corrections?: { id?: string; passage?: string }[] }>(MODELE_REDACTEUR, [
    { role: "system", content: PROMPT_AUTEUR },
    {
      role: "user",
      content: `DATE DES FAITS : ${dateLongue(dateFaits)} (${dateFaits})\n\nMÉMO :\n${texte}\n\nPASSAGES À CORRIGER :\n\n${problemes.map(decrire).join("\n\n")}`,
    },
  ]);
  const corrections: Record<string, string> = {};
  for (const c of reponse.corrections ?? []) {
    if (typeof c.id === "string" && typeof c.passage === "string") corrections[c.id.trim()] = c.passage;
  }
  return corrections;
}
