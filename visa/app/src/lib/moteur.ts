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
import { MODELE_EXTRACTION, MODELE_JUGE, mistralJson } from "./mistral";
import { pisteConfigure } from "./piste";
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
  Statut,
  VerificationSource,
  VersionTexte,
} from "./types";

export { versionALaDate } from "./controles";

type Emettre = (e: Evenement) => void;

const PROMPT_EXTRACTION = `Tu es l'extracteur de Visa, un outil qui vérifie les textes juridiques français produits par une IA.
Découpe le texte en AFFIRMATIONS JURIDIQUES vérifiables (une règle, une solution jurisprudentielle, un délai, un montant, un fait tiré d'une pièce).
Ignore les phrases de politesse, de transition ou purement rhétoriques.

Pour chaque affirmation :
- "passage" : COPIE EXACTE, caractère pour caractère, de la phrase ou du membre de phrase dans le texte (il servira à la surligner). Ne reformule jamais.
- "resume" : l'affirmation reformulée en une phrase simple.
- "sources" : chaque source citée À L'APPUI de cette affirmation (tableau vide si aucune source n'est citée). Pour chacune :
  - "brut" : la référence telle qu'écrite
  - "type" : "article_code" | "decision" | "loi" | "ordonnance" | "decret" | "arrete" | "circulaire" | "piece" | "autre"
  - "code" : nom du code pour un article (ex. "Code du travail"), sinon null
  - "numero" : numéro de l'article (ex. "L1235-3") ou du texte (ex. "2017-1387") ou de la pièce, sinon null
  - "juridiction" : pour une décision (ex. "Cass. soc.", "Conseil d'État", "CA Paris"), sinon null
  - "date" : date de la décision ou du texte au format AAAA-MM-JJ, sinon null
  - "numero_affaire" : numéro de pourvoi ou de requête (ex. "00-45.135"), sinon null
  - "titre" : intitulé si donné, sinon null

Si le texte mentionne la date des faits (licenciement, signature, sinistre…), renseigne "date_faits" (AAAA-MM-JJ), sinon null.
Réponds en JSON : {"date_faits": ..., "affirmations": [...]}`;

const PROMPT_JUGE = `Tu es l'AVOCAT DE LA PARTIE ADVERSE. On te soumet une affirmation tirée des écritures de ton adversaire, et le texte OFFICIEL de la source qu'il cite (dans la version applicable à la date des faits).
Ton travail : vérifier, sans complaisance, si la source dit vraiment ce qu'on lui fait dire.

Règles :
- Tu ne juges QUE sur le texte officiel fourni. N'utilise pas tes connaissances pour combler un manque.
- "extrait" doit être une COPIE EXACTE (mot pour mot) d'un passage du texte officiel, d'au moins une dizaine de mots, qui fonde ton verdict. Elle sera vérifiée automatiquement : si elle ne figure pas dans le texte, ton verdict est rejeté.
- "raisonnement" : 2 à 5 étapes courtes, compréhensibles par un avocat (ce que dit l'affirmation → ce que dit le texte → l'écart éventuel → la conclusion).
- "verdict" :
  - "SOUTIENT" : le texte dit bien cela
  - "PARTIEL" : le texte dit quelque chose de proche mais l'affirmation exagère, omet une condition ou une exception
  - "NE_SOUTIENT_PAS" : le texte ne dit pas cela, ou dit le contraire
  - "HORS_SUJET" : le texte ne traite pas de la question
- "correction" : ce que dit vraiment le texte, en une phrase (vide si SOUTIENT).
Réponds en JSON : {"verdict": ..., "raisonnement": [...], "extrait": ..., "correction": ...}`;

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
    acteur: "Visa",
    action: "Texte reçu",
    detail: `${texte.length} caractères, ${pieces.length} pièce(s) du dossier`,
    empreinte: empreinte(texte).slice(0, 16),
  });
  if (!pisteConfigure()) {
    journal({ acteur: "Visa", action: "Bases officielles non configurées : les sources seront marquées « non vérifiées »." });
  }

  journal({ acteur: "Extracteur", action: "Découpage du texte en affirmations…", modele: MODELE_EXTRACTION });
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
    acteur: "Extracteur",
    action: `${affirmations.length} affirmations, ${affirmations.reduce((n, a) => n + a.sources.length, 0)} sources citées`,
    detail: dateFaitsSaisie
      ? `Date des faits saisie : ${dateFaits}`
      : extraction.date_faits
        ? `Date des faits détectée dans le texte : ${dateFaits}`
        : `Date des faits inconnue : on vérifie à la date du jour (${dateFaits})`,
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

  const synthese: Record<Statut, number> = { vert: 0, orange: 0, rouge: 0, gris: 0 };
  for (const r of resultats) synthese[r.statut]++;
  journal({
    acteur: "Visa",
    action: "Vérification terminée",
    detail: `${synthese.vert} vertes, ${synthese.orange} à revoir, ${synthese.rouge} fausses, ${synthese.gris} non vérifiables`,
  });
  emettre({ type: "fin", synthese });
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

  // 1. Existe ?
  journal({ acteur: "Chercheur", action: `${a.id} · recherche de « ${s.brut} »` });
  const recherche = await rechercherSource(s, pieces);
  tracer(recherche.trace);
  const officielle = recherche.officielle;
  if (!officielle) return fin(recherche.controles, null, null, null);

  // 2 et 3. En vigueur à la date des faits ? Quel rang ?
  const dateEtRang = controlerDateEtRang(s, officielle, dateFaits);
  tracer(dateEtRang.trace);
  const version = dateEtRang.version;
  const controles = [...recherche.controles, ...dateEtRang.controles];

  // 4. Dit-elle vraiment ça ? (avocat adverse)
  const texte = texteApplicable(officielle, version);
  if (!texte) {
    controles.push({ nom: "contenu", statut: "gris", message: "Texte officiel vide : contenu non vérifié." });
    return fin(controles, officielle, version, null);
  }
  journal({ acteur: "Avocat adverse", action: `${a.id} · conteste l'affirmation…`, modele: MODELE_JUGE });
  const brut = await mistralJson<Omit<Jugement, "extraitRetrouve">>(MODELE_JUGE, [
    { role: "system", content: PROMPT_JUGE },
    {
      role: "user",
      content: `AFFIRMATION : ${a.passage}\nRÉSUMÉ : ${a.resume}\nSOURCE CITÉE : ${s.brut}\nDATE DES FAITS : ${dateFaits}\n\nTEXTE OFFICIEL (${officielle.titre}${version ? `, version en vigueur du ${version.debut} au ${version.fin ?? "aujourd'hui"}` : ""}) :\n${texte.slice(0, 15000)}`,
    },
  ]);
  const jugement = jugementVerifie(brut, texte);
  controles.push(controlerContenu(jugement));
  journal({
    acteur: "Avocat adverse",
    action: `${a.id} · verdict ${jugement.verdict}${jugement.extraitRetrouve ? " (extrait vérifié mot pour mot)" : " (extrait NON retrouvé, verdict écarté)"}`,
    modele: MODELE_JUGE,
  });
  return fin(controles, officielle, version, jugement);
}
