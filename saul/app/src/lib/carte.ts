import {
  conclureAffirmation,
  controlerContenu,
  controlerDateEtRang,
  jugementVerifie,
  pire,
  rechercherSource,
  texteApplicable,
} from "./controles";
import { planifier, retenirProposition, type PropositionBrute } from "./correction";
import { pisteConfigure } from "./piste";
import type { Piece } from "./sources";
import type {
  Affirmation,
  Controle,
  Jugement,
  ResultatAffirmation,
  SourceCitee,
  SourceOfficielle,
  Statut,
  TypeSource,
  VerificationSource,
  VersionTexte,
} from "./types";
import { contientVerbatim } from "./verbatim";

/**
 * The « source map » skill: the agent using it splits up the answer and
 * plays opposing counsel; Saul's rules (controles.ts) decide. Nothing is
 * green without an excerpt found word for word in the official text.
 */

export type OrigineDate = "entered" | "text" | "today";

/** What the agent writes into affirmations.json. */
export interface Decoupage {
  date_faits?: string | null;
  affirmations: { passage: string; resume: string; sources?: SourceCitee[] }[];
}

/** A source cited by a statement, after the lookup and the model-free checks. */
export interface ElementPrepare {
  /** “A3-1”: statement A3, first source cited. */
  id: string;
  affirmation: string;
  citee: SourceCitee;
  officielle: SourceOfficielle | null;
  versionApplicable: VersionTexte | null;
  controles: Controle[];
  /** The text opposing counsel must judge on; null when there is nothing to judge. */
  texteAJuger: string | null;
}

export interface Preparation {
  titre: string;
  reponse: string;
  dateFaits: string;
  origineDate: OrigineDate;
  basesConnectees: boolean;
  affirmations: Affirmation[];
  elements: ElementPrepare[];
}

/** What the agent writes into jugements.json, one per item to judge. */
export interface JugementSaisi {
  id: string;
  verdict: Jugement["verdict"];
  raisonnement?: string[];
  extrait?: string;
  correction?: string;
}

/** What the agent writes into reecritures.json: one per orange or red statement it can correct. */
export interface ReecritureSaisie extends PropositionBrute {
  /** L'affirmation, ex. « A4 ». */
  id: string;
}

export interface Carte {
  titre: string;
  reponse: string;
  dateFaits: string;
  origineDate: OrigineDate;
  basesConnectees: boolean;
  resultats: ResultatAffirmation[];
  synthese: Record<Statut, number>;
  generee: string;
}

const TYPES: TypeSource[] = [
  "article_code",
  "decision",
  "loi",
  "ordonnance",
  "decret",
  "arrete",
  "circulaire",
  "piece",
  "autre",
];
const VERDICTS: Jugement["verdict"][] = ["SOUTIENT", "PARTIEL", "NE_SOUTIENT_PAS", "HORS_SUJET"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Numbers the statements and rejects any that are not copied word for word from the answer. */
export function validerDecoupage(reponse: string, d: Decoupage): { affirmations: Affirmation[]; erreurs: string[] } {
  const erreurs: string[] = [];
  if (!Array.isArray(d.affirmations)) return { affirmations: [], erreurs: ["“affirmations” must be a list."] };
  const affirmations = d.affirmations.map((a, i) => {
    const id = `A${i + 1}`;
    if (!a.passage || !contientVerbatim(reponse, a.passage)) {
      erreurs.push(`${id}: the passage is not copied word for word from the answer (“${(a.passage ?? "").slice(0, 60)}…”).`);
    }
    const sources = a.sources ?? [];
    sources.forEach((s, j) => {
      if (!s.brut) erreurs.push(`${id}-${j + 1}: “brut” is missing.`);
      if (!TYPES.includes(s.type)) erreurs.push(`${id}-${j + 1}: unknown type “${s.type}” (${TYPES.join(", ")}).`);
    });
    return { id, passage: a.passage, resume: a.resume ?? "", sources };
  });
  if (d.date_faits && !DATE.test(d.date_faits)) erreurs.push(`date_faits “${d.date_faits}”: expected format YYYY-MM-DD.`);
  return { affirmations, erreurs };
}

/** Finds every cited source and applies the checks that need no judgement. */
export async function preparer(
  reponse: string,
  d: Decoupage,
  options: { titre: string; dateSaisie?: string | null; pieces?: Piece[]; aujourdhui?: string },
): Promise<{ preparation: Preparation | null; erreurs: string[] }> {
  const { affirmations, erreurs } = validerDecoupage(reponse, d);
  if (options.dateSaisie && !DATE.test(options.dateSaisie)) {
    erreurs.push(`--date “${options.dateSaisie}”: expected format YYYY-MM-DD.`);
  }
  if (erreurs.length > 0) return { preparation: null, erreurs };

  const origineDate: OrigineDate = options.dateSaisie ? "entered" : d.date_faits ? "text" : "today";
  const dateFaits =
    options.dateSaisie || d.date_faits || options.aujourdhui || new Date().toISOString().slice(0, 10);

  const elements: ElementPrepare[] = [];
  for (const a of affirmations) {
    for (const [j, citee] of a.sources.entries()) {
      const recherche = await rechercherSource(citee, options.pieces ?? []);
      const element: ElementPrepare = {
        id: `${a.id}-${j + 1}`,
        affirmation: a.id,
        citee,
        officielle: recherche.officielle,
        versionApplicable: null,
        controles: [...recherche.controles],
        texteAJuger: null,
      };
      if (recherche.officielle) {
        const dateEtRang = controlerDateEtRang(citee, recherche.officielle, dateFaits);
        element.versionApplicable = dateEtRang.version;
        element.controles.push(...dateEtRang.controles);
        const texte = texteApplicable(recherche.officielle, dateEtRang.version);
        if (texte) element.texteAJuger = texte;
        else element.controles.push({ nom: "contenu", statut: "gris", message: "The official text is empty: content not checked." });
      }
      elements.push(element);
    }
  }
  return {
    preparation: {
      titre: options.titre,
      reponse,
      dateFaits,
      origineDate,
      basesConnectees: pisteConfigure(),
      affirmations,
      elements,
    },
    erreurs: [],
  };
}

/**
 * Applies the agent's verdicts: a verdict with no word-for-word excerpt is set aside.
 * Then its rewrites, with the same safeguards as the app's drafter (correction.ts).
 */
export function conclure(
  p: Preparation,
  jugements: JugementSaisi[],
  generee: string,
  reecritures: ReecritureSaisie[] = [],
): Carte {
  const parId = new Map(jugements.map((j) => [j.id, j]));
  const verification = (e: ElementPrepare): VerificationSource => {
    if (e.texteAJuger === null) {
      return {
        citee: e.citee,
        officielle: e.officielle,
        versionApplicable: e.versionApplicable,
        controles: e.controles,
        jugement: null,
        statut: pire(e.controles.map((c) => c.statut)),
      };
    }
    const saisi = parId.get(e.id);
    const jugement =
      saisi && VERDICTS.includes(saisi.verdict)
        ? jugementVerifie(
            {
              verdict: saisi.verdict,
              raisonnement: saisi.raisonnement ?? [],
              extrait: saisi.extrait ?? "",
              correction: saisi.correction ?? "",
            },
            e.texteAJuger,
          )
        : null;
    const controles = [...e.controles, controlerContenu(jugement)];
    return {
      citee: e.citee,
      officielle: e.officielle,
      versionApplicable: e.versionApplicable,
      controles,
      jugement,
      statut: pire(controles.map((c) => c.statut)),
    };
  };

  const resultats: ResultatAffirmation[] = p.affirmations.map((a) => {
    const verifications = p.elements.filter((e) => e.affirmation === a.id).map(verification);
    return { affirmation: a, verifications, ...conclureAffirmation(a, verifications) };
  });
  const saisies = new Map(reecritures.map((r) => [r.id, r]));
  for (const r of resultats) {
    const plan = planifier(r, resultats, p.dateFaits);
    if (!plan) continue;
    const saisie = saisies.get(r.affirmation.id);
    r.reecriture =
      plan.cas === "fixe"
        ? plan.reecriture
        : saisie
          ? retenirProposition(plan, r.affirmation.passage, saisie)
          : plan.repli;
  }
  const synthese: Record<Statut, number> = { vert: 0, orange: 0, rouge: 0, gris: 0 };
  for (const r of resultats) synthese[r.statut]++;
  return {
    titre: p.titre,
    reponse: p.reponse,
    dateFaits: p.dateFaits,
    origineDate: p.origineDate,
    basesConnectees: p.basesConnectees,
    resultats,
    synthese,
    generee,
  };
}
