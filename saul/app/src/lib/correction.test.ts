import { describe, expect, test } from "bun:test";
import {
  assurerCitation,
  dateLongue,
  diffMots,
  planifier,
  references,
  resumePourAvocat,
  retenirProposition,
  type PlanRedaction,
} from "./correction";
import type {
  Controle,
  Reecriture,
  ResultatAffirmation,
  SourceCitee,
  SourceOfficielle,
  Statut,
  VerificationSource,
} from "./types";

const FAITS = "2016-03-15";

const L1235_3: SourceOfficielle = {
  base: "Légifrance",
  id: "LEGIARTI000006901174",
  titre: "Article L1235-3 — Code du travail",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006901174",
  rang: 3,
  rangLibelle: "Loi / ordonnance",
  etat: "VIGUEUR",
  date: null,
  texte: "barème",
  versions: [
    {
      debut: "2008-05-01",
      fin: "2016-08-10",
      etat: "MODIFIE",
      texte:
        "Si le licenciement d'un salarié survient pour une cause qui n'est pas réelle et sérieuse, le juge peut proposer la réintégration du salarié dans l'entreprise. Si l'une ou l'autre des parties refuse, le juge octroie une indemnité au salarié. Cette indemnité, à la charge de l'employeur, ne peut être inférieure aux salaires des six derniers mois.",
    },
    { debut: "2017-09-24", fin: null, etat: "VIGUEUR", texte: "barème" },
  ],
};
const L1232_1: SourceOfficielle = {
  base: "Légifrance",
  id: "LEGIARTI000006901125",
  titre: "Article L1232-1 — Code du travail",
  url: null,
  rang: 3,
  rangLibelle: "Loi / ordonnance",
  etat: "VIGUEUR",
  date: null,
  texte: "Tout licenciement pour motif personnel est motivé dans les conditions définies par le présent chapitre. Il est justifié par une cause réelle et sérieuse.",
  versions: [],
};
const ARRET_2002: SourceOfficielle = {
  base: "Judilibre",
  id: "5fca",
  titre: "Cour de cassation soc 2002-07-10 n° 00-45.135",
  url: null,
  rang: 7,
  rangLibelle: "Jurisprudence (interprétation)",
  etat: null,
  date: "2002-07-10",
  texte: "une clause de non-concurrence n'est licite que si elle comporte l'obligation pour l'employeur de verser au salarié une contrepartie financière",
  versions: [],
};

const ARTICLE = (numero: string): SourceCitee => ({
  brut: `article ${numero.replace(/^([LR])/, "$1. ")} du Code du travail`,
  type: "article_code",
  code: "Code du travail",
  numero,
});
const ok = (nom: Controle["nom"]): Controle => ({ nom, statut: "vert", message: "ok" });

function verif(
  citee: SourceCitee,
  officielle: SourceOfficielle | null,
  controles: Controle[],
  versionIndex: number | null = null,
): VerificationSource {
  const statuts = controles.map((c) => c.statut);
  const statut: Statut = (["rouge", "orange", "gris", "vert"] as Statut[]).find((s) => statuts.includes(s)) ?? "gris";
  return {
    citee,
    officielle,
    versionApplicable: officielle && versionIndex !== null ? officielle.versions[versionIndex] : null,
    controles,
    jugement: null,
    statut,
  };
}

function res(
  id: string,
  passage: string,
  statut: Statut,
  verifications: VerificationSource[],
  reecriture?: Reecriture,
): ResultatAffirmation {
  return {
    affirmation: { id, passage, resume: `résumé ${id}`, sources: verifications.map((v) => v.citee) },
    verifications,
    statut,
    message: "",
    reecriture,
  };
}

// A4 : le barème de 2017 appliqué à des faits de 2016.
const PASSAGE_A4 =
  "Si le licenciement est jugé sans cause réelle et sérieuse, l'indemnité est plafonnée à quatre mois de salaire brut (article L. 1235-3 du Code du travail).";
const V_A4 = verif(
  ARTICLE("L1235-3"),
  L1235_3,
  [
    ok("existe"),
    { nom: "date", statut: "orange", message: "Le texte a changé depuis les faits." },
    ok("rang"),
    { nom: "contenu", statut: "rouge", message: "La source ne dit pas cela." },
  ],
  0,
);
const a4 = res("A4", PASSAGE_A4, "rouge", [V_A4]);

// A6 : une décision inventée.
const PASSAGE_A6 =
  "La nullité de la clause ouvre droit à une indemnité forfaitaire de six mois de salaire (Cass. soc., 14 mai 2014, n° 13-17.983).";
const V_A6 = verif(
  { brut: "Cass. soc., 14 mai 2014, n° 13-17.983", type: "decision", numero_affaire: "13-17.983" },
  null,
  [{ nom: "existe", statut: "rouge", message: "introuvable" }],
);
const a6 = res("A6", PASSAGE_A6, "rouge", [V_A6]);

// A7 : une circulaire présentée comme décisive.
const PASSAGE_A7 = "Une circulaire du 12 mars 2010 confirme que la clause est inopposable.";
const V_A7 = verif({ brut: "circulaire du 12 mars 2010", type: "circulaire" }, null, [
  { nom: "existe", statut: "gris", message: "Circulaire : recherche automatique non disponible." },
  { nom: "rang", statut: "orange", message: "Une circulaire est sous la loi et le décret." },
]);
const a7 = res("A7", PASSAGE_A7, "orange", [V_A7]);

const a1 = res("A1", "Tout licenciement doit avoir une cause réelle et sérieuse (article L. 1232-1 du Code du travail).", "vert", [
  verif(ARTICLE("L1232-1"), L1232_1, [ok("existe"), ok("rang"), ok("contenu")]),
]);
const a5 = res("A5", "La clause doit comporter une contrepartie financière (Cass. soc., 10 juillet 2002, n° 00-45.135).", "vert", [
  verif({ brut: "Cass. soc., 10 juillet 2002, n° 00-45.135", type: "decision" }, ARRET_2002, [ok("existe"), ok("contenu")]),
]);

const EXTRAIT_2016 = "Cette indemnité, à la charge de l'employeur, ne peut être inférieure aux salaires des six derniers mois";
const PROPOSITION_A4 = {
  possible: true,
  source: "A4-1",
  passage:
    "Si le licenciement est jugé sans cause réelle et sérieuse, l'indemnité ne peut être inférieure aux salaires des six derniers mois (article L. 1235-3 du Code du travail, dans sa rédaction en vigueur au 15 mars 2016).",
  extrait: EXTRAIT_2016,
  explication: "En 2016, le texte fixait un plancher de six mois, pas un plafond.",
};

function planRedaction(r: ResultatAffirmation, tous: ResultatAffirmation[] = [r]): PlanRedaction {
  const plan = planifier(r, tous, FAITS);
  if (plan?.cas !== "rediger") throw new Error(`plan inattendu : ${JSON.stringify(plan)}`);
  return plan;
}

describe("le rédacteur ne propose rien sans extrait vérifié", () => {
  test("extrait retrouvé mot pour mot → passage réécrit, cité dans la version des faits", () => {
    const plan = planRedaction(a4);
    expect(plan.candidats.map((c) => c.cle)).toEqual(["A4-1"]);
    expect(plan.candidats[0].texte).toContain("six derniers mois");
    const r = retenirProposition(plan, PASSAGE_A4, PROPOSITION_A4);
    expect(r.type).toBe("remplacer");
    expect(r.propose).toContain("six derniers mois");
    expect(r.source?.citation).toBe("article L. 1235-3 du Code du travail, dans sa rédaction en vigueur au 15 mars 2016");
    expect(r.source?.version).toBe("en vigueur du 01/05/2008 au 10/08/2016");
    expect(r.source?.extrait).toBe(EXTRAIT_2016);
  });
  test("extrait inventé → pas de proposition, « à réécrire à la main »", () => {
    const r = retenirProposition(planRedaction(a4), PASSAGE_A4, {
      ...PROPOSITION_A4,
      extrait: "Cette indemnité ne peut excéder quatre mois de salaire brut pour quatre ans d'ancienneté",
    });
    expect(r.type).toBe("a_la_main");
    expect(r.propose).toBeNull();
    expect(r.source).toBeNull();
    expect(r.motif).toContain("mot pour mot");
  });
  test("extrait pris dans la version actuelle et non dans celle des faits → refusé", () => {
    const actuel = { ...L1235_3, versions: [L1235_3.versions[0], { ...L1235_3.versions[1], texte: "Le juge octroie une indemnité dont le montant est compris entre les montants minimaux et maximaux fixés dans le tableau." }] };
    const v = { ...V_A4, officielle: actuel, versionApplicable: actuel.versions[0] };
    const plan = planRedaction(res("A4", PASSAGE_A4, "rouge", [v]));
    const r = retenirProposition(plan, PASSAGE_A4, {
      ...PROPOSITION_A4,
      extrait: "le montant est compris entre les montants minimaux et maximaux fixés dans le tableau",
    });
    expect(r.type).toBe("a_la_main");
  });
  test("le rédacteur renonce, ou ne répond pas → « à réécrire à la main »", () => {
    expect(retenirProposition(planRedaction(a4), PASSAGE_A4, { possible: false }).type).toBe("a_la_main");
    expect(retenirProposition(planRedaction(a4), PASSAGE_A4, null).type).toBe("a_la_main");
    expect(retenirProposition(planRedaction(a4), PASSAGE_A4, { ...PROPOSITION_A4, passage: "  " }).type).toBe("a_la_main");
  });
  test("une référence qui n'est pas dans les sources vérifiées fait écarter la proposition", () => {
    const r = retenirProposition(planRedaction(a4), PASSAGE_A4, {
      ...PROPOSITION_A4,
      passage: `${PROPOSITION_A4.passage} Voir aussi l'article L. 1235-5 et Cass. soc., 4 mars 2015, n° 13-21.123.`,
    });
    expect(r.type).toBe("a_la_main");
    expect(r.motif).toContain("L1235-5");
  });
  test("la référence oubliée ou incomplète est remise dans la version des faits", () => {
    const sansVersion = PROPOSITION_A4.passage.replace(", dans sa rédaction en vigueur au 15 mars 2016", "");
    const r = retenirProposition(planRedaction(a4), PASSAGE_A4, { ...PROPOSITION_A4, passage: sansVersion });
    expect(r.propose).toBe(PROPOSITION_A4.passage);
    const c = { brut: "article L. 1235-3 du Code du travail", citation: "article L. 1235-3 du Code du travail, dans sa rédaction en vigueur au 15 mars 2016" };
    expect(assurerCitation("L'indemnité ne peut être inférieure à six mois.", c)).toBe(
      "L'indemnité ne peut être inférieure à six mois (article L. 1235-3 du Code du travail, dans sa rédaction en vigueur au 15 mars 2016).",
    );
  });
  test("les guillemets recopiés autour du passage sont retirés", () => {
    const r = retenirProposition(planRedaction(a4), PASSAGE_A4, { ...PROPOSITION_A4, passage: `« ${PROPOSITION_A4.passage} »` });
    expect(r.propose).toBe(PROPOSITION_A4.passage);
  });
  test("une source inconnue, ou un passage inchangé, fait écarter la proposition", () => {
    const plan = planRedaction(a4);
    const deux: PlanRedaction = { ...plan, candidats: [...plan.candidats, { ...plan.candidats[0], cle: "A4-2" }] };
    expect(retenirProposition(deux, PASSAGE_A4, { ...PROPOSITION_A4, source: "A9-1" }).type).toBe("a_la_main");
    expect(retenirProposition(plan, PASSAGE_A4, { ...PROPOSITION_A4, passage: PASSAGE_A4 }).type).toBe("a_la_main");
  });
  test("un passage qui garde une décision introuvable est écarté ; le repli retire la référence", () => {
    const passage = `${PASSAGE_A4} (Cass. soc., 14 mai 2014, n° 13-17.983)`;
    const mixte = res("A4", passage, "rouge", [V_A4, V_A6]);
    const plan = planRedaction(mixte);
    expect(plan.repli.type).toBe("source_a_trouver");
    const r = retenirProposition(plan, passage, {
      ...PROPOSITION_A4,
      passage: `${PROPOSITION_A4.passage} (Cass. soc., 14 mai 2014, n° 13-17.983)`,
    });
    expect(r.type).toBe("source_a_trouver");
    expect(r.propose).not.toContain("13-17.983");
  });
});

describe("sans source vérifiée, on ne propose jamais une source inventée", () => {
  test("décision introuvable → la référence est retirée, « source à trouver »", () => {
    const plan = planifier(a6, [a6], FAITS);
    expect(plan?.cas).toBe("fixe");
    const r = plan?.cas === "fixe" ? plan.reecriture : null;
    expect(r?.type).toBe("source_a_trouver");
    expect(r?.propose).toBe(
      "La nullité de la clause ouvre droit à une indemnité forfaitaire de six mois de salaire [source à trouver].",
    );
    expect(r?.source).toBeNull();
  });
  test("référence introuvable au cœur de la phrase → le passage est à supprimer", () => {
    const v = verif({ brut: "L. 122-14-4 du Code du travail", type: "article_code", numero: "L122-14-4" }, null, [
      { nom: "existe", statut: "rouge", message: "introuvable" },
    ]);
    const passage = "L'ancien article L. 122-14-4 du Code du travail prévoyait déjà ce plafonnement.";
    const plan = planifier(res("A4", passage, "rouge", [v]), [], FAITS);
    const r = plan?.cas === "fixe" ? plan.reecriture : null;
    expect(r?.type).toBe("supprimer");
    expect(r?.propose).toBe("");
  });
  test("vraie décision qui ne dit pas cela → si le rédacteur renonce, la référence est retirée", () => {
    const hs = verif({ brut: "Cass. soc., 14 mai 2014, n° 13-17.983", type: "decision" }, { ...ARRET_2002, id: "x" }, [
      ok("existe"),
      { nom: "contenu", statut: "rouge", message: "La source ne dit pas cela : faute inexcusable." },
    ]);
    const plan = planRedaction(res("A6", PASSAGE_A6, "rouge", [hs]));
    expect(plan.repli.type).toBe("source_a_trouver");
    const r = retenirProposition(plan, PASSAGE_A6, { possible: false });
    expect(r.propose).toBe(
      "La nullité de la clause ouvre droit à une indemnité forfaitaire de six mois de salaire [source à trouver].",
    );
    expect(r.motif).toContain("ne dit pas cela");
  });
  test("référence introuvable absente du passage → « à réécrire à la main »", () => {
    const ailleurs = res("A6", "La nullité ouvre droit à six mois de salaire.", "rouge", [V_A6]);
    const plan = planifier(ailleurs, [ailleurs], FAITS);
    expect(plan?.cas === "fixe" && plan.reecriture.type).toBe("a_la_main");
  });
  test("circulaire sans texte de rang supérieur vérifié dans le mémo → « à appuyer sur un texte de rang supérieur »", () => {
    // L'arrêt de 2002 est vérifié mais c'est de la jurisprudence ; A4 est une loi mais elle est rouge.
    const plan = planifier(a7, [a4, a5, a7], FAITS);
    expect(plan?.cas).toBe("fixe");
    expect(plan?.cas === "fixe" && plan.reecriture.type).toBe("rang_superieur");
  });
  test("circulaire avec une loi vérifiée ailleurs dans le mémo → le rédacteur peut s'appuyer sur elle seule", () => {
    const plan = planRedaction(a7, [a1, a4, a5, a7]);
    expect(plan.appui).toBe("rang_superieur");
    expect(plan.candidats.map((c) => c.cle)).toEqual(["A1-1"]);
    expect(plan.repli.type).toBe("rang_superieur");
    const r = retenirProposition(plan, PASSAGE_A7, { possible: false });
    expect(r.type).toBe("rang_superieur");
  });
  test("texte pas en vigueur à la date des faits → aucune réécriture automatique", () => {
    const v = verif(ARTICLE("L1235-3"), L1235_3, [ok("existe"), { nom: "date", statut: "rouge", message: "Pas encore en vigueur." }]);
    const plan = planifier(res("A3", PASSAGE_A4, "rouge", [v]), [], FAITS);
    expect(plan?.cas === "fixe" && plan.reecriture.type).toBe("a_la_main");
    expect(plan?.cas === "fixe" && plan.reecriture.motif).toContain("pas en vigueur");
  });
  test("vert ou gris → rien à proposer", () => {
    expect(planifier(a1, [a1], FAITS)).toBeNull();
    expect(planifier(res("A9", "x", "gris", []), [], FAITS)).toBeNull();
  });
});

describe("mode révision", () => {
  test("le mode révision ne barre que ce qui change", () => {
    expect(diffMots("le délai est de deux ans (article L. 1471-1)", "le délai est de deux ans (article L. 1471-1, version 2016)")).toEqual({
      prefixe: "le délai est de deux ans (article L. ",
      retire: "1471-1)",
      ajoute: "1471-1, version 2016)",
      suffixe: "",
    });
    expect(diffMots("a b c d", "a x d")).toEqual({ prefixe: "a ", retire: "b c", ajoute: "x", suffixe: " d" });
  });});

describe("résumé pour l'avocat", () => {
  test("les rouges triés par gravité, les oranges dans l'ordre, les verts comptés", () => {
    const date = res("A2", "x", "rouge", [verif(ARTICLE("L1"), L1232_1, [{ nom: "date", statut: "rouge", message: "Plus en vigueur." }])]);
    const s = resumePourAvocat([a1, date, a4, a5, a6, a7, res("A9", "y", "gris", [])]);
    expect(s.aCorriger.map((p) => [p.id, p.motif])).toEqual([
      ["A6", "source introuvable"],
      ["A4", "la source ne dit pas cela"],
      ["A2", "texte pas en vigueur à la date des faits"],
    ]);
    expect(s.aRelire.map((p) => [p.id, p.motif])).toEqual([["A7", "circulaire : ne lie pas le juge"]]);
    expect(s.verifies).toBe(2);
    expect(s.nonVerifiables).toBe(1);
  });
});

describe("outils", () => {
  test("références normalisées", () => {
    expect(references("article L. 1235-3 du Code du travail")).toEqual(["L1235-3"]);
    expect(references("Cass. soc., 10 juillet 2002, n° 00-45.135")).toEqual(["POURVOI00-45.135"]);
    expect(references("ordonnance n° 2017-1387 du 22 septembre 2017")).toEqual(["NUM2017-1387"]);
    expect(references("article 1240 du Code civil")).toEqual(["ART1240"]);
  });
  test("dates en toutes lettres", () => {
    expect(dateLongue("2016-03-15")).toBe("15 mars 2016");
    expect(dateLongue("2017-09-01")).toBe("1er septembre 2017");
  });
});
