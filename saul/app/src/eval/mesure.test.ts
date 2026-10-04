import { describe, expect, test } from "bun:test";
import { JEU_FR, texteNote } from "./jeu-fr";
import { calculerMesures, matrice, mots, rattacher, statutRattache, type Ligne } from "./mesure";

const ATTENDUS = [
  {
    id: "A",
    passage:
      "L'entretien préalable pouvait se tenir deux jours ouvrables après la présentation de la lettre de convocation (article L. 1232-2 du Code du travail).",
  },
  {
    id: "B",
    passage: "Ayant plus de deux ans d'ancienneté, Mme Durand a droit à un préavis de deux mois (article L. 1234-1 du Code du travail).",
  },
  { id: "C", passage: "La doctrine majoritaire considère qu'une clause de révision du prix doit s'interpréter en faveur du débiteur." },
];

describe("mots porteurs", () => {
  test("sans accents, sans mots vides, sans doublon", () => {
    expect([...mots("Le délai d'un mois — le délai")]).toEqual(["delai", "mois"]);
  });
});

describe("rattachement des affirmations obtenues aux attendues", () => {
  test("passage recopié à l'identique → rattaché", () => {
    const r = rattacher(ATTENDUS, [{ id: "o1", passage: ATTENDUS[0].passage }]);
    expect(r.liens.get("A")).toEqual(["o1"]);
    expect(r.enTrop).toEqual([]);
  });

  test("affirmation coupée en deux morceaux → les deux rattachés à la même attendue", () => {
    const r = rattacher(ATTENDUS, [
      { id: "o1", passage: "Ayant plus de deux ans d'ancienneté, Mme Durand" },
      { id: "o2", passage: "a droit à un préavis de deux mois (article L. 1234-1 du Code du travail)" },
    ]);
    expect(r.liens.get("B")).toEqual(["o1", "o2"]);
  });

  test("deux attendues fusionnées en une → rattachée aux deux", () => {
    const r = rattacher(ATTENDUS, [{ id: "o1", passage: `${ATTENDUS[0].passage} ${ATTENDUS[1].passage}` }]);
    expect(r.liens.get("A")).toEqual(["o1"]);
    expect(r.liens.get("B")).toEqual(["o1"]);
    expect(r.liens.get("C")).toEqual([]);
  });

  test("phrase de faits sans rapport → en trop ; attendue non découpée → aucun lien", () => {
    const r = rattacher(ATTENDUS, [{ id: "o1", passage: "La société emploie 120 salariés depuis 2018." }]);
    expect(r.enTrop).toEqual(["o1"]);
    expect(r.liens.get("A")).toEqual([]);
  });

  test("une seule référence en commun ne suffit pas à rattacher", () => {
    const r = rattacher(ATTENDUS, [{ id: "o1", passage: "article L. 1232-2" }]);
    expect(r.enTrop).toEqual(["o1"]);
  });
});

describe("statut retenu pour une attendue", () => {
  test("aucun morceau → absent", () => expect(statutRattache([])).toBe("absent"));
  test("le pire des morceaux qui citent une source", () => {
    expect(
      statutRattache([
        { statut: "vert", nbSources: 1 },
        { statut: "rouge", nbSources: 1 },
      ]),
    ).toBe("rouge");
  });
  test("un fragment de faits sans source (gris) ne déteint pas sur la règle sourcée", () => {
    expect(
      statutRattache([
        { statut: "gris", nbSources: 0 },
        { statut: "vert", nbSources: 1 },
      ]),
    ).toBe("vert");
  });
  test("sans aucune source → gris", () => expect(statutRattache([{ statut: "gris", nbSources: 0 }])).toBe("gris"));
});

const LIGNES: Ligne[] = [
  { id: "1", type: "juste", attendu: "vert", obtenu: "vert" },
  { id: "2", type: "juste", attendu: "vert", obtenu: "rouge" },
  { id: "3", type: "juste", attendu: "vert", obtenu: "gris" },
  { id: "4", type: "decision_inventee", attendu: "rouge", obtenu: "rouge" },
  { id: "5", type: "ne_dit_pas_ca", attendu: "rouge", obtenu: "vert" },
  { id: "6", type: "ne_dit_pas_ca", attendu: "rouge", obtenu: "gris" },
  { id: "7", type: "texte_modifie", attendu: "orange", obtenu: "orange" },
  { id: "8", type: "circulaire", attendu: "orange", obtenu: "absent" },
  { id: "9", type: "reference_floue", attendu: "gris", obtenu: "vert" },
];

describe("matrice et taux", () => {
  test("matrice attendu × obtenu", () => {
    const m = matrice(LIGNES);
    expect(m.vert).toEqual({ vert: 1, orange: 0, rouge: 1, gris: 1, absent: 0 });
    expect(m.rouge).toEqual({ vert: 1, orange: 0, rouge: 1, gris: 1, absent: 0 });
    expect(m.orange.absent).toBe(1);
    expect(m.gris.vert).toBe(1);
  });

  test("détection : le gris compte, l'absente non ; détection stricte : rouge ou orange seulement", () => {
    const r = calculerMesures(LIGNES);
    expect(r.detection).toEqual({ n: 3, sur: 5, taux: 0.6 });
    expect(r.detectionStricte).toEqual({ n: 2, sur: 5, taux: 0.4 });
  });

  test("faux verts parmi les fausses, et parmi toutes les non vertes (le gris attendu compte)", () => {
    const r = calculerMesures(LIGNES);
    expect(r.fauxVertsSurFausses).toEqual({ n: 1, sur: 5, taux: 0.2 });
    expect(r.fauxVerts).toEqual({ n: 2, sur: 6, taux: 2 / 6 });
  });

  test("faux rouges et verts confirmés, sur les justes", () => {
    const r = calculerMesures(LIGNES);
    expect(r.fauxRouges).toEqual({ n: 1, sur: 3, taux: 1 / 3 });
    expect(r.vertsConfirmes).toEqual({ n: 1, sur: 3, taux: 1 / 3 });
  });

  test("par type d'erreur", () => {
    const r = calculerMesures(LIGNES);
    expect(r.parType.ne_dit_pas_ca).toEqual({ n: 2, exactes: 0, signalees: 1, fauxVerts: 1, fauxRouges: 0, absentes: 0 });
    expect(r.parType.circulaire.absentes).toBe(1);
    expect(r.exactitude).toEqual({ n: 3, sur: 9, taux: 3 / 9 });
  });

  test("aucune ligne → taux nul, pas de division par zéro", () => {
    expect(calculerMesures([]).detection.taux).toBeNull();
  });
});

describe("jeu de test", () => {
  const cas = JEU_FR.flatMap((n) => n.cas.map((c) => ({ note: n, c })));
  test("identifiants uniques", () => {
    expect(new Set(cas.map(({ c }) => c.id)).size).toBe(cas.length);
  });
  test("chaque passage figure une seule fois dans sa note", () => {
    for (const { note, c } of cas) expect(texteNote(note).split(c.passage).length).toBe(2);
  });
  test("chaque affirmation sourcée a sa preuve, sauf inexistence et circulaire", () => {
    for (const { c } of cas) {
      if (c.type === "reference_floue") expect(c.source).toBeNull();
      else expect(c.source).not.toBeNull();
      if (["juste", "ne_dit_pas_ca", "texte_modifie"].includes(c.type)) expect(c.preuve).toBeTruthy();
      if (c.type === "circulaire") expect(c.intitule).toBeTruthy();
    }
  });
  test("chaque passage se rattache à lui-même et à lui seul", () => {
    for (const note of JEU_FR) {
      const r = rattacher(note.cas, note.cas);
      for (const c of note.cas) expect(r.liens.get(c.id)).toEqual([c.id]);
    }
  });
});
