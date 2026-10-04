/**
 * The « verify the sources » skill (.claude/skills/verifier-sources): the mechanical part.
 *
 *   bun scripts/carte.ts preparer <dossier> [--date AAAA-MM-JJ] [--titre "…"]
 *   bun scripts/carte.ts conclure <dossier>
 *
 * Run it from app/: Bun reads .env.local there (PISTE keys) and the source cache.
 * The folder holds reponse.txt, affirmations.json and, optionally, pieces/*.txt.
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  conclure,
  preparer,
  type Decoupage,
  type JugementSaisi,
  type Preparation,
  type ReecritureSaisie,
} from "@/lib/carte";
import { rendreCarte } from "@/lib/carte-html";
import { pire } from "@/lib/controles";
import { MENTION, planifier } from "@/lib/correction";
import type { Piece } from "@/lib/sources";
import type { Statut } from "@/lib/types";

const PASTILLE: Record<Statut, string> = { vert: "🟢", orange: "🟠", rouge: "🔴", gris: "⚪" };

function option(nom: string): string | null {
  const i = process.argv.indexOf(nom);
  return i > 0 ? (process.argv[i + 1] ?? null) : null;
}

async function lireJson<T>(fichier: string): Promise<T> {
  try {
    return JSON.parse(await readFile(fichier, "utf8")) as T;
  } catch (e) {
    throw new Error(`Lecture de ${fichier} impossible : ${(e as Error).message}`);
  }
}

async function lirePieces(dossier: string): Promise<Piece[]> {
  const rep = path.join(dossier, "pieces");
  let noms: string[];
  try {
    noms = (await readdir(rep)).filter((n) => /\.(txt|md)$/i.test(n)).sort();
  } catch {
    return [];
  }
  return Promise.all(
    noms.map(async (n) => ({ nom: n.replace(/\.(txt|md)$/i, ""), texte: await readFile(path.join(rep, n), "utf8") })),
  );
}

async function commandePreparer(dossier: string) {
  const reponse = await readFile(path.join(dossier, "reponse.txt"), "utf8");
  const decoupage = await lireJson<Decoupage>(path.join(dossier, "affirmations.json"));
  const pieces = await lirePieces(dossier);
  const titre =
    option("--titre") ??
    reponse
      .split("\n")
      .find((l) => l.trim())
      ?.trim()
      .slice(0, 90) ??
    "Answer checked";

  const { preparation, erreurs } = await preparer(reponse, decoupage, {
    titre,
    dateSaisie: option("--date"),
    pieces,
  });
  if (!preparation) {
    console.error("Fix these in affirmations.json before going on:");
    for (const e of erreurs) console.error(`  - ${e}`);
    process.exit(1);
  }

  await writeFile(path.join(dossier, "preparation.json"), JSON.stringify(preparation, null, 2));
  const textes = path.join(dossier, "textes");
  await rm(textes, { recursive: true, force: true });
  await mkdir(textes, { recursive: true });

  const passages = new Map(preparation.affirmations.map((a) => [a.id, a]));
  const aJuger = preparation.elements.filter((e) => e.texteAJuger !== null);
  for (const e of aJuger) {
    const a = passages.get(e.affirmation);
    const v = e.versionApplicable;
    await writeFile(
      path.join(textes, `${e.id}.txt`),
      [
        `ITEM ${e.id} — to be judged by opposing counsel`,
        `STATEMENT: ${a?.passage ?? ""}`,
        `SUMMARY: ${a?.resume ?? ""}`,
        `SOURCE CITED: ${e.citee.brut}`,
        `DATE OF THE FACTS: ${preparation.dateFaits}`,
        `TEXTE OFFICIEL : ${e.officielle?.titre ?? ""}${v ? ` (version en vigueur du ${v.debut ?? "?"} au ${v.fin ?? "aujourd'hui"})` : ""}`,
        "----- start of the official text -----",
        e.texteAJuger,
        "----- end of the official text -----",
        "",
      ].join("\n"),
    );
  }

  const origine = { entered: "as entered", text: "found in the text", today: "UNKNOWN: today's date" };
  console.log(`Date of the facts: ${preparation.dateFaits} (${origine[preparation.origineDate]})`);
  console.log(
    `${preparation.affirmations.length} statements, ${preparation.elements.length} sources cited, ${pieces.length} document(s). ` +
      `Official databases: ${preparation.basesConnectees ? "connected" : "NOT connected (anything from Légifrance or Judilibre will stay grey)"}.`,
  );
  console.log(`\nTo judge (${aJuger.length}): read each file, then write ${path.join(dossier, "jugements.json")}`);
  for (const e of aJuger) console.log(`  ${e.id.padEnd(6)} ${path.join(textes, `${e.id}.txt`)}   (${e.officielle?.titre ?? ""})`);
  const tranches = preparation.elements.filter((e) => e.texteAJuger === null);
  if (tranches.length > 0) {
    console.log(`\nAlready settled without a verdict (${tranches.length}):`);
    for (const e of tranches) {
      const statut = pire(e.controles.map((c) => c.statut));
      const raison = e.controles.find((c) => c.statut === statut)?.message ?? "";
      console.log(`  ${e.id.padEnd(6)} ${PASTILLE[statut]} ${e.citee.brut} — ${raison}`);
    }
  }
  const sansSource = preparation.affirmations.filter((a) => a.sources.length === 0);
  if (sansSource.length > 0) console.log(`\nNo source cited (grey): ${sansSource.map((a) => a.id).join(", ")}`);
}

async function commandeConclure(dossier: string) {
  const preparation = await lireJson<Preparation>(path.join(dossier, "preparation.json"));
  let jugements: JugementSaisi[] = [];
  try {
    jugements = await lireJson<JugementSaisi[]>(path.join(dossier, "jugements.json"));
  } catch {
    console.warn("No jugements.json: anything that needed judging will stay grey.");
  }
  const attendus = new Set(preparation.elements.filter((e) => e.texteAJuger !== null).map((e) => e.id));
  const inconnus = jugements.filter((j) => !attendus.has(j.id)).map((j) => j.id);
  if (inconnus.length > 0) console.warn(`Verdicts ignored (no item to judge carries that id): ${inconnus.join(", ")}`);
  const manquants = [...attendus].filter((id) => !jugements.some((j) => j.id === id));
  if (manquants.length > 0) console.warn(`Items left unjudged (they stay grey): ${manquants.join(", ")}`);

  let reecritures: ReecritureSaisie[] = [];
  try {
    reecritures = await lireJson<ReecritureSaisie[]>(path.join(dossier, "reecritures.json"));
  } catch {
    // Optional: with no rewrite, the passages to fix stay “to be rewritten by hand”.
  }

  const carte = conclure(preparation, jugements, new Date().toISOString(), reecritures);
  await writeFile(path.join(dossier, "resultat.json"), JSON.stringify(carte, null, 2));
  const html = path.join(dossier, "carte.html");
  await writeFile(html, rendreCarte(carte));

  const s = carte.synthese;
  console.log(
    `${carte.resultats.length} statements: ${s.vert} verified, ${s.orange} to review, ${s.rouge} false, ${s.gris} not verified.`,
  );
  for (const r of carte.resultats) {
    console.log(`  ${r.affirmation.id.padEnd(4)} ${PASTILLE[r.statut]} ${r.statut === "vert" ? r.affirmation.resume : r.message}`);
  }
  const ecartes = carte.resultats.flatMap((r) =>
    r.verifications.filter((v) => v.jugement && !v.jugement.extraitRetrouve).map(() => r.affirmation.id),
  );
  if (ecartes.length > 0) {
    console.log(`\nExcerpts not found word for word (verdict set aside): ${ecartes.join(", ")}. Copy the exact excerpt, then run again.`);
  }

  const aCorriger = carte.resultats.filter((r) => r.reecriture);
  if (aCorriger.length > 0) {
    const proposees = aCorriger.filter((r) => r.reecriture?.type === "remplacer").length;
    console.log(`\nCorrections: ${proposees} rewrite(s) kept out of ${aCorriger.length} passage(s) to fix.`);
    for (const r of aCorriger) {
      const e = r.reecriture!;
      const plan = planifier(r, carte.resultats, carte.dateFaits);
      const saisie = reecritures.some((x) => x.id === r.affirmation.id);
      if (e.type === "remplacer") {
        console.log(`  ${r.affirmation.id.padEnd(4)} rewritten — ${e.source?.citation}`);
      } else if (plan?.cas === "rediger" && !saisie) {
        console.log(`  ${r.affirmation.id.padEnd(4)} to propose in reecritures.json, based on:`);
        for (const c of plan.candidats) {
          console.log(`         ${c.cle.padEnd(6)} ${path.join(dossier, "textes", `${c.cle}.txt`)}  citer ainsi : « ${c.citation} »`);
        }
      } else {
        console.log(`  ${r.affirmation.id.padEnd(4)} ${MENTION[e.type]} — ${e.motif}`);
      }
    }
  }
  console.log(`\nSource map: ${path.resolve(html)}`);
}

const [commande, dossier] = process.argv.slice(2);
if (!dossier || (commande !== "preparer" && commande !== "conclure")) {
  console.error("Usage : bun scripts/carte.ts preparer|conclure <dossier> [--date AAAA-MM-JJ] [--titre …]");
  process.exit(2);
}
await (commande === "preparer" ? commandePreparer(dossier) : commandeConclure(dossier));
