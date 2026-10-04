import {
  conclureAffirmation,
  controlerContenu,
  controlerDateEtRang,
  jugementVerifie,
  pire,
  rechercherSource,
  texteApplicable,
} from "./controles";
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
 * Le skill « carte des sources » : l'agent qui l'utilise découpe la réponse et
 * joue l'avocat adverse ; les règles de Visa (controles.ts) tranchent. Rien
 * n'est vert sans un extrait retrouvé mot pour mot dans le texte officiel.
 */

export type OrigineDate = "saisie" | "texte" | "aujourd'hui";

/** Ce que l'agent écrit dans affirmations.json. */
export interface Decoupage {
  date_faits?: string | null;
  affirmations: { passage: string; resume: string; sources?: SourceCitee[] }[];
}

/** Une source citée par une affirmation, après la recherche et les contrôles sans modèle. */
export interface ElementPrepare {
  /** « A3-1 » : affirmation A3, première source citée. */
  id: string;
  affirmation: string;
  citee: SourceCitee;
  officielle: SourceOfficielle | null;
  versionApplicable: VersionTexte | null;
  controles: Controle[];
  /** Le texte sur lequel l'avocat adverse doit juger ; null s'il n'y a rien à juger. */
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

/** Ce que l'agent écrit dans jugements.json, un par élément à juger. */
export interface JugementSaisi {
  id: string;
  verdict: Jugement["verdict"];
  raisonnement?: string[];
  extrait?: string;
  correction?: string;
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

/** Numérote les affirmations et refuse celles qui ne sont pas copiées mot pour mot de la réponse. */
export function validerDecoupage(reponse: string, d: Decoupage): { affirmations: Affirmation[]; erreurs: string[] } {
  const erreurs: string[] = [];
  if (!Array.isArray(d.affirmations)) return { affirmations: [], erreurs: ["« affirmations » doit être une liste."] };
  const affirmations = d.affirmations.map((a, i) => {
    const id = `A${i + 1}`;
    if (!a.passage || !contientVerbatim(reponse, a.passage)) {
      erreurs.push(`${id} : le passage n'est pas copié mot pour mot de la réponse (« ${(a.passage ?? "").slice(0, 60)}… »).`);
    }
    const sources = a.sources ?? [];
    sources.forEach((s, j) => {
      if (!s.brut) erreurs.push(`${id}-${j + 1} : « brut » manquant.`);
      if (!TYPES.includes(s.type)) erreurs.push(`${id}-${j + 1} : type « ${s.type} » inconnu (${TYPES.join(", ")}).`);
    });
    return { id, passage: a.passage, resume: a.resume ?? "", sources };
  });
  if (d.date_faits && !DATE.test(d.date_faits)) erreurs.push(`date_faits « ${d.date_faits} » : format AAAA-MM-JJ attendu.`);
  return { affirmations, erreurs };
}

/** Retrouve chaque source citée et applique les contrôles qui ne demandent pas de jugement. */
export async function preparer(
  reponse: string,
  d: Decoupage,
  options: { titre: string; dateSaisie?: string | null; pieces?: Piece[]; aujourdhui?: string },
): Promise<{ preparation: Preparation | null; erreurs: string[] }> {
  const { affirmations, erreurs } = validerDecoupage(reponse, d);
  if (options.dateSaisie && !DATE.test(options.dateSaisie)) {
    erreurs.push(`--date « ${options.dateSaisie} » : format AAAA-MM-JJ attendu.`);
  }
  if (erreurs.length > 0) return { preparation: null, erreurs };

  const origineDate: OrigineDate = options.dateSaisie ? "saisie" : d.date_faits ? "texte" : "aujourd'hui";
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
        else element.controles.push({ nom: "contenu", statut: "gris", message: "Texte officiel vide : contenu non vérifié." });
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

/** Applique les jugements de l'agent : un verdict sans extrait retrouvé mot pour mot est écarté. */
export function conclure(p: Preparation, jugements: JugementSaisi[], generee: string): Carte {
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
