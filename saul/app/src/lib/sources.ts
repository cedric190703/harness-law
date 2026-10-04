import { libelleRang, rangSource } from "./hierarchie";
import { judilibre, legifrance } from "./piste";
import type { SourceCitee, SourceOfficielle, VersionTexte } from "./types";
import { normaliser, texteBrut } from "./verbatim";

/** Identifiants Légifrance des codes les plus cités (source : DILA). */
const CODES: Record<string, string> = {
  civil: "LEGITEXT000006070721",
  penal: "LEGITEXT000006070719",
  commerce: "LEGITEXT000005634379",
  travail: "LEGITEXT000006072050",
  consommation: "LEGITEXT000006069565",
  "procedure civile": "LEGITEXT000006070716",
  "procedure penale": "LEGITEXT000006071154",
  "securite sociale": "LEGITEXT000006073189",
  "propriete intellectuelle": "LEGITEXT000006069414",
  "monetaire et financier": "LEGITEXT000006072026",
  "general des impots": "LEGITEXT000006069577",
  "procedures fiscales": "LEGITEXT000006069583",
  "sante publique": "LEGITEXT000006072665",
  urbanisme: "LEGITEXT000006074075",
  environnement: "LEGITEXT000006074220",
  assurances: "LEGITEXT000006073984",
  "construction et de l habitation": "LEGITEXT000006074096",
  "relations entre le public et l administration": "LEGITEXT000031366350",
  "justice administrative": "LEGITEXT000006070933",
};

export function codeVersLegitext(code: string | null | undefined): string | null {
  if (!code) return null;
  // Identifiant Légifrance déjà résolu (code, ou loi non codifiée).
  if (/^(LEGITEXT|JORFTEXT)/i.test(code)) return code;
  const n = normaliser(code).replace(/^code (de la |du |des |de l |de )?/, "");
  if (n === "cgi") return CODES["general des impots"];
  if (CODES[n]) return CODES[n];
  // Le nom le plus long d'abord : « procedure civile » contient aussi « civil ».
  const nom = Object.keys(CODES)
    .sort((a, b) => b.length - a.length)
    .find((c) => n.includes(c));
  return nom ? CODES[nom] : null;
}

/** « L. 1235-3 » → « L1235-3 » */
export function normaliserNumeroArticle(numero: string): string {
  return numero
    .replace(/^art(icle)?\.?\s*/i, "")
    .replace(/\s+/g, "")
    .replace(/^([LRDA])\.?/i, (m) => m[0].toUpperCase());
}

/** « article 22 de la loi n° 89-462 » → « 22 » ; null si aucun article n'est cité. */
export function articleCite(brut: string): string | null {
  const m = /\bart(?:icle)?\.?\s*((?:[LRDA]\.?\s?)?\d+(?:-\d+)*)/i.exec(brut);
  return m ? normaliserNumeroArticle(m[1]) : null;
}

/** Les dates Légifrance arrivent en millisecondes ; 2999 = « sans fin ». */
function dateIso(d: unknown): string | null {
  if (d === null || d === undefined || d === "") return null;
  const date = typeof d === "number" ? new Date(d) : new Date(String(d));
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() >= 2999) return null;
  return date.toISOString().slice(0, 10);
}

type Brut = Record<string, unknown>;

async function chercherArticle(c: SourceCitee): Promise<SourceOfficielle | null | "non_identifiable"> {
  const idCode = codeVersLegitext(c.code);
  if (!idCode || !c.numero) return "non_identifiable";
  const num = normaliserNumeroArticle(c.numero);

  const variantes = /^[LRDA]/.test(num) ? [num] : [num, `L${num}`];
  let article: Brut | null = null;
  for (const v of variantes) {
    const d = await legifrance<{ article?: Brut }>("/consult/getArticleWithIdAndNum", { id: idCode, num: v });
    if (d?.article?.id) {
      article = d.article;
      break;
    }
  }
  if (!article) return null;

  let versions: VersionTexte[] = [];
  if (article.cid) {
    const h = await legifrance<{ listArticle?: Brut[] }>("/consult/getArticleByCid", { cid: article.cid });
    versions = (h?.listArticle ?? [])
      .map((v) => ({
        debut: dateIso(v.dateDebut),
        fin: dateIso(v.dateFin),
        etat: (v.etat as string) ?? null,
        texte: texteBrut(String(v.texteHtml ?? v.texte ?? "")),
      }))
      .sort((a, b) => (a.debut ?? "").localeCompare(b.debut ?? ""));
  }
  const rang = rangSource(c);
  return {
    base: "Légifrance",
    id: String(article.id),
    titre: `Article ${article.num ?? num} — ${c.code ?? ""}`.trim(),
    url: `https://www.legifrance.gouv.fr/codes/article_lc/${article.id}`,
    rang,
    rangLibelle: libelleRang(rang),
    etat: (article.etat as string) ?? null,
    date: dateIso(article.dateDebut),
    texte: texteBrut(String(article.texteHtml ?? article.texte ?? "")),
    versions,
  };
}

function estAdministratif(juridiction: string | null | undefined): boolean {
  const j = normaliser(juridiction ?? "");
  return /conseil d etat|\bce\b|\bcaa\b|\bta\b|administrati/.test(j);
}

async function chercherDecision(c: SourceCitee): Promise<SourceOfficielle | null | "non_identifiable"> {
  const numero = c.numero_affaire?.trim();
  if (!numero) return "non_identifiable";
  const fond = estAdministratif(c.juridiction) ? "CETAT" : "JURI";
  const champ = fond === "CETAT" ? "NUM_DEC" : "NUM_AFFAIRE";

  const recherche = await legifrance<{ results?: Brut[] }>("/search", {
    fond,
    recherche: {
      champs: [
        { typeChamp: champ, criteres: [{ typeRecherche: "EXACTE", valeur: numero, operateur: "ET" }], operateur: "ET" },
      ],
      operateur: "ET",
      pageSize: 5,
      pageNumber: 1,
      sort: "PERTINENCE",
      typePagination: "DEFAUT",
    },
  });
  const titre = (recherche?.results?.[0]?.titles as Brut[] | undefined)?.[0];
  if (titre?.id) {
    const d = await legifrance<{ text?: Brut }>("/consult/juri", { textId: titre.id });
    const t = d?.text;
    if (t) {
      const rang = rangSource(c);
      return {
        base: "Légifrance",
        id: String(titre.id),
        titre: String(t.titre ?? titre.title ?? c.brut),
        url: `https://www.legifrance.gouv.fr/juri/id/${titre.id}`,
        rang,
        rangLibelle: libelleRang(rang),
        etat: null,
        date: dateIso(t.dateTexte ?? t.dateDecision),
        texte: texteBrut(String(t.texteHtml ?? t.texte ?? "")),
        versions: [],
      };
    }
  }

  if (fond === "JURI") {
    const r = await judilibre<{ results?: Brut[] }>("/search", { query: numero, page_size: "5" });
    const trouve = (r?.results ?? []).find((x) =>
      [x.number, ...((x.numbers as string[]) ?? [])].some((n) => normaliser(String(n)) === normaliser(numero)),
    );
    if (trouve?.id) {
      const d = await judilibre<Brut>("/decision", { id: String(trouve.id) });
      if (d) {
        const rang = rangSource(c);
        return {
          base: "Judilibre",
          id: String(d.id),
          titre: `${d.jurisdiction === "cc" ? "Cour de cassation" : d.jurisdiction} ${d.chamber ?? ""} ${d.decision_date ?? ""} n° ${d.number ?? numero}`,
          url: `https://www.courdecassation.fr/decision/${d.id}`,
          rang,
          rangLibelle: libelleRang(rang),
          etat: null,
          date: (d.decision_date as string) ?? null,
          texte: String(d.text ?? ""),
          versions: [],
        };
      }
    }
  }
  return null;
}

async function chercherTexte(c: SourceCitee): Promise<SourceOfficielle | null | "non_identifiable"> {
  const numero = c.numero?.trim();
  if (!numero) return "non_identifiable";
  const recherche = await legifrance<{ results?: Brut[] }>("/search", {
    fond: "LODA_ETAT",
    recherche: {
      champs: [{ typeChamp: "NUM", criteres: [{ typeRecherche: "EXACTE", valeur: numero, operateur: "ET" }], operateur: "ET" }],
      operateur: "ET",
      pageSize: 5,
      pageNumber: 1,
      sort: "PERTINENCE",
      typePagination: "DEFAUT",
    },
  });
  const titre = (recherche?.results?.[0]?.titles as Brut[] | undefined)?.[0];
  if (!titre?.id) return null;
  // L'identifiant du texte (cid) : l'id de la recherche porte un suffixe de version que Légifrance refuse (400).
  const idTexte = String(titre.cid ?? titre.id);

  // « article 22 de la loi n° 89-462 » : l'article lui-même, avec ses versions, plutôt que la loi entière.
  const num = articleCite(c.brut);
  if (num) {
    const article = await chercherArticle({ ...c, code: idTexte, numero: num });
    if (article === "non_identifiable" || !article) return article;
    return { ...article, titre: `Article ${num} — ${String(titre.title ?? c.brut)}` };
  }

  const d = await legifrance<Brut>("/consult/lawDecree", {
    textId: idTexte,
    date: new Date().toISOString().slice(0, 10),
  });
  const articles: string[] = [];
  const parcourir = (n: Brut) => {
    for (const a of (n.articles as Brut[]) ?? []) {
      articles.push(`Article ${a.num ?? ""}\n${texteBrut(String(a.content ?? a.texteHtml ?? a.texte ?? ""))}`);
    }
    for (const s of (n.sections as Brut[]) ?? []) parcourir(s);
  };
  if (d) parcourir(d);
  const rang = rangSource(c);
  return {
    base: "Légifrance",
    id: String(titre.id),
    titre: String(d?.title ?? titre.title ?? c.brut),
    url: `https://www.legifrance.gouv.fr/loda/id/${titre.id}`,
    rang,
    rangLibelle: libelleRang(rang),
    etat: (titre.legalStatus as string) ?? null,
    date: dateIso(d?.dateTexte ?? d?.dateParution),
    texte: articles.join("\n\n"),
    versions: [],
  };
}

export interface Piece {
  nom: string;
  texte: string;
}

function chercherPiece(c: SourceCitee, pieces: Piece[]): SourceOfficielle | null {
  const cible = normaliser(`${c.numero ?? ""} ${c.titre ?? ""} ${c.brut}`);
  const piece =
    pieces.find((p) => cible.includes(normaliser(p.nom))) ??
    pieces.find((p, i) => new RegExp(`\\b(piece|pce|p) (n )?${i + 1}\\b`).test(cible));
  if (!piece) return null;
  return {
    base: "Dossier",
    id: piece.nom,
    titre: piece.nom,
    url: null,
    rang: 0,
    rangLibelle: "Pièce du dossier",
    etat: null,
    date: null,
    texte: piece.texte,
    versions: [],
  };
}

/** Retrouve une source citée dans la base officielle adaptée (ou dans les pièces du dossier). */
export async function retrouverSource(
  c: SourceCitee,
  pieces: Piece[],
): Promise<SourceOfficielle | null | "non_identifiable"> {
  switch (c.type) {
    case "article_code":
      return chercherArticle(c);
    case "decision":
      return chercherDecision(c);
    case "loi":
    case "ordonnance":
    case "decret":
    case "arrete":
      return chercherTexte(c);
    case "piece":
      return chercherPiece(c, pieces);
    default:
      return "non_identifiable";
  }
}
