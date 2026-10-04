/**
 * Condition de référence « modèle seul » : le même Mistral, sans Légifrance ni garde-fou.
 *
 *   bun scripts/eval-modele-seul.ts
 *
 * Pour chaque affirmation du jeu (avec sa source citée et la date des faits), on demande au modèle
 * vert / orange / rouge / gris, avec les mêmes définitions que Saul. Mêmes taux que scripts/eval.ts.
 * Écrit src/eval/resultats-modele-seul.json. À lancer depuis app/.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { jeuChoisi, LIBELLE_TYPE, type TypeCas } from "@/eval/jeu-fr";
import { calculerMesures, STATUTS, type Ligne, type Taux } from "@/eval/mesure";
import { MODELE_JUGE, mistralJson } from "@/lib/mistral";
import type { Statut } from "@/lib/types";

const PROMPT = `Tu es un juriste français expérimenté. On te soumet une affirmation juridique tirée d'une note écrite par une IA, avec la source qu'elle cite, et la date des faits.
Dis si l'affirmation est juridiquement exacte, si la source citée existe et si elle dit bien cela, dans sa version applicable à la date des faits.
Réponds en JSON : {"statut": "vert" | "orange" | "rouge" | "gris", "raison": "une phrase"}
- "vert" : affirmation exacte, la source existe, elle dit bien cela et elle était en vigueur à la date des faits ;
- "orange" : à revoir (texte modifié depuis les faits, circulaire présentée comme obligatoire, nuance importante omise) ;
- "rouge" : fausse (source inexistante ou inventée, source qui ne dit pas cela, texte pas en vigueur à la date des faits) ;
- "gris" : invérifiable (aucune source précise citée).`;

const INTERVALLE_MS = Number(process.env.EVAL_INTERVALLE_MS ?? 4500);
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (t: Taux) => (t.taux === null ? "—" : `${Math.round(t.taux * 100)} % (${t.n}/${t.sur})`);

// Cache neuf : rien n'est rejoué.
process.env.SAUL_CACHE_DIR = path.resolve(".cache", "eval-modele-seul", new Date().toISOString().replace(/[:.]/g, "-"));

async function demander(dateFaits: string, passage: string): Promise<{ statut: Statut; raison: string }> {
  for (let essai = 1; ; essai++) {
    try {
      const r = await mistralJson<{ statut?: string; raison?: string }>(MODELE_JUGE, [
        { role: "system", content: PROMPT },
        { role: "user", content: `DATE DES FAITS : ${dateFaits}\nAFFIRMATION : ${passage}` },
      ]);
      const statut = STATUTS.includes(r.statut as Statut) ? (r.statut as Statut) : "gris";
      return { statut, raison: r.raison ?? "" };
    } catch (e) {
      if (essai >= 5) throw e;
      await dormir(15_000 * essai);
    }
  }
}

async function main() {
  const debut = Date.now();
  const lignes: (Ligne & { raisonModele: string })[] = [];
  const jeu = jeuChoisi(process.argv);
  for (const note of jeu.notes) {
    for (const c of note.cas) {
      const t0 = Date.now();
      const { statut, raison } = await demander(note.dateFaits, c.passage);
      lignes.push({ id: c.id, type: c.type, attendu: c.attendu, obtenu: statut, raisonModele: raison });
      console.log(`${statut === c.attendu ? "✓" : "✗"} ${c.id} attendu ${c.attendu.padEnd(6)} modèle ${statut.padEnd(6)} ${raison.slice(0, 110)}`);
      await dormir(Math.max(0, INTERVALLE_MS - (Date.now() - t0)));
    }
  }
  const mesures = calculerMesures(lignes);
  const duree = Math.round((Date.now() - debut) / 1000);
  console.log(`\nModèle seul (${MODELE_JUGE}) sur ${mesures.total} affirmations, ${duree} s`);
  console.log(`Détection des fausses (pas en vert) : ${pct(mesures.detection)}`);
  console.log(`Faux verts parmi les fausses        : ${pct(mesures.fauxVertsSurFausses)}`);
  console.log(`Faux verts (non vertes attendues)   : ${pct(mesures.fauxVerts)}`);
  console.log(`Faux rouges parmi les justes        : ${pct(mesures.fauxRouges)}`);
  console.log(`Justes confirmées en vert           : ${pct(mesures.vertsConfirmes)}`);
  console.log(`Exactitude                          : ${pct(mesures.exactitude)}`);
  for (const [t, v] of Object.entries(mesures.parType)) {
    console.log(`  ${LIBELLE_TYPE[t as TypeCas].padEnd(40)} ${v.exactes}/${v.n} exactes · ${v.fauxVerts} faux verts · ${v.fauxRouges} faux rouges`);
  }
  await writeFile(
    path.join(process.cwd(), jeu.nom === "base" ? "src/eval/resultats-modele-seul.json" : `src/eval/resultats-modele-seul-${jeu.nom}.json`),
    `${JSON.stringify({ date: new Date().toISOString(), jeu: jeu.nom, modele: MODELE_JUGE, prompt: PROMPT, dureeSecondes: duree, mesures, lignes }, null, 2)}\n`,
  );
}

await main();
