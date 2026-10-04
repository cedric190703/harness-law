import { describe, expect, test } from "bun:test";
import { rangArticle } from "./hierarchie";
import { versionALaDate } from "./moteur";
import { articleCite, codeVersLegitext, normaliserNumeroArticle } from "./sources";
import { contientVerbatim } from "./verbatim";

const VERSIONS = [
  { debut: "2008-05-01", fin: "2017-09-24", etat: "MODIFIE", texte: "ne peut être inférieure aux salaires des six derniers mois" },
  { debut: "2017-09-24", fin: null, etat: "VIGUEUR", texte: "barème" },
];

describe("version applicable à la date des faits", () => {
  test("faits de 2016 → version 2008-2017", () => {
    expect(versionALaDate(VERSIONS, "2016-03-15")?.debut).toBe("2008-05-01");
  });
  test("faits le jour du changement → nouvelle version", () => {
    expect(versionALaDate(VERSIONS, "2017-09-24")?.debut).toBe("2017-09-24");
  });
  test("faits avant toute version → aucune", () => {
    expect(versionALaDate(VERSIONS, "2001-01-01")).toBeNull();
  });
});

describe("garde-fou mot pour mot", () => {
  const officiel = "Cette indemnité, à la charge de l'employeur, ne peut être inférieure aux salaires des six derniers mois.";
  test("extrait exact (apostrophe typographique, casse) → retrouvé", () => {
    expect(contientVerbatim(officiel, "À LA CHARGE DE L’EMPLOYEUR, ne peut être inférieure")).toBe(true);
  });
  test("extrait inventé → rejeté", () => {
    expect(contientVerbatim(officiel, "ne peut excéder quatre mois de salaire brut")).toBe(false);
  });
  test("extrait trop court → rejeté", () => {
    expect(contientVerbatim(officiel, "mois")).toBe(false);
  });
});

describe("identification des articles", () => {
  test("« L. 1235-3 » → L1235-3", () => expect(normaliserNumeroArticle("L. 1235-3")).toBe("L1235-3"));
  test("« article R 1234-2 » → R1234-2", () => expect(normaliserNumeroArticle("article R 1234-2")).toBe("R1234-2"));
  test("Code du travail", () => expect(codeVersLegitext("Code du travail")).toBe("LEGITEXT000006072050"));
  test("Code civil", () => expect(codeVersLegitext("C. civil")).toBe("LEGITEXT000006070721"));
  test("Code de procédure civile ≠ Code civil", () => {
    expect(codeVersLegitext("Code de procédure civile")).toBe("LEGITEXT000006070716");
    expect(codeVersLegitext("Code de procédure pénale")).toBe("LEGITEXT000006071154");
    expect(codeVersLegitext("Code pénal")).toBe("LEGITEXT000006070719");
  });
  test("code inconnu → null", () => expect(codeVersLegitext("Code de la route martienne")).toBeNull());
  test("article cité dans une loi non codifiée", () => {
    expect(articleCite("article 22 de la loi n° 89-462 du 6 juillet 1989")).toBe("22");
    expect(articleCite("art. 7-1 de la loi du 6 juillet 1989")).toBe("7-1");
    expect(articleCite("loi n° 89-462 du 6 juillet 1989")).toBeNull();
  });
  test("rang : L = loi, R = décret", () => {
    expect(rangArticle("L1235-3")).toBe(3);
    expect(rangArticle("R1234-2")).toBe(4);
    expect(rangArticle("1240")).toBe(3);
  });
});
