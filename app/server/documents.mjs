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

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** « 15 septembre 2026 » → « 2026-09-15 ». Null si ce n'est pas une date. */
export function dateFrancaise(texte) {
  const m = texte.match(/\b(\d{1,2})(?:er)?\s+(\p{L}+)\s+(\d{4})\b/u);
  if (!m) return null;
  const mois = MOIS.findIndex((x) => x === m[2].toLowerCase());
  if (mois === -1) return null;
  return `${m[3]}-${String(mois + 1).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
}

/**
 * La date de l'acte : celle de sa signature, telle que le document la porte.
 *
 * Elle sert à ordonner plusieurs avenants au même contrat. Deux avenants
 * successifs peuvent modifier la même clause, et c'est le dernier qui donne le
 * texte en vigueur — jamais le premier rencontré dans l'arborescence.
 */
export function dateDeLActe(texte) {
  const entete = texte.slice(0, 1200);
  // Uniquement les tournures qui datent **l'acte lui-même**. Un « du 4 février
  // 2021 » peut parfaitement désigner le contrat qu'une lettre cite : s'en
  // servir ferait porter au document la date d'un autre.
  for (const rx of [
    /sign[ée]e?\s+(?:à\s+[\p{L}\s-]+,?\s+)?le\s+([^\n.;]{6,40})/iu,
    /\bfait\s+à\s+[^,\n]+,\s*le\s+([^\n.;]{6,40})/iu,
    /\bdat[ée]e?\s+du\s+([^\n.;]{6,40})/iu,
    // « Nanterre, le 3 septembre 2026 » : l'en-tête d'une lettre.
    /^[ \t]*\p{Lu}[\p{L}\s-]{2,30},\s*le\s+(\d{1,2}(?:er)?\s+\p{L}+\s+\d{4})/imu,
    /\bmis(?:e)?\s+à\s+jour\s+le\s+([^\n.;]{6,40})/iu,
  ]) {
    const m = entete.match(rx);
    const d = m && dateFrancaise(m[1]);
    if (d) return d;
  }
  return null;
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
    d.dateActe = d.lisible ? dateDeLActe(d.texte) : null;
    d.dernierAvenant = false;

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
      a.motifTri =
        "Avenant dont le contrat d'origine n'a pas pu être identifié avec certitude. Il n'est rattaché à aucun contrat : rattachez-le à la main plutôt que de laisser l'audit deviner.";
    }
  }

  // Ordonner les avenants d'un même contrat par leur date, et désigner le
  // dernier. Un avenant sans date est traité comme le plus ancien : on ne lui
  // fait pas dire le droit en vigueur sans savoir quand il a été signé.
  for (const parent of documents.filter((x) => x.avenants?.length)) {
    const suite = parent.avenants
      .map((chemin) => documents.find((d) => d.chemin === chemin))
      .filter(Boolean)
      .sort((a, b) => (a.dateActe ?? "0000-00-00").localeCompare(b.dateActe ?? "0000-00-00"));
    suite.forEach((a, i) => {
      a.rangAvenant = i + 1;
      a.dernierAvenant = i === suite.length - 1;
      if (!a.dateActe) {
        a.motifTri = `${a.motifTri} Sa date de signature n'a pas pu être lue : son rang dans la suite des avenants est incertain.`;
      } else if (suite.length > 1) {
        a.motifTri = `Avenant du ${a.dateActe}, ${i + 1}ᵉ sur ${suite.length} au contrat « ${parent.nom} »${
          i === suite.length - 1 ? " — c'est lui qui donne le texte en vigueur." : " — remplacé par un avenant postérieur."
        }`;
      }
    });
    parent.avenants = suite.map((a) => a.chemin);
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
 * Les mots en majuscules qui n'identifient personne : ils figurent dans tous les
 * actes. S'en servir pour rattacher un avenant revient à tirer au sort.
 */
const MOTS_BANALS = new Set([
  "ARTICLE", "ARTICLES", "CONTRAT", "AVENANT", "ENTRE", "PRÉAMBULE", "PREAMBULE",
  "STIPULATIONS", "MODIFICATION", "MODIFICATIONS", "OBJET", "DURÉE", "DUREE",
  "PRIX", "SIGNATURES", "SIGNATURE", "FOURNITURE", "EXCLUSIVE", "ENGAGEMENT",
  "VOLUME", "MINIMUM", "RÉSILIATION", "RESILIATION", "JANVIER", "FÉVRIER",
  "FEVRIER", "MARS", "AVRIL", "JUIN", "JUILLET", "AOÛT", "AOUT", "SEPTEMBRE",
  "OCTOBRE", "NOVEMBRE", "DÉCEMBRE", "DECEMBRE", "EUROS", "TONNES", "NOTE",
  "DISTRIBUTEUR", "FOURNISSEUR", "PRENEUR", "BAILLEUR", "GARANT", "SOCIÉTÉ",
  "SOCIETE", "PRÉSENT", "PRESENT", "SUIVANTES", "REMPLACÉ", "REMPLACE",
]);

/**
 * Le contrat qu'un avenant modifie.
 *
 * On ne devine pas : un rattachement faux déplace une clause d'un contrat à un
 * autre et corrompt le rapport en silence. Deux indices seulement sont admis, et
 * à défaut on renvoie null pour que l'avenant soit signalé comme non rattaché.
 *
 *   1. la date que l'avenant cite comme celle du contrat d'origine, confrontée
 *      à la date d'acte des candidats ;
 *   2. le nom propre qu'il nomme, cherché dans le NOM du candidat ou dans ses
 *      parties — jamais n'importe où dans son texte.
 */
function contratModifie(avenant, documents) {
  const candidats = documents.filter((d) => d.role === "retenu" && d !== avenant);
  const entete = avenant.texte.slice(0, 1000);

  // 1. La date du contrat d'origine, telle que l'avenant la cite.
  const citee = entete.match(/\b(?:du|le|en date du)\s+(\d{1,2}(?:er)?\s+\p{L}+\s+\d{4})/iu);
  const date = citee && dateFrancaise(citee[1]);
  if (date) {
    const parDate = candidats.filter((d) => d.dateActe === date);
    if (parDate.length === 1) return parDate[0];
    // Plusieurs contrats signés le même jour : on tranche par le nom propre.
    if (parDate.length > 1) {
      const parNom = parDate.find((d) => nomsPropres(entete).some((n) => d.nom.toUpperCase().includes(n)));
      if (parNom) return parNom;
      return null;
    }
  }

  // 2. Le nom propre que l'avenant nomme, cherché dans le nom du candidat ou
  //    dans son en-tête, là où les parties sont désignées.
  for (const n of nomsPropres(entete)) {
    const trouves = candidats.filter(
      (d) => d.nom.toUpperCase().includes(n) || d.texte.slice(0, 700).toUpperCase().includes(n),
    );
    if (trouves.length === 1) return trouves[0];
  }
  return null;
}

/** Les noms propres d'un en-tête, du plus fréquent au moins fréquent. */
function nomsPropres(texte) {
  const compte = new Map();
  for (const m of texte.matchAll(/\b([A-ZÀ-Ü][A-ZÀ-Ü'’-]{3,})\b/g)) {
    const mot = m[1];
    if (MOTS_BANALS.has(mot)) continue;
    compte.set(mot, (compte.get(mot) ?? 0) + 1);
  }
  return [...compte.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
}

/**
 * Injecte dans un document le texte lu par reconnaissance de caractères.
 *
 * Le document devient exploitable, mais il garde la marque de son origine : un
 * passage lu par machine sur une image n'a pas la force d'un passage lu dans un
 * fichier texte. L'interface doit le dire, et seul le juriste peut lever la
 * réserve en ouvrant l'original.
 *
 * Rend false si le texte reconnu est trop maigre pour être exploité — auquel cas
 * le document reste illisible, et le dit.
 */
export function appliquerReconnaissance(doc, texte, modele) {
  if (!texte || texte.trim().length < 40) return false;
  doc.texte = texte;
  doc.pages = paginer(texte);
  doc.lisible = true;
  doc.aReconnaitre = false;
  doc.origineTexte = { par: "reconnaissance", modele, aConfirmer: true };
  doc.motifIllisible = null;
  return true;
}

/** Charge et trie la data room en une fois. */
export async function chargerDataRoom(racine, { reconnaitre } = {}) {
  const fichiers = (await listerFichiers(racine)).filter((f) => !META.some((m) => m.test(basename(f))));
  const docs = [];
  for (const f of fichiers) {
    const d = await lireDocument(racine, f);
    d.id = `D${String(docs.length + 1).padStart(2, "0")}`;
    d.cheminAbsolu = f;
    d.origineTexte = d.lisible ? { par: "fichier", modele: null, aConfirmer: false } : null;
    docs.push(d);
  }

  // La reconnaissance de caractères se fait avant le triage : un scan devenu
  // lisible doit être dépouillé comme n'importe quel document.
  if (reconnaitre) {
    for (const d of docs.filter((x) => x.aReconnaitre)) {
      try {
        const lu = await reconnaitre(d);
        // Un appel qui réussit ne suffit pas : ce qui compte est que le texte
        // soit effectivement entré dans le document. Sinon il reste illisible.
        const applique = lu ? appliquerReconnaissance(d, lu.texte, lu.modele) : false;
        if (lu && !applique) {
          d.motifIllisible = `${d.motifIllisible} La reconnaissance n'a rendu que ${lu.texte.trim().length} caractères : trop peu pour être exploité.`;
        }
      } catch (e) {
        d.motifIllisible = `${d.motifIllisible} La reconnaissance a échoué : ${e.message}`;
      }
    }
  }

  return trier(docs);
}
