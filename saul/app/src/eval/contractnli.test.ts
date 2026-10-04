import { describe, expect, test } from "bun:test";
import { normaliser } from "@/lib/verbatim";
import {
  contientParMorceaux,
  echantillonner,
  labelDeSaul,
  labelDuModele,
  localiserExtrait,
  mesurerNli,
  positionsNormalisees,
  qualitePreuve,
  synthetiserQualite,
  type Label,
  type LignePaire,
  type Paire,
} from "./contractnli";

function paires(): Paire[] {
  const labels: Label[] = ["Entailment", "Contradiction", "NotMentioned"];
  return Array.from({ length: 60 }, (_, i) => ({
    id: `${100 + Math.floor(i / 6)}:nda-${(i % 6) + 1}`,
    document: 100 + Math.floor(i / 6),
    hypothese: `nda-${(i % 6) + 1}`,
    attendu: labels[i % 3],
  }));
}

describe("échantillon fixé par la graine", () => {
  test("même graine → même échantillon, quel que soit l'ordre reçu", () => {
    const a = echantillonner(paires(), 20261004, 5).map((p) => p.id);
    const b = echantillonner([...paires()].reverse(), 20261004, 5).map((p) => p.id);
    expect(a).toEqual(b);
  });

  test("autre graine → autre échantillon", () => {
    const a = echantillonner(paires(), 20261004, 5).map((p) => p.id);
    const b = echantillonner(paires(), 1, 5).map((p) => p.id);
    expect(a).not.toEqual(b);
  });

  test("équilibré, sans doublon, entrelacé E, C, N", () => {
    const e = echantillonner(paires(), 20261004, 5);
    expect(e).toHaveLength(15);
    expect(new Set(e.map((p) => p.id)).size).toBe(15);
    expect(e.slice(0, 3).map((p) => p.attendu)).toEqual(["Entailment", "Contradiction", "NotMentioned"]);
  });

  test("pas assez de paires d'une étiquette → erreur", () => {
    expect(() => echantillonner(paires(), 20261004, 21)).toThrow();
  });
});

describe("étiquette du modèle seul", () => {
  test("tolère casse et séparateurs", () => {
    expect(labelDuModele({ label: "Entailment" })).toBe("Entailment");
    expect(labelDuModele({ label: "not mentioned" })).toBe("NotMentioned");
    expect(labelDuModele({ label: "CONTRADICTION" })).toBe("Contradiction");
  });
  test("réponse sans étiquette lisible → invalide", () => {
    expect(labelDuModele({ label: "Peut-être" })).toBe("invalide");
    expect(labelDuModele({})).toBe("invalide");
    expect(labelDuModele(null)).toBe("invalide");
  });
});

describe("verdict de Saul → étiquette", () => {
  test("correspondance avec extrait retrouvé", () => {
    expect(labelDeSaul({ verdict: "SOUTIENT", extraitRetrouve: true })).toBe("Entailment");
    expect(labelDeSaul({ verdict: "NE_SOUTIENT_PAS", extraitRetrouve: true })).toBe("Contradiction");
    expect(labelDeSaul({ verdict: "PARTIEL", extraitRetrouve: true })).toBe("Contradiction");
    expect(labelDeSaul({ verdict: "HORS_SUJET", extraitRetrouve: true })).toBe("NotMentioned");
  });
  test("extrait introuvable → gris, même si le verdict est SOUTIENT", () => {
    expect(labelDeSaul({ verdict: "SOUTIENT", extraitRetrouve: false })).toBe("gris");
  });
  test("verdict inconnu → gris", () => {
    expect(labelDeSaul({ verdict: "PEUT_ETRE" as "SOUTIENT", extraitRetrouve: true })).toBe("gris");
  });
});

describe("garde-fou tolérant aux coupures (analyse seulement)", () => {
  const t = "The Recipient shall hold all information, as defined below, in strict confidence and shall return it on request.";

  test("morceaux séparés par [...] ou …, chacun mot pour mot et dans l'ordre → accepté", () => {
    expect(contientParMorceaux(t, "The Recipient shall hold all information [...] in strict confidence and shall return it")).toBe(true);
    expect(contientParMorceaux(t, "The Recipient shall hold all information … shall return it on request")).toBe(true);
  });

  test("un morceau absent, dans le désordre ou trop court → refusé", () => {
    expect(contientParMorceaux(t, "The Recipient shall hold all information [...] shall destroy it on request")).toBe(false);
    expect(contientParMorceaux(t, "shall return it on request [...] The Recipient shall hold all information")).toBe(false);
    expect(contientParMorceaux(t, "The Recipient shall hold all information [...] it")).toBe(false);
    expect(contientParMorceaux(t, "")).toBe(false);
  });

  test("sans coupure, revient au mot pour mot", () => {
    expect(contientParMorceaux(t, "hold all information, as defined below, in strict confidence")).toBe(true);
  });
});

describe("mesures", () => {
  const lignes: LignePaire[] = [
    { attendu: "Entailment", predit: "Entailment" },
    { attendu: "Entailment", predit: "gris" },
    { attendu: "Contradiction", predit: "Entailment" },
    { attendu: "Contradiction", predit: "Contradiction" },
    { attendu: "NotMentioned", predit: "NotMentioned" },
    { attendu: "NotMentioned", predit: "Contradiction" },
  ];
  const m = mesurerNli(lignes);

  test("exactitude, gris et exactitude hors gris", () => {
    expect(m.exactitude).toEqual({ n: 3, sur: 6, taux: 0.5 });
    expect(m.gris).toEqual({ n: 1, sur: 6, taux: 1 / 6 });
    expect(m.exactitudeHorsGris).toEqual({ n: 3, sur: 5, taux: 0.6 });
  });

  test("faux verts : NON Entailment déclarées Entailment", () => {
    expect(m.fauxVerts).toEqual({ n: 1, sur: 4, taux: 0.25 });
    expect(m.fauxVertsSurContradiction.n).toBe(1);
    expect(m.fauxVertsSurNonMentionne.n).toBe(0);
    expect(m.vertsConfirmes).toEqual({ n: 1, sur: 2, taux: 0.5 });
  });

  test("F1 par étiquette et F1 macro (gris compte comme une erreur)", () => {
    // Entailment : 1 vrai sur 2 prédits, 1 sur 2 attendus → P = R = F1 = 0,5.
    expect(m.parLabel.Entailment.f1).toBeCloseTo(0.5);
    // Contradiction : 1 vrai sur 2 prédits, 1 sur 2 attendus.
    expect(m.parLabel.Contradiction.f1).toBeCloseTo(0.5);
    // NotMentioned : 1 vrai sur 1 prédit, 1 sur 2 attendus → F1 = 2/3.
    expect(m.parLabel.NotMentioned.f1).toBeCloseTo(2 / 3);
    expect(m.f1Macro).toBeCloseTo((0.5 + 0.5 + 2 / 3) / 3);
  });

  test("matrice : lignes attendues, colonnes prédites", () => {
    expect(m.matrice.Entailment.gris).toBe(1);
    expect(m.matrice.Contradiction.Entailment).toBe(1);
    expect(m.matrice.NotMentioned.Contradiction).toBe(1);
  });

  test("étiquette jamais prédite → précision et F1 nuls, sans division par zéro", () => {
    const r = mesurerNli([{ attendu: "Entailment", predit: "gris" }]);
    expect(r.parLabel.Entailment).toEqual({ precision: 0, rappel: 0, f1: 0 });
    expect(r.exactitudeHorsGris.taux).toBeNull();
  });
});

describe("positions de l'extrait dans le contrat", () => {
  const textes = [
    "Receiving Party shall NOT disclose — any Confidential Information.",
    "L'élève a reçu   l'œuvre <b>intégrale</b> le 3 mai.",
    "  ...Début\n\n(a) item; (b) autre  ",
  ];

  test("la normalisation avec positions donne exactement normaliser()", () => {
    for (const t of textes) expect(positionsNormalisees(t).norm).toBe(normaliser(t));
  });

  test("retrouve l'extrait malgré casse, ponctuation et espaces", () => {
    const t = "1. Definitions.\nThe Receiving Party shall not, without consent, disclose any Confidential Information.";
    const [occ] = localiserExtrait(t, "shall not without consent disclose any confidential information");
    expect(t.slice(occ[0], occ[1])).toBe("shall not, without consent, disclose any Confidential Information");
  });

  test("toutes les occurrences ; extrait trop court ou absent → aucune", () => {
    const t = "Each party shall return all copies. Later, each party shall return all copies.";
    expect(localiserExtrait(t, "each party shall return all copies")).toHaveLength(2);
    expect(localiserExtrait(t, "copies")).toEqual([]);
    expect(localiserExtrait(t, "each party shall destroy all copies")).toEqual([]);
  });
});

describe("qualité de la preuve", () => {
  // Trois passages : [0, 10), [10, 30), [30, 50).
  const spans: [number, number][] = [
    [0, 10],
    [10, 30],
    [30, 50],
  ];

  test("extrait dans le passage de preuve → recoupe, précision pleine", () => {
    const q = qualitePreuve(spans, [1], [[12, 28]]);
    expect(q).toEqual({ recoupe: true, precisionCaracteres: 1, passagesTouches: [1], precisionPassages: 1, rappelPassages: 1 });
  });

  test("extrait à cheval sur la preuve et un autre passage", () => {
    const q = qualitePreuve(spans, [1, 2], [[20, 40]]);
    expect(q?.recoupe).toBe(true);
    expect(q?.precisionCaracteres).toBe(1);
    expect(q?.passagesTouches).toEqual([1, 2]);
    expect(q?.rappelPassages).toBe(1);
    const r = qualitePreuve(spans, [2], [[20, 40]]);
    expect(r?.precisionCaracteres).toBe(0.5);
    expect(r?.precisionPassages).toBe(0.5);
  });

  test("extrait hors de la preuve → ne recoupe pas", () => {
    expect(qualitePreuve(spans, [2], [[0, 8]])?.recoupe).toBe(false);
  });

  test("plusieurs occurrences → la meilleure", () => {
    expect(qualitePreuve(spans, [2], [[0, 8], [32, 40]])?.recoupe).toBe(true);
  });

  test("sans occurrence ou sans preuve officielle → null", () => {
    expect(qualitePreuve(spans, [1], [])).toBeNull();
    expect(qualitePreuve(spans, [], [[0, 8]])).toBeNull();
  });

  test("synthèse", () => {
    const s = synthetiserQualite([
      { recoupe: true, precisionCaracteres: 1, passagesTouches: [1], precisionPassages: 1, rappelPassages: 0.5 },
      { recoupe: false, precisionCaracteres: 0, passagesTouches: [0], precisionPassages: 0, rappelPassages: 0 },
    ]);
    expect(s.recoupe).toEqual({ n: 1, sur: 2, taux: 0.5 });
    expect(s.precisionCaracteresMoyenne).toBe(0.5);
    expect(s.rappelPassagesMoyen).toBe(0.25);
    expect(synthetiserQualite([]).precisionCaracteresMoyenne).toBeNull();
  });
});
