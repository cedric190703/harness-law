import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { conclure, preparer, validerDecoupage, type Decoupage, type JugementSaisi } from "./carte";
import { rendreCarte } from "./carte-html";
import { controlerDateEtRang } from "./controles";
import type { SourceOfficielle } from "./types";

const REPONSE = `Le salarié perçoit un salaire mensuel brut de 3 000 euros (pièce n° 1).
Sa période d'essai est de six mois (pièce n° 1).
Une circulaire du 12 mars 2010 confirme que la clause est inopposable.
La jurisprudence constante admet cette solution.
Le contrat a été signé le 3 mars 2020 (pièce n° 7).
Le licenciement doit avoir une cause réelle et sérieuse (article L. 1232-1 du Code du travail).`;

const PIECES = [
  {
    nom: "Contrat de travail",
    texte:
      "Article 4 — Rémunération. Le salarié percevra un salaire mensuel brut de 3 000 euros.\nArticle 5 — Période d'essai. La période d'essai est fixée à deux mois, renouvelable une fois.",
  },
];

const DECOUPAGE: Decoupage = {
  date_faits: "2020-03-03",
  affirmations: [
    {
      passage: "Le salarié perçoit un salaire mensuel brut de 3 000 euros (pièce n° 1).",
      resume: "Salaire de 3 000 euros bruts par mois.",
      sources: [{ brut: "pièce n° 1", type: "piece", numero: "1" }],
    },
    {
      passage: "Sa période d'essai est de six mois (pièce n° 1).",
      resume: "Période d'essai de six mois.",
      sources: [{ brut: "pièce n° 1", type: "piece", numero: "1" }],
    },
    {
      passage: "Une circulaire du 12 mars 2010 confirme que la clause est inopposable.",
      resume: "Une circulaire rend la clause inopposable.",
      sources: [{ brut: "circulaire du 12 mars 2010", type: "circulaire", date: "2010-03-12" }],
    },
    { passage: "La jurisprudence constante admet cette solution.", resume: "Jurisprudence constante.", sources: [] },
    {
      passage: "Le contrat a été signé le 3 mars 2020 (pièce n° 7).",
      resume: "Signature le 3 mars 2020.",
      sources: [{ brut: "pièce n° 7", type: "piece", numero: "7" }],
    },
    {
      passage: "Le licenciement doit avoir une cause réelle et sérieuse (article L. 1232-1 du Code du travail).",
      resume: "Cause réelle et sérieuse.",
      sources: [{ brut: "article L. 1232-1 du Code du travail", type: "article_code", code: "Code du travail", numero: "L1232-1" }],
    },
  ],
};

const SOUTIENT_A1: JugementSaisi = {
  id: "A1-1",
  verdict: "SOUTIENT",
  raisonnement: ["L'affirmation donne 3 000 euros.", "L'article 4 du contrat dit 3 000 euros."],
  extrait: "Le salarié percevra un salaire mensuel brut de 3 000 euros",
  correction: "",
};
const CONTREDIT_A2: JugementSaisi = {
  id: "A2-1",
  verdict: "NE_SOUTIENT_PAS",
  raisonnement: ["L'affirmation dit six mois.", "Le contrat dit deux mois."],
  extrait: "La période d'essai est fixée à deux mois, renouvelable une fois",
  correction: "La période d'essai est de deux mois, renouvelable une fois.",
};

// Les tests ne dépendent pas des clés locales : bases officielles débranchées.
const sauvegarde = { id: process.env.PISTE_CLIENT_ID, secret: process.env.PISTE_CLIENT_SECRET };
beforeAll(() => {
  delete process.env.PISTE_CLIENT_ID;
  delete process.env.PISTE_CLIENT_SECRET;
});
afterAll(() => {
  if (sauvegarde.id) process.env.PISTE_CLIENT_ID = sauvegarde.id;
  if (sauvegarde.secret) process.env.PISTE_CLIENT_SECRET = sauvegarde.secret;
});

async function preparation() {
  const { preparation, erreurs } = await preparer(REPONSE, DECOUPAGE, { titre: "Essai", pieces: PIECES });
  expect(erreurs).toEqual([]);
  return preparation!;
}

describe("découpage", () => {
  test("numérote les affirmations A1, A2…", () => {
    const { affirmations, erreurs } = validerDecoupage(REPONSE, DECOUPAGE);
    expect(erreurs).toEqual([]);
    expect(affirmations.map((a) => a.id)).toEqual(["A1", "A2", "A3", "A4", "A5", "A6"]);
  });
  test("refuse un passage reformulé (pas copié de la réponse)", () => {
    const { erreurs } = validerDecoupage(REPONSE, {
      affirmations: [{ passage: "Le salaire du salarié s'élève à 3 000 euros par mois.", resume: "", sources: [] }],
    });
    expect(erreurs[0]).toContain("A1");
  });
  test("refuse un type de source inconnu et une date mal formée", () => {
    const { erreurs } = validerDecoupage(REPONSE, {
      date_faits: "03/03/2020",
      affirmations: [
        {
          passage: "La jurisprudence constante admet cette solution.",
          resume: "",
          sources: [{ brut: "Dalloz", type: "doctrine" as never }],
        },
      ],
    });
    expect(erreurs.some((e) => e.includes("doctrine"))).toBe(true);
    expect(erreurs.some((e) => e.includes("AAAA-MM-JJ"))).toBe(true);
  });
});

describe("préparation", () => {
  test("seules les sources retrouvées avec un texte sont à juger", async () => {
    const p = await preparation();
    expect(p.elements.filter((e) => e.texteAJuger !== null).map((e) => e.id)).toEqual(["A1-1", "A2-1"]);
  });
  test("date des faits : saisie > texte > aujourd'hui", async () => {
    const saisie = await preparer(REPONSE, DECOUPAGE, { titre: "x", dateSaisie: "2019-01-01", pieces: PIECES });
    expect(saisie.preparation?.dateFaits).toBe("2019-01-01");
    expect(saisie.preparation?.origineDate).toBe("saisie");
    const texte = await preparation();
    expect(texte.origineDate).toBe("texte");
    const inconnue = await preparer(REPONSE, { ...DECOUPAGE, date_faits: null }, {
      titre: "x",
      pieces: PIECES,
      aujourdhui: "2026-10-04",
    });
    expect(inconnue.preparation?.dateFaits).toBe("2026-10-04");
    expect(inconnue.preparation?.origineDate).toBe("aujourd'hui");
  });
});

describe("conclusion : sans preuve, rien n'est vert", () => {
  test("chaque cas reçoit la bonne couleur", async () => {
    const carte = conclure(await preparation(), [SOUTIENT_A1, CONTREDIT_A2], "2026-10-04T12:00:00Z");
    const statut = Object.fromEntries(carte.resultats.map((r) => [r.affirmation.id, r.statut]));
    expect(statut).toEqual({
      A1: "vert", // pièce retrouvée, extrait mot pour mot, SOUTIENT
      A2: "rouge", // la pièce dit le contraire
      A3: "orange", // circulaire : rang inférieur
      A4: "gris", // aucune source citée
      A5: "rouge", // pièce introuvable
      A6: "gris", // bases officielles non connectées
    });
    expect(carte.synthese).toEqual({ vert: 1, orange: 1, rouge: 2, gris: 2 });
  });
  test("un extrait inventé fait écarter le verdict, même SOUTIENT", async () => {
    const invente = { ...SOUTIENT_A1, extrait: "Le salarié percevra un salaire mensuel brut de 4 500 euros" };
    const carte = conclure(await preparation(), [invente], "2026-10-04T12:00:00Z");
    const a1 = carte.resultats[0];
    expect(a1.statut).toBe("gris");
    expect(a1.verifications[0].jugement?.extraitRetrouve).toBe(false);
  });
  test("un élément non jugé ou au verdict inconnu reste gris", async () => {
    const p = await preparation();
    expect(conclure(p, [], "t").resultats[0].statut).toBe("gris");
    const farfelu = { ...SOUTIENT_A1, verdict: "PEUT_ETRE" as never };
    expect(conclure(p, [farfelu], "t").resultats[0].statut).toBe("gris");
  });
  test("PARTIEL donne orange", async () => {
    const partiel = { ...SOUTIENT_A1, verdict: "PARTIEL" as const, correction: "Brut, pas net." };
    expect(conclure(await preparation(), [partiel], "t").resultats[0].statut).toBe("orange");
  });
});

describe("réécritures proposées par l'agent", () => {
  const PERIODE = {
    id: "A2",
    source: "A2-1",
    passage: "Sa période d'essai est de deux mois, renouvelable une fois (pièce n° 1).",
    extrait: "La période d'essai est fixée à deux mois, renouvelable une fois",
    explication: "Le contrat prévoit deux mois, pas six.",
  };
  test("chaque orange ou rouge reçoit une proposition ou ce qu'il reste à faire", async () => {
    const carte = conclure(await preparation(), [SOUTIENT_A1, CONTREDIT_A2], "t", [PERIODE]);
    const r = Object.fromEntries(carte.resultats.map((x) => [x.affirmation.id, x.reecriture ?? null]));
    expect(r.A1).toBeNull(); // vert
    expect(r.A4).toBeNull(); // gris
    expect(r.A2?.type).toBe("remplacer");
    expect(r.A2?.propose).toBe(PERIODE.passage);
    expect(r.A2?.source?.citation).toBe("pièce n° 1");
    expect(r.A3?.type).toBe("rang_superieur"); // circulaire, aucun texte de rang supérieur vérifié dans la réponse
    expect(r.A5?.type).toBe("source_a_trouver");
    expect(r.A5?.propose).toBe("Le contrat a été signé le 3 mars 2020 [source à trouver].");
  });
  test("sans extrait retrouvé mot pour mot, pas de proposition", async () => {
    const invente = { ...PERIODE, extrait: "La période d'essai est fixée à deux mois, non renouvelable" };
    const carte = conclure(await preparation(), [SOUTIENT_A1, CONTREDIT_A2], "t", [invente]);
    const a2 = carte.resultats[1].reecriture;
    expect(a2?.type).toBe("a_la_main");
    expect(a2?.propose).toBeNull();
  });
  test("la carte affiche la réécriture dans les données de la page", async () => {
    const html = rendreCarte(conclure(await preparation(), [SOUTIENT_A1, CONTREDIT_A2], "t", [PERIODE]));
    const json = JSON.parse(html.split('<script id="donnees" type="application/json">')[1].split("</script>")[0]);
    expect(json.revisions.A2).toEqual({
      prefixe: "Sa période d'essai est de ",
      retire: "six mois",
      ajoute: "deux mois, renouvelable une fois",
      suffixe: " (pièce n° 1).",
    });
    expect(html).toContain("function blocReecriture");
  });
});

describe("version en vigueur à la date des faits", () => {
  const article: SourceOfficielle = {
    base: "Légifrance",
    id: "LEGIARTI0001",
    titre: "Article L1235-3 — Code du travail",
    url: null,
    rang: 3,
    rangLibelle: "Loi / ordonnance",
    etat: "VIGUEUR",
    date: "2017-09-24",
    texte: "barème",
    versions: [
      { debut: "2008-05-01", fin: "2017-09-24", etat: "MODIFIE", texte: "six derniers mois" },
      { debut: "2017-09-24", fin: null, etat: "VIGUEUR", texte: "barème" },
    ],
  };
  const citee = { brut: "article L. 1235-3", type: "article_code" as const, numero: "L1235-3" };
  test("faits de 2016 : le texte a changé depuis → orange, version de 2008", () => {
    const r = controlerDateEtRang(citee, article, "2016-03-15");
    expect(r.version?.debut).toBe("2008-05-01");
    expect(r.controles.find((c) => c.nom === "date")?.statut).toBe("orange");
  });
  test("faits antérieurs à toute version → rouge", () => {
    const r = controlerDateEtRang(citee, article, "2001-01-01");
    expect(r.controles.find((c) => c.nom === "date")?.statut).toBe("rouge");
  });
});

describe("page HTML", () => {
  test("un passage piégé ne peut pas casser la page", async () => {
    const piege = "Selon la pièce </script><script>alert(1)</script> le salaire est fixé (pièce n° 1).";
    const { preparation: p } = await preparer(
      piege,
      { affirmations: [{ passage: piege, resume: "x", sources: [] }] },
      { titre: "<b>Essai</b>", pieces: PIECES },
    );
    const html = rendreCarte(conclure(p!, [], "2026-10-04T12:00:00Z"));
    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain("<b>Essai</b>");
    const json = html.split('<script id="donnees" type="application/json">')[1].split("</script>")[0];
    expect(JSON.parse(json).resultats[0].affirmation.passage).toBe(piege);
  });
});
