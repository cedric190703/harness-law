// Les sources officielles mises en cache pour la démonstration.
//
// Visa interroge normalement Légifrance et Judilibre en direct (voir
// `engine/piste.ts`). Sans identifiants PISTE, il lit ce fichier : la démo
// reste jouable hors ligne, et aucun verdict n'est inventé pour autant —
// chaque entrée ci-dessous porte son identifiant de base et son texte copié.
//
// À relire par un juriste avant toute démonstration publique : les numéros de
// pourvoi et les extraits sont tenus pour exacts mais n'ont pas été recoupés
// sur Légifrance avec de vrais identifiants.

import type { Source } from "../types";

/** Un article de code en vigueur au jour des faits, sans difficulté. */
function article(
  reference: string,
  intitule: string,
  identifiant: string,
  texte: string,
  passage: string,
  versions: Source["versions"] = [],
): Source {
  return {
    reference,
    intitule,
    base: "Légifrance",
    identifiant,
    rang: "loi",
    etat: "en vigueur",
    texte,
    passage,
    versions,
    lien: `https://www.legifrance.gouv.fr/codes/article_lc/${identifiant}`,
  };
}

/** Une décision retrouvée dans Judilibre. */
function decision(
  reference: string,
  intitule: string,
  identifiant: string,
  texte: string,
  passage: string | null,
): Source {
  return {
    reference,
    intitule,
    base: "Judilibre",
    identifiant,
    rang: "jurisprudence",
    etat: "en vigueur",
    texte,
    passage,
    versions: [],
    lien: `https://www.courdecassation.fr/decision/${identifiant}`,
  };
}

export const SOURCES: Record<string, Source> = {
  "L1121-1": article(
    "Article L. 1121-1 du code du travail",
    "Restrictions aux libertés individuelles",
    "LEGIARTI000006900785",
    "Nul ne peut apporter aux droits des personnes et aux libertés individuelles et collectives de restrictions qui ne seraient pas justifiées par la nature de la tâche à accomplir ni proportionnées au but recherché.",
    "restrictions qui ne seraient pas justifiées par la nature de la tâche à accomplir ni proportionnées au but recherché",
  ),

  "L1232-1": article(
    "Article L. 1232-1 du code du travail",
    "Cause réelle et sérieuse du licenciement",
    "LEGIARTI000006901119",
    "Tout licenciement pour motif personnel est motivé dans les conditions définies par le présent chapitre. Il est justifié par une cause réelle et sérieuse.",
    "Il est justifié par une cause réelle et sérieuse",
  ),

  "L1234-1": article(
    "Article L. 1234-1 du code du travail",
    "Durée du préavis de licenciement",
    "LEGIARTI000006901104",
    "Lorsque le licenciement n'est pas motivé par une faute grave, le salarié a droit : 1° S'il justifie chez le même employeur d'une ancienneté de services continus inférieure à six mois, à un préavis dont la durée est déterminée par la loi, la convention ou l'accord collectif de travail ou, à défaut, par les usages pratiqués dans la localité et la profession ; 2° S'il justifie chez le même employeur d'une ancienneté de services continus comprise entre six mois et moins de deux ans, à un préavis d'un mois ; 3° S'il justifie chez le même employeur d'une ancienneté de services continus d'au moins deux ans, à un préavis de deux mois.",
    "à un préavis de deux mois",
  ),

  "L1234-9": article(
    "Article L. 1234-9 du code du travail",
    "Indemnité légale de licenciement",
    "LEGIARTI000019071007",
    "Le salarié titulaire d'un contrat de travail à durée indéterminée, licencié alors qu'il compte une année d'ancienneté ininterrompue au service du même employeur, a droit, sauf en cas de faute grave, à une indemnité de licenciement.",
    "licencié alors qu'il compte une année d'ancienneté ininterrompue au service du même employeur, a droit, sauf en cas de faute grave, à une indemnité de licenciement",
  ),

  // Le cas de la prescription : deux versions, et c'est l'ancienne qui
  // s'applique à des faits de 2016. Visa doit le dire sans se tromper.
  "L1471-1": {
    ...article(
      "Article L. 1471-1 du code du travail",
      "Délai de prescription de l'action portant sur l'exécution ou la rupture du contrat",
      "LEGIARTI000027565255",
      "Toute action portant sur l'exécution ou la rupture du contrat de travail se prescrit par deux ans à compter du jour où celui qui l'exerce a connu ou aurait dû connaître les faits lui permettant d'exercer son droit.",
      "se prescrit par deux ans",
    ),
    versions: [
      {
        debut: "2013-06-17",
        fin: "2017-09-24",
        resume: "Délai unique de deux ans pour l'exécution comme pour la rupture.",
        extrait: "se prescrit par deux ans à compter du jour où celui qui l'exerce a connu ou aurait dû connaître les faits",
      },
      {
        debut: "2017-09-24",
        fin: null,
        resume:
          "L'ordonnance du 22 septembre 2017 ramène à douze mois le délai pour contester la rupture ; les deux ans ne valent plus que pour l'exécution.",
        extrait: "Toute action portant sur la rupture du contrat de travail se prescrit par douze mois",
      },
    ],
  },

  // Le barème Macron : en vigueur aujourd'hui, pas au jour des faits.
  "L1235-3": {
    ...article(
      "Article L. 1235-3 du code du travail",
      "Indemnité pour licenciement sans cause réelle et sérieuse (barème)",
      "LEGIARTI000036762052",
      "Si le licenciement d'un salarié survient pour une cause qui n'est pas réelle et sérieuse, le juge peut proposer la réintégration du salarié dans l'entreprise, avec maintien de ses avantages acquis. Si l'une ou l'autre des parties refuse cette réintégration, le juge octroie au salarié une indemnité à la charge de l'employeur, dont le montant est compris entre les montants minimaux et maximaux fixés dans le tableau ci-après.",
      "dont le montant est compris entre les montants minimaux et maximaux fixés dans le tableau ci-après",
    ),
    versions: [
      {
        debut: "2008-05-01",
        fin: "2017-09-24",
        resume:
          "Aucun barème. Pour un salarié de deux ans d'ancienneté ou plus dans une entreprise de onze salariés ou plus, le juge accorde au minimum six mois de salaire, sans plafond.",
        extrait:
          "le tribunal octroie une indemnité au salarié à la charge de l'employeur qui ne peut être inférieure aux salaires des six derniers mois",
      },
      {
        debut: "2017-09-24",
        fin: null,
        resume:
          "L'ordonnance n° 2017-1387 du 22 septembre 2017 institue un plancher et un plafond par année d'ancienneté : c'est le « barème Macron ».",
        extrait: "dont le montant est compris entre les montants minimaux et maximaux fixés dans le tableau ci-après",
      },
    ],
  },

  // Un article emporté par la recodification de 2008 : plus rien derrière.
  "L122-14-3": {
    reference: "Article L. 122-14-3 du code du travail (ancienne numérotation)",
    intitule: "Appréciation du caractère réel et sérieux du licenciement — texte abrogé",
    base: "Légifrance",
    identifiant: "LEGIARTI000006647123",
    rang: "loi",
    etat: "abrogé",
    texte:
      "En cas de litige, le juge à qui il appartient d'apprécier le caractère réel et sérieux des motifs invoqués par l'employeur forme sa conviction au vu des éléments fournis par les parties. [Texte abrogé par l'ordonnance n° 2007-329 du 12 mars 2007, entrée en vigueur le 1er mai 2008. Dispositions reprises à l'article L. 1235-1.]",
    passage: "Texte abrogé par l'ordonnance n° 2007-329 du 12 mars 2007, entrée en vigueur le 1er mai 2008",
    versions: [
      {
        debut: "1973-07-13",
        fin: "2008-05-01",
        resume: "Dernière version applicable, avant la recodification du code du travail.",
        extrait: "forme sa conviction au vu des éléments fournis par les parties",
      },
    ],
    lien: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006647123",
  },

  // Une circulaire : elle existe, mais elle ne lie pas le juge.
  "CIRC-DGT-2008-17": {
    reference: "Circulaire DGT n° 2008-17 du 5 novembre 2008",
    intitule: "Circulaire de la direction générale du travail relative au licenciement pour motif personnel",
    base: "Légifrance",
    identifiant: "CIRCTEXT000019820120",
    rang: "circulaire",
    etat: "en vigueur",
    texte:
      "La présente circulaire a pour objet de présenter aux services les règles applicables à la procédure de licenciement pour motif personnel. Elle est destinée à éclairer l'action des agents de contrôle et ne saurait ajouter aux obligations légales et réglementaires existantes.",
    passage: "ne saurait ajouter aux obligations légales et réglementaires existantes",
    versions: [],
    lien: "https://www.legifrance.gouv.fr/circulaire/id/CIRCTEXT000019820120",
  },

  "CASS-2002-07-10": decision(
    "Cass. soc., 10 juillet 2002, n° 00-45.135",
    "La clause de non-concurrence est nulle à défaut de contrepartie financière",
    "JURITEXT000007045421",
    "Attendu qu'une clause de non-concurrence n'est licite que si elle est indispensable à la protection des intérêts légitimes de l'entreprise, limitée dans le temps et dans l'espace, qu'elle tient compte des spécificités de l'emploi du salarié et comporte l'obligation pour l'employeur de verser au salarié une contrepartie financière, ces conditions étant cumulatives.",
    "comporte l'obligation pour l'employeur de verser au salarié une contrepartie financière, ces conditions étant cumulatives",
  ),

  "CASS-2002-09-18": decision(
    "Cass. soc., 18 septembre 2002, n° 00-42.904",
    "Le juge peut réduire l'étendue d'une clause de non-concurrence excessive",
    "JURITEXT000007046112",
    "Attendu que le juge, en présence d'une clause de non-concurrence insérée dans un contrat de travail, même indispensable à la protection des intérêts légitimes de l'entreprise, peut, lorsque cette clause ne permet pas au salarié d'exercer une activité conforme à sa formation et à son expérience professionnelle, en restreindre l'application en limitant son effet dans le temps, l'espace ou ses autres modalités.",
    "en restreindre l'application en limitant son effet dans le temps, l'espace ou ses autres modalités",
  ),

  // La décision la plus dangereuse : elle existe vraiment, mais pas sur ce
  // point. Le texte officiel est sur la renonciation de l'employeur.
  "CASS-2009-03-25": decision(
    "Cass. soc., 25 mars 2009, n° 07-41.894",
    "Renonciation de l'employeur au bénéfice de la clause de non-concurrence",
    "JURITEXT000020489933",
    "Attendu que l'employeur qui entend renoncer au bénéfice de la clause de non-concurrence doit le faire dans le délai contractuellement prévu ou, à défaut, au moment du licenciement ; qu'il ne peut, après l'expiration de ce délai, se dispenser du paiement de la contrepartie financière.",
    "l'employeur qui entend renoncer au bénéfice de la clause de non-concurrence doit le faire dans le délai contractuellement prévu",
  ),

  // Postérieure aux faits : elle existe et dit bien ce qu'on lui fait dire,
  // mais elle n'était pas rendue au jour des faits.
  "CASS-2017-02-08": decision(
    "Cass. soc., 8 février 2017, n° 15-26.516",
    "Contrepartie financière dérisoire : la clause est nulle",
    "JURITEXT000034040127",
    "Attendu qu'une contrepartie financière dérisoire au regard de l'étendue de l'obligation de non-concurrence équivaut à une absence de contrepartie et entraîne la nullité de la clause.",
    "une contrepartie financière dérisoire au regard de l'étendue de l'obligation de non-concurrence équivaut à une absence de contrepartie",
  ),
};

/** La décision citée dans le mémo qui n'existe dans aucune base. */
export const INTROUVABLE: Source = {
  reference: "Cass. soc., 14 février 2019, n° 17-28.942",
  intitule: "Aucune décision ne porte ce numéro de pourvoi",
  base: "introuvable",
  identifiant: null,
  rang: "jurisprudence",
  etat: "inconnu",
  texte: "",
  passage: null,
  versions: [],
  lien: null,
};
