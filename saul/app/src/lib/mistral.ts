import { avecCache } from "./cache";

export const MODELE_EXTRACTION = process.env.MISTRAL_MODEL_EXTRACTION ?? "mistral-large-latest";
export const MODELE_JUGE = process.env.MISTRAL_MODEL_JUGE ?? "mistral-large-latest";

interface Message {
  role: "system" | "user";
  content: string;
}

/** Appel Mistral en mode JSON. Les réponses sont mises en cache (rejouabilité de la démo). */
export async function mistralJson<T>(modele: string, messages: Message[]): Promise<T> {
  const cle = process.env.MISTRAL_API_KEY;
  if (!cle) throw new Error("MISTRAL_API_KEY manquante dans app/.env.local");

  const { valeur } = await avecCache("mistral", { modele, messages }, async () => {
    for (let essai = 0; essai < 4; essai++) {
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modele,
          messages,
          temperature: 0,
          response_format: { type: "json_object" },
        }),
      });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1500 * (essai + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`Mistral ${res.status} : ${await res.text()}`);
      const data = await res.json();
      return data.choices[0].message.content as string;
    }
    throw new Error("Mistral indisponible après 4 essais");
  });

  return JSON.parse(valeur) as T;
}
