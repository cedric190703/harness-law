/**
 * Preuve 1 : mesure de Visa sur le jeu de test français (src/eval/jeu-fr.ts).
 *
 *   bun scripts/eval.ts                      # mesure complète, sur un cache neuf
 *   bun scripts/eval.ts --notes N1,N4        # quelques notes seulement
 *   bun scripts/eval.ts --cache .cache/eval/2026-10-04T15-00-00   # rejoue ou reprend une mesure
 *   bun scripts/eval.ts --sans-relance-piste # Visa tel quel : une panne de Légifrance donne du gris
 *
 * Lance verifierTexte() sur chaque note, une par une, avec sa date des faits ; relie chaque affirmation
 * découpée par Mistral à l'affirmation attendue, puis calcule détection, faux verts, faux rouges,
 * matrice et exactitude par type d'erreur. Écrit src/eval/resultats.json.
 * À lancer depuis app/ (clés Mistral et PISTE dans .env.local).
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { JEU_FR, LIBELLE_TYPE, texteNote, type NoteDeTest, type TypeCas } from "@/eval/jeu-fr";
import {
  calculerMesures,
  rattacher,
  statutRattache,
  STATUTS,
  STATUTS_OBTENUS,
  type Ligne,
  type Taux,
} from "@/eval/mesure";
import { empreinte } from "@/lib/cache";
import { MODELE_EXTRACTION, MODELE_JUGE } from "@/lib/mistral";
import { verifierTexte } from "@/lib/moteur";
import type { Evenement, ResultatAffirmation, Statut } from "@/lib/types";
import { normaliser } from "@/lib/verbatim";

/** Prix publics Mistral Large (mistral.ai/pricing, 4 octobre 2026), en dollars par million de jetons. */
const PRIX_PAR_MILLION = { entree: 0.5, sortie: 1.5 };
/** Limite de Mistral Large sur cette clé : 15 requêtes par minute. On espace les appels. */
const INTERVALLE_MS = Number(process.env.EVAL_INTERVALLE_MS ?? 4500);

function option(nom: string): string | null {
  const i = process.argv.indexOf(nom);
  return i > 0 ? (process.argv[i + 1] ?? null) : null;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cache : neuf à chaque mesure (rien n'est rejoué), sauf si --cache est donné.
const horodatage = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
const dossierCache = path.resolve(option("--cache") ?? path.join(".cache", "eval", horodatage));
process.env.VISA_CACHE_DIR = dossierCache;

// Appels Mistral : espacés, relancés sur 429, et comptés (jetons réels renvoyés par l'API).
const consommation = { appels: 0, entree: 0, sortie: 0, refus429: 0, modeles: new Set<string>() };
// Bac à sable PISTE : pannes passagères relancées (sauf --sans-relance-piste, pour mesurer Visa tel quel).
const RELANCE_PISTE = !process.argv.includes("--sans-relance-piste");
const pannesPiste: string[] = [];
const fetchOriginal = globalThis.fetch;
let prochainCreneau = 0;

async function appelPiste(url: string, entree: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
  for (let essai = 0; ; essai++) {
    try {
      // Nouveau délai à chaque essai : celui de piste.ts a pu expirer.
      const res = await fetchOriginal(entree, essai === 0 ? init : { ...init, signal: AbortSignal.timeout(20_000) });
      if ((res.status === 429 || res.status >= 500) && RELANCE_PISTE && essai < 3) {
        pannesPiste.push(`${res.status} ${url.replace(/\?.*/, "")}`);
        await dormir(3000 * (essai + 1));
        continue;
      }
      return res;
    } catch (e) {
      pannesPiste.push(`${String(e).slice(0, 80)} ${url.replace(/\?.*/, "")}`);
      if (!RELANCE_PISTE || essai >= 3) throw e;
      await dormir(3000 * (essai + 1));
    }
  }
}

globalThis.fetch = Object.assign(
  async (entree: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
    if (url.includes("piste.gouv.fr")) return appelPiste(url, entree, init);
    if (!url.startsWith("https://api.mistral.ai/")) return fetchOriginal(entree, init);
    for (let essai = 0; ; essai++) {
      const creneau = Math.max(Date.now(), prochainCreneau);
      prochainCreneau = creneau + INTERVALLE_MS;
      await dormir(creneau - Date.now());
      const res = await fetchOriginal(entree, init);
      if (res.status === 429 && essai < 6) {
        consommation.refus429++;
        await dormir(10_000 * (essai + 1));
        continue;
      }
      if (res.ok) {
        const d = (await res.clone().json()) as { model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        consommation.appels++;
        consommation.entree += d.usage?.prompt_tokens ?? 0;
        consommation.sortie += d.usage?.completion_tokens ?? 0;
        if (d.model) consommation.modeles.add(d.model);
      }
      return res;
    }
  },
  { preconnect: fetchOriginal.preconnect },
) as typeof fetch;

interface Obtenue {
  id: string;
  passage: string;
  statut: Statut;
  message: string;
  sources: {
    citee: string;
    type: string;
    trouvee: string | null;
    controles: string[];
    verdict: string | null;
    extraitRetrouve: boolean | null;
    extrait: string | null;
  }[];
}

function resumerResultat(noteId: string, r: ResultatAffirmation): Obtenue {
  return {
    id: `${noteId}/${r.affirmation.id}`,
    passage: r.affirmation.passage,
    statut: r.statut,
    message: r.message,
    sources: r.verifications.map((v) => ({
      citee: v.citee.brut,
      type: v.citee.type,
      trouvee: v.officielle?.titre ?? null,
      controles: v.controles.map((c) => `${c.nom} ${c.statut} : ${c.message}`),
      verdict: v.jugement?.verdict ?? null,
      extraitRetrouve: v.jugement ? v.jugement.extraitRetrouve : null,
      extrait: v.jugement?.extrait ?? null,
    })),
  };
}

/** Ce qui a fait dévier Visa sur une affirmation, pour le rapport (heuristique, à relire). */
function cause(attendu: Statut, obtenu: Statut | "absent", morceaux: Obtenue[], source: string | null): string {
  if (obtenu === "absent") return "extraction : affirmation non découpée par Mistral";
  const sourcees = morceaux.filter((m) => m.sources.length > 0);
  if (source && sourcees.length === 0) return "extraction : source citée non rattachée à l'affirmation";
  const v = sourcees.flatMap((m) => m.sources);
  if (v.some((s) => s.controles.some((c) => c.startsWith("existe gris") && c.includes("incomplète"))))
    return "extraction : référence mal découpée (non identifiable)";
  if (v.some((s) => s.controles.some((c) => c.startsWith("existe gris") && c.includes("injoignable"))))
    return "recherche : base officielle injoignable";
  if (attendu !== "rouge" && v.some((s) => s.controles.some((c) => c.startsWith("existe rouge"))))
    return "recherche : source réelle non retrouvée";
  if (v.some((s) => s.verdict && s.extraitRetrouve === false)) return "juge : extrait non retrouvé mot pour mot (verdict écarté)";
  if (v.some((s) => s.verdict)) return `juge : verdict ${v.map((s) => s.verdict).filter(Boolean).join(", ")}`;
  return "règles : contrôle d'existence, de date ou de rang";
}

/** Levée pour arrêter verifierTexte une fois la première vérification terminée. */
class FinDeVerification extends Error {}

/**
 * Vérifie une note et garde la première vérification de chaque affirmation.
 * La boucle de correction (le rédacteur réécrit puis Visa revérifie) n'est pas mesurée ici : on l'arrête avant.
 */
async function verifierNote(note: NoteDeTest): Promise<{ resultats: ResultatAffirmation[]; journal: string[] }> {
  for (let essai = 1; ; essai++) {
    const resultats: ResultatAffirmation[] = [];
    const journal: string[] = [];
    let attendues = -1;
    const emettre = (e: Evenement) => {
      if (e.type === "affirmations") attendues = e.affirmations.length;
      if (e.type === "resultat" && !resultats.some((r) => r.affirmation.id === e.resultat.affirmation.id)) {
        resultats.push(e.resultat);
      }
      if (e.type === "journal") journal.push(`${e.entree.acteur} · ${e.entree.action}${e.entree.detail ? ` — ${e.entree.detail}` : ""}`);
      const correction = e.type === "boucle" || (e.type === "journal" && String(e.entree.acteur) === "Rédacteur");
      if (correction && resultats.length === attendues) throw new FinDeVerification();
    };
    try {
      await verifierTexte(texteNote(note), note.dateFaits, [], emettre);
      return { resultats, journal };
    } catch (e) {
      if (e instanceof FinDeVerification) return { resultats, journal };
      if (essai >= 3) throw e;
      console.log(`   erreur (${String(e).slice(0, 160)}), nouvel essai dans 30 s…`);
      await dormir(30_000);
    }
  }
}

const pct = (t: Taux) => (t.taux === null ? "—" : `${Math.round(t.taux * 100)} % (${t.n}/${t.sur})`);

async function main() {
  const filtre = option("--notes")?.split(",");
  const notes = JEU_FR.filter((n) => !filtre || filtre.includes(n.id));
  const debut = Date.now();
  // Empreinte du code mesuré, prise au lancement : plusieurs personnes modifient Visa en même temps.
  const codeMesure = Object.fromEntries(
    await Promise.all(
      ["moteur", "controles", "sources", "mistral", "piste", "verbatim"].map(async (f) => [
        f,
        empreinte(await readFile(path.join(process.cwd(), `src/lib/${f}.ts`), "utf8")).slice(0, 12),
      ]),
    ),
  );
  console.log(`Mesure Visa — ${notes.length} notes, extraction ${MODELE_EXTRACTION}, juge ${MODELE_JUGE}`);
  console.log(`Cache : ${dossierCache}`);

  const lignes: (Ligne & {
    note: string;
    passage: string;
    raison: string;
    obtenus: string[];
    cause: string | null;
  })[] = [];
  const enTrop: Obtenue[] = [];
  const parNote: { id: string; dateFaits: string; secondes: number; affirmationsObtenues: number; incidents: string[] }[] = [];
  const detailObtenues: Obtenue[] = [];

  for (const note of notes) {
    const t0 = Date.now();
    process.stdout.write(`\n${note.id} (${note.cas.length} attendues, faits du ${note.dateFaits})… `);
    const { resultats, journal } = await verifierNote(note);
    const obtenues = resultats.map((r) => resumerResultat(note.id, r));
    detailObtenues.push(...obtenues);
    const secondes = Math.round((Date.now() - t0) / 1000);
    // Pannes des bases officielles (Visa met alors en gris) : gardées pour le rapport.
    const incidents = journal.filter((j) => /erreur/i.test(j));
    parNote.push({ id: note.id, dateFaits: note.dateFaits, secondes, affirmationsObtenues: obtenues.length, incidents });
    console.log(`${obtenues.length} affirmations découpées, ${secondes} s`);

    const { liens, enTrop: horsJeu } = rattacher(note.cas, obtenues);
    enTrop.push(...obtenues.filter((o) => horsJeu.includes(o.id)));
    for (const c of note.cas) {
      const morceaux = obtenues.filter((o) => liens.get(c.id)?.includes(o.id));
      const obtenu = statutRattache(morceaux.map((m) => ({ statut: m.statut, nbSources: m.sources.length })));
      const ok = obtenu === c.attendu;
      lignes.push({
        id: c.id,
        note: note.id,
        type: c.type,
        attendu: c.attendu,
        obtenu,
        passage: c.passage,
        raison: c.raison,
        obtenus: morceaux.map((m) => m.id),
        cause: ok ? null : cause(c.attendu, obtenu, morceaux, c.source?.brut ?? null),
      });
      console.log(`   ${ok ? "✓" : "✗"} ${c.id} attendu ${c.attendu.padEnd(6)} obtenu ${obtenu}${ok ? "" : `  ← ${lignes.at(-1)?.cause}`}`);
    }
  }

  const mesures = calculerMesures(lignes);
  const duree = Math.round((Date.now() - debut) / 1000);
  const cout =
    (consommation.entree * PRIX_PAR_MILLION.entree + consommation.sortie * PRIX_PAR_MILLION.sortie) / 1_000_000;

  console.log(`\n=== Résultat sur ${mesures.total} affirmations (${JSON.stringify(mesures.parEtiquette)}) ===`);
  console.log(`Détection des fausses (pas en vert)   : ${pct(mesures.detection)}`);
  console.log(`  dont rouge ou orange                : ${pct(mesures.detectionStricte)}`);
  console.log(`Faux verts parmi les fausses          : ${pct(mesures.fauxVertsSurFausses)}`);
  console.log(`Faux verts (rouge, orange, gris attendus) : ${pct(mesures.fauxVerts)}`);
  console.log(`Faux rouges parmi les justes          : ${pct(mesures.fauxRouges)}`);
  console.log(`Justes confirmées en vert             : ${pct(mesures.vertsConfirmes)}`);
  console.log(`Exactitude (statut identique)         : ${pct(mesures.exactitude)}`);
  console.log(`Non découpées par Mistral             : ${pct(mesures.absentes)}`);
  console.log(`\nMatrice (lignes = attendu, colonnes = obtenu) :`);
  console.log(`         ${STATUTS_OBTENUS.map((s) => s.padStart(7)).join("")}`);
  for (const a of STATUTS) console.log(`  ${a.padEnd(7)}${STATUTS_OBTENUS.map((o) => String(mesures.matrice[a][o]).padStart(7)).join("")}`);
  console.log(`\nPar type :`);
  for (const [t, v] of Object.entries(mesures.parType)) {
    console.log(
      `  ${LIBELLE_TYPE[t as TypeCas].padEnd(40)} ${v.exactes}/${v.n} exactes · ${v.signalees} signalées · ${v.fauxVerts} faux verts · ${v.fauxRouges} faux rouges`,
    );
  }
  console.log(`\n${enTrop.length} affirmations découpées hors jeu (faits, transitions) ; ${consommation.appels} appels Mistral, ${consommation.entree} + ${consommation.sortie} jetons, ~${cout.toFixed(3)} $, ${duree} s, ${consommation.refus429} refus 429, ${pannesPiste.length} pannes PISTE${RELANCE_PISTE ? " relancées" : ""}.`);

  const fichier = path.join(process.cwd(), "src/eval/resultats.json");
  await writeFile(
    fichier,
    `${JSON.stringify(
      {
        date: new Date().toISOString(),
        notes: parNote,
        modeles: {
          extraction: MODELE_EXTRACTION,
          juge: MODELE_JUGE,
          reponduPar: [...consommation.modeles],
        },
        codeMesure,
        cacheNeuf: !option("--cache"),
        relancePiste: RELANCE_PISTE,
        pannesPiste,
        dureeSecondes: duree,
        consommation: {
          appels: consommation.appels,
          jetonsEntree: consommation.entree,
          jetonsSortie: consommation.sortie,
          refus429: consommation.refus429,
          coutDollars: Number(cout.toFixed(4)),
          prixParMillion: PRIX_PAR_MILLION,
        },
        mesures,
        lignes: lignes.map((l) => ({
          ...l,
          detail: detailObtenues.filter((o) => l.obtenus.includes(o.id)),
        })),
        horsJeu: enTrop.map((o) => ({ id: o.id, passage: o.passage, statut: o.statut, message: o.message })),
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Écrit : ${path.relative(process.cwd(), fichier)}`);
  // Les passages obtenus doivent être des copies exactes : on signale ceux qui n'en sont pas.
  const texteDe = new Map(notes.map((n) => [n.id, normaliser(texteNote(n))]));
  const nonCopies = detailObtenues.filter((o) => !texteDe.get(o.id.split("/")[0])?.includes(normaliser(o.passage)));
  if (nonCopies.length) console.log(`${nonCopies.length} passages découpés ne sont pas des copies exactes du texte.`);
}

await main();
