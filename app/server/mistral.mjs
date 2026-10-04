// Mistral, côté serveur. Deux usages : lire un scan (reconnaissance de
// caractères) et proposer un passage pour une question donnée.
//
// Le second usage ne dispense jamais de la barrière : ce que le modèle propose
// est ensuite retrouvé mot pour mot dans le fichier, ou rejeté. Le modèle
// accélère la recherche, il ne fonde aucun constat à lui seul.

import { readFile } from "node:fs/promises";
import { charger } from "./piste.mjs";

export const MODELES = {
  raisonnement: "magistral-medium-latest",
  rapide: "mistral-medium-latest",
  reconnaissance: "mistral-ocr-latest",
};

let etat = null;

/**
 * Mistral répond-il ? On le teste pour de vrai, une fois, avec l'appel le moins
 * coûteux possible. Une clé valide sans quota d'inférence existe : il faut donc
 * distinguer « pas de clé », « clé refusée » et « quota épuisé », parce que ces
 * trois cas se disent différemment au juriste.
 */
export async function etatDuModele() {
  if (etat) return etat;
  const c = await charger();
  if (!c.mistral) {
    etat = { disponible: false, cause: "aucune-cle", message: "Aucune clé Mistral n'est renseignée." };
    return etat;
  }
  try {
    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${c.mistral}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODELES.rapide, messages: [{ role: "user", content: "ok" }], max_tokens: 1 }),
    });
    if (r.ok) {
      etat = { disponible: true, cause: null, message: `Mistral répond (${MODELES.raisonnement}).` };
    } else if (r.status === 429) {
      etat = {
        disponible: false,
        cause: "quota",
        message:
          "La clé Mistral est valide mais son quota d'inférence est épuisé : l'extraction se fait par motifs, et chaque passage reste vérifié sur le fichier.",
      };
    } else if (r.status === 401 || r.status === 403) {
      etat = { disponible: false, cause: "refusee", message: `Mistral refuse la clé (${r.status}).` };
    } else {
      etat = { disponible: false, cause: "erreur", message: `Mistral a répondu ${r.status}.` };
    }
  } catch (e) {
    etat = { disponible: false, cause: "reseau", message: `Mistral injoignable : ${e.message}` };
  }
  return etat;
}

async function completer(modele, systeme, demande) {
  const c = await charger();
  const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${c.mistral}`, "Content-Type": "application/json" },
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
  if (!r.ok) throw new Error(`Mistral a répondu ${r.status}.`);
  const d = await r.json();
  return JSON.parse(d.choices[0].message.content);
}

/**
 * Propose le passage d'un document qui répond à une question de l'audit. La
 * consigne interdit la reformulation : ce qui n'est pas copié ne passera pas la
 * barrière de vérification, et sera donc perdu.
 */
export async function chercherPassage(question, pourquoi, texte) {
  const systeme = [
    "Tu assistes un avocat qui audite une data room. On te donne une question d'audit et le texte d'un document.",
    "Trouve le passage du document qui répond à cette question.",
    "passage : COPIE EXACTE du document, de 15 à 80 mots. N'en change pas un mot, pas une ponctuation.",
    "Ce passage sera recherché mot pour mot dans le fichier : s'il n'y est pas tel quel, il sera rejeté.",
    "Si le document ne répond pas à la question, réponds {\"passage\": null}.",
    'Réponds en JSON : {"passage": "..." | null, "pourquoi": "en une phrase"}',
  ].join("\n");
  return completer(MODELES.raisonnement, systeme, `QUESTION : ${question}\nCE QU'ON CHERCHE : ${pourquoi}\n\nDOCUMENT :\n${texte}`);
}

/** Lit un document scanné. Rend le texte reconnu, ou lève. */
export async function reconnaitre(chemin) {
  const c = await charger();
  const octets = await readFile(chemin);
  const type = chemin.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const r = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: { Authorization: `Bearer ${c.mistral}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELES.reconnaissance,
      document: { type: "image_url", image_url: `data:${type};base64,${octets.toString("base64")}` },
    }),
  });
  if (!r.ok) throw new Error(`Reconnaissance de caractères indisponible (${r.status}).`);
  const d = await r.json();
  return (d.pages ?? []).map((p) => p.markdown ?? "").join("\n\n").trim();
}
