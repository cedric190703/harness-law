// Les dossiers. Un cabinet ne traite pas une opération, il en traite plusieurs,
// et chacune vit des semaines : des pièces arrivent, le rapport se refait, le
// travail de relecture doit survivre au rechargement de la page.
//
// Un dossier est un répertoire. Rien d'autre : pas de base, pas de schéma à
// migrer. On peut l'ouvrir dans le Finder, y déposer un fichier à la main, et
// l'audit en tiendra compte au prochain passage.
//
//   dossiers/<id>/
//     dossier.json      l'opération, la cible, la date de référence
//     pieces/           les documents versés, dans l'arborescence du vendeur
//     audits/           un fichier par passage, horodaté : l'historique
//     travail.json      ce que le juriste a relu, noté, corrigé

import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const RACINE = "./dossiers";

/** Un identifiant de dossier sûr : on le compose nous-mêmes, jamais le client. */
export function identifiant(nom) {
  const base = nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || `dossier-${Date.now()}`;
}

/**
 * Refuse tout identifiant qui pourrait sortir du répertoire des dossiers.
 * Les chemins viennent du réseau : on ne leur fait pas confiance.
 */
function verifier(id) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) throw new Error(`Identifiant de dossier invalide : ${id}`);
  return id;
}

export const cheminDossier = (id) => join(RACINE, verifier(id));
export const cheminPieces = (id) => join(cheminDossier(id), "pieces");

/** La liste des dossiers, le plus récemment audité en premier. */
export async function lister() {
  let noms = [];
  try {
    noms = (await readdir(RACINE, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
  const dossiers = [];
  for (const nom of noms) {
    const d = await charger(nom).catch(() => null);
    if (d) dossiers.push(d);
  }
  return dossiers.sort((a, b) => (b.dernierAudit ?? "").localeCompare(a.dernierAudit ?? ""));
}

/** Les métadonnées d'un dossier, avec de quoi l'afficher dans une liste. */
export async function charger(id) {
  const chemin = cheminDossier(id);
  const meta = JSON.parse(await readFile(join(chemin, "dossier.json"), "utf8"));
  const audits = await listerAudits(id);
  const pieces = await compterPieces(id);
  const travail = await lireTravail(id);
  return {
    ...meta,
    id,
    pieces,
    nombreAudits: audits.length,
    dernierAudit: audits[0]?.a ?? null,
    relus: travail.relus.length,
  };
}

async function compterPieces(id) {
  let compte = 0;
  async function descendre(dossier) {
    let entrees = [];
    try {
      entrees = await readdir(dossier, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entrees) {
      if (e.name.startsWith(".")) continue;
      if (e.isDirectory()) await descendre(join(dossier, e.name));
      else compte += 1;
    }
  }
  await descendre(cheminPieces(id));
  return compte;
}

/** Crée un dossier vide, prêt à recevoir des pièces. */
export async function creer({ nom, operation, cible, cote, dateReference, responsable }) {
  if (!nom?.trim()) throw new Error("Un dossier a besoin d'un nom.");
  let id = identifiant(nom);
  // Deux dossiers peuvent porter le même nom : on ne les écrase pas.
  let suffixe = 1;
  while (await existe(id)) id = `${identifiant(nom)}-${++suffixe}`;
  const meta = {
    id,
    nom: nom.trim(),
    operation: operation?.trim() || "Due diligence d'acquisition",
    cible: cible?.trim() || "",
    cote: cote?.trim() || "l'acquéreur",
    dateReference: dateReference || new Date().toISOString().slice(0, 10),
    ouvertLe: new Date().toISOString(),
    responsable: responsable?.trim() || "",
  };
  await mkdir(join(cheminDossier(id), "pieces"), { recursive: true });
  await mkdir(join(cheminDossier(id), "audits"), { recursive: true });
  await writeFile(join(cheminDossier(id), "dossier.json"), JSON.stringify(meta, null, 2), "utf8");
  return charger(id);
}

async function existe(id) {
  try {
    await stat(cheminDossier(id));
    return true;
  } catch {
    return false;
  }
}

/** Supprime un dossier. Jamais un dossier de démonstration. */
export async function supprimer(id) {
  const meta = JSON.parse(await readFile(join(cheminDossier(id), "dossier.json"), "utf8"));
  if (meta.demonstration) throw new Error("Le dossier de démonstration ne se supprime pas.");
  await rm(cheminDossier(id), { recursive: true, force: true });
}

/** Un nom de fichier sûr : le nom vient du poste du juriste, pas de nous. */
function nomSur(nom) {
  const propre = nom
    .replace(/[/\\]/g, "-")
    .replace(/^\.+/, "")
    .replace(/[\u0000-\u001f]/g, "")
    .trim();
  if (!propre) throw new Error("Nom de fichier vide.");
  return propre.slice(0, 160);
}

/**
 * Verse des pièces dans un dossier. `lot` est un nom de sous-dossier, pour
 * retrouver ce qui est arrivé ensemble — c'est ainsi qu'arrivent les versements.
 */
export async function verser(id, fichiers, lot) {
  const sousDossier = lot ? nomSur(lot) : `versement du ${new Date().toISOString().slice(0, 10)}`;
  const cible = join(cheminPieces(id), sousDossier);
  await mkdir(cible, { recursive: true });
  const verses = [];
  for (const f of fichiers) {
    if (!f?.nom || typeof f.contenu !== "string") continue;
    const nom = nomSur(f.nom);
    const octets = Buffer.from(f.contenu, "base64");
    if (octets.length > 8 * 1024 * 1024) {
      verses.push({ nom, refuse: "Fichier de plus de 8 Mo : versez-le dans le répertoire du dossier." });
      continue;
    }
    await writeFile(join(cible, nom), octets);
    verses.push({ nom, octets: octets.length, dans: sousDossier });
  }
  return { lot: sousDossier, verses };
}

// ------------------------------------------------------- l'historique des audits

export async function listerAudits(id) {
  let noms = [];
  try {
    noms = (await readdir(join(cheminDossier(id), "audits"))).filter((n) => n.endsWith(".json"));
  } catch {
    return [];
  }
  const audits = [];
  for (const nom of noms) {
    try {
      const a = JSON.parse(await readFile(join(cheminDossier(id), "audits", nom), "utf8"));
      audits.push({ fichier: nom, a: a.lanceLe, id: a.id, constats: a.constats.length, pieces: a.documents.length });
    } catch {
      /* un fichier d'audit illisible ne doit pas empêcher d'ouvrir le dossier */
    }
  }
  return audits.sort((x, y) => (y.a ?? "").localeCompare(x.a ?? ""));
}

export async function enregistrerAudit(id, audit) {
  const dossier = join(cheminDossier(id), "audits");
  await mkdir(dossier, { recursive: true });
  const nom = `${audit.lanceLe.replace(/[:.]/g, "-")}.json`;
  await writeFile(join(dossier, nom), JSON.stringify(audit, null, 2), "utf8");
  return nom;
}

export async function dernierAudit(id) {
  const [dernier] = await listerAudits(id);
  if (!dernier) return null;
  return JSON.parse(await readFile(join(cheminDossier(id), "audits", dernier.fichier), "utf8"));
}

/** L'audit qui précède celui-ci, pour dire ce qui a changé. */
export async function auditPrecedent(id) {
  const audits = await listerAudits(id);
  if (audits.length < 2) return null;
  return JSON.parse(await readFile(join(cheminDossier(id), "audits", audits[1].fichier), "utf8"));
}

// ------------------------------------------------------- le travail du juriste

const TRAVAIL_VIDE = { relus: [], notes: {}, corrections: {} };

/**
 * Ce que le juriste a fait : les constats qu'il a relus, ses notes, ses
 * corrections de rédaction. C'est son travail : il survit aux relances de
 * l'audit et aux rechargements de la page.
 *
 * Tout est rattaché à la **clé** d'un constat, jamais à son numéro affiché : le
 * numéro se décale quand des pièces arrivent, la clé non.
 */
export async function lireTravail(id) {
  try {
    const lu = JSON.parse(await readFile(join(cheminDossier(id), "travail.json"), "utf8"));
    return { ...TRAVAIL_VIDE, ...lu };
  } catch {
    return { ...TRAVAIL_VIDE };
  }
}

export async function ecrireTravail(id, partiel) {
  const avant = await lireTravail(id);
  const apres = {
    relus: partiel.relus ?? avant.relus,
    notes: { ...avant.notes, ...(partiel.notes ?? {}) },
    corrections: { ...avant.corrections, ...(partiel.corrections ?? {}) },
    modifieLe: new Date().toISOString(),
  };
  // Une note vidée est une note supprimée : on ne garde pas de chaînes vides.
  for (const [k, v] of Object.entries(apres.notes)) if (!v) delete apres.notes[k];
  for (const [k, v] of Object.entries(apres.corrections)) if (!v) delete apres.corrections[k];
  await mkdir(cheminDossier(id), { recursive: true });
  await writeFile(join(cheminDossier(id), "travail.json"), JSON.stringify(apres, null, 2), "utf8");
  return apres;
}

/**
 * Applique le travail du juriste à un audit fraîchement calculé.
 *
 * Le rattachement se fait par la clé. On accepte encore l'ancien rattachement
 * par numéro, pour ne pas perdre le travail déjà enregistré avant ce changement.
 */
export function appliquerTravail(audit, travail) {
  const relus = new Set(travail.relus);
  const pris = (c, table) => table[c.cle] ?? table[c.id] ?? null;
  return {
    ...audit,
    constats: audit.constats.map((c) => ({
      ...c,
      relu: relus.has(c.cle) || relus.has(c.id),
      note: pris(c, travail.notes),
      // Une correction du juriste remplace la rédaction, sans effacer l'originale.
      correction: pris(c, travail.corrections),
    })),
    travail: { relus: travail.relus.length, notes: Object.keys(travail.notes).length, corrections: Object.keys(travail.corrections).length, modifieLe: travail.modifieLe ?? null },
  };
}
