import { boucler, type Boucle } from "./boucle";
import { empreinte } from "./cache";
import {
  conclureAffirmation,
  controlerContenu,
  controlerDateEtRang,
  jugementVerifie,
  pire,
  rechercherSource,
  texteApplicable,
} from "./controles";
import { MODELE_EXTRACTION, MODELE_JUGE, MODELE_REDACTEUR, mistralJson } from "./mistral";
import { pisteConfigure } from "./piste";
import { corrigerMemo } from "./redacteur";
import type { Piece } from "./sources";
import type {
  Affirmation,
  Controle,
  EntreeJournal,
  Evenement,
  Jugement,
  ResultatAffirmation,
  SourceCitee,
  SourceOfficielle,
  VerificationSource,
  VersionTexte,
} from "./types";

export { versionALaDate } from "./controles";

type Emettre = (e: Evenement) => void;

const PROMPT_EXTRACTION = `You are Saul's extractor. Saul checks French legal texts produced by an AI.
Split the text into verifiable LEGAL STATEMENTS (a rule, a holding, a time limit, an amount, a fact drawn from a case document).
Ignore courtesies, transitions and purely rhetorical sentences.

For each statement:
- "passage": an EXACT COPY, character for character, of the sentence or clause in the text (it is used to highlight it). Never rephrase.
- "resume": the statement restated in one plain sentence, in English.
- "sources": every source cited IN SUPPORT of that statement (an empty array if none is cited). For each one:
  - "brut": the reference exactly as written in the text, in French
  - "type": "article_code" | "decision" | "loi" | "ordonnance" | "decret" | "arrete" | "circulaire" | "piece" | "autre"
  - "code": the code's name for an article (e.g. "Code du travail"), otherwise null
  - "numero": the article number (e.g. "L1235-3"), the text number (e.g. "2017-1387") or the document number, otherwise null
  - "juridiction": for a decision (e.g. "Cass. soc.", "Conseil d'État", "CA Paris"), otherwise null
  - "date": the date of the decision or the text, as YYYY-MM-DD, otherwise null
  - "numero_affaire": the appeal or application number (e.g. "00-45.135"), otherwise null
  - "titre": the title if given, otherwise null

If the text mentions the date of the facts (dismissal, signature, loss…), fill in "date_faits" (YYYY-MM-DD), otherwise null.
Answer in JSON: {"date_faits": ..., "affirmations": [...]}`;

export const PROMPT_JUGE = `You are COUNSEL FOR THE OPPOSING PARTY. You are given a statement taken from your opponent's pleadings, and the OFFICIAL text of the source it cites (in the version applicable at the date of the facts).
Your job: check, without indulgence, whether the source really says what it is made to say.

Rules:
- You judge ONLY on the official text provided. Do not use your own knowledge to fill a gap.
- "extrait" must be an EXACT COPY (word for word) of a passage of the official text, at least ten words long, that grounds your verdict. It is checked automatically: if it does not appear in the text, your verdict is rejected. Keep it in the original French of the source.
- "raisonnement": 2 to 5 short steps a lawyer can follow, in English (what the statement says → what the text says → the gap, if any → the conclusion).
- "verdict":
  - "SOUTIENT": the text does say this
  - "PARTIEL": the text says something close, but the statement overstates it, or omits a condition or an exception
  - "NE_SOUTIENT_PAS": the text does not say this, or says the opposite
  - "HORS_SUJET": the text does not deal with the question
- "correction": what the text really says, in one sentence, in English (empty if SOUTIENT).
Answer in JSON: {"verdict": ..., "raisonnement": [...], "extrait": ..., "correction": ...}`;

function maintenant() {
  return new Date().toISOString();
}

async function limiter<T>(taches: (() => Promise<T>)[], max: number): Promise<T[]> {
  const resultats: T[] = new Array(taches.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(max, taches.length) }, async () => {
      while (i < taches.length) {
        const k = i++;
        resultats[k] = await taches[k]();
      }
    }),
  );
  return resultats;
}

export async function verifierTexte(
  texte: string,
  dateFaitsSaisie: string | null,
  pieces: Piece[],
  emettre: Emettre,
): Promise<void> {
  const journal = (e: Omit<EntreeJournal, "t">) => emettre({ type: "journal", entree: { t: maintenant(), ...e } });

  journal({
    acteur: "Saul",
    action: "Text received",
    detail: `${texte.length} characters, ${pieces.length} case-file document(s)`,
    empreinte: empreinte(texte).slice(0, 16),
  });
  if (!pisteConfigure()) {
    journal({ acteur: "Saul", action: "Official databases are not configured: sources will be marked “not verified”." });
  }

  journal({ acteur: "Extractor", action: "Splitting the text into statements…", modele: MODELE_EXTRACTION });
  const extraction = await mistralJson<{ date_faits: string | null; affirmations: Omit<Affirmation, "id">[] }>(
    MODELE_EXTRACTION,
    [
      { role: "system", content: PROMPT_EXTRACTION },
      { role: "user", content: texte },
    ],
  );
  const affirmations: Affirmation[] = (extraction.affirmations ?? []).map((a, i) => ({
    ...a,
    sources: a.sources ?? [],
    id: `A${i + 1}`,
  }));
  const dateFaits = dateFaitsSaisie || extraction.date_faits || new Date().toISOString().slice(0, 10);
  journal({
    acteur: "Extractor",
    action: `${affirmations.length} statements, ${affirmations.reduce((n, a) => n + a.sources.length, 0)} sources cited`,
    detail: dateFaitsSaisie
      ? `Date of the facts, as entered: ${dateFaits}`
      : extraction.date_faits
        ? `Date of the facts, detected in the text: ${dateFaits}`
        : `Date of the facts unknown: checking against today (${dateFaits})`,
    modele: MODELE_EXTRACTION,
  });
  emettre({ type: "affirmations", affirmations, dateFaits });

  const resultats = await limiter(
    affirmations.map((a) => async () => {
      const r = await verifierAffirmation(a, dateFaits, pieces, journal);
      emettre({ type: "resultat", resultat: r });
      return r;
    }),
    3,
  );

  // 5. Send the flagged passages back to the AI that wrote the memo, then re-check its corrections (2 rounds at most).
  const b = await boucler(
    { texte, resultats },
    {
      corriger: async (t, problemes) => {
        journal({
          acteur: "Drafter",
          action: `sending ${problemes.length} flagged passage(s) back to the AI, with their evidence: ${problemes.map((p) => p.id).join(", ")}`,
          modele: MODELE_REDACTEUR,
        });
        return corrigerMemo(t, problemes, dateFaits);
      },
      reverifier: (id, passage) => reverifierPassage(id, passage, dateFaits, pieces, journal),
    },
    { apresTour: (etat) => journalTour(etat, journal, emettre) },
  );
  journal({ acteur: "Saul", action: b.arret });
  emettre({ type: "boucle", boucle: b });

  const synthese = b.versions[b.versions.length - 1].synthese;
  journal({
    acteur: "Saul",
    action: "Check complete",
    detail: `version ${b.versions.length}: ${synthese.vert} verified, ${synthese.orange} to review, ${synthese.rouge} false, ${synthese.gris} not verifiable`,
  });
  emettre({ type: "fin", synthese });
}

function journalTour(b: Boucle, journal: (e: Omit<EntreeJournal, "t">) => void, emettre: Emettre) {
  const tour = b.tours[b.tours.length - 1];
  for (const t of tour.tentatives) {
    journal({
      acteur: "Drafter",
      action: `${t.id} · ${t.retenue ? "correction kept" : "correction rejected"} (${t.raison})`,
      detail: t.propose ? `« ${t.propose.slice(0, 160)}${t.propose.length > 160 ? "…" : ""} »` : undefined,
    });
  }
  const v = b.versions[b.versions.length - 1];
  journal({
    acteur: "Saul",
    action:
      v.numero === tour.numero + 1
        ? `Round ${tour.numero}: version ${v.numero}`
        : `Round ${tour.numero}: no correction kept, version ${v.numero} unchanged`,
    detail: `${v.synthese.rouge} false, ${v.synthese.orange} to review, ${v.synthese.vert} verified, ${v.synthese.gris} not verifiable`,
  });
  emettre({ type: "boucle", boucle: b });
}

/** Re-checks a passage the AI corrected: its sources are extracted and checked like any other. */
async function reverifierPassage(
  id: string,
  passage: string,
  dateFaits: string,
  pieces: Piece[],
  journal: (e: Omit<EntreeJournal, "t">) => void,
): Promise<ResultatAffirmation> {
  const extraction = await mistralJson<{ affirmations: Omit<Affirmation, "id">[] }>(MODELE_EXTRACTION, [
    { role: "system", content: PROMPT_EXTRACTION },
    { role: "user", content: passage },
  ]);
  const extraites = extraction.affirmations ?? [];
  const sources: SourceCitee[] = [];
  for (const s of extraites.flatMap((a) => a.sources ?? [])) {
    if (!sources.some((x) => x.brut === s.brut)) sources.push(s);
  }
  const a: Affirmation = { id, passage, resume: extraites[0]?.resume ?? passage, sources };
  return verifierAffirmation(a, dateFaits, pieces, journal);
}

async function verifierAffirmation(
  a: Affirmation,
  dateFaits: string,
  pieces: Piece[],
  journal: (e: Omit<EntreeJournal, "t">) => void,
): Promise<ResultatAffirmation> {
  const verifications: VerificationSource[] = [];
  for (const s of a.sources) verifications.push(await verifierSource(a, s, dateFaits, pieces, journal));
  return { affirmation: a, verifications, ...conclureAffirmation(a, verifications) };
}

async function verifierSource(
  a: Affirmation,
  s: SourceCitee,
  dateFaits: string,
  pieces: Piece[],
  journal: (e: Omit<EntreeJournal, "t">) => void,
): Promise<VerificationSource> {
  const tracer = (t: Omit<EntreeJournal, "t"> | null) => {
    if (t) journal({ ...t, action: `${a.id} · ${t.action}` });
  };
  const fin = (
    controles: Controle[],
    officielle: SourceOfficielle | null,
    version: VersionTexte | null,
    jugement: Jugement | null,
  ): VerificationSource => ({
    citee: s,
    officielle,
    versionApplicable: version,
    controles,
    jugement,
    statut: pire(controles.map((c) => c.statut)),
  });

  // 1. Does it exist?
  journal({ acteur: "Researcher", action: `${a.id} · looking up “${s.brut}”` });
  const recherche = await rechercherSource(s, pieces);
  tracer(recherche.trace);
  const officielle = recherche.officielle;
  if (!officielle) return fin(recherche.controles, null, null, null);

  // 2 and 3. In force at the date of the facts? What rank?
  const dateEtRang = controlerDateEtRang(s, officielle, dateFaits);
  tracer(dateEtRang.trace);
  const version = dateEtRang.version;
  const controles = [...recherche.controles, ...dateEtRang.controles];

  // 4. Does it really say that? (opposing counsel)
  const texte = texteApplicable(officielle, version);
  if (!texte) {
    controles.push({ nom: "contenu", statut: "gris", message: "The official text is empty: content not checked." });
    return fin(controles, officielle, version, null);
  }
  journal({ acteur: "Opposing counsel", action: `${a.id} · challenging the statement…`, modele: MODELE_JUGE });
  const brut = await mistralJson<Omit<Jugement, "extraitRetrouve">>(MODELE_JUGE, [
    { role: "system", content: PROMPT_JUGE },
    {
      role: "user",
      content: `STATEMENT: ${a.passage}\nSUMMARY: ${a.resume}\nSOURCE CITED: ${s.brut}\nDATE OF THE FACTS: ${dateFaits}\n\nOFFICIAL TEXT (${officielle.titre}${version ? `, version in force from ${version.debut} to ${version.fin ?? "today"}` : ""}):\n${texte.slice(0, 15000)}`,
    },
  ]);
  const jugement = jugementVerifie(brut, texte);
  controles.push(controlerContenu(jugement));
  journal({
    acteur: "Opposing counsel",
    action: `${a.id} · verdict ${jugement.verdict}${jugement.extraitRetrouve ? " (excerpt verified word for word)" : " (excerpt NOT found, verdict set aside)"}`,
    modele: MODELE_JUGE,
  });
  return fin(controles, officielle, version, jugement);
}
