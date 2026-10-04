// La data room, telle qu'elle est : des fichiers mal nommés, des doublons, des
// brouillons rangés à côté des originaux, et des pièces qu'on ne peut pas lire.
//
// Ce module ne fait qu'une chose, mais la fait sans rien supposer : il ouvre
// chaque fichier, décide s'il est lisible, et dit pourquoi quand il ne l'est
// pas. Un document illisible n'est jamais passé sous silence : c'est
// exactement l'information que le juriste doit avoir pour savoir ce qui n'a
// pas été lu.

import { readdir, readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extname, join, relative, basename } from "node:path";

/** Ce qu'on sait lire directement, sans reconnaissance de caractères. */
const TEXTE = new Set([".txt", ".md", ".csv"]);
/** Ce qui demande une reconnaissance de caractères. */
const IMAGE = new Set([".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"]);

/**
 * Les mots qui annoncent un brouillon. On ne les cherche que dans le nom du
 * fichier et dans son tout début : un contrat peut parfaitement *parler* d'un
 * projet en son corps sans en être un.
 */
const MARQUES_BROUILLON = [
  "ne pas signer",
  "version de travail",
  "non exécuté",
  "non execute",
  "ne pas diffuser",
  "draft",
];
/** La longueur d'en-tête où une mention de brouillon a un sens. */
const ENTETE_BROUILLON = 300;

/** Les mots qui annoncent un avenant, cherchés dans le nom ou le titre seul. */
const MARQUES_AVENANT = ["avenant", "amendement", "modificatif"];
/** Un titre tient dans les deux premières lignes utiles. */
const ENTETE_TITRE = 160;

/** Les fichiers qui décrivent la data room au lieu d'en faire partie. */
const META = [/^0*0?[-_ ]*lisez[-_ ]?moi/i, /^readme/i, /^index\./i, /^sommaire/i];

/** Le rôle particulier de deux pièces qui ne sont pas des documents à dépouiller. */
function rolePieceDeProcedure(nom, debut) {
  const n = nom.toLowerCase();
  const d = debut.toLowerCase();
  if (n.includes("liste de demandes") || n.includes("request list") || d.includes("liste de demandes de l'acqu"))
    return "liste-demandes";
  if (n.includes("réponses") || n.includes("reponses") || n.includes("q&r") || d.includes("réponses du vendeur"))
    return "reponses-vendeur";
  return null;
}

export async function listerFichiers(racine) {
  const sortie = [];
  async function descendre(dossier) {
    for (const e of await readdir(dossier, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const chemin = join(dossier, e.name);
      if (e.isDirectory()) await descendre(chemin);
      else sortie.push(chemin);
    }
  }
  await descendre(racine);
  return sortie.sort();
}

/**
 * Ouvre un fichier et dit ce qu'on peut en faire. Trois cas seulement :
 * lisible, à reconnaître (image), ou illisible — et dans ce dernier cas, la
 * raison est toujours dite en français, parce qu'elle paraîtra dans le rapport.
 */
export async function lireDocument(racine, chemin) {
  const ext = extname(chemin).toLowerCase();
  const infos = await stat(chemin);
  const brut = await readFile(chemin);
  const base = {
    id: null,
    chemin: relative(racine, chemin),
    nom: basename(chemin),
    dossier: relative(racine, chemin).split("/").slice(0, -1).join("/") || "(racine)",
    extension: ext,
    octets: infos.size,
    empreinte: createHash("sha256").update(brut).digest("hex").slice(0, 16),
  };

  if (TEXTE.has(ext)) {
    const texte = brut.toString("utf8");
    // Un fichier texte qui ne contient presque rien d'imprimable n'est pas du
    // texte : mieux vaut le dire que de livrer une page blanche.
    const imprimables = (texte.match(/[\p{L}\p{N}]/gu) ?? []).length;
    if (imprimables < 40) {
      return { ...base, lisible: false, motifIllisible: "Fichier texte sans contenu exploitable.", texte: "", pages: [] };
    }
    return { ...base, lisible: true, aReconnaitre: false, texte, pages: paginer(texte) };
  }

  if (IMAGE.has(ext)) {
    return {
      ...base,
      lisible: false,
      aReconnaitre: true,
      motifIllisible:
        "Document scanné : image sans couche de texte. Une reconnaissance de caractères est nécessaire.",
      texte: "",
      pages: [],
    };
  }

  if (ext === ".pdf") {
    const entete = brut.subarray(0, 5).toString("latin1");
    if (entete !== "%PDF-") {
      return {
        ...base,
        lisible: false,
        motifIllisible:
          "Le fichier porte l'extension .pdf mais n'en est pas un : son en-tête est absent. Fichier probablement corrompu au dépôt.",
        texte: "",
        pages: [],
      };
    }
    // Un vrai PDF : on tente d'en tirer le texte des flux non compressés.
    const texte = texteDuPdf(brut);
    if (texte.trim().length < 80) {
      return {
        ...base,
        lisible: false,
        aReconnaitre: true,
        motifIllisible: "PDF sans couche de texte exploitable : une reconnaissance de caractères est nécessaire.",
        texte: "",
        pages: [],
      };
    }
    return { ...base, lisible: true, aReconnaitre: false, texte, pages: paginer(texte) };
  }

  return {
    ...base,
    lisible: false,
    motifIllisible: `Format non pris en charge (${ext || "sans extension"}).`,
    texte: "",
    pages: [],
  };
}

/** Le texte des flux PDF non compressés. Suffisant pour détecter une couche de texte. */
function texteDuPdf(brut) {
  const s = brut.toString("latin1");
  const morceaux = [];
  for (const m of s.matchAll(/\(((?:\\.|[^()\\])*)\)\s*Tj/g)) morceaux.push(m[1]);
  return morceaux.join(" ").replace(/\\([()\\])/g, "$1");
}

/** Lignes par page. Convention du dossier, affichée à l'écran avec le renvoi. */
export const LIGNES_PAR_PAGE = 28;

/**
 * Découpe en pages. Les documents de la data room n'ont pas de saut de page :
 * on applique la convention ci-dessus. Le numéro de page sert à renvoyer le
 * juriste au bon endroit du document, il ne fait pas autorité par lui-même.
 */
function paginer(texte) {
  const lignes = texte.split("\n");
  const pages = [];
  for (let i = 0; i < lignes.length; i += LIGNES_PAR_PAGE) {
    pages.push({
      numero: pages.length + 1,
      lignes: lignes.slice(i, i + LIGNES_PAR_PAGE).join("\n"),
      premiereLigne: i + 1,
    });
  }
  return pages.length ? pages : [{ numero: 1, lignes: texte, premiereLigne: 1 }];
}

/** À quelle page se trouve un passage ? Rend aussi la ligne, plus précise. */
export function situer(doc, passage) {
  const i = doc.texte.indexOf(passage);
  if (i === -1) return null;
  const ligne = doc.texte.slice(0, i).split("\n").length;
  const page = doc.pages.find((p) => ligne >= p.premiereLigne && ligne < p.premiereLigne + LIGNES_PAR_PAGE) ?? doc.pages[0];
  return { page: page?.numero ?? 1, ligne };
}

/** Un intitulé d'article, dans ces documents, est en majuscules. */
function estUnIntitule(s) {
  const lettres = s.replace(/[^\p{L}]/gu, "");
  if (lettres.length < 3) return false;
  const majuscules = (s.match(/\p{Lu}/gu) ?? []).length;
  return majuscules / lettres.length > 0.7;
}

function formerClause(marque, intitule) {
  const m = /^\d/.test(marque) ? `Article ${marque}` : marque.replace(/^ARTICLE/i, "Article");
  return intitule && estUnIntitule(intitule) ? `${m} — ${intitule}` : m;
}

/**
 * L'article ou la clause où tombe un passage.
 *
 * L'ordre des deux essais n'est pas indifférent. Un passage commence très
 * souvent par son propre intitulé — « 14.2 — Le contrat sera résilié… » — et il
 * faut alors retenir celui-là. Ne regarder que ce qui précède conduirait à
 * annoncer l'article 14.1 pour un passage de l'article 14.2 : exactement le
 * genre d'erreur de renvoi qui ruine la confiance d'un lecteur juriste.
 */
export function clauseDe(doc, passage) {
  const i = doc.texte.indexOf(passage);
  if (i === -1) return null;

  // 1. Le passage porte-t-il lui-même son intitulé ?
  const propre = passage.match(/^\s*(ARTICLE\s+[\w.\-]+|\d+\.\d+)\s*(?:—|-|–)?[ \t]*([^\n]*)/i);
  if (propre) {
    const marque = propre[1].trim();
    let intitule = (propre[2] ?? "").trim();
    // Une sous-clause numérotée (14.2) emprunte le titre de son article.
    if (/^\d+\.\d+$/.test(marque) && !estUnIntitule(intitule)) {
      const parent = marque.split(".")[0];
      const rx = new RegExp(`^\\s*ARTICLE\\s+${parent}\\s*(?:—|-|–)?[ \\t]*([^\\n]*)$`, "im");
      const m = doc.texte.slice(0, i).match(rx);
      if (m && estUnIntitule(m[1].trim())) intitule = m[1].trim();
    }
    return formerClause(marque, intitule);
  }

  // 2. À défaut, le dernier intitulé rencontré avant le passage.
  const titres = [...doc.texte.slice(0, i).matchAll(/^[ \t]*(ARTICLE\s+[\w.\-]+|\d+\.\d+)\s*(?:—|-|–)?[ \t]*([^\n]*)$/gim)];
  const dernier = titres.at(-1);
  if (!dernier) return null;
  return formerClause(dernier[1].trim(), (dernier[2] ?? "").trim());
}

/**
 * Le triage. Il répond à la question que le juriste se pose en ouvrant la data
 * room : lequel de ces fichiers compte, et pourquoi puis-je écarter les autres ?
 *
 * Rien n'est jeté : un document écarté reste au dossier avec son motif. C'est
 * ce qui permet au juriste de contester le tri en une seconde.
 */
export function trier(documents) {
  const parEmpreinte = new Map();
  for (const d of documents) {
    if (!parEmpreinte.has(d.empreinte)) parEmpreinte.set(d.empreinte, []);
    parEmpreinte.get(d.empreinte).push(d);
  }

  for (const d of documents) {
    d.role = "retenu";
    d.motifTri = null;
    d.parentDe = null;

    if (!d.lisible) {
      d.role = "illisible";
      d.motifTri = d.motifIllisible;
      continue;
    }

    const nomBas = d.nom.toLowerCase();
    const entete = d.texte.slice(0, ENTETE_BROUILLON).toLowerCase();
    const titre = d.texte.trimStart().slice(0, ENTETE_TITRE).toLowerCase();

    // La liste de demandes et les réponses du vendeur ne se dépouillent pas
    // comme des contrats : l'une fixe le périmètre, l'autre fournit des
    // affirmations à éprouver. Elles ont leur propre écran.
    const particulier = rolePieceDeProcedure(d.nom, titre);
    if (particulier) {
      d.role = particulier;
      d.motifTri =
        particulier === "liste-demandes"
          ? "Liste de demandes : elle fixe le périmètre et sert à dire ce qui manque."
          : "Réponses du vendeur : chaque affirmation est éprouvée contre les documents.";
      continue;
    }

    // Un brouillon non signé ne prouve rien. On le dit, et on garde le signé.
    const marqueBrouillon = MARQUES_BROUILLON.find((m) => nomBas.includes(m) || entete.includes(m))
      ?? (/\bprojet\b/.test(titre) && !/\bprojet\b.{0,40}(sodimex|acquisition|cession)/i.test(titre) ? "projet" : null);
    if (marqueBrouillon) {
      d.role = "ecarte";
      d.motifTri = `Brouillon non signé : mention « ${marqueBrouillon} » en tête et aucune signature au document.`;
      continue;
    }

    // Doublon strict : même empreinte.
    const jumeaux = parEmpreinte.get(d.empreinte);
    if (jumeaux.length > 1 && jumeaux[0] !== d) {
      d.role = "ecarte";
      d.motifTri = `Doublon strict de « ${jumeaux[0].nom} » : contenu identique au bit près.`;
      continue;
    }

    if (MARQUES_AVENANT.some((m) => nomBas.includes(m) || titre.includes(m))) {
      d.role = "avenant";
      d.motifTri = "Avenant : il modifie un contrat qu'il faut retrouver pour lire le texte en vigueur.";
    }
  }

  // Doublon partiel : même objet, l'un tronqué. C'est le cas le plus
  // dangereux — le fichier tronqué peut avoir perdu la clause qui compte.
  for (const d of documents.filter((x) => x.role === "retenu")) {
    for (const autre of documents.filter((x) => x.role === "retenu" && x !== d)) {
      if (d.octets >= autre.octets) continue;
      const tete = normaliser(d.texte).slice(0, 400);
      if (tete.length < 200 || !normaliser(autre.texte).includes(tete)) continue;
      d.role = "ecarte";
      const perdu = clausesPerdues(d, autre);
      d.motifTri =
        `Version tronquée de « ${autre.nom} » : le début est identique, mais ce fichier s'arrête plus tôt` +
        (perdu.length ? ` et il manque ${perdu.join(", ")}.` : ".");
      break;
    }
  }

  // Rattacher chaque avenant au contrat qu'il modifie.
  for (const a of documents.filter((x) => x.role === "avenant")) {
    const parent = contratModifie(a, documents);
    if (parent) {
      a.parentDe = parent.chemin;
      parent.avenants = [...(parent.avenants ?? []), a.chemin];
    } else {
      a.motifTri = "Avenant dont le contrat d'origine n'a pas été retrouvé dans la data room.";
    }
  }

  return documents;
}

function normaliser(t) {
  return t.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Les articles présents dans le long et absents du tronqué. */
function clausesPerdues(tronque, complet) {
  const arts = (t) => new Set([...t.matchAll(/ARTICLE\s+(\d+(?:\.\d+)?)/gi)].map((m) => m[1]));
  const a = arts(tronque.texte);
  const manquants = [...arts(complet.texte)].filter((x) => !a.has(x));
  if (!manquants.length) return [];
  return [`les articles ${manquants.join(", ")}`];
}

/**
 * Le contrat qu'un avenant modifie. On cherche la date et les parties que
 * l'avenant cite lui-même : c'est lui qui le dit, pas nous.
 */
function contratModifie(avenant, documents) {
  const date = avenant.texte.match(/\bdu\s+(\d{1,2}(?:er)?\s+\p{L}+\s+\d{4})/u)?.[1];
  const candidats = documents.filter((d) => d.role === "retenu" && d !== avenant);
  if (date) {
    const parDate = candidats.find((d) => d.texte.includes(date));
    if (parDate) return parDate;
  }
  // À défaut de date, le nom propre le plus présent dans l'avenant.
  const noms = [...avenant.texte.matchAll(/\b([A-ZÀ-Ü]{4,})\b/g)].map((m) => m[1]);
  const compte = new Map();
  for (const n of noms) compte.set(n, (compte.get(n) ?? 0) + 1);
  const frequents = [...compte.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  for (const n of frequents) {
    const trouve = candidats.find((d) => d.nom.toUpperCase().includes(n) || d.texte.includes(n));
    if (trouve) return trouve;
  }
  return null;
}

/** Charge et trie la data room en une fois. */
export async function chargerDataRoom(racine) {
  const fichiers = (await listerFichiers(racine)).filter((f) => !META.some((m) => m.test(basename(f))));
  const docs = [];
  for (const f of fichiers) {
    const d = await lireDocument(racine, f);
    d.id = `D${String(docs.length + 1).padStart(2, "0")}`;
    docs.push(d);
  }
  return trier(docs);
}
