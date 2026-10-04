import { describe, expect, test } from "bun:test";
import { boucler, memoFinalEnTexte, problemes, remplacerPassage, revision, type Correcteur, type Probleme } from "./boucle";
import type { ResultatAffirmation, SourceOfficielle, Statut } from "./types";

const L1235_3: SourceOfficielle = {
  base: "Légifrance",
  id: "LEGIARTI1",
  titre: "Article L1235-3 — Code du travail",
  url: null,
  rang: 3,
  rangLibelle: "Loi / ordonnance",
  etat: "VIGUEUR",
  date: null,
  texte: "barème",
  versions: [
    { debut: "2008-05-01", fin: "2017-09-24", etat: "MODIFIE", texte: "ne peut être inférieure aux salaires des six derniers mois" },
    { debut: "2017-09-24", fin: null, etat: "VIGUEUR", texte: "barème" },
  ],
};

/** Faux vérificateur : le statut est écrit dans le passage (« [vert] », « [rouge] »…). */
function verifie(id: string, passage: string): ResultatAffirmation {
  const statut = (/\[(vert|orange|rouge|gris)\]/.exec(passage)?.[1] ?? "gris") as Statut;
  return {
    affirmation: { id, passage, resume: passage, sources: [{ brut: "article L. 1235-3", type: "article_code" }] },
    verifications: [
      {
        citee: { brut: "article L. 1235-3", type: "article_code" },
        officielle: statut === "rouge" ? null : L1235_3,
        versionApplicable: statut === "rouge" ? null : L1235_3.versions[0],
        controles: [],
        jugement:
          statut === "rouge"
            ? null
            : {
                verdict: "SOUTIENT",
                raisonnement: [],
                extrait: "ne peut être inférieure aux salaires des six derniers mois",
                extraitRetrouve: true,
                correction: "",
              },
        statut,
      },
    ],
    statut,
    message: statut === "rouge" ? "« Cass. soc. 2099 » est introuvable dans les bases officielles." : `statut ${statut}`,
  };
}

const P1 = "Le licenciement exige une cause réelle et sérieuse [vert].";
const P2 = "L'indemnité est plafonnée à quatre mois [rouge].";
const P3 = "Le préavis est de deux mois [orange].";
const P4 = "Un arrêt de 2099 le confirme [rouge].";
const TEXTE = `Note.\n${P1} ${P2}\n${P3} ${P4}\nFin.`;
const V1 = { texte: TEXTE, resultats: [verifie("A1", P1), verifie("A2", P2), verifie("A3", P3), verifie("A4", P4)] };

/** Faux rédacteur : une réponse scriptée par tour, et la liste de ce qu'on lui a envoyé. */
function redacteur(tours: Record<string, string>[]): Correcteur & { recus: Probleme[][]; textes: string[] } {
  const recus: Probleme[][] = [];
  const textes: string[] = [];
  return {
    recus,
    textes,
    async corriger(texte, p) {
      textes.push(texte);
      recus.push(p);
      return tours[recus.length - 1] ?? {};
    },
    async reverifier(id, passage) {
      return verifie(id, passage);
    },
  };
}

describe("la boucle juge → correction", () => {
  test("corrigé du premier coup : version 2 sans rouge, on s'arrête", async () => {
    const ia = redacteur([
      { A2: "L'indemnité ne peut être inférieure à six mois de salaire [vert].", A3: "Le préavis est de deux mois, sauf disposition plus favorable [vert].", A4: "" },
    ]);
    const b = await boucler(V1, ia);
    expect(b.versions.map((v) => [v.numero, v.synthese.rouge, v.synthese.orange, v.synthese.vert])).toEqual([
      [1, 2, 1, 1],
      [2, 0, 0, 3],
    ]);
    expect(b.tours).toHaveLength(1);
    expect(b.arret).toBe("Plus aucune affirmation fausse.");
    const v2 = b.versions[1];
    expect(v2.texte).toBe(
      `Note.\n${P1} L'indemnité ne peut être inférieure à six mois de salaire [vert].\nLe préavis est de deux mois, sauf disposition plus favorable [vert].\nFin.`,
    );
    expect(v2.supprimes).toEqual(["A4"]);
  });

  test("on envoie à l'IA le mémo complet et chaque problème avec sa preuve", async () => {
    const ia = redacteur([{}]);
    await boucler(V1, ia);
    expect(ia.textes[0]).toBe(TEXTE);
    expect(ia.recus[0].map((p) => [p.id, p.statut])).toEqual([
      ["A2", "rouge"],
      ["A3", "orange"],
      ["A4", "rouge"],
    ]);
    const a3 = ia.recus[0][1].preuves[0];
    expect(a3.version).toBe("en vigueur du 01/05/2008 au 24/09/2017");
    expect(a3.extrait).toBe("ne peut être inférieure aux salaires des six derniers mois");
    expect(ia.recus[0][0].preuves[0].extrait).toBeNull(); // introuvable : aucune preuve à montrer
  });

  test("une référence inventée remplacée par une autre non vérifiée repart en rouge et n'est pas gardée", async () => {
    const ia = redacteur([
      { A2: "L'indemnité est plafonnée (Cass. soc., 3 mai 2017, n° 99-99.999) [rouge].", A4: "Un arrêt de 2098 le confirme [rouge]." },
      { A2: "L'indemnité ne peut être inférieure à six mois [vert].", A4: "" },
    ]);
    const b = await boucler(V1, ia);
    const t1 = b.tours[0];
    expect(t1.tentatives.map((t) => [t.id, t.retenue])).toEqual([
      ["A2", false],
      ["A4", false],
    ]);
    expect(t1.tentatives[0].raison).toContain("introuvable");
    // Rien de gardé au tour 1 : pas de version 2 avec la fausse référence.
    expect(b.versions.every((v) => !v.texte.includes("99-99.999"))).toBe(true);
    // Au tour 2, l'IA reçoit la raison du rejet.
    expect(ia.recus[1].find((p) => p.id === "A2")?.rejet?.propose).toContain("99-99.999");
    expect(b.versions.map((v) => v.numero)).toEqual([1, 2]);
    expect(b.versions[1].synthese.rouge).toBe(0);
  });

  test("deux tours au plus : il reste du rouge, on s'arrête et on le dit", async () => {
    const ia = redacteur([{ A2: "Toujours faux [rouge]." }, { A2: "Encore faux [rouge]." }, { A2: "Juste [vert]." }]);
    const b = await boucler(V1, ia);
    expect(b.tours).toHaveLength(2);
    expect(ia.recus).toHaveLength(2);
    expect(b.versions).toHaveLength(1);
    expect(b.arret).toContain("2 tours");
  });

  test("une correction qui retire la source (gris) n'est pas gardée", async () => {
    const ia = redacteur([{ A2: "L'indemnité est plafonnée [source à trouver]." }]);
    const b = await boucler(V1, ia, { toursMax: 1 });
    expect(b.tours[0].tentatives[0].retenue).toBe(false);
    expect(b.versions).toHaveLength(1);
  });

  test("seuls les passages signalés peuvent changer : le reste est gardé mot pour mot", async () => {
    const ia = redacteur([{ A1: "Réécrit alors qu'il était juste [vert].", A2: "Corrigé [vert].", A4: "Corrigé aussi [vert]." }]);
    const b = await boucler(V1, ia);
    const v2 = b.versions[1];
    expect(v2.texte).toContain(P1);
    expect(v2.texte).not.toContain("Réécrit alors");
    expect(v2.texte.replace("Corrigé [vert].", P2).replace("Corrigé aussi [vert].", P4)).toBe(TEXTE);
  });

  test("sans rouge, on ne relance pas l'IA", async () => {
    const ia = redacteur([]);
    const b = await boucler({ texte: `${P1} ${P3}`, resultats: [verifie("A1", P1), verifie("A3", P3)] }, ia);
    expect(ia.recus).toHaveLength(0);
    expect(b.arret).toContain("Aucune affirmation fausse");
  });

  test("une revérification impossible écarte la correction, sans casser la boucle", async () => {
    const ia = redacteur([{ A2: "Corrigé [vert]." }]);
    ia.reverifier = async () => {
      throw new Error("Mistral indisponible après 4 essais");
    };
    const b = await boucler(V1, ia, { toursMax: 1 });
    expect(b.tours[0].tentatives[0]).toMatchObject({ id: "A2", retenue: false });
    expect(b.tours[0].tentatives[0].raison).toContain("revérification impossible");
    expect(b.versions).toHaveLength(1);
  });
  test("le rédacteur en panne arrête la boucle sans casser la vérification", async () => {
    const ia: Correcteur = {
      corriger: async () => {
        throw new Error("Mistral indisponible");
      },
      reverifier: async (id, p) => verifie(id, p),
    };
    const b = await boucler(V1, ia);
    expect(b.versions).toHaveLength(1);
    expect(b.arret).toContain("Mistral indisponible");
  });
});

describe("mémo final en mode révision", () => {
  test("différences entre la version 1 et la dernière, et ce qui reste signalé", async () => {
    const ia = redacteur([{ A2: "L'indemnité ne peut être inférieure à six mois [vert].", A4: "" }]);
    const b = await boucler(V1, ia);
    const { segments, differences } = revision(b);
    expect(differences.map((d) => [d.id, d.apres === null ? "supprimé" : d.tour === null ? "signalé" : `tour ${d.tour}`, d.note])).toEqual([
      ["A2", "tour 1", 1],
      ["A3", "signalé", 2],
      ["A4", "supprimé", 3],
    ]);
    const v1 = segments.map((s) => ("texte" in s ? s.texte : s.difference.avant)).join("");
    expect(v1).toBe(TEXTE);
    const texte = memoFinalEnTexte(b);
    expect(texte.startsWith(b.versions[1].texte)).toBe(true);
    expect(texte).toContain("[1] A2 · corrigé par l'IA (tour 1), revérifié : vérifié — Article L1235-3 — Code du travail (Légifrance, version en vigueur du 01/05/2008 au 24/09/2017) : « ne peut être inférieure aux salaires des six derniers mois »");
    expect(texte).toContain("[2] A3 · à revoir, non corrigé");
    expect(texte).toContain("[3] A4 · supprimé par l'IA (tour 1)");
  });
});

describe("outils", () => {
  test("supprimer un passage retire aussi l'espace qui le précède", () => {
    expect(remplacerPassage("A. B. C.", "B.", "")).toBe("A. C.");
    expect(remplacerPassage("A. B.", "Z.", "x")).toBeNull();
  });
  test("seuls les orange et rouges sont signalés", () => {
    expect(problemes(V1.resultats).map((p) => p.id)).toEqual(["A2", "A3", "A4"]);
  });
});
