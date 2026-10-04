import type { SourceCitee, Statut } from "@/lib/types";

/**
 * Jeu de test français de Visa (preuve 1) : 9 mini-notes « écrites par une IA »,
 * chaque affirmation avec l'étiquette attendue et sa raison.
 *
 * Chaque étiquette a été prouvée sur Légifrance / Judilibre par `bun scripts/prouver-jeu.ts`
 * (existence, version à la date des faits, extrait mot pour mot). À faire relire par un juriste.
 */

export type TypeCas =
  | "juste"
  | "article_inexistant"
  | "decision_inventee"
  | "pas_en_vigueur"
  | "ne_dit_pas_ca"
  | "texte_modifie"
  | "circulaire"
  | "reference_floue"
  | "decision_mal_citee";

export const LIBELLE_TYPE: Record<TypeCas, string> = {
  juste: "Affirmation juste",
  article_inexistant: "Article inexistant",
  decision_inventee: "Décision inventée",
  pas_en_vigueur: "Pas en vigueur à la date des faits",
  ne_dit_pas_ca: "La source ne dit pas ça",
  texte_modifie: "Texte modifié depuis les faits",
  circulaire: "Circulaire invoquée comme obligatoire",
  reference_floue: "Référence floue ou absente",
  decision_mal_citee: "Vraie décision mal citée (date ou chambre)",
};

export interface CasAttendu {
  id: string;
  /** Copie exacte du passage dans la note. */
  passage: string;
  attendu: Statut;
  type: TypeCas;
  raison: string;
  /**
   * La référence officielle exacte, pour le script de preuve (Visa, lui, ne lit que le texte de la note).
   * Pour un article de loi non codifiée, `code` porte l'identifiant Légifrance de la loi.
   */
  source: SourceCitee | null;
  /** Extrait mot pour mot de la version applicable à la date des faits, qui fonde l'étiquette. */
  preuve?: string;
  /** Extrait mot pour mot de la version actuelle, absent de la version des faits (texte qui a changé). */
  preuveActuelle?: string;
  /** Circulaire : son intitulé exact dans le fonds des circulaires de Légifrance. */
  intitule?: string;
}

export interface NoteDeTest {
  id: string;
  titre: string;
  domaine: string;
  dateFaits: string;
  faits: string;
  cas: CasAttendu[];
}

/** Le texte soumis à Visa : titre, faits, puis une affirmation par paragraphe. */
export function texteNote(n: NoteDeTest): string {
  return [n.titre, n.faits, ...n.cas.map((c) => c.passage)].join("\n\n");
}

const CT = "Code du travail";
const CC = "Code civil";
const CCONSO = "Code de la consommation";
const CPC = "Code de procédure civile";
const LOI_1989 = "LEGITEXT000006069108";

function article(code: string, numero: string, brut: string): SourceCitee {
  return { brut, type: "article_code", code, numero };
}

function decision(juridiction: string, date: string, numero: string, brut: string): SourceCitee {
  return { brut, type: "decision", juridiction, date, numero_affaire: numero };
}

export const JEU_FR: NoteDeTest[] = [
  {
    id: "N1",
    titre: "NOTE — Licenciement pour insuffisance professionnelle de Mme Durand",
    domaine: "Droit du travail",
    dateFaits: "2023-06-15",
    faits:
      "Rappel des faits : Mme Durand, responsable logistique depuis le 3 septembre 2018 dans une société de 120 salariés, a été licenciée pour insuffisance professionnelle par lettre du 15 juin 2023.",
    cas: [
      {
        id: "N1-1",
        passage:
          "Le licenciement pour motif personnel doit être justifié par une cause réelle et sérieuse (article L. 1232-1 du Code du travail).",
        attendu: "vert",
        type: "juste",
        raison: "L1232-1, en vigueur depuis 2008 : « Il est justifié par une cause réelle et sérieuse. »",
        source: article(CT, "L1232-1", "article L. 1232-1 du Code du travail"),
        preuve: "Il est justifié par une cause réelle et sérieuse.",
      },
      {
        id: "N1-2",
        passage:
          "L'entretien préalable pouvait se tenir deux jours ouvrables après la présentation de la lettre de convocation (article L. 1232-2 du Code du travail).",
        attendu: "rouge",
        type: "ne_dit_pas_ca",
        raison: "L1232-2 impose cinq jours ouvrables, pas deux.",
        source: article(CT, "L1232-2", "article L. 1232-2 du Code du travail"),
        preuve: "L'entretien préalable ne peut avoir lieu moins de cinq jours ouvrables après la présentation",
      },
      {
        id: "N1-3",
        passage:
          "Ayant plus de deux ans d'ancienneté, Mme Durand a droit à un préavis de deux mois (article L. 1234-1 du Code du travail).",
        attendu: "vert",
        type: "juste",
        raison: "L1234-1, 3° : préavis de deux mois à partir de deux ans d'ancienneté ; texte inchangé depuis 2008.",
        source: article(CT, "L1234-1", "article L. 1234-1 du Code du travail"),
        preuve: "d'au moins deux ans, à un préavis de deux mois",
      },
      {
        id: "N1-4",
        passage:
          "L'indemnité légale de licenciement ne peut être inférieure à un quart de mois de salaire par année d'ancienneté pour les années jusqu'à dix ans (article R. 1234-2 du Code du travail).",
        attendu: "vert",
        type: "juste",
        raison: "R1234-2 dans sa version du 27 septembre 2017, applicable en 2023.",
        source: article(CT, "R1234-2", "article R. 1234-2 du Code du travail"),
        preuve: "Un quart de mois de salaire par année d'ancienneté pour les années jusqu'à dix ans",
      },
      {
        id: "N1-5",
        passage:
          "Si le licenciement est jugé sans cause réelle et sérieuse, l'indemnité due à une salariée ayant quatre ans d'ancienneté dans une entreprise d'au moins onze salariés est comprise entre trois et cinq mois de salaire brut (article L. 1235-3 du Code du travail).",
        attendu: "vert",
        type: "juste",
        raison:
          "Barème L1235-3 (version du 1er avril 2018) : ligne « 4 ans » = 3 mois minimum, 5 mois maximum. Le juge doit lire un tableau.",
        source: article(CT, "L1235-3", "article L. 1235-3 du Code du travail"),
        preuve: "dont le montant est compris entre les montants minimaux et maximaux fixés dans le tableau ci-dessous",
      },
      {
        id: "N1-6",
        passage:
          "Mme Durand dispose d'un délai de deux ans à compter de la notification du licenciement pour le contester (article L. 1471-1 du Code du travail).",
        attendu: "rouge",
        type: "ne_dit_pas_ca",
        raison: "Depuis l'ordonnance du 22 septembre 2017, l'action sur la rupture se prescrit par douze mois.",
        source: article(CT, "L1471-1", "article L. 1471-1 du Code du travail"),
        preuve: "Toute action portant sur la rupture du contrat de travail se prescrit par douze mois",
      },
      {
        id: "N1-7",
        passage:
          "La Cour de cassation a jugé que le barème de l'article L. 1235-3 du Code du travail est compatible avec l'article 10 de la Convention n° 158 de l'OIT (Cass. soc., 11 mai 2022, n° 21-14.490).",
        attendu: "vert",
        type: "juste",
        raison:
          "Arrêt réel, publié au bulletin. Piège pour Visa : le motif décisif (§ 22) est après le 15 000e caractère, que le juge ne lit pas.",
        source: decision("Cass. soc.", "2022-05-11", "21-14.490", "Cass. soc., 11 mai 2022, n° 21-14.490"),
        preuve:
          "les dispositions de l'article L. 1235-3 du code du travail sont compatibles avec les stipulations de l'article 10 de la Convention précitée",
      },
      {
        id: "N1-8",
        passage:
          "L'employeur devait lui proposer une formation d'adaptation avant d'invoquer son insuffisance professionnelle, faute de quoi le licenciement est nul (Cass. soc., 3 mars 2021, n° 19-48.207).",
        attendu: "rouge",
        type: "decision_inventee",
        raison: "Aucune décision n° 19-48.207, ni sur Légifrance ni sur Judilibre.",
        source: decision("Cass. soc.", "2021-03-03", "19-48.207", "Cass. soc., 3 mars 2021, n° 19-48.207"),
      },
      {
        id: "N1-9",
        passage:
          "Selon une jurisprudence constante, l'insuffisance professionnelle doit reposer sur des éléments objectifs et matériellement vérifiables.",
        attendu: "gris",
        type: "reference_floue",
        raison: "« Jurisprudence constante » sans aucune décision identifiable : invérifiable.",
        source: null,
      },
    ],
  },
  {
    id: "N2",
    titre: "NOTE — Dossier Martin c/ Société Delta Distribution",
    domaine: "Droit du travail",
    dateFaits: "2016-03-15",
    faits:
      "Rappel des faits : M. Martin, attaché commercial depuis le 2 janvier 2012 dans une société de 40 salariés, a été licencié par lettre du 15 mars 2016. Son contrat comporte une clause de non-concurrence de deux ans, sans contrepartie financière.",
    cas: [
      {
        id: "N2-1",
        passage:
          "Si le licenciement est jugé sans cause réelle et sérieuse, l'indemnité ne peut être inférieure aux salaires des six derniers mois (article L. 1235-3 du Code du travail).",
        attendu: "orange",
        type: "texte_modifie",
        raison:
          "Juste en 2016 (version 2008-2017), mais l'article a changé depuis : barème des ordonnances de 2017. À signaler.",
        source: article(CT, "L1235-3", "article L. 1235-3 du Code du travail"),
        preuve: "ne peut être inférieure aux salaires des six derniers mois",
        preuveActuelle: "fixés dans le tableau ci-dessous",
      },
      {
        id: "N2-2",
        passage:
          "L'indemnité légale de licenciement ne peut être inférieure à un cinquième de mois de salaire par année d'ancienneté (article R. 1234-2 du Code du travail).",
        attendu: "orange",
        type: "texte_modifie",
        raison: "Juste en 2016 (version 2008-2017) ; depuis septembre 2017, c'est un quart de mois.",
        source: article(CT, "R1234-2", "article R. 1234-2 du Code du travail"),
        preuve: "ne peut être inférieure à un cinquième de mois de salaire par année d'ancienneté",
        preuveActuelle: "Un quart de mois de salaire par année d'ancienneté",
      },
      {
        id: "N2-3",
        passage:
          "M. Martin dispose d'un délai de deux ans pour contester son licenciement (article L. 1471-1 du Code du travail).",
        attendu: "orange",
        type: "texte_modifie",
        raison: "Juste en 2016 (version 2013-2017) ; depuis 2017, douze mois pour la rupture.",
        source: article(CT, "L1471-1", "article L. 1471-1 du Code du travail"),
        preuve: "Toute action portant sur l'exécution ou la rupture du contrat de travail se prescrit par deux ans",
        preuveActuelle: "se prescrit par douze mois",
      },
      {
        id: "N2-4",
        passage:
          "Le plafonnement de l'indemnité ne s'applique pas lorsque le licenciement est entaché de nullité (article L. 1235-3-1 du Code du travail).",
        attendu: "rouge",
        type: "pas_en_vigueur",
        raison: "L1235-3-1 n'existe que depuis le 24 septembre 2017 : pas en vigueur en mars 2016.",
        source: article(CT, "L1235-3-1", "article L. 1235-3-1 du Code du travail"),
        preuveActuelle: "n'est pas applicable lorsque le juge constate que le licenciement est entaché",
      },
      {
        id: "N2-5",
        passage:
          "Une clause de non-concurrence n'est licite que si elle comporte l'obligation pour l'employeur de verser au salarié une contrepartie financière (Cass. soc., 10 juillet 2002, n° 00-45.135).",
        attendu: "vert",
        type: "juste",
        raison: "Arrêt réel, publié au bulletin ; c'est exactement l'attendu de principe.",
        source: decision("Cass. soc.", "2002-07-10", "00-45.135", "Cass. soc., 10 juillet 2002, n° 00-45.135"),
        preuve: "comporte l'obligation pour l'employeur de verser au salarié une contrepartie financière",
      },
      {
        id: "N2-6",
        passage:
          "Le Code du travail limite la durée de toute clause de non-concurrence à un an maximum (article L. 1121-1 du Code du travail).",
        attendu: "rouge",
        type: "ne_dit_pas_ca",
        raison: "L1121-1 pose un principe de proportionnalité des restrictions ; aucune durée maximale.",
        source: article(CT, "L1121-1", "article L. 1121-1 du Code du travail"),
        preuve:
          "Nul ne peut apporter aux droits des personnes et aux libertés individuelles et collectives de restrictions qui ne seraient pas justifiées par la nature de la tâche à accomplir",
      },
    ],
  },
  {
    id: "N3",
    titre: "NOTE — Embauche, CDD et rupture conventionnelle à la société Bêta Conseil",
    domaine: "Droit du travail",
    dateFaits: "2023-02-01",
    faits:
      "Contexte : la société Bêta Conseil, cabinet de 60 salariés, nous interroge le 1er février 2023 sur plusieurs contrats en cours.",
    cas: [
      {
        id: "N3-1",
        passage:
          "La période d'essai d'un cadre en contrat à durée indéterminée peut atteindre six mois, hors renouvellement (article L. 1221-19 du Code du travail).",
        attendu: "rouge",
        type: "ne_dit_pas_ca",
        raison: "L1221-19 : quatre mois maximum pour les cadres.",
        source: article(CT, "L1221-19", "article L. 1221-19 du Code du travail"),
        preuve: "Pour les cadres, de quatre mois.",
      },
      {
        id: "N3-2",
        passage:
          "La période d'essai ne peut être renouvelée qu'une fois, et seulement si un accord de branche étendu le prévoit (article L. 1221-21 du Code du travail).",
        attendu: "vert",
        type: "juste",
        raison: "L1221-21, inchangé depuis 2008.",
        source: article(CT, "L1221-21", "article L. 1221-21 du Code du travail"),
        preuve: "La période d'essai peut être renouvelée une fois si un accord de branche étendu le prévoit.",
      },
      {
        id: "N3-3",
        passage:
          "À l'issue d'un contrat à durée déterminée qui n'est pas suivi d'un contrat à durée indéterminée, le salarié perçoit une indemnité de fin de contrat égale à 10 % de la rémunération totale brute (article L. 1243-8 du Code du travail).",
        attendu: "vert",
        type: "juste",
        raison: "L1243-8, inchangé depuis 2008.",
        source: article(CT, "L1243-8", "article L. 1243-8 du Code du travail"),
        preuve: "Cette indemnité est égale à 10 % de la rémunération totale brute versée au salarié.",
      },
      {
        id: "N3-4",
        passage:
          "Après la signature de la convention de rupture conventionnelle, chaque partie dispose d'un délai de rétractation de huit jours (article L. 1237-13 du Code du travail).",
        attendu: "rouge",
        type: "ne_dit_pas_ca",
        raison: "L1237-13 : quinze jours calendaires.",
        source: article(CT, "L1237-13", "article L. 1237-13 du Code du travail"),
        preuve: "dispose d'un délai de quinze jours calendaires pour exercer son droit de rétractation",
      },
      {
        id: "N3-5",
        passage:
          "L'administration dispose d'un délai de quinze jours ouvrables pour homologuer la convention ; à défaut de réponse dans ce délai, l'homologation est réputée acquise (article L. 1237-14 du Code du travail).",
        attendu: "vert",
        type: "juste",
        raison: "L1237-14, inchangé depuis 2008.",
        source: article(CT, "L1237-14", "article L. 1237-14 du Code du travail"),
        preuve: "A défaut de notification dans ce délai, l'homologation est réputée acquise",
      },
      {
        id: "N3-6",
        passage:
          "La circulaire DGT n° 2008/11 du 22 juillet 2008 impose de refuser l'homologation lorsque l'indemnité convenue est inférieure à l'indemnité légale, et cette règle s'impose au juge.",
        attendu: "orange",
        type: "circulaire",
        raison: "Circulaire réelle, mais une circulaire ne lie pas le juge : elle est présentée ici comme obligatoire.",
        source: {
          brut: "circulaire DGT n° 2008/11 du 22 juillet 2008",
          type: "circulaire",
          numero: "2008/11",
          date: "2008-07-22",
        },
        intitule:
          "Circulaire DGT n° 2008/11 du 22 juillet 2008 relative à l'examen de la demande d'homologation d'une rupture conventionnelle d'un contrat à durée indéterminée",
      },
      {
        id: "N3-7",
        passage:
          "L'instruction DGT n° 02 du 23 mars 2010 interdit de recourir à la rupture conventionnelle pour contourner les règles du licenciement économique collectif, et le juge est tenu de l'appliquer.",
        attendu: "orange",
        type: "circulaire",
        raison: "Instruction réelle, présentée comme liant le juge ; une instruction ministérielle ne le lie pas.",
        source: {
          brut: "instruction DGT n° 02 du 23 mars 2010",
          type: "circulaire",
          numero: "02",
          date: "2010-03-23",
        },
        intitule:
          "Instruction DGT n°02 du 23 mars 2010 relative à l’incidence d’un contexte économique difficile sur la rupture conventionnelle d’un contrat de travail à durée indéterminée",
      },
      {
        id: "N3-8",
        passage:
          "L'action en requalification d'un contrat à durée déterminée se prescrit par six mois (article L. 1471-2 du Code du travail).",
        attendu: "rouge",
        type: "article_inexistant",
        raison: "Il n'existe pas d'article L. 1471-2 dans le Code du travail.",
        source: article(CT, "L1471-2", "article L. 1471-2 du Code du travail"),
      },
    ],
  },
  {
    id: "N4",
    titre: "NOTE — Contrat de distribution Gamma / Delta",
    domaine: "Droit des contrats",
    dateFaits: "2022-09-01",
    faits:
      "Contexte : contrat de distribution conclu le 10 janvier 2022 entre deux sociétés ; la société Gamma reproche à son partenaire des retards de livraison constatés en septembre 2022.",
    cas: [
      {
        id: "N4-1",
        passage: "Les contrats légalement formés tiennent lieu de loi à ceux qui les ont faits (article 1103 du Code civil).",
        attendu: "vert",
        type: "juste",
        raison: "Article 1103 issu de l'ordonnance de 2016, en vigueur depuis le 1er octobre 2016.",
        source: article(CC, "1103", "article 1103 du Code civil"),
        preuve: "Les contrats légalement formés tiennent lieu de loi à ceux qui les ont faits.",
      },
      {
        id: "N4-2",
        passage:
          "Les contrats doivent être négociés, formés et exécutés de bonne foi, et cette disposition est d'ordre public (article 1104 du Code civil).",
        attendu: "vert",
        type: "juste",
        raison: "Article 1104 en vigueur depuis le 1er octobre 2016.",
        source: article(CC, "1104", "article 1104 du Code civil"),
        preuve: "Les contrats doivent être négociés, formés et exécutés de bonne foi. Cette disposition est d'ordre public.",
      },
      {
        id: "N4-3",
        passage:
          "Le devoir précontractuel d'information ne porte pas sur l'estimation de la valeur de la prestation (article 1112-1 du Code civil).",
        attendu: "vert",
        type: "juste",
        raison: "Article 1112-1, alinéa 2, en vigueur depuis le 1er octobre 2016.",
        source: article(CC, "1112-1", "article 1112-1 du Code civil"),
        preuve: "ce devoir d'information ne porte pas sur l'estimation de la valeur de la prestation",
      },
      {
        id: "N4-4",
        passage:
          "Le juge peut, même d'office, modérer ou augmenter la pénalité convenue si elle est manifestement excessive ou dérisoire (article 1231-5 du Code civil).",
        attendu: "vert",
        type: "juste",
        raison: "Article 1231-5, alinéa 2.",
        source: article(CC, "1231-5", "article 1231-5 du Code civil"),
        preuve:
          "le juge peut, même d'office, modérer ou augmenter la pénalité ainsi convenue si elle est manifestement excessive ou dérisoire",
      },
      {
        id: "N4-5",
        passage: "L'action en paiement de la société Gamma se prescrit par dix ans (article 2224 du Code civil).",
        attendu: "rouge",
        type: "ne_dit_pas_ca",
        raison: "Article 2224 : cinq ans, pas dix.",
        source: article(CC, "2224", "article 2224 du Code civil"),
        preuve: "Les actions personnelles ou mobilières se prescrivent par cinq ans",
      },
      {
        id: "N4-6",
        passage:
          "La partie qui rompt brutalement les négociations engage sa responsabilité contractuelle (article 1104-2 du Code civil).",
        attendu: "rouge",
        type: "article_inexistant",
        raison: "Il n'existe pas d'article 1104-2 dans le Code civil.",
        source: article(CC, "1104-2", "article 1104-2 du Code civil"),
      },
      {
        id: "N4-7",
        passage:
          "Une clause limitative de responsabilité ne peut être écartée qu'en cas de faute lourde du débiteur (Cass. com., 22 octobre 1996, n° 93-18.632).",
        attendu: "rouge",
        type: "ne_dit_pas_ca",
        raison:
          "Arrêt Chronopost : la clause qui contredit l'obligation essentielle est réputée non écrite, sans exiger de faute lourde (la cour d'appel exigeait une faute lourde et a été cassée).",
        source: decision("Cass. com.", "1996-10-22", "93-18.632", "Cass. com., 22 octobre 1996, n° 93-18.632"),
        preuve:
          "la clause limitative de responsabilité du contrat, qui contredisait la portée de l'engagement pris, devait être réputée non écrite",
      },
      {
        id: "N4-8",
        passage:
          "Le distributeur victime de retards répétés peut résilier le contrat sans mise en demeure préalable (Cass. com., 9 juin 2020, n° 18-46.913).",
        attendu: "rouge",
        type: "decision_inventee",
        raison: "Aucune décision n° 18-46.913, ni sur Légifrance ni sur Judilibre.",
        source: decision("Cass. com.", "2020-06-09", "18-46.913", "Cass. com., 9 juin 2020, n° 18-46.913"),
      },
    ],
  },
  {
    id: "N5",
    titre: "NOTE — Contrat de maintenance Epsilon conclu en 2015",
    domaine: "Droit des contrats",
    dateFaits: "2015-03-10",
    faits:
      "Contexte : contrat de maintenance conclu le 10 mars 2015 entre la société Epsilon et son prestataire ; un litige est né en 2017 sur l'exécution du contrat.",
    cas: [
      {
        id: "N5-1",
        passage:
          "Le prestataire était tenu d'informer son client de toute information dont l'importance est déterminante pour son consentement (article 1112-1 du Code civil).",
        attendu: "rouge",
        type: "pas_en_vigueur",
        raison:
          "L'article 1112-1 n'existe que depuis le 1er octobre 2016 ; un contrat conclu en 2015 reste régi par l'ancien droit.",
        source: article(CC, "1112-1", "article 1112-1 du Code civil"),
        preuveActuelle: "Celle des parties qui connaît une information dont l'importance est déterminante",
      },
      {
        id: "N5-2",
        passage:
          "En cas de changement de circonstances imprévisible rendant l'exécution excessivement onéreuse, la société Epsilon peut demander une renégociation du contrat (article 1195 du Code civil).",
        attendu: "rouge",
        type: "pas_en_vigueur",
        raison:
          "L'imprévision (article 1195) date de l'ordonnance de 2016 ; en 2015, l'article 1195 portait sur les obligations alternatives.",
        source: article(CC, "1195", "article 1195 du Code civil"),
        preuve: "Si les deux choses sont péries sans la faute du débiteur",
        preuveActuelle: "Si un changement de circonstances imprévisible lors de la conclusion du contrat",
      },
      {
        id: "N5-3",
        passage:
          "Le tiers à un contrat peut invoquer, sur le fondement de la responsabilité délictuelle, un manquement contractuel dès lors que ce manquement lui a causé un dommage (Cass. ass. plén., 6 octobre 2006, n° 05-13.255).",
        attendu: "vert",
        type: "juste",
        raison: "Arrêt Myr'Ho / Boot shop, attendu de principe repris mot pour mot.",
        source: decision(
          "Cass. ass. plén.",
          "2006-10-06",
          "05-13.255",
          "Cass. ass. plén., 6 octobre 2006, n° 05-13.255",
        ),
        preuve:
          "le tiers à un contrat peut invoquer, sur le fondement de la responsabilité délictuelle, un manquement contractuel dès lors que ce manquement lui a causé un dommage",
      },
      {
        id: "N5-4",
        passage:
          "Les actions personnelles ou mobilières se prescrivent par cinq ans à compter du jour où le titulaire d'un droit a connu ou aurait dû connaître les faits lui permettant de l'exercer (article 2224 du Code civil).",
        attendu: "vert",
        type: "juste",
        raison: "Article 2224, version en vigueur depuis le 19 juin 2008.",
        source: article(CC, "2224", "article 2224 du Code civil"),
        preuve: "Les actions personnelles ou mobilières se prescrivent par cinq ans",
      },
      {
        id: "N5-5",
        passage:
          "La doctrine majoritaire considère qu'une clause de révision du prix doit s'interpréter en faveur du débiteur.",
        attendu: "gris",
        type: "reference_floue",
        raison: "Aucune source identifiable (« la doctrine majoritaire »).",
        source: null,
      },
    ],
  },
  {
    id: "N6",
    titre: "NOTE — Achat en ligne d'un ordinateur par M. Petit",
    domaine: "Droit de la consommation",
    dateFaits: "2023-04-12",
    faits:
      "Contexte : M. Petit a acheté un ordinateur portable sur un site marchand le 12 avril 2023 ; l'appareil, livré le 15 avril 2023, est tombé en panne.",
    cas: [
      {
        id: "N6-1",
        passage:
          "M. Petit disposait d'un délai de sept jours pour exercer son droit de rétractation (article L. 221-18 du Code de la consommation).",
        attendu: "rouge",
        type: "ne_dit_pas_ca",
        raison: "L221-18 : quatorze jours.",
        source: article(CCONSO, "L221-18", "article L. 221-18 du Code de la consommation"),
        preuve: "Le consommateur dispose d'un délai de quatorze jours pour exercer son droit de rétractation",
      },
      {
        id: "N6-2",
        passage:
          "Le vendeur répond des défauts de conformité existant lors de la délivrance qui apparaissent dans un délai de deux ans à compter de celle-ci (article L. 217-3 du Code de la consommation).",
        attendu: "vert",
        type: "juste",
        raison: "L217-3 dans sa version du 1er octobre 2021 (ordonnance n° 2021-1247).",
        source: article(CCONSO, "L217-3", "article L. 217-3 du Code de la consommation"),
        preuve: "Il répond des défauts de conformité existant au moment de la délivrance du bien",
      },
      {
        id: "N6-3",
        passage:
          "Dans les contrats entre professionnels et consommateurs, sont abusives les clauses qui créent, au détriment du consommateur, un déséquilibre significatif entre les droits et obligations des parties (article L. 212-1 du Code de la consommation).",
        attendu: "vert",
        type: "juste",
        raison: "L212-1, alinéa 1er, version du 1er octobre 2016.",
        source: article(CCONSO, "L212-1", "article L. 212-1 du Code de la consommation"),
        preuve:
          "sont abusives les clauses qui ont pour objet ou pour effet de créer, au détriment du consommateur, un déséquilibre significatif",
      },
      {
        id: "N6-4",
        passage:
          "L'action du professionnel en paiement des biens qu'il fournit au consommateur se prescrit par deux ans (article L. 218-2 du Code de la consommation).",
        attendu: "vert",
        type: "juste",
        raison: "L218-2, inchangé depuis le 1er juillet 2016.",
        source: article(CCONSO, "L218-2", "article L. 218-2 du Code de la consommation"),
        preuve:
          "L'action des professionnels, pour les biens ou les services qu'ils fournissent aux consommateurs, se prescrit par deux ans.",
      },
      {
        id: "N6-5",
        passage:
          "Le vendeur doit rembourser le consommateur dans les sept jours suivant la rétractation (article L. 221-35-1 du Code de la consommation).",
        attendu: "rouge",
        type: "article_inexistant",
        raison: "Il n'existe pas d'article L. 221-35-1 dans le Code de la consommation.",
        source: article(CCONSO, "L221-35-1", "article L. 221-35-1 du Code de la consommation"),
      },
      {
        id: "N6-6",
        passage:
          "La circulaire du 26 septembre 2014 de présentation de la loi relative à la consommation fixe les conditions de l'action de groupe, et ces conditions s'imposent au juge.",
        attendu: "orange",
        type: "circulaire",
        raison: "Circulaire réelle, présentée comme liant le juge ; une circulaire ne le lie pas.",
        source: {
          brut: "circulaire du 26 septembre 2014",
          type: "circulaire",
          date: "2014-09-26",
        },
        intitule:
          "Circulaire du 26 septembre 2014 de présentation des dispositions de la loi n° 2014-344 du 17 mars 2014 relative à la consommation et du décret n° 2014-1081 du 24 septembre 2014 relatif à l’action de groupe en matière de consommation",
      },
    ],
  },
  {
    id: "N7",
    titre: "NOTE — Restitution du dépôt de garantie de Mme Leroy",
    domaine: "Bail d'habitation",
    dateFaits: "2023-06-15",
    faits:
      "Contexte : Mme Leroy louait depuis le 1er juillet 2020 un appartement vide à M. Garnier, bailleur personne physique ; elle a quitté les lieux le 15 juin 2023 et réclame son dépôt de garantie.",
    cas: [
      {
        id: "N7-1",
        passage:
          "Le dépôt de garantie ne peut être supérieur à un mois de loyer en principal (article 22 de la loi n° 89-462 du 6 juillet 1989).",
        attendu: "vert",
        type: "juste",
        raison: "Article 22 de la loi de 1989, version en vigueur depuis le 27 mars 2014.",
        source: article(LOI_1989, "22", "article 22 de la loi n° 89-462 du 6 juillet 1989"),
        preuve: "il ne peut être supérieur à un mois de loyer en principal",
      },
      {
        id: "N7-2",
        passage:
          "Les actions dérivant du contrat de bail se prescrivent par cinq ans (article 7-1 de la loi n° 89-462 du 6 juillet 1989).",
        attendu: "rouge",
        type: "ne_dit_pas_ca",
        raison: "Article 7-1 : trois ans.",
        source: article(LOI_1989, "7-1", "article 7-1 de la loi n° 89-462 du 6 juillet 1989"),
        preuve: "Toutes actions dérivant d'un contrat de bail sont prescrites par trois ans",
      },
      {
        id: "N7-3",
        passage:
          "Le bail consenti par un bailleur personne physique est conclu pour une durée au moins égale à trois ans (article 10 de la loi n° 89-462 du 6 juillet 1989).",
        attendu: "vert",
        type: "juste",
        raison: "Article 10 de la loi de 1989, version en vigueur depuis le 27 mars 2014.",
        source: article(LOI_1989, "10", "article 10 de la loi n° 89-462 du 6 juillet 1989"),
        preuve: "Le contrat de location est conclu pour une durée au moins égale à trois ans pour les bailleurs personnes physiques",
      },
      {
        id: "N7-4",
        passage:
          "Le bailleur est obligé de délivrer au preneur, s'il s'agit de son habitation principale, un logement décent (article 1719 du Code civil).",
        attendu: "vert",
        type: "juste",
        raison: "Article 1719, 1°, version en vigueur depuis le 28 mars 2009.",
        source: article(CC, "1719", "article 1719 du Code civil"),
        preuve: "De délivrer au preneur la chose louée et, s'il s'agit de son habitation principale, un logement décent",
      },
      {
        id: "N7-5",
        passage:
          "Le bailleur qui restitue le dépôt de garantie en retard doit une pénalité forfaitaire d'un mois de loyer, sans autre formalité (Cass. 3e civ., 7 juillet 2022, n° 21-44.180).",
        attendu: "rouge",
        type: "decision_inventee",
        raison: "Aucune décision n° 21-44.180, ni sur Légifrance ni sur Judilibre.",
        source: decision("Cass. 3e civ.", "2022-07-07", "21-44.180", "Cass. 3e civ., 7 juillet 2022, n° 21-44.180"),
      },
    ],
  },
  {
    id: "N8",
    titre: "NOTE — Harcèlement moral subi par Mme Roux en 2011",
    domaine: "Droit du travail et droit pénal",
    dateFaits: "2011-09-01",
    faits:
      "Contexte : Mme Roux, comptable, dénonce des faits de harcèlement moral commis par son supérieur entre janvier et septembre 2011 ; elle envisage une plainte pénale et une action prud'homale.",
    cas: [
      {
        id: "N8-1",
        passage:
          "Le harcèlement moral est puni d'un an d'emprisonnement et de 15 000 euros d'amende (article 222-33-2 du Code pénal).",
        attendu: "orange",
        type: "texte_modifie",
        raison:
          "Peine applicable aux faits de 2011 (version 2002-2012) ; elle a été portée à deux ans et 30 000 € en août 2012.",
        source: article("Code pénal", "222-33-2", "article 222-33-2 du Code pénal"),
        preuve: "est puni d'un an d'emprisonnement et de 15000 euros d'amende",
        preuveActuelle: "est puni de deux ans d'emprisonnement et de 30 000 € d'amende",
      },
      {
        id: "N8-2",
        passage:
          "Aucun salarié ne doit subir des agissements répétés de harcèlement moral ayant pour objet ou pour effet une dégradation de ses conditions de travail (article L. 1152-1 du Code du travail).",
        attendu: "vert",
        type: "juste",
        raison: "L1152-1, inchangé depuis 2008.",
        source: article(CT, "L1152-1", "article L. 1152-1 du Code du travail"),
        preuve: "Aucun salarié ne doit subir les agissements répétés de harcèlement moral",
      },
      {
        id: "N8-3",
        passage:
          "Tout manquement de l'employeur cause nécessairement au salarié un préjudice qu'il n'a pas à prouver (Cass. soc., 13 avril 2016, n° 14-28.293).",
        attendu: "rouge",
        type: "ne_dit_pas_ca",
        raison:
          "Arrêt réel qui juge l'inverse : le préjudice relève de l'appréciation souveraine des juges du fond. Piège : la formule « cause nécessairement un préjudice » figure dans le moyen rejeté.",
        source: decision("Cass. soc.", "2016-04-13", "14-28.293", "Cass. soc., 13 avril 2016, n° 14-28.293"),
        preuve:
          "l'existence d'un préjudice et l'évaluation de celui-ci relèvent du pouvoir souverain d'appréciation des juges du fond",
      },
      {
        id: "N8-4",
        passage:
          "Les juges du fond admettent généralement qu'un acte isolé ne suffit pas à caractériser un harcèlement moral.",
        attendu: "gris",
        type: "reference_floue",
        raison: "Aucune source identifiable (« les juges du fond admettent généralement »).",
        source: null,
      },
    ],
  },
  {
    id: "N9",
    titre: "NOTE — Recouvrement d'une facture de 3 000 euros par la société Iota",
    domaine: "Procédure civile",
    dateFaits: "2023-01-10",
    faits:
      "Contexte : la société Iota veut assigner un client le 10 janvier 2023 en paiement d'une facture de 3 000 euros, et anticipe un éventuel appel.",
    cas: [
      {
        id: "N9-1",
        passage:
          "Il incombe à chaque partie de prouver conformément à la loi les faits nécessaires au succès de sa prétention (article 9 du Code de procédure civile).",
        attendu: "vert",
        type: "juste",
        raison: "Article 9 du CPC, inchangé depuis 1976.",
        source: article(CPC, "9", "article 9 du Code de procédure civile"),
        preuve: "Il incombe à chaque partie de prouver conformément à la loi les faits nécessaires au succès de sa prétention.",
      },
      {
        id: "N9-2",
        passage:
          "La demande n'excédant pas 5 000 euros, l'assignation doit être précédée, à peine d'irrecevabilité, d'une tentative de conciliation, de médiation ou de procédure participative (article 750-1 du Code de procédure civile).",
        attendu: "rouge",
        type: "pas_en_vigueur",
        raison:
          "L'article 750-1 a été annulé par le Conseil d'État le 22 septembre 2022 et n'a été rétabli qu'en mai 2023 : aucune version en vigueur au 10 janvier 2023.",
        source: article(CPC, "750-1", "article 750-1 du Code de procédure civile"),
        preuveActuelle: "En application de l'article 4 de la loi n° 2016-1547 du 18 novembre 2016",
      },
      {
        id: "N9-3",
        passage:
          "Le délai d'appel est d'un mois en matière contentieuse (article 538 du Code de procédure civile).",
        attendu: "vert",
        type: "juste",
        raison: "Article 538 du CPC : délai de recours par une voie ordinaire d'un mois en matière contentieuse.",
        source: article(CPC, "538", "article 538 du Code de procédure civile"),
        preuve: "Le délai de recours par une voie ordinaire est d'un mois en matière contentieuse",
      },
      {
        id: "N9-4",
        passage:
          "L'intimé dispose d'un délai de trois mois à compter de la notification des conclusions de l'appelant pour remettre ses conclusions au greffe (article 909 du Code de procédure civile).",
        attendu: "orange",
        type: "texte_modifie",
        raison:
          "Juste au 10 janvier 2023 (version 2017-2024), mais le texte a été réécrit le 1er septembre 2024 (changement de forme, délai identique).",
        source: article(CPC, "909", "article 909 du Code de procédure civile"),
        preuve: "d'un délai de trois mois à compter de la notification des conclusions de l'appelant prévues à l'article 908",
        preuveActuelle: "à compter de la notification qui lui est faite des conclusions de l'appelant",
      },
      {
        id: "N9-5",
        passage:
          "Lorsque l'appelant ne demande dans le dispositif de ses conclusions ni l'infirmation ni l'annulation du jugement, la cour d'appel ne peut que confirmer le jugement (Cass. 2e civ., 17 septembre 2020, n° 18-23.626).",
        attendu: "vert",
        type: "juste",
        raison: "Arrêt réel, publié au bulletin, § 4.",
        source: decision("Cass. 2e civ.", "2020-09-17", "18-23.626", "Cass. 2e civ., 17 septembre 2020, n° 18-23.626"),
        preuve:
          "lorsque l'appelant ne demande dans le dispositif de ses conclusions ni l'infirmation ni l'annulation du jugement, la cour d'appel ne peut que confirmer le jugement",
      },
      {
        id: "N9-6",
        passage:
          "Les frais de recouvrement amiable engagés avant le procès sont toujours mis à la charge du débiteur (article 700-1 du Code de procédure civile).",
        attendu: "rouge",
        type: "article_inexistant",
        raison: "Il n'existe pas d'article 700-1 dans le Code de procédure civile.",
        source: article(CPC, "700-1", "article 700-1 du Code de procédure civile"),
      },
      {
        id: "N9-7",
        passage:
          "La cour d'appel doit relever d'office la caducité de la déclaration d'appel, même lorsque l'intimé a déjà conclu (Cass. 2e civ., 15 janvier 2020, n° 18-47.552).",
        attendu: "rouge",
        type: "decision_inventee",
        raison: "Aucune décision n° 18-47.552, ni sur Légifrance ni sur Judilibre.",
        source: decision("Cass. 2e civ.", "2020-01-15", "18-47.552", "Cass. 2e civ., 15 janvier 2020, n° 18-47.552"),
      },
    ],
  },
];

/**
 * Affaires réelles françaises (base Charlotin, HEC) : références citées par des avocats et relevées par le juge.
 * Les références viennent des décisions ; la phrase qui les entoure est reconstituée.
 * TA Orléans, 29 décembre 2025, n° 2506461 n'est pas repris : l'export ne donne pas ses références exactes.
 */
export const JEU_CHARLOTIN: NoteDeTest[] = [
  {
    id: "C1",
    titre: "REQUÊTE D'APPEL — CAA Bordeaux, n° 25BX02906 (arrêt du 26 février 2026)",
    domaine: "Contentieux administratif",
    dateFaits: "2025-10-01",
    faits: "Contexte : requête d'appel contre un refus de l'administration, rédigée avec une IA.",
    cas: [
      {
        id: "C1-1",
        passage:
          "Le Conseil d'État a jugé que l'administration ne peut légalement refuser la demande sans examiner l'ensemble de la situation personnelle du requérant (CE, 7 février 2018, n° 409302).",
        attendu: "rouge",
        type: "decision_inventee",
        raison: "Relevée par la CAA de Bordeaux comme inexistante ; aucun n° 409302 au Conseil d'État sur Légifrance.",
        source: decision("CE", "2018-02-07", "409302", "CE, 7 février 2018, n° 409302"),
      },
    ],
  },
  {
    id: "C2",
    titre: "MÉMOIRE — TA Orléans, reconduite à la frontière, n° 2506907 (jugement du 7 janvier 2026)",
    domaine: "Droit des étrangers",
    dateFaits: "2025-12-01",
    faits: "Contexte : mémoire contre une mesure d'éloignement, rédigé avec une IA.",
    cas: [
      {
        id: "C2-1",
        passage:
          "Le Conseil d'État exige que le préfet procède à un examen particulier de la situation de l'étranger avant toute mesure d'éloignement (CE, 27 juin 2019, n° 420269).",
        attendu: "rouge",
        type: "decision_inventee",
        raison: "Relevée par le TA d'Orléans comme inexistante ; aucun n° 420269 sur Légifrance.",
        source: decision("CE", "2019-06-27", "420269", "CE, 27 juin 2019, n° 420269"),
      },
      {
        id: "C2-2",
        passage:
          "Le juge administratif contrôle la proportionnalité de la mesure d'éloignement au regard du droit au respect de la vie privée et familiale (CE, 12 octobre 2012, GISTI et FAPIL, n° 34728).",
        attendu: "rouge",
        type: "decision_mal_citee",
        raison:
          "Relevée par le TA comme inexistante. Le n° 34728 désigne une décision du Conseil d'État du 12 janvier 1983, sans rapport.",
        source: decision("CE", "2012-10-12", "34728", "CE, 12 octobre 2012, GISTI et FAPIL, n° 34728"),
      },
      {
        id: "C2-3",
        passage:
          "Une mesure de reconduite à la frontière doit être motivée en fait et en droit (CE, 9 juin 1978, Lebon, n° 05873).",
        attendu: "rouge",
        type: "decision_mal_citee",
        raison: "Relevée par le TA comme inexistante. Le n° 05873 désigne une décision du Conseil d'État du 16 juin 1978.",
        source: decision("CE", "1978-06-09", "05873", "CE, 9 juin 1978, n° 05873"),
      },
      {
        id: "C2-4",
        passage:
          "La cour administrative d'appel de Lyon a annulé une obligation de quitter le territoire dans une situation identique (CAA Lyon, 18 janvier 2022, n° 20LY01957).",
        attendu: "rouge",
        type: "decision_inventee",
        raison: "Relevée par le TA d'Orléans comme inexistante ; aucun n° 20LY01957 sur Légifrance.",
        source: decision("CAA Lyon", "2022-01-18", "20LY01957", "CAA Lyon, 18 janvier 2022, n° 20LY01957"),
      },
    ],
  },
];

/** Cas difficiles : un chiffre faux d'une unité, une ancienne numérotation, une décision mal citée, une loi modifiée. */
export const JEU_DIFFICILE: NoteDeTest[] = [
  {
    id: "D1",
    titre: "NOTE — Litige contractuel Kappa / Lambda",
    domaine: "Droit des contrats",
    dateFaits: "2022-09-01",
    faits: "Contexte : contrat de prestation conclu le 15 mars 2022 ; le prestataire n'a pas livré et le client a subi un dommage.",
    cas: [
      {
        id: "D1-1",
        passage:
          "Les conventions légalement formées tiennent lieu de loi à ceux qui les ont faites (article 1134 du Code civil).",
        attendu: "rouge",
        type: "ne_dit_pas_ca",
        raison:
          "Ancienne numérotation : depuis le 1er octobre 2016, l'article 1134 traite de l'erreur sur les qualités du cocontractant (la règle est à l'article 1103).",
        source: article(CC, "1134", "article 1134 du Code civil"),
        preuve: "L'erreur sur les qualités essentielles du cocontractant",
      },
      {
        id: "D1-2",
        passage:
          "Tout fait quelconque de l'homme qui cause à autrui un dommage oblige celui par la faute duquel il est arrivé à le réparer (article 1382 du Code civil).",
        attendu: "rouge",
        type: "ne_dit_pas_ca",
        raison:
          "Ancienne numérotation : la règle est à l'article 1240 depuis 2016 ; l'article 1382 porte aujourd'hui sur les présomptions judiciaires.",
        source: article(CC, "1382", "article 1382 du Code civil"),
        preuve: "Les présomptions qui ne sont pas établies par la loi",
      },
    ],
  },
  {
    id: "D2",
    titre: "NOTE — Rupture et période d'essai chez Mu Services",
    domaine: "Droit du travail",
    dateFaits: "2023-02-01",
    faits: "Contexte : la société Mu Services, 30 salariés, nous interroge le 1er février 2023.",
    cas: [
      {
        id: "D2-1",
        passage:
          "Après la signature de la convention de rupture conventionnelle, chaque partie dispose d'un délai de rétractation de quatorze jours calendaires (article L. 1237-13 du Code du travail).",
        attendu: "rouge",
        type: "ne_dit_pas_ca",
        raison: "Chiffre faux d'une unité : quinze jours calendaires.",
        source: article(CT, "L1237-13", "article L. 1237-13 du Code du travail"),
        preuve: "dispose d'un délai de quinze jours calendaires pour exercer son droit de rétractation",
      },
      {
        id: "D2-2",
        passage:
          "Pour un cadre, la durée de la période d'essai, renouvellement compris, ne peut pas dépasser sept mois (article L. 1221-21 du Code du travail).",
        attendu: "rouge",
        type: "ne_dit_pas_ca",
        raison: "Chiffre faux d'une unité : huit mois pour les cadres.",
        source: article(CT, "L1221-21", "article L. 1221-21 du Code du travail"),
        preuve: "Huit mois pour les cadres.",
      },
      {
        id: "D2-3",
        passage:
          "La Cour de cassation exige, pour la validité d'une clause de non-concurrence, une contrepartie financière versée au salarié (Cass. soc., 10 juillet 2003, n° 00-45.135).",
        attendu: "orange",
        type: "decision_mal_citee",
        raison: "Bonne décision, mauvaise date : l'arrêt n° 00-45.135 est du 10 juillet 2002.",
        source: decision("Cass. soc.", "2003-07-10", "00-45.135", "Cass. soc., 10 juillet 2003, n° 00-45.135"),
      },
    ],
  },
  {
    id: "D3",
    titre: "NOTE — Bail de M. Noël : restitution du dépôt de garantie et trouble causé à un voisin",
    domaine: "Bail",
    dateFaits: "2013-06-01",
    faits: "Contexte : M. Noël a rendu les clés de son logement le 1er juin 2013 ; un commerçant voisin se plaint de l'état de l'immeuble.",
    cas: [
      {
        id: "D3-1",
        passage:
          "Le dépôt de garantie est restitué dans un délai maximal de deux mois à compter de la restitution des clés par le locataire (article 22 de la loi n° 89-462 du 6 juillet 1989).",
        attendu: "orange",
        type: "texte_modifie",
        raison:
          "Juste en 2013 (version 2009-2014). Depuis la loi ALUR (27 mars 2014), le délai est d'un mois si l'état des lieux de sortie est conforme.",
        source: article(LOI_1989, "22", "article 22 de la loi n° 89-462 du 6 juillet 1989"),
        preuve: "Il est restitué dans un délai maximal de deux mois à compter de la restitution des clés par le locataire",
        preuveActuelle: "délai maximal d'un mois",
      },
      {
        id: "D3-2",
        passage:
          "Le tiers à un contrat de bail peut invoquer, sur le fondement de la responsabilité délictuelle, un manquement contractuel dès lors que ce manquement lui a causé un dommage (Cass. 3e civ., 6 octobre 2006, n° 05-13.255).",
        attendu: "orange",
        type: "decision_mal_citee",
        raison:
          "Bonne décision, bonne date, mauvaise formation : l'arrêt n° 05-13.255 est de l'Assemblée plénière, pas de la 3e chambre civile.",
        source: decision("Cass. 3e civ.", "2006-10-06", "05-13.255", "Cass. 3e civ., 6 octobre 2006, n° 05-13.255"),
        preuve: "Assemblée plénière",
      },
    ],
  },
];

/** Le jeu choisi en ligne de commande : --jeu base (défaut), difficile ou charlotin. */
export function jeuChoisi(argv: string[]): { nom: string; notes: NoteDeTest[] } {
  const i = argv.indexOf("--jeu");
  const nom = i > 0 ? (argv[i + 1] ?? "base") : "base";
  if (nom === "charlotin") return { nom, notes: JEU_CHARLOTIN };
  if (nom === "difficile") return { nom, notes: JEU_DIFFICILE };
  return { nom: "base", notes: JEU_FR };
}
