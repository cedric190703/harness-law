import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/** Dossier du cache : VISA_CACHE_DIR si défini (mesure sur cache neuf), sinon app/.cache. */
function racine(): string {
  return process.env.VISA_CACHE_DIR || path.join(process.cwd(), ".cache");
}

export function empreinte(valeur: unknown): string {
  return createHash("sha256").update(JSON.stringify(valeur)).digest("hex");
}

/**
 * Cache disque : les réponses des bases officielles et du modèle sont gardées
 * pour que la démo rejoue à l'identique, même si le wifi tombe.
 */
export async function avecCache<T>(
  espace: string,
  cle: unknown,
  calcul: () => Promise<T>,
): Promise<{ valeur: T; depuisCache: boolean }> {
  if (process.env.VISA_CACHE === "0") return { valeur: await calcul(), depuisCache: false };
  const fichier = path.join(racine(), espace, `${empreinte(cle)}.json`);
  try {
    return { valeur: JSON.parse(await readFile(fichier, "utf8")) as T, depuisCache: true };
  } catch {
    const valeur = await calcul();
    await mkdir(path.dirname(fichier), { recursive: true });
    await writeFile(fichier, JSON.stringify(valeur));
    return { valeur, depuisCache: false };
  }
}
