/**
 * Preuve ContractNLI : Saul contre le modèle seul, sur un benchmark public de contrats.
 *
 *   bun scripts/contractnli.ts                            # les 150 paires (reprend là où il s'est arrêté)
 *   bun scripts/contractnli.ts --limite 6                 # les 6 premières paires de l'échantillon
 *   bun scripts/contractnli.ts --modele mistral-medium-3.5
 *   bun scripts/contractnli.ts --donnees ~/lab-claude-code/contractnli/contract-nli/test.json
 *
 * Jeu : ContractNLI (Koreeda et Manning, Findings of EMNLP 2021, CC BY 4.0),
 * https://stanfordnlp.github.io/contract-nli/ — 607 accords de confidentialité, 17 hypothèses.
 * Échantillon du split de test fixé par la graine 20261004 : 50 Entailment, 50 Contradiction, 50 NotMentioned.
 *
 * Pour chaque paire (contrat, hypothèse), deux appels au même modèle Mistral, le contrat entier :
 *   A, modèle seul : « le contrat implique-t-il, contredit-il, ne mentionne-t-il pas l'hypothèse ? »
 *   B, Saul : le prompt de l'avocat adverse (PROMPT_JUGE), l'hypothèse comme affirmation et le contrat
 *      comme texte officiel, puis le garde-fou mot pour mot (jugementVerifie).
 * Les appels sont séquentiels, espacés, relancés sur 429 et gardés en cache (.cache/contractnli) :
 * relancer le script reprend après une coupure. Écrit src/eval/contractnli-resultats.json.
 * À lancer depuis app/ (clé Mistral dans .env.local).
 */
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  contientParMorceaux,
  echantillonner,
  labelDeSaul,
  labelDuModele,
  LABELS,
  localiserExtrait,
  mesurerNli,
  PREDICTIONS,
  qualitePreuve,
  synthetiserQualite,
  type Label,
  type MesuresNli,
  type Paire,
  type Prediction,
  type QualitePreuve,
} from "@/eval/contractnli";
import type { Taux } from "@/eval/mesure";
import { avecCache } from "@/lib/cache";
import { jugementVerifie } from "@/lib/controles";
import { PROMPT_JUGE } from "@/lib/moteur";
import type { Jugement } from "@/lib/types";

function option(nom: string): string | null {
  const i = process.argv.indexOf(nom);
  return i > 0 ? (process.argv[i + 1] ?? null) : null;
}

const GRAINE = 20261004;
const PAR_LABEL = 50;
const MODELE = option("--modele") ?? process.env.CONTRACTNLI_MODELE ?? "mistral-large-latest";
const DONNEES = path.resolve(
  (option("--donnees") ?? path.join(os.homedir(), "lab-claude-code/contractnli/contract-nli/test.json")).replace(
    /^~(?=\/)/,
    os.homedir(),
  ),
);
const LIMITE = Number(option("--limite") ?? 3 * PAR_LABEL);
/** Mistral Large sur cette clé : 15 requêtes par minute, partagées avec les autres mesures. */
const INTERVALLE_MS = Number(process.env.CONTRACTNLI_INTERVALLE_MS ?? (MODELE.startsWith("mistral-large") ? 4500 : 300));
/** Prix publics Mistral Large (mistral.ai/pricing, 4 octobre 2026), en dollars par million de jetons. */
const PRIX_PAR_MILLION: Record<string, { entree: number; sortie: number }> = {
  "mistral-large-latest": { entree: 0.5, sortie: 1.5 },
};

process.env.SAUL_CACHE_DIR = path.resolve(".cache/contractnli");

const PROMPT_MODELE_SEUL = `Tu lis un contrat (un accord de confidentialité) et une hypothèse.
Question : le contrat implique-t-il l'hypothèse, la contredit-il, ou ne la mentionne-t-il pas ?
- "Entailment" : le contrat implique l'hypothèse.
- "Contradiction" : le contrat contredit l'hypothèse.
- "NotMentioned" : le contrat ne mentionne pas ce dont parle l'hypothèse.
Réponds en JSON : {"label": "Entailment" | "Contradiction" | "NotMentioned"}`;

interface DocumentNli {
  id: number;
  file_name: string;
  text: string;
  spans: [number, number][];
  annotation_sets: { annotations: Record<string, { choice: Label; spans: number[] }> }[];
}

interface JeuNli {
  documents: DocumentNli[];
  labels: Record<string, { short_description: string; hypothesis: string }>;
}

interface Message {
  role: "system" | "user";
  content: string;
}

interface Reponse {
  contenu: string;
  modele: string;
  entree: number;
  sortie: number;
  ms: number;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const incidents = { refus429: 0, erreurs5xx: 0, reseau: 0 };
let prochainCreneau = 0;

/** Un appel réseau, espacé des autres, relancé sur 429, 5xx et coupure réseau. */
async function appelReseau(messages: Message[]): Promise<Reponse> {
  for (let essai = 0; ; essai++) {
    const creneau = Math.max(Date.now(), prochainCreneau);
    prochainCreneau = creneau + INTERVALLE_MS;
    await dormir(creneau - Date.now());
    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODELE, messages, temperature: 0, response_format: { type: "json_object" } }),
        signal: AbortSignal.timeout(180_000),
      });
    } catch (e) {
      incidents.reseau++;
      if (essai >= 5) throw e;
      await dormir(5_000 * (essai + 1));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (res.status === 429) incidents.refus429++;
      else incidents.erreurs5xx++;
      await res.text().catch(() => "");
      if (essai >= 8) throw new Error(`Mistral ${res.status} après ${essai + 1} essais`);
      const attente = Number(res.headers.get("retry-after")) * 1000 || 15_000 * (essai + 1);
      await dormir(Math.min(attente, 90_000));
      continue;
    }
    if (!res.ok) throw new Error(`Mistral ${res.status} : ${(await res.text()).slice(0, 300)}`);
    const d = (await res.json()) as {
      model?: string;
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      contenu: d.choices[0].message.content,
      modele: d.model ?? MODELE,
      entree: d.usage?.prompt_tokens ?? 0,
      sortie: d.usage?.completion_tokens ?? 0,
      ms: Date.now() - t0,
    };
  }
}

/** Avec cache disque : une paire déjà jugée est rejouée telle quelle (reprise après coupure). */
async function appeler(messages: Message[]): Promise<Reponse & { depuisCache: boolean }> {
  const { valeur, depuisCache } = await avecCache("appels", { modele: MODELE, messages, temperature: 0 }, () =>
    appelReseau(messages),
  );
  return { ...valeur, depuisCache };
}

function lireJson(contenu: string): unknown {
  try {
    return JSON.parse(contenu);
  } catch {
    return null;
  }
}

interface ResultatPaire extends Paire {
  fichier: string;
  intitule: string;
  texteHypothese: string;
  longueurContrat: number;
  preuveOfficielle: string[];
  A: { label: Prediction; reponse: string };
  B: {
    label: Prediction;
    /** Ce que Saul aurait dit sans le garde-fou mot pour mot. */
    labelSansGardeFou: Prediction;
    /** Analyse : l'extrait passe-t-il si l'on accepte une citation coupée par « [...] », chaque morceau mot pour mot ? */
    extraitParMorceaux: boolean;
    labelGardeFouParMorceaux: Prediction;
    verdict: string | null;
    extrait: string;
    extraitRetrouve: boolean;
    raisonnement: string[];
    correction: string;
    qualite: QualitePreuve | null;
  };
}

const tronquer = (t: string, n: number) => (t.length > n ? `${t.slice(0, n)}…` : t);

async function jugerPaire(doc: DocumentNli, jeu: JeuNli, p: Paire, compter: (r: Reponse & { depuisCache: boolean }) => void) {
  const annotation = doc.annotation_sets[0].annotations[p.hypothese];
  const hypothese = jeu.labels[p.hypothese].hypothesis;

  const a = await appeler([
    { role: "system", content: PROMPT_MODELE_SEUL },
    { role: "user", content: `HYPOTHÈSE : ${hypothese}\n\nCONTRAT (« ${doc.file_name} », texte intégral) :\n${doc.text}` },
  ]);
  compter(a);

  const b = await appeler([
    { role: "system", content: PROMPT_JUGE },
    {
      role: "user",
      content: `AFFIRMATION : ${hypothese}\nRÉSUMÉ : ${hypothese}\nSOURCE CITÉE : l'accord de confidentialité « ${doc.file_name} »\n\nTEXTE OFFICIEL (accord de confidentialité « ${doc.file_name} », texte intégral) :\n${doc.text}`,
    },
  ]);
  compter(b);

  const brut = lireJson(b.contenu) as Partial<Omit<Jugement, "extraitRetrouve">> | null;
  const jugement = brut
    ? jugementVerifie(
        {
          verdict: brut.verdict as Jugement["verdict"],
          raisonnement: Array.isArray(brut.raisonnement) ? brut.raisonnement.map(String) : [],
          extrait: typeof brut.extrait === "string" ? brut.extrait : "",
          correction: typeof brut.correction === "string" ? brut.correction : "",
        },
        doc.text,
      )
    : null;

  const resultat: ResultatPaire = {
    ...p,
    fichier: doc.file_name,
    intitule: jeu.labels[p.hypothese].short_description,
    texteHypothese: hypothese,
    longueurContrat: doc.text.length,
    preuveOfficielle: annotation.spans.map((k) => tronquer(doc.text.slice(...doc.spans[k]).trim(), 500)),
    A: { label: labelDuModele(lireJson(a.contenu)), reponse: tronquer(a.contenu, 300) },
    B: {
      label: jugement ? labelDeSaul(jugement) : "invalide",
      labelSansGardeFou: jugement ? labelDeSaul({ ...jugement, extraitRetrouve: true }) : "invalide",
      extraitParMorceaux: jugement ? contientParMorceaux(doc.text, jugement.extrait) : false,
      labelGardeFouParMorceaux: jugement
        ? labelDeSaul({ ...jugement, extraitRetrouve: contientParMorceaux(doc.text, jugement.extrait) })
        : "invalide",
      verdict: jugement?.verdict ?? null,
      extrait: jugement?.extrait ?? "",
      extraitRetrouve: jugement?.extraitRetrouve ?? false,
      raisonnement: jugement?.raisonnement ?? [],
      correction: jugement?.correction ?? "",
      qualite:
        jugement?.extraitRetrouve && annotation.spans.length
          ? qualitePreuve(doc.spans, annotation.spans, localiserExtrait(doc.text, jugement.extrait))
          : null,
    },
  };
  return resultat;
}

const pct = (t: Taux) => (t.taux === null ? "—" : `${(t.taux * 100).toFixed(1)} % (${t.n}/${t.sur})`);
const nb = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1)} %`);

function afficher(nom: string, m: MesuresNli) {
  console.log(`\n${nom}`);
  console.log(`  exactitude ${pct(m.exactitude)} · F1 macro ${m.f1Macro.toFixed(3)} · F1(E) ${m.parLabel.Entailment.f1.toFixed(3)} · F1(C) ${m.parLabel.Contradiction.f1.toFixed(3)} · F1(N) ${m.parLabel.NotMentioned.f1.toFixed(3)}`);
  console.log(`  faux verts ${pct(m.fauxVerts)} (sur Contradiction ${pct(m.fauxVertsSurContradiction)}, sur NotMentioned ${pct(m.fauxVertsSurNonMentionne)})`);
  console.log(`  fiabilité des verts (précision Entailment) ${nb(m.parLabel.Entailment.precision)}`);
  console.log(`  verts confirmés ${pct(m.vertsConfirmes)} · gris ${pct(m.gris)} · invalides ${pct(m.invalides)} · exactitude hors gris ${pct(m.exactitudeHorsGris)}`);
  console.log(`  matrice (lignes = attendu) : ${PREDICTIONS.map((p) => p.slice(0, 13).padStart(14)).join("")}`);
  for (const a of LABELS) console.log(`  ${a.padEnd(27)}${PREDICTIONS.map((p) => String(m.matrice[a][p]).padStart(14)).join("")}`);
}

async function main() {
  if (!process.env.MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY manquante dans app/.env.local");
  let jeu: JeuNli;
  try {
    jeu = JSON.parse(await readFile(DONNEES, "utf8")) as JeuNli;
  } catch {
    throw new Error(
      `Jeu introuvable : ${DONNEES}. Télécharger https://stanfordnlp.github.io/contract-nli/resources/contract-nli.zip et le dézipper dans ~/lab-claude-code/contractnli/.`,
    );
  }
  const documents = new Map(jeu.documents.map((d) => [d.id, d]));
  const toutes: Paire[] = jeu.documents.flatMap((d) =>
    Object.entries(d.annotation_sets[0].annotations).map(([cle, a]) => ({
      id: `${d.id}:${cle}`,
      document: d.id,
      hypothese: cle,
      attendu: a.choice,
    })),
  );
  const echantillon = echantillonner(toutes, GRAINE, PAR_LABEL);
  const aJuger = echantillon.slice(0, LIMITE);
  console.log(
    `ContractNLI test : ${jeu.documents.length} contrats, ${toutes.length} paires. Échantillon (graine ${GRAINE}) : ${echantillon.length}, jugées ici : ${aJuger.length}. Modèle ${MODELE}.`,
  );
  console.log(`Cache : ${process.env.SAUL_CACHE_DIR}`);

  const debut = Date.now();
  const conso = { appels: 0, depuisCache: 0, entree: 0, sortie: 0, msReseau: 0, modeles: new Set<string>() };
  const compter = (r: Reponse & { depuisCache: boolean }) => {
    conso.appels++;
    if (r.depuisCache) conso.depuisCache++;
    conso.entree += r.entree;
    conso.sortie += r.sortie;
    conso.msReseau += r.ms;
    conso.modeles.add(r.modele);
  };

  const resultats: ResultatPaire[] = [];
  const erreurs: { id: string; erreur: string }[] = [];
  for (const [k, p] of aJuger.entries()) {
    const doc = documents.get(p.document);
    if (!doc) throw new Error(`Document ${p.document} absent du jeu`);
    try {
      const r = await jugerPaire(doc, jeu, p, compter);
      resultats.push(r);
      const ok = (x: Prediction) => (x === p.attendu ? "✓" : "✗");
      console.log(
        `[${String(k + 1).padStart(3)}/${aJuger.length}] ${p.id.padEnd(12)} ${p.attendu.padEnd(13)} A ${ok(r.A.label)} ${r.A.label.padEnd(13)} B ${ok(r.B.label)} ${r.B.label.padEnd(13)} (${r.B.verdict ?? "?"}${r.B.extraitRetrouve ? ", extrait ✓" : ", extrait introuvable"}${r.B.qualite ? `, recoupe ${r.B.qualite.recoupe ? "oui" : "non"}` : ""})`,
      );
    } catch (e) {
      erreurs.push({ id: p.id, erreur: String(e).slice(0, 300) });
      console.log(`[${k + 1}/${aJuger.length}] ${p.id} ERREUR ${String(e).slice(0, 200)}`);
    }
  }

  const mesuresA = mesurerNli(resultats.map((r) => ({ attendu: r.attendu, predit: r.A.label })));
  const mesuresB = mesurerNli(resultats.map((r) => ({ attendu: r.attendu, predit: r.B.label })));
  const mesuresBSansGardeFou = mesurerNli(resultats.map((r) => ({ attendu: r.attendu, predit: r.B.labelSansGardeFou })));
  const mesuresBParMorceaux = mesurerNli(
    resultats.map((r) => ({ attendu: r.attendu, predit: r.B.labelGardeFouParMorceaux })),
  );
  const avecPreuve = resultats.filter((r) => r.attendu !== "NotMentioned");
  const qualites = avecPreuve.flatMap((r) => (r.B.qualite ? [r.B.qualite] : []));
  const qualitesJustes = avecPreuve.flatMap((r) => (r.B.qualite && r.B.label === r.attendu ? [r.B.qualite] : []));
  const verdictsBruts = Object.fromEntries(
    LABELS.map((a) => {
      const compte: Record<string, number> = {};
      for (const r of resultats.filter((x) => x.attendu === a)) {
        const cle = `${r.B.verdict ?? "illisible"}${r.B.extraitRetrouve ? "" : " (extrait introuvable)"}`;
        compte[cle] = (compte[cle] ?? 0) + 1;
      }
      return [a, compte];
    }),
  );
  const causesGris: Record<string, number> = {};
  for (const r of resultats.filter((x) => x.B.label === "gris")) {
    const cause = !r.B.extrait.trim()
      ? "extrait vide"
      : /\[\s*(?:\.{3}|…)\s*\]|…|\.{3}/.test(r.B.extrait)
        ? "citation coupée par [...]"
        : "mots modifiés ou omis";
    causesGris[cause] = (causesGris[cause] ?? 0) + 1;
  }
  const partiels = resultats.filter((r) => r.B.verdict === "PARTIEL" && r.B.extraitRetrouve);
  const fauxVertsEvites = resultats.filter(
    (r) => r.attendu !== "Entailment" && r.B.verdict === "SOUTIENT" && !r.B.extraitRetrouve,
  );
  const vraisVertsPerdus = resultats.filter(
    (r) => r.attendu === "Entailment" && r.B.verdict === "SOUTIENT" && !r.B.extraitRetrouve,
  );

  const duree = Math.round((Date.now() - debut) / 1000);
  const prix = PRIX_PAR_MILLION[MODELE] ?? null;
  const cout = prix ? (conso.entree * prix.entree + conso.sortie * prix.sortie) / 1_000_000 : null;

  console.log(`\n=== ContractNLI, ${resultats.length} paires, modèle ${MODELE} (répondu par ${[...conso.modeles].join(", ")}) ===`);
  afficher("A — modèle seul", mesuresA);
  afficher("B — Saul (avocat adverse + garde-fou mot pour mot)", mesuresB);
  afficher("B sans le garde-fou (même verdicts, extrait non vérifié)", mesuresBSansGardeFou);
  afficher("B, garde-fou tolérant aux citations coupées par [...] (analyse)", mesuresBParMorceaux);
  const sq = synthetiserQualite(qualites);
  console.log(
    `\nQualité des preuves de Saul (Entailment et Contradiction, extrait retrouvé : ${sq.n}/${avecPreuve.length}) : recoupe un passage officiel ${pct(sq.recoupe)} · précision en caractères ${nb(sq.precisionCaracteresMoyenne)} · précision en passages ${nb(sq.precisionPassagesMoyenne)} · rappel en passages ${nb(sq.rappelPassagesMoyen)}`,
  );
  console.log(`Causes des gris : ${JSON.stringify(causesGris)}`);
  console.log(`PARTIEL retenus : ${partiels.length} (attendu : ${partiels.map((r) => r.attendu).join(", ") || "—"})`);
  console.log(`Faux verts évités par le garde-fou : ${fauxVertsEvites.length} · vrais verts perdus par le garde-fou : ${vraisVertsPerdus.length}`);
  console.log(`Verdicts bruts par étiquette attendue : ${JSON.stringify(verdictsBruts)}`);
  console.log(
    `${conso.appels} appels (${conso.depuisCache} depuis le cache), ${conso.entree} + ${conso.sortie} jetons, ${cout === null ? "prix inconnu" : `~${cout.toFixed(3)} $`}, latence cumulée ${Math.round(conso.msReseau / 1000)} s, ce passage ${duree} s, ${incidents.refus429} refus 429, ${erreurs.length} erreurs.`,
  );

  const complet = resultats.length === 3 * PAR_LABEL && erreurs.length === 0;
  const fichier = complet
    ? path.join(process.cwd(), "src/eval/contractnli-resultats.json")
    : path.join(process.env.SAUL_CACHE_DIR!, "resultats-partiels.json");
  await writeFile(
    fichier,
    `${JSON.stringify(
      {
        date: new Date().toISOString(),
        jeu: {
          nom: "ContractNLI",
          reference: "Koreeda et Manning, « ContractNLI: A Dataset for Document-level Natural Language Inference for Contracts », Findings of EMNLP 2021",
          url: "https://stanfordnlp.github.io/contract-nli/",
          licence: "CC BY 4.0",
          split: "test",
          documents: jeu.documents.length,
          paires: toutes.length,
        },
        echantillon: { graine: GRAINE, parLabel: PAR_LABEL, n: resultats.length, ids: echantillon.map((p) => p.id) },
        modele: { demande: MODELE, reponduPar: [...conso.modeles] },
        conditions: {
          A: { nom: "modèle seul", prompt: PROMPT_MODELE_SEUL },
          B: {
            nom: "Saul : avocat adverse (PROMPT_JUGE de src/lib/moteur.ts, inchangé) + garde-fou mot pour mot (jugementVerifie)",
            correspondance: {
              SOUTIENT: "Entailment",
              NE_SOUTIENT_PAS: "Contradiction",
              PARTIEL: "Contradiction",
              HORS_SUJET: "NotMentioned",
              "extrait introuvable": "gris",
            },
          },
          contrat: "texte intégral pour les deux conditions (l'app Saul coupe à 15 000 caractères)",
        },
        /** Durée de ce passage seulement : un passage rejoué depuis le cache est presque instantané. */
        dureeCePassageSecondes: duree,
        consommation: {
          appels: conso.appels,
          depuisCache: conso.depuisCache,
          jetonsEntree: conso.entree,
          jetonsSortie: conso.sortie,
          latenceCumuleeSecondes: Math.round(conso.msReseau / 1000),
          coutDollars: cout === null ? null : Number(cout.toFixed(4)),
          prixParMillion: prix,
          ...incidents,
        },
        mesures: {
          A: mesuresA,
          B: mesuresB,
          BSansGardeFou: mesuresBSansGardeFou,
          BGardeFouParMorceaux: mesuresBParMorceaux,
          qualitePreuvesB: { toutes: sq, verdictsJustes: synthetiserQualite(qualitesJustes) },
          verdictsBrutsB: verdictsBruts,
          causesGris,
          partielsRetenus: partiels.map((r) => ({ id: r.id, attendu: r.attendu })),
          fauxVertsEvitesParLeGardeFou: fauxVertsEvites.map((r) => r.id),
          vraisVertsPerdusParLeGardeFou: vraisVertsPerdus.map((r) => r.id),
          contratsDePlusDe15000Caracteres: resultats.filter((r) => r.longueurContrat > 15000).length,
        },
        erreurs,
        paires: resultats,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Écrit : ${path.relative(process.cwd(), fichier)}`);
}

await main();
