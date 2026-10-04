// Le modèle : Mistral, pour le découpage en affirmations et pour la
// contradiction. Deux usages seulement, et chacun rend un résultat contrôlable.
//
// Visa marche sans clé : la démonstration rejoue alors le découpage mis en
// cache. Le point important n'est pas que le modèle soit appelé, c'est que
// tout ce qu'il produit soit ensuite vérifié sur le texte officiel.

const CLE = import.meta.env.VITE_MISTRAL_API_KEY ?? "";
const URL_API = "https://api.mistral.ai/v1/chat/completions";

/** Magistral : ses étapes de raisonnement sont lisibles, ce qui compte ici. */
const MODELE_RAISONNEMENT = "magistral-medium-latest";
const MODELE_RAPIDE = "mistral-medium-latest";

export function cleDisponible(): boolean {
  return Boolean(CLE);
}

export const MODELES = { raisonnement: MODELE_RAISONNEMENT, rapide: MODELE_RAPIDE };

async function completer(modele: string, systeme: string, demande: string): Promise<string> {
  const reponse = await fetch(URL_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modele,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systeme },
        { role: "user", content: demande },
      ],
    }),
  });
  if (!reponse.ok) throw new Error(`Mistral a répondu ${reponse.status}.`);
  const data = (await reponse.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message.content ?? "";
}

export type AffirmationBrute = { phrase: string; citation: string | null };

/**
 * Le découpage. Une consigne stricte : copier les phrases, ne jamais les
 * reformuler, et ne jamais compléter une référence absente.
 */
export async function decouper(texte: string): Promise<AffirmationBrute[]> {
  const systeme = [
    "Tu découpes une note juridique française en affirmations de droit.",
    "Une affirmation est une phrase qui avance une règle de droit ou son application.",
    "Recopie la phrase EXACTEMENT telle qu'elle est écrite. Ne la reformule jamais.",
    "citation : la référence citée par l'auteur dans cette phrase, recopiée telle quelle.",
    "Si l'auteur ne cite aucune référence, mets null. N'en invente jamais une, même évidente.",
    'Réponds en JSON : {"affirmations": [{"phrase": "...", "citation": "..." | null}]}',
  ].join("\n");
  const brut = await completer(MODELE_RAISONNEMENT, systeme, texte);
  const data = JSON.parse(brut) as { affirmations?: AffirmationBrute[] };
  return data.affirmations ?? [];
}

export type ContradictionBrute = { argument: string; passage: string };

/**
 * La contradiction. Le modèle doit citer un passage du texte officiel qu'on
 * lui fournit ; l'appelant vérifie ensuite ce passage mot pour mot avec
 * `passagePresent`. Si le passage n'y est pas, l'objection est écartée.
 */
export async function contredire(
  affirmation: string,
  texteOfficiel: string,
): Promise<ContradictionBrute | null> {
  const systeme = [
    "Tu es l'avocat de la partie adverse. On te donne une affirmation et le texte officiel de la source citée.",
    "Formule en une phrase l'objection la plus forte que tu opposerais.",
    "passage : un extrait COPIÉ du texte officiel fourni, de 8 à 40 mots, qui appuie ton objection.",
    "Tu ne peux citer que ce texte. N'écris jamais un passage que tu n'y as pas lu : il sera vérifié mot pour mot et rejeté.",
    "Si le texte officiel ne permet aucune objection, réponds {\"argument\": null}.",
    'Réponds en JSON : {"argument": "..." | null, "passage": "..."}',
  ].join("\n");
  const brut = await completer(
    MODELE_RAISONNEMENT,
    systeme,
    `AFFIRMATION :\n${affirmation}\n\nTEXTE OFFICIEL :\n${texteOfficiel}`,
  );
  const data = JSON.parse(brut) as { argument: string | null; passage?: string };
  if (!data.argument || !data.passage) return null;
  return { argument: data.argument, passage: data.passage };
}
