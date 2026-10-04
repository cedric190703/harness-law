/**
 * Skill « vérifier les sources » (.claude/skills/verifier-sources) : la partie mécanique.
 *
 *   bun scripts/carte.ts preparer <dossier> [--date AAAA-MM-JJ] [--titre "…"]
 *   bun scripts/carte.ts conclure <dossier>
 *
 * À lancer depuis app/ : Bun y lit .env.local (clés PISTE) et le cache des sources.
 * Le dossier contient reponse.txt, affirmations.json, et éventuellement pieces/*.txt.
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
    "Réponse vérifiée";

  const { preparation, erreurs } = await preparer(reponse, decoupage, {
    titre,
    dateSaisie: option("--date"),
    pieces,
  });
  if (!preparation) {
    console.error("À corriger dans affirmations.json avant de continuer :");
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
        `ÉLÉMENT ${e.id} — à juger par l'avocat adverse`,
        `AFFIRMATION : ${a?.passage ?? ""}`,
        `RÉSUMÉ : ${a?.resume ?? ""}`,
        `SOURCE CITÉE : ${e.citee.brut}`,
        `DATE DES FAITS : ${preparation.dateFaits}`,
        `TEXTE OFFICIEL : ${e.officielle?.titre ?? ""}${v ? ` (version en vigueur du ${v.debut ?? "?"} au ${v.fin ?? "aujourd'hui"})` : ""}`,
        "----- début du texte officiel -----",
        e.texteAJuger,
        "----- fin du texte officiel -----",
        "",
      ].join("\n"),
    );
  }

  const origine = { saisie: "saisie", texte: "trouvée dans le texte", "aujourd'hui": "INCONNUE : date du jour" };
  console.log(`Date des faits : ${preparation.dateFaits} (${origine[preparation.origineDate]})`);
  console.log(
    `${preparation.affirmations.length} affirmations, ${preparation.elements.length} sources citées, ${pieces.length} pièce(s). ` +
      `Bases officielles : ${preparation.basesConnectees ? "connectées" : "NON connectées (tout ce qui vient de Légifrance ou Judilibre restera gris)"}.`,
  );
  console.log(`\nÀ juger (${aJuger.length}) : lis chaque fichier, puis écris ${path.join(dossier, "jugements.json")}`);
  for (const e of aJuger) console.log(`  ${e.id.padEnd(6)} ${path.join(textes, `${e.id}.txt`)}   (${e.officielle?.titre ?? ""})`);
  const tranches = preparation.elements.filter((e) => e.texteAJuger === null);
  if (tranches.length > 0) {
    console.log(`\nDéjà tranchés sans jugement (${tranches.length}) :`);
    for (const e of tranches) {
      const statut = pire(e.controles.map((c) => c.statut));
      const raison = e.controles.find((c) => c.statut === statut)?.message ?? "";
      console.log(`  ${e.id.padEnd(6)} ${PASTILLE[statut]} ${e.citee.brut} — ${raison}`);
    }
  }
  const sansSource = preparation.affirmations.filter((a) => a.sources.length === 0);
  if (sansSource.length > 0) console.log(`\nSans source citée (gris) : ${sansSource.map((a) => a.id).join(", ")}`);
}

async function commandeConclure(dossier: string) {
  const preparation = await lireJson<Preparation>(path.join(dossier, "preparation.json"));
  let jugements: JugementSaisi[] = [];
  try {
    jugements = await lireJson<JugementSaisi[]>(path.join(dossier, "jugements.json"));
  } catch {
    console.warn("Pas de jugements.json : tout ce qui devait être jugé restera gris.");
  }
  const attendus = new Set(preparation.elements.filter((e) => e.texteAJuger !== null).map((e) => e.id));
  const inconnus = jugements.filter((j) => !attendus.has(j.id)).map((j) => j.id);
  if (inconnus.length > 0) console.warn(`Jugements ignorés (aucun élément à juger avec cet identifiant) : ${inconnus.join(", ")}`);
  const manquants = [...attendus].filter((id) => !jugements.some((j) => j.id === id));
  if (manquants.length > 0) console.warn(`Éléments non jugés (restent gris) : ${manquants.join(", ")}`);

  let reecritures: ReecritureSaisie[] = [];
  try {
    reecritures = await lireJson<ReecritureSaisie[]>(path.join(dossier, "reecritures.json"));
  } catch {
    // Facultatif : sans réécriture, les passages à corriger restent « à réécrire à la main ».
  }

  const carte = conclure(preparation, jugements, new Date().toISOString(), reecritures);
  await writeFile(path.join(dossier, "resultat.json"), JSON.stringify(carte, null, 2));
  const html = path.join(dossier, "carte.html");
  await writeFile(html, rendreCarte(carte));

  const s = carte.synthese;
  console.log(
    `${carte.resultats.length} affirmations : ${s.vert} vérifiées, ${s.orange} à revoir, ${s.rouge} fausses, ${s.gris} non vérifiées.`,
  );
  for (const r of carte.resultats) {
    console.log(`  ${r.affirmation.id.padEnd(4)} ${PASTILLE[r.statut]} ${r.statut === "vert" ? r.affirmation.resume : r.message}`);
  }
  const ecartes = carte.resultats.flatMap((r) =>
    r.verifications.filter((v) => v.jugement && !v.jugement.extraitRetrouve).map(() => r.affirmation.id),
  );
  if (ecartes.length > 0) {
    console.log(`\nExtraits introuvables mot pour mot (verdict écarté) : ${ecartes.join(", ")}. Recopie l'extrait exact puis relance.`);
  }

  const aCorriger = carte.resultats.filter((r) => r.reecriture);
  if (aCorriger.length > 0) {
    const proposees = aCorriger.filter((r) => r.reecriture?.type === "remplacer").length;
    console.log(`\nCorrections : ${proposees} réécriture(s) retenue(s) sur ${aCorriger.length} passage(s) à corriger.`);
    for (const r of aCorriger) {
      const e = r.reecriture!;
      const plan = planifier(r, carte.resultats, carte.dateFaits);
      const saisie = reecritures.some((x) => x.id === r.affirmation.id);
      if (e.type === "remplacer") {
        console.log(`  ${r.affirmation.id.padEnd(4)} réécrit — ${e.source?.citation}`);
      } else if (plan?.cas === "rediger" && !saisie) {
        console.log(`  ${r.affirmation.id.padEnd(4)} à proposer dans reecritures.json, sur :`);
        for (const c of plan.candidats) {
          console.log(`         ${c.cle.padEnd(6)} ${path.join(dossier, "textes", `${c.cle}.txt`)}  citer ainsi : « ${c.citation} »`);
        }
      } else {
        console.log(`  ${r.affirmation.id.padEnd(4)} ${MENTION[e.type]} — ${e.motif}`);
      }
    }
  }
  console.log(`\nCarte : ${path.resolve(html)}`);
}

const [commande, dossier] = process.argv.slice(2);
if (!dossier || (commande !== "preparer" && commande !== "conclure")) {
  console.error("Usage : bun scripts/carte.ts preparer|conclure <dossier> [--date AAAA-MM-JJ] [--titre …]");
  process.exit(2);
}
await (commande === "preparer" ? commandePreparer(dossier) : commandeConclure(dossier));
