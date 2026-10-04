// Le dossier de démonstration : une note rédigée « par ChatGPT » sur un
// licenciement et une clause de non-concurrence, pour des faits de mars 2016.
//
// C'est aussi notre jeu de test : chaque affirmation illustre un cas que Visa
// doit attraper. Les verdicts attendus sont écrits ici, en dur, de façon à
// pouvoir mesurer la chaîne réelle contre eux (voir `engine/jeuDeTest.ts`).

import type { Affirmation, Controle, ControleId, Dossier, Verdict } from "../types";
import { INTROUVABLE, SOURCES } from "./sources";

const DATE_DES_FAITS = "2016-03-12";

function ctrl(id: ControleId, verdict: Verdict, reponse: string, preuve: string | null): Controle {
  return { id, verdict, reponse, preuve };
}

/** Le verdict d'ensemble est le plus sévère des quatre contrôles. */
function pire(controles: Controle[]): Verdict {
  const ordre: Verdict[] = ["rouge", "orange", "gris", "vert"];
  return ordre.find((v) => controles.some((c) => c.verdict === v)) ?? "gris";
}

type Brouillon = Omit<Affirmation, "verdict" | "valideParLeJuriste">;

function affirmation(a: Brouillon): Affirmation {
  return { ...a, verdict: pire(a.controles), valideParLeJuriste: false };
}

export const TEXTE_SOUMIS = `NOTE — Licenciement de M. Berthier et clause de non-concurrence
Faits : rupture notifiée le 12 mars 2016. Ancienneté : 4 ans et 2 mois. Effectif : 38 salariés.

1. Sur le fondement du licenciement

Tout licenciement pour motif personnel doit être justifié par une cause réelle et sérieuse (article L. 1232-1 du code du travail). En cas de litige, il appartient au juge d'apprécier le caractère réel et sérieux des motifs invoqués par l'employeur au vu des éléments fournis par les parties (article L. 122-14-3 du code du travail).

Compte tenu d'une ancienneté supérieure à deux ans, M. Berthier avait droit à un préavis de deux mois (article L. 1234-1 du code du travail) ainsi qu'à l'indemnité légale de licenciement (article L. 1234-9 du code du travail).

2. Sur le montant de l'indemnité en cas de licenciement injustifié

Si le licenciement est jugé sans cause réelle et sérieuse, l'indemnité due à M. Berthier est comprise entre trois et cinq mois de salaire brut, en application du barème fixé à l'article L. 1235-3 du code du travail.

La circulaire DGT n° 2008-17 du 5 novembre 2008 impose en outre à l'employeur de motiver la lettre de licenciement par écrit avant tout entretien préalable.

3. Sur la clause de non-concurrence

La clause insérée au contrat de M. Berthier ne prévoit aucune contrepartie financière. Or une clause de non-concurrence n'est licite que si elle comporte l'obligation pour l'employeur de verser au salarié une contrepartie financière, ces conditions étant cumulatives (Cass. soc., 10 juillet 2002, n° 00-45.135). Elle est donc nulle.

À supposer la contrepartie stipulée mais d'un montant symbolique, la nullité serait également encourue, une contrepartie dérisoire équivalant à une absence de contrepartie (Cass. soc., 8 février 2017, n° 15-26.516).

La Cour de cassation a par ailleurs jugé que le salarié qui respecte une clause nulle a droit à des dommages-intérêts équivalant à vingt-quatre mois de salaire (Cass. soc., 14 février 2019, n° 17-28.942).

Enfin, la Cour a admis que l'employeur peut renoncer à tout moment au bénéfice de la clause, sans indemnité (Cass. soc., 25 mars 2009, n° 07-41.894).

Le juge conserve la faculté de limiter l'application d'une clause excessive dans le temps, l'espace ou ses autres modalités (Cass. soc., 18 septembre 2002, n° 00-42.904).

Toute stipulation portant atteinte à la liberté du travail doit rester proportionnée au but recherché (article L. 1121-1 du code du travail).

4. Sur la prescription

L'action de M. Berthier devant le conseil de prud'hommes se prescrit par deux ans à compter de la notification de la rupture (article L. 1471-1 du code du travail).

Il est de jurisprudence constante que le doute profite au salarié.`;

export const AFFIRMATIONS: Affirmation[] = [
  affirmation({
    id: "A01",
    phrase:
      "Tout licenciement pour motif personnel doit être justifié par une cause réelle et sérieuse.",
    citation: "Article L. 1232-1 du code du travail",
    resume: "Bonne source, en vigueur au jour des faits, et elle dit bien cela.",
    controles: [
      ctrl("existence", "vert", "L'article existe au code du travail.", "Légifrance, LEGIARTI000006901119"),
      ctrl("vigueur", "vert", "En vigueur au 12 mars 2016, dans la version citée.", "Version du 1er mai 2008, sans date de fin"),
      ctrl("rang", "vert", "Article de loi : il lie le juge.", "Rang législatif"),
      ctrl("portee", "vert", "Le texte officiel emploie les mêmes termes.", "« Il est justifié par une cause réelle et sérieuse »"),
    ],
    source: SOURCES["L1232-1"],
    contradiction: null,
  }),

  affirmation({
    id: "A02",
    phrase:
      "Il appartient au juge d'apprécier le caractère réel et sérieux des motifs au vu des éléments fournis par les parties.",
    citation: "Article L. 122-14-3 du code du travail",
    resume: "L'article est abrogé depuis le 1er mai 2008 : il ne peut plus être visé.",
    controles: [
      ctrl("existence", "vert", "L'article a existé : il figure au fonds historique.", "Légifrance, LEGIARTI000006647123"),
      ctrl(
        "vigueur",
        "rouge",
        "Abrogé le 1er mai 2008 par la recodification, soit près de huit ans avant les faits.",
        "Fin d'application : 1er mai 2008 — ordonnance n° 2007-329 du 12 mars 2007",
      ),
      ctrl("rang", "vert", "C'était un article de loi.", "Rang législatif"),
      ctrl(
        "portee",
        "orange",
        "La règle subsiste, mais à l'article L. 1235-1 : c'est lui qu'il faut viser.",
        "Dispositions reprises à l'article L. 1235-1",
      ),
    ],
    source: SOURCES["L122-14-3"],
    contradiction: null,
  }),

  affirmation({
    id: "A03",
    phrase: "Une ancienneté supérieure à deux ans ouvrait droit à un préavis de deux mois.",
    citation: "Article L. 1234-1 du code du travail",
    resume: "Bonne source, en vigueur au jour des faits, et elle dit bien cela.",
    controles: [
      ctrl("existence", "vert", "L'article existe au code du travail.", "Légifrance, LEGIARTI000006901104"),
      ctrl("vigueur", "vert", "En vigueur au 12 mars 2016.", "Version du 1er mai 2008, sans date de fin"),
      ctrl("rang", "vert", "Article de loi : il lie le juge.", "Rang législatif"),
      ctrl("portee", "vert", "Le 3° de l'article prévoit exactement ce préavis.", "« à un préavis de deux mois »"),
    ],
    source: SOURCES["L1234-1"],
    contradiction: null,
  }),

  affirmation({
    id: "A04",
    phrase: "M. Berthier avait droit à l'indemnité légale de licenciement.",
    citation: "Article L. 1234-9 du code du travail",
    resume: "Bonne source : une année d'ancienneté suffit, il en a quatre.",
    controles: [
      ctrl("existence", "vert", "L'article existe au code du travail.", "Légifrance, LEGIARTI000019071007"),
      ctrl("vigueur", "vert", "En vigueur au 12 mars 2016.", "Version applicable depuis le 1er mai 2008"),
      ctrl("rang", "vert", "Article de loi : il lie le juge.", "Rang législatif"),
      ctrl(
        "portee",
        "vert",
        "La condition d'ancienneté est d'un an ; elle est remplie.",
        "« licencié alors qu'il compte une année d'ancienneté ininterrompue »",
      ),
    ],
    source: SOURCES["L1234-9"],
    contradiction: null,
  }),

  affirmation({
    id: "A05",
    phrase:
      "L'indemnité pour licenciement injustifié est comprise entre trois et cinq mois de salaire brut, en application du barème.",
    citation: "Article L. 1235-3 du code du travail",
    resume:
      "Le barème n'existait pas au 12 mars 2016 : la version applicable imposait un plancher de six mois, sans plafond.",
    controles: [
      ctrl("existence", "vert", "L'article existe au code du travail.", "Légifrance, LEGIARTI000036762052"),
      ctrl(
        "vigueur",
        "orange",
        "La version citée n'entre en vigueur que le 24 septembre 2017, soit dix-huit mois après les faits.",
        "Ordonnance n° 2017-1387 du 22 septembre 2017",
      ),
      ctrl("rang", "vert", "Article de loi : il lie le juge.", "Rang législatif"),
      ctrl(
        "portee",
        "orange",
        "La version applicable au jour des faits dit l'inverse : au moins six mois de salaire, sans plafond.",
        "« une indemnité […] qui ne peut être inférieure aux salaires des six derniers mois »",
      ),
    ],
    source: SOURCES["L1235-3"],
    contradiction: {
      argument:
        "Le barème ne s'applique qu'aux licenciements notifiés après le 23 septembre 2017 ; pour une rupture de mars 2016, le plancher de six mois demeure.",
      passage:
        "une indemnité […] qui ne peut être inférieure aux salaires des six derniers mois",
      passageRetrouve: true,
    },
  }),

  affirmation({
    id: "A06",
    phrase:
      "La circulaire DGT n° 2008-17 impose à l'employeur de motiver la lettre de licenciement avant tout entretien préalable.",
    citation: "Circulaire DGT n° 2008-17 du 5 novembre 2008",
    resume:
      "La circulaire existe, mais elle ne lie pas le juge — et elle ne dit pas cela.",
    controles: [
      ctrl("existence", "vert", "La circulaire existe et est publiée.", "Légifrance, CIRCTEXT000019820120"),
      ctrl("vigueur", "vert", "Toujours publiée au jour des faits.", "Publiée le 5 novembre 2008"),
      ctrl(
        "rang",
        "orange",
        "Une circulaire est une instruction aux services : elle ne crée pas d'obligation et ne lie pas le juge.",
        "« ne saurait ajouter aux obligations légales et réglementaires existantes »",
      ),
      ctrl(
        "portee",
        "rouge",
        "Aucun passage n'impose de motiver avant l'entretien préalable ; l'ordre inverse résulte de L. 1232-2 et L. 1232-6.",
        "Passage introuvable dans le texte officiel",
      ),
    ],
    source: SOURCES["CIRC-DGT-2008-17"],
    contradiction: {
      argument:
        "L'entretien préalable précède la lettre de licenciement : exiger une motivation écrite antérieure inverse la procédure légale.",
      passage: "ne saurait ajouter aux obligations légales et réglementaires existantes",
      passageRetrouve: true,
    },
  }),

  affirmation({
    id: "A07",
    phrase:
      "Une clause de non-concurrence n'est licite que si elle comporte une contrepartie financière, ces conditions étant cumulatives.",
    citation: "Cass. soc., 10 juillet 2002, n° 00-45.135",
    resume: "Bonne décision, passage retrouvé mot pour mot.",
    controles: [
      ctrl("existence", "vert", "La décision existe dans Judilibre.", "JURITEXT000007045421"),
      ctrl("vigueur", "vert", "Rendue le 10 juillet 2002, antérieure aux faits, non remise en cause.", "Décision du 10 juillet 2002"),
      ctrl("rang", "vert", "Arrêt de la chambre sociale de la Cour de cassation.", "Jurisprudence de la Cour de cassation"),
      ctrl(
        "portee",
        "vert",
        "Le passage cité figure mot pour mot dans l'arrêt.",
        "« comporte l'obligation pour l'employeur de verser au salarié une contrepartie financière, ces conditions étant cumulatives »",
      ),
    ],
    source: SOURCES["CASS-2002-07-10"],
    contradiction: {
      argument: "Rien à opposer : la condition est posée en termes cumulatifs par l'arrêt lui-même.",
      passage: "ces conditions étant cumulatives",
      passageRetrouve: true,
    },
  }),

  affirmation({
    id: "A08",
    phrase: "Une contrepartie dérisoire équivaut à une absence de contrepartie et entraîne la nullité.",
    citation: "Cass. soc., 8 février 2017, n° 15-26.516",
    resume: "La décision dit bien cela, mais elle est postérieure de onze mois aux faits.",
    controles: [
      ctrl("existence", "vert", "La décision existe dans Judilibre.", "JURITEXT000034040127"),
      ctrl(
        "vigueur",
        "orange",
        "Rendue le 8 février 2017, soit après la rupture du 12 mars 2016 : à citer comme évolution, non comme droit applicable au jour des faits.",
        "Écart de 11 mois avec la date des faits",
      ),
      ctrl("rang", "vert", "Arrêt de la chambre sociale de la Cour de cassation.", "Jurisprudence de la Cour de cassation"),
      ctrl(
        "portee",
        "vert",
        "Le passage cité figure mot pour mot dans l'arrêt.",
        "« une contrepartie financière dérisoire […] équivaut à une absence de contrepartie »",
      ),
    ],
    source: SOURCES["CASS-2017-02-08"],
    contradiction: {
      argument:
        "L'adversaire opposera que l'arrêt est postérieur aux faits ; la solution était toutefois déjà admise avant 2016, ce qu'il faut documenter par un arrêt antérieur.",
      passage: "équivaut à une absence de contrepartie",
      passageRetrouve: true,
    },
  }),

  affirmation({
    id: "A09",
    phrase:
      "Le salarié qui respecte une clause nulle a droit à des dommages-intérêts équivalant à vingt-quatre mois de salaire.",
    citation: "Cass. soc., 14 février 2019, n° 17-28.942",
    resume: "Aucune décision ne porte ce numéro de pourvoi. La référence est inventée.",
    controles: [
      ctrl(
        "existence",
        "rouge",
        "Aucune décision à ce numéro, ni dans Judilibre, ni au fonds JURI de Légifrance.",
        "Recherche NUM_AFFAIRE « 17-28.942 » : 0 résultat",
      ),
      ctrl("vigueur", "gris", "Sans source, rien à dater.", null),
      ctrl("rang", "gris", "Sans source, aucun rang à établir.", null),
      ctrl(
        "portee",
        "rouge",
        "Le quantum de vingt-quatre mois ne se rattache à aucun texte ni arrêt : l'indemnisation est appréciée au cas par cas.",
        "Aucun fondement retrouvé",
      ),
    ],
    source: INTROUVABLE,
    contradiction: {
      argument:
        "L'adversaire relèvera l'inexistence de l'arrêt. Le risque n'est pas de perdre le point : c'est l'article 32-1 du code de procédure civile et la déontologie.",
      passage: "—",
      passageRetrouve: false,
    },
  }),

  affirmation({
    id: "A10",
    phrase: "L'employeur peut renoncer à tout moment au bénéfice de la clause, sans indemnité.",
    citation: "Cass. soc., 25 mars 2009, n° 07-41.894",
    resume: "L'arrêt existe mais dit l'inverse : la renonciation est enfermée dans un délai.",
    controles: [
      ctrl("existence", "vert", "La décision existe dans Judilibre.", "JURITEXT000020489933"),
      ctrl("vigueur", "vert", "Rendue le 25 mars 2009, antérieure aux faits.", "Décision du 25 mars 2009"),
      ctrl("rang", "vert", "Arrêt de la chambre sociale de la Cour de cassation.", "Jurisprudence de la Cour de cassation"),
      ctrl(
        "portee",
        "rouge",
        "L'arrêt juge le contraire : la renonciation doit intervenir dans le délai contractuel ou, à défaut, au moment du licenciement.",
        "« doit le faire dans le délai contractuellement prévu ou, à défaut, au moment du licenciement »",
      ),
    ],
    source: SOURCES["CASS-2009-03-25"],
    contradiction: {
      argument:
        "L'adversaire citera le même arrêt contre nous : hors délai, l'employeur reste tenu de la contrepartie financière.",
      passage: "il ne peut, après l'expiration de ce délai, se dispenser du paiement de la contrepartie financière",
      passageRetrouve: true,
    },
  }),

  affirmation({
    id: "A11",
    phrase:
      "Le juge peut limiter l'application d'une clause excessive dans le temps, l'espace ou ses autres modalités.",
    citation: "Cass. soc., 18 septembre 2002, n° 00-42.904",
    resume: "Bonne décision, passage retrouvé mot pour mot.",
    controles: [
      ctrl("existence", "vert", "La décision existe dans Judilibre.", "JURITEXT000007046112"),
      ctrl("vigueur", "vert", "Rendue le 18 septembre 2002, antérieure aux faits.", "Décision du 18 septembre 2002"),
      ctrl("rang", "vert", "Arrêt de la chambre sociale de la Cour de cassation.", "Jurisprudence de la Cour de cassation"),
      ctrl(
        "portee",
        "vert",
        "Le passage cité figure mot pour mot dans l'arrêt.",
        "« en restreindre l'application en limitant son effet dans le temps, l'espace ou ses autres modalités »",
      ),
    ],
    source: SOURCES["CASS-2002-09-18"],
    contradiction: null,
  }),

  affirmation({
    id: "A12",
    phrase: "Toute stipulation portant atteinte à la liberté du travail doit rester proportionnée au but recherché.",
    citation: "Article L. 1121-1 du code du travail",
    resume: "Bonne source, en vigueur au jour des faits, et elle dit bien cela.",
    controles: [
      ctrl("existence", "vert", "L'article existe au code du travail.", "Légifrance, LEGIARTI000006900785"),
      ctrl("vigueur", "vert", "En vigueur au 12 mars 2016.", "Version du 1er mai 2008, sans date de fin"),
      ctrl("rang", "vert", "Article de loi : il lie le juge.", "Rang législatif"),
      ctrl(
        "portee",
        "vert",
        "Le texte officiel emploie le critère de proportionnalité invoqué.",
        "« ni proportionnées au but recherché »",
      ),
    ],
    source: SOURCES["L1121-1"],
    contradiction: null,
  }),

  affirmation({
    id: "A13",
    phrase: "L'action se prescrit par deux ans à compter de la notification de la rupture.",
    citation: "Article L. 1471-1 du code du travail",
    resume:
      "Exact pour des faits de 2016 : les douze mois ne valent que depuis le 24 septembre 2017.",
    controles: [
      ctrl("existence", "vert", "L'article existe au code du travail.", "Légifrance, LEGIARTI000027565255"),
      ctrl(
        "vigueur",
        "vert",
        "La version de deux ans s'applique du 17 juin 2013 au 24 septembre 2017: elle couvre le 12 mars 2016.",
        "Version applicable au 12 mars 2016 : délai de deux ans",
      ),
      ctrl("rang", "vert", "Article de loi : il lie le juge.", "Rang législatif"),
      ctrl("portee", "vert", "Le texte applicable dit bien deux ans.", "« se prescrit par deux ans »"),
    ],
    source: SOURCES["L1471-1"],
    contradiction: {
      argument:
        "L'adversaire pourrait invoquer le délai de douze mois ; il n'est entré en vigueur qu'en septembre 2017 et ne rétroagit pas.",
      passage: "se prescrit par deux ans",
      passageRetrouve: true,
    },
  }),

  affirmation({
    id: "A14",
    phrase: "Il est de jurisprudence constante que le doute profite au salarié.",
    citation: null,
    resume: "Aucune source citée : Visa ne peut rien vérifier. À étayer avant tout dépôt.",
    controles: [
      ctrl("existence", "gris", "Aucune référence n'est donnée : il n'y a rien à retrouver.", null),
      ctrl("vigueur", "gris", "Sans source, rien à dater.", null),
      ctrl("rang", "gris", "Sans source, aucun rang à établir.", null),
      ctrl(
        "portee",
        "gris",
        "La règle existe à l'article L. 1235-1, dernier alinéa, mais elle n'est pas citée ici.",
        "Piste proposée, non vérifiée : L. 1235-1",
      ),
    ],
    source: null,
    contradiction: null,
  }),
];

export const DOSSIER_DEMO: Omit<Dossier, "etapes"> = {
  id: "D-2026-014",
  nom: "Berthier / Sodimex — licenciement et clause de non-concurrence",
  matiere: "Droit du travail",
  redigePar: "ChatGPT (GPT-5), note rédigée le 2 octobre 2026",
  dateDesFaits: DATE_DES_FAITS,
  verifieLe: "2026-10-04T11:20:00+02:00",
  texte: TEXTE_SOUMIS,
  affirmations: AFFIRMATIONS,
};
