// Le harnais : il enchaîne les étapes de l'audit et consigne tout ce qu'il fait.
//
// Ce qui fait la valeur de ce fichier n'est pas l'enchaînement, c'est la trace.
// Pour chaque constat du rapport, le juriste doit pouvoir répondre à : quels
// documents ai-je parcourus, lequel ai-je retenu, à quelle page, sur quel
// passage, et qu'ai-je écarté en route. C'est cette trace qui transforme la
// vérification en relecture ciblée au lieu d'une relecture complète.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chargerDataRoom } from "./documents.mjs";
import { couverture, depouiller, lireListeDeDemandes, passagePresent } from "./extraction.mjs";
import { CHANTIERS, EPREUVES_VENDEUR, GRAVITES, SONDES } from "./sondes.mjs";
import * as piste from "./piste.mjs";
import { etatDuModele } from "./mistral.mjs";

export const ETAPES = [
  { id: "triage", titre: "Triage de la data room", quoi: "Ouvrir chaque fichier, écarter les doublons et les brouillons, dire ce qui est illisible." },
  { id: "perimetre", titre: "Périmètre et liste de demandes", quoi: "Confronter ce qui est arrivé à ce qui a été demandé." },
  { id: "depouillement", titre: "Dépouillement par chantier", quoi: "Chercher, dans chaque document, les clauses que l'audit doit relever." },
  { id: "droit", titre: "Contrôle du droit applicable", quoi: "Vérifier sur Légifrance et Judilibre que la clause relevée tient en droit." },
  { id: "reponses", titre: "Épreuve des réponses du vendeur", quoi: "Confronter chaque réponse du vendeur aux documents." },
  { id: "spa", titre: "Traduction au contrat de cession", quoi: "Transformer chaque risque en garantie, condition suspensive ou ajustement de prix." },
  { id: "rapport", titre: "Rapport et couverture", quoi: "Classer par gravité et dire ce qui n'a pas été lu." },
];

const maintenant = () => new Date().toISOString();

/**
 * Lance l'audit. `avancer` est appelé à chaque étape, ce qui permet à
 * l'interface de montrer le travail en train de se faire.
 */
export async function auditer({ racine = "./dataroom", dateReference = "2026-10-04", avancer = () => {} } = {}) {
  const trace = [];
  const debut = Date.now();
  const journal = [];
  const dire = (etape, etat, detail) => {
    journal.push({ etape, etat, detail, a: maintenant() });
    avancer({ etape, etat, detail });
  };

  const modele = await etatDuModele();
  const pisteOk = await piste.disponible();

  // ---------------------------------------------------------------- 1. triage
  dire("triage", "en cours", "Ouverture des fichiers de la data room.");
  const documents = await chargerDataRoom(racine);
  trace.push({
    etape: "triage",
    outil: "lecture locale",
    fichiers: documents.length,
    detail: documents.map((d) => ({ id: d.id, nom: d.nom, role: d.role, motif: d.motifTri, octets: d.octets })),
  });
  dire("triage", "terminée", `${documents.length} fichiers ouverts.`);

  // ------------------------------------------------------------ 2. périmètre
  dire("perimetre", "en cours", "Lecture de la liste de demandes.");
  const demandes = lireListeDeDemandes(documents);
  trace.push({ etape: "perimetre", outil: "lecture locale", lignes: demandes.lignes.length, manquants: demandes.manquants.length });
  dire("perimetre", "terminée", `${demandes.lignes.length} demandes, ${demandes.manquants.length} non satisfaites.`);

  // -------------------------------------------------------- 3. dépouillement
  dire("depouillement", "en cours", `${SONDES.length} questions d'audit sur ${CHANTIERS.length} chantiers.`);
  const contexte = {
    illisibles: documents.filter((d) => d.role === "illisible"),
    demandes,
    dateReference,
  };
  const { constats, sansReponse, rejets, trace: traceSondes } = depouiller(documents, SONDES, contexte);
  trace.push({ etape: "depouillement", outil: modele.disponible ? "Mistral + motifs" : "motifs", moteur: modele, detail: traceSondes });
  dire("depouillement", "terminée", `${constats.length} constats, ${rejets.length} rejetés faute de passage retrouvé.`);

  // ------------------------------------------------------------------ 4. droit
  dire("droit", "en cours", "Interrogation de Légifrance et Judilibre.");
  const sourcesDroit = [];
  for (const c of constats.filter((x) => x.droit)) {
    const d = c.droit.demande;
    try {
      if (!pisteOk) throw new Error("Aucun identifiant PISTE : le droit applicable n'a pas été vérifié.");
      const art = d.article ? await piste.article(d.article.code, d.article.numero) : null;
      const jur = d.jurisprudence ? await piste.judilibre(d.jurisprudence, 3) : null;
      const applicable = art ? piste.versionAu(art.versions, dateReference) : null;
      c.droit.resultat = {
        verifie: true,
        article: art && {
          reference: art.reference,
          identifiant: art.identifiant,
          etat: art.etat === "VIGUEUR" ? "en vigueur" : art.etat.toLowerCase(),
          texte: art.texte,
          lien: art.lien,
          versionApplicable: applicable && { debut: applicable.debut, fin: applicable.fin, texte: applicable.texte },
          nombreVersions: art.versions.length,
        },
        jurisprudence: jur && { total: jur.total, decisions: jur.decisions },
        base: `Légifrance et Judilibre, ${await piste.environnement()}`,
        a: maintenant(),
      };
      sourcesDroit.push({ constat: c.id, identifiant: art?.identifiant ?? null, decisions: jur?.decisions.length ?? 0 });
    } catch (e) {
      // Rien n'est tenu pour acquis quand la base ne répond pas.
      c.droit.resultat = { verifie: false, motif: e.message, a: maintenant() };
      sourcesDroit.push({ constat: c.id, echec: e.message });
    }
  }
  trace.push({ etape: "droit", outil: "API Légifrance et Judilibre (PISTE)", detail: sourcesDroit });
  dire("droit", "terminée", `${sourcesDroit.filter((s) => !s.echec).length} constats appuyés sur le texte officiel.`);

  // -------------------------------------------------------------- 5. réponses
  dire("reponses", "en cours", `${EPREUVES_VENDEUR.length} réponses du vendeur à éprouver.`);
  const parSonde = new Map();
  for (const c of constats) parSonde.set(c.sonde, [...(parSonde.get(c.sonde) ?? []), c]);
  const epreuves = EPREUVES_VENDEUR.map((e) => {
    const appuis = e.constats.flatMap((s) => parSonde.get(s) ?? []);
    return {
      ...e,
      // Une réponse ne peut être déclarée inexacte que si un constat l'établit.
      verdict: appuis.length ? e.verdict : "non éprouvée",
      pourquoi: appuis.length
        ? e.pourquoi
        : "Aucun constat du registre ne permet d'éprouver cette réponse en l'état du dossier.",
      appuis: appuis.map((c) => ({
        constat: c.id,
        document: c.provenance.nomRetenu,
        clause: c.provenance.clause,
        page: c.provenance.page,
        extrait: c.provenance.extrait,
      })),
    };
  });
  const inexactes = epreuves.filter((e) => e.verdict === "inexacte").length;
  trace.push({ etape: "reponses", outil: "confrontation au registre", detail: epreuves.map((e) => ({ q: e.question, verdict: e.verdict })) });
  dire("reponses", "terminée", `${inexactes} réponses sur ${epreuves.length} contredites par les documents.`);

  // ------------------------------------------------------------------- 6. SPA
  dire("spa", "en cours", "Traduction des risques en mécanismes de cession.");
  const mecanismes = constats
    .filter((c) => c.spa)
    .map((c) => ({
      constat: c.id,
      chantier: c.chantier,
      question: c.question,
      gravite: c.gravite,
      mecanisme: c.spa.mecanisme,
      redaction: c.spa.redaction,
      appui: { document: c.provenance.nomRetenu, clause: c.provenance.clause, page: c.provenance.page },
    }));
  trace.push({ etape: "spa", outil: "règles de l'audit", detail: mecanismes.map((m) => ({ constat: m.constat, mecanisme: m.mecanisme })) });
  dire("spa", "terminée", `${mecanismes.length} mécanismes proposés.`);

  // --------------------------------------------------------------- 7. rapport
  dire("rapport", "en cours", "Classement par gravité et calcul de la couverture.");
  constats.sort((a, b) => GRAVITES.indexOf(a.gravite) - GRAVITES.indexOf(b.gravite));
  const cv = couverture(documents, demandes);
  trace.push({ etape: "rapport", outil: "règles de l'audit", couverture: cv });
  dire("rapport", "terminée", `${constats.length} constats classés.`);

  return {
    id: `audit-${Date.now()}`,
    operation: "Projet Sodimex — acquisition de 100 % des titres",
    cible: "SODIMEX SAS, RCS Lyon 412 785 339",
    cote: "l'acquéreur",
    dateReference,
    lanceLe: maintenant(),
    dureeMs: Date.now() - debut,
    moteur: {
      extraction: modele.disponible ? "Mistral (magistral-medium) puis vérification sur le fichier" : "motifs, puis vérification sur le fichier",
      modele,
      droit: pisteOk ? `Légifrance et Judilibre en direct (${await piste.environnement()})` : "non interrogé",
    },
    etapes: ETAPES,
    journal,
    documents: documents.map(({ texte, pages, ...reste }) => ({
      ...reste,
      lignes: texte ? texte.split("\n").length : 0,
      pages: pages.length,
    })),
    chantiers: CHANTIERS,
    demandes,
    constats,
    sansReponse,
    rejets,
    epreuves,
    mecanismes,
    couverture: cv,
    trace,
  };
}

/** Le texte d'un document, pour l'afficher à côté de la rédaction. */
export async function texteDocument(racine, chemin) {
  const docs = await chargerDataRoom(racine);
  const d = docs.find((x) => x.chemin === chemin || x.id === chemin);
  if (!d) return null;
  return { id: d.id, nom: d.nom, chemin: d.chemin, role: d.role, lisible: d.lisible, texte: d.texte, pages: d.pages };
}

/** Garde le dernier audit sur disque : la démonstration ne dépend pas du réseau. */
export async function enregistrer(resultat, dossier = "./dataroom/.audit") {
  await mkdir(dossier, { recursive: true });
  await writeFile(`${dossier}/dernier.json`, JSON.stringify(resultat, null, 2), "utf8");
  return `${dossier}/dernier.json`;
}

export async function dernierAudit(dossier = "./dataroom/.audit") {
  try {
    return JSON.parse(await readFile(`${dossier}/dernier.json`, "utf8"));
  } catch {
    return null;
  }
}

export { passagePresent };
