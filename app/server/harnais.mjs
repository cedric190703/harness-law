// Le harnais : il enchaîne les étapes de l'audit et consigne tout ce qu'il fait.
//
// Ce qui fait la valeur de ce fichier n'est pas l'enchaînement, c'est la trace.
// Pour chaque constat du rapport, le juriste doit pouvoir répondre à : quels
// documents ai-je parcourus, lequel ai-je retenu, à quelle page, sur quel
// passage, et qu'ai-je écarté en route. C'est cette trace qui transforme la
// vérification en relecture ciblée au lieu d'une relecture complète.

import { chargerDataRoom } from "./documents.mjs";
import * as dossiers from "./dossiers.mjs";
import { ACTEURS, journal, parcours } from "./journal.mjs";
import { blocsDuRapport } from "./redaction.mjs";
import { couverture, depouiller, lireListeDeDemandes, passagePresent } from "./extraction.mjs";
import { CHANTIERS, EPREUVES_VENDEUR, GRAVITES, SONDES } from "./sondes.mjs";
import * as piste from "./piste.mjs";
import { MODELES, etatDuModele, reconnaitre } from "./mistral.mjs";

export const ETAPES = [
  { id: "triage", titre: "Triage de la data room", quoi: "Ouvrir chaque fichier, écarter les doublons et les brouillons, dire ce qui est illisible." },
  { id: "reconnaissance", titre: "Lecture des documents scannés", quoi: "Lire par reconnaissance de caractères ce qui n'a pas de couche de texte." },
  { id: "perimetre", titre: "Périmètre et liste de demandes", quoi: "Confronter ce qui est arrivé à ce qui a été demandé." },
  { id: "depouillement", titre: "Dépouillement par chantier", quoi: "Chercher, dans chaque document, les clauses que l'audit doit relever." },
  { id: "droit", titre: "Contrôle du droit applicable", quoi: "Vérifier sur Légifrance et Judilibre que la clause relevée tient en droit." },
  { id: "reponses", titre: "Épreuve des réponses du vendeur", quoi: "Confronter chaque réponse du vendeur aux documents." },
  { id: "spa", titre: "Traduction au contrat de cession", quoi: "Transformer chaque risque en garantie, condition suspensive ou ajustement de prix." },
  { id: "rapport", titre: "Rapport et couverture", quoi: "Classer par gravité et dire ce qui n'a pas été lu." },
  { id: "changements", titre: "Écart avec le passage précédent", quoi: "Dire ce qui a changé, et quelles relectures sont périmées." },
];

const maintenant = () => new Date().toISOString();

/**
 * Lance l'audit. `avancer` est appelé à chaque étape, ce qui permet à
 * l'interface de montrer le travail en train de se faire.
 */
export async function auditer({
  /** Le dossier à auditer. Son répertoire porte les pièces et l'historique. */
  dossier = "sodimex",
  /** Pour auditer un répertoire de pièces hors dossier (jeu de test). */
  racine = null,
  dateReference = null,
  avancer = () => {},
  // Le jeu de test a besoin du corpus exact qui a servi — texte reconnu
  // compris — pour éprouver les passages contre lui et non contre autre chose.
  surCorpus = () => {},
} = {}) {
  const trace = [];
  const debut = Date.now();
  // Le journal nomme ses acteurs : le juriste doit pouvoir dire qui a fait quoi.
  const j = journal((e) => avancer({ type: "journal", entree: e }));
  const dire = (etape, etat, detail) => avancer({ type: "etape", etape, etat, detail });

  const modele = await etatDuModele();
  const pisteOk = await piste.disponible();

  // Les métadonnées du dossier : l'opération, la cible, le côté qu'on conseille.
  const meta = racine ? null : await dossiers.charger(dossier);
  const pieces = racine ?? dossiers.cheminPieces(dossier);
  const dateRef = dateReference ?? meta?.dateReference ?? new Date().toISOString().slice(0, 10);
  const precedent = racine ? null : await dossiers.dernierAudit(dossier);
  // Le travail du juriste est l'état courant de sa relecture, pas l'instantané
  // d'un audit passé : c'est lui qui dit ce qu'il avait validé.
  const travail = racine ? { relus: [], notes: {}, corrections: {} } : await dossiers.lireTravail(dossier);

  // ---------------------------------------------------------------- 1. triage
  dire("triage", "en cours", "Ouverture des fichiers de la data room.");
  // Ce que la reconnaissance a lu, pour le consigner.
  const reconnus = [];
  const documents = await chargerDataRoom(pieces, {
    reconnaitre: async (doc) => {
      if (!modele.disponible) {
        reconnus.push({ document: doc.id, nom: doc.nom, echec: modele.message });
        return null;
      }
      dire("reconnaissance", "en cours", `Lecture de « ${doc.nom} » par reconnaissance de caractères.`);
      const texte = await reconnaitre(doc.cheminAbsolu);
      // On note l'appel ; son succès réel est constaté plus bas, sur l'état du
      // document. Annoncer une lecture réussie sur un document resté illisible
      // serait exactement le genre de contradiction que ce produit traque.
      reconnus.push({ document: doc.id, nom: doc.nom, modele: MODELES.reconnaissance, caracteres: texte.length });
      return { texte, modele: MODELES.reconnaissance };
    },
  });
  trace.push({
    etape: "triage",
    outil: "lecture locale",
    fichiers: documents.length,
    detail: documents.map((d) => ({ id: d.id, nom: d.nom, role: d.role, motif: d.motifTri, octets: d.octets })),
  });
  surCorpus(documents);
  for (const d of documents) {
    j.dire("Trieur", `ouvre « ${d.nom} »`, {
      detail: d.motifTri ?? `retenu · ${d.lignes ?? d.texte.split("\n").length} lignes`,
      pistes: [d.id],
      outil: "lecture locale",
    });
  }
  dire("triage", "terminée", `${documents.length} fichiers ouverts.`);
  // Le succès se lit sur le document, pas sur la réponse de l'API.
  for (const r of reconnus) {
    const doc = documents.find((d) => d.id === r.document);
    r.applique = doc?.origineTexte?.par === "reconnaissance";
    if (!r.applique && !r.echec) r.echec = doc?.motifIllisible ?? "le texte reconnu n'a pas été appliqué";
  }
  trace.push({ etape: "reconnaissance", outil: MODELES.reconnaissance, detail: reconnus });
  const lus = reconnus.filter((r) => r.applique);
  for (const r of reconnus) {
    j.dire("Lecteur", `lit « ${r.nom} » par reconnaissance de caractères`, {
      detail: r.applique ? `${r.caracteres} caractères reconnus — à confirmer sur l'original` : r.echec,
      pistes: [r.document],
      outil: MODELES.reconnaissance,
    });
  }
  dire(
    "reconnaissance",
    "terminée",
    lus.length
      ? `${lus.length} document${lus.length > 1 ? "s" : ""} scanné${lus.length > 1 ? "s" : ""} lu${lus.length > 1 ? "s" : ""} par reconnaissance de caractères.`
      : reconnus.length
        ? `${reconnus.length} document${reconnus.length > 1 ? "s" : ""} scanné${reconnus.length > 1 ? "s" : ""} non lu${reconnus.length > 1 ? "s" : ""}.`
        : "Aucun document scanné.",
  );

  // ------------------------------------------------------------ 2. périmètre
  dire("perimetre", "en cours", "Lecture de la liste de demandes.");
  const demandes = lireListeDeDemandes(documents);
  trace.push({ etape: "perimetre", outil: "lecture locale", lignes: demandes.lignes.length, manquants: demandes.manquants.length });
  j.dire("Cadreur", "confronte les pièces reçues à la liste de demandes", {
    detail: `${demandes.manquants.length} des ${demandes.lignes.length} lignes restent sans réponse exploitable`,
    pistes: demandes.document ? [demandes.document] : [],
    outil: "lecture locale",
  });
  dire("perimetre", "terminée", `${demandes.lignes.length} demandes, ${demandes.manquants.length} non satisfaites.`);

  // -------------------------------------------------------- 3. dépouillement
  dire("depouillement", "en cours", `${SONDES.length} questions d'audit sur ${CHANTIERS.length} chantiers.`);
  const contexte = {
    illisibles: documents.filter((d) => d.role === "illisible"),
    demandes,
    dateReference: dateRef,
  };
  const { constats, sansReponse, rejets, trace: traceSondes } = depouiller(documents, SONDES, contexte, j);
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
      const applicable = art ? piste.versionAu(art.versions, dateRef) : null;
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
  for (const s of sourcesDroit) {
    j.dire("Droit", `contrôle le texte officiel visé par ${s.constat}`, {
      detail: s.echec ?? `${s.identifiant ?? "sans article"} · ${s.decisions} décisions au soutien`,
      pistes: ["droit"],
      constat: s.constat,
      outil: "API Légifrance et Judilibre",
    });
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
  for (const e of epreuves) {
    j.dire("Contradicteur", `éprouve la réponse ${e.question} du vendeur`, {
      detail: `${e.verdict}${e.appuis.length ? ` · établi par ${e.appuis.map((a) => a.constat).join(", ")}` : ""}`,
      pistes: documents.filter((d) => d.role === "reponses-vendeur").map((d) => d.id),
      outil: "confrontation au registre",
    });
  }
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
  for (const m of mecanismes) {
    j.dire("Rédacteur", `traduit ${m.constat} en ${m.mecanisme}`, {
      detail: m.question,
      pistes: ["rapport"],
      constat: m.constat,
      outil: "règles de l'audit",
    });
  }
  trace.push({ etape: "spa", outil: "règles de l'audit", detail: mecanismes.map((m) => ({ constat: m.constat, mecanisme: m.mecanisme })) });
  dire("spa", "terminée", `${mecanismes.length} mécanismes proposés.`);

  // --------------------------------------------------------------- 7. rapport
  dire("rapport", "en cours", "Classement par gravité et calcul de la couverture.");
  constats.sort((a, b) => GRAVITES.indexOf(a.gravite) - GRAVITES.indexOf(b.gravite));
  const cv = couverture(documents, demandes);
  trace.push({ etape: "rapport", outil: "règles de l'audit", couverture: cv });
  dire("rapport", "terminée", `${constats.length} constats classés.`);

  // --------------------------------------------------------- 8. changements
  dire("changements", "en cours", "Comparaison avec le passage précédent.");
  const changements = comparer(precedent, { documents, constats }, travail.relus);
  trace.push({ etape: "changements", outil: "comparaison des deux passages", detail: changements });
  dire(
    "changements",
    "terminée",
    changements.premier
      ? "Premier passage sur ce dossier."
      : `${changements.constats.nouveaux.length} nouveaux constats, ${changements.constats.modifies.length} modifiés, ${changements.aRevoir.length} relectures périmées.`,
  );

  return {
    id: `audit-${Date.now()}`,
    dossier: meta?.id ?? "hors-dossier",
    nomDossier: meta?.nom ?? "Pièces hors dossier",
    operation: meta?.operation ?? "Due diligence",
    cible: meta?.cible ?? "",
    cote: meta?.cote ?? "l'acquéreur",
    dateReference: dateRef,
    lanceLe: maintenant(),
    dureeMs: Date.now() - debut,
    moteur: {
      // Dire exactement ce qui a tourné. Annoncer un modèle qui n'a pas servi
      // serait la première entorse à la promesse du produit.
      extraction: "recherche par motifs, puis vérification mot pour mot sur le fichier",
      reconnaissance: lus.length
        ? { employee: true, modele: MODELES.reconnaissance, documents: lus.map((r) => r.document) }
        : { employee: false, motif: reconnus.length ? (reconnus[0].echec ?? "non employée") : "aucun document scanné" },
      modele,
      droit: pisteOk ? `Légifrance et Judilibre en direct (${await piste.environnement()})` : "non interrogé",
    },
    etapes: ETAPES,
    acteurs: ACTEURS,
    journal: j.entrees,
    documents: documents.map(({ texte, pages, cheminAbsolu, ...reste }) => ({
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
    changements,
    trace,
    ...dossiers.appliquerTravail({ constats }, travail),
  };
}

/**
 * Le rapport lisible et le schéma du parcours. On les calcule après coup, pour
 * qu'ils reposent sur l'audit tel qu'il est enregistré — travail du juriste
 * compris — et non sur un état intermédiaire.
 */
export function enrichir(audit) {
  return {
    ...audit,
    acteurs: audit.acteurs ?? ACTEURS,
    blocs: blocsDuRapport(audit),
    parcours: parcours(audit.journal, audit.documents),
  };
}

/**
 * Ce qui a changé depuis le passage précédent.
 *
 * Le point qui compte n'est pas la liste des nouveautés : c'est `aRevoir`. Un
 * juriste qui a relu et validé un constat doit être averti quand une pièce
 * arrivée depuis en a changé la teneur. Sans cela, sa validation ment.
 */
function comparer(precedent, actuel, relus = []) {
  const valides = new Set(relus);
  if (!precedent) {
    return {
      premier: true,
      depuis: null,
      documents: { ajoutes: [], disparus: [], modifies: [] },
      constats: { nouveaux: [], disparus: [], modifies: [] },
      aRevoir: [],
    };
  }

  const avantDocs = new Map(precedent.documents.map((d) => [d.chemin, d]));
  const apresDocs = new Map(actuel.documents.map((d) => [d.chemin, d]));
  const resume = (d) => ({ id: d.id, nom: d.nom, chemin: d.chemin, role: d.role });

  const documents = {
    ajoutes: [...apresDocs.values()].filter((d) => !avantDocs.has(d.chemin)).map(resume),
    disparus: [...avantDocs.values()].filter((d) => !apresDocs.has(d.chemin)).map(resume),
    modifies: [...apresDocs.values()]
      .filter((d) => {
        const a = avantDocs.get(d.chemin);
        return a && a.empreinte !== d.empreinte;
      })
      .map(resume),
  };

  // On compare par clé, et non par numéro affiché : un numéro qui se décale
  // ferait apparaître un constat comme disparu puis réapparu, alors que c'est
  // le même, simplement renuméroté.
  const cle = (c) => c.cle ?? c.id;
  const avantConstats = new Map(precedent.constats.map((c) => [cle(c), c]));
  const apresConstats = new Map(actuel.constats.map((c) => [cle(c), c]));
  const bref = (c) => ({ id: c.id, cle: cle(c), chantier: c.chantier, question: c.question, valeur: c.valeur, gravite: c.gravite });

  const modifies = [];
  const aRevoir = [];
  for (const c of actuel.constats) {
    const a = avantConstats.get(cle(c));
    if (!a) continue;
    const quoi = [];
    if (a.valeur !== c.valeur) quoi.push({ champ: "valeur", avant: a.valeur, apres: c.valeur });
    if (a.gravite !== c.gravite) quoi.push({ champ: "gravité", avant: a.gravite, apres: c.gravite });
    if (a.provenance.retenu !== c.provenance.retenu) {
      quoi.push({ champ: "document retenu", avant: a.provenance.nomRetenu, apres: c.provenance.nomRetenu });
    }
    if (a.provenance.extrait !== c.provenance.extrait) quoi.push({ champ: "passage retenu", avant: null, apres: null });
    if (!quoi.length) continue;
    modifies.push({ ...bref(c), quoi });
    // La relecture du juriste portait sur l'état d'avant : elle est périmée.
    if (valides.has(cle(c)) || valides.has(c.id)) aRevoir.push({ ...bref(c), quoi });
  }

  return {
    premier: false,
    depuis: precedent.lanceLe,
    documents,
    constats: {
      nouveaux: actuel.constats.filter((c) => !avantConstats.has(cle(c))).map(bref),
      disparus: precedent.constats.filter((c) => !apresConstats.has(cle(c))).map(bref),
      modifies,
    },
    aRevoir,
  };
}

/** Le texte d'un document d'un dossier, pour l'afficher à côté de la rédaction. */
export async function texteDocument(dossier, quoi) {
  const docs = await chargerDataRoom(dossiers.cheminPieces(dossier));
  const d = docs.find((x) => x.chemin === quoi || x.id === quoi);
  if (!d) return null;
  return { id: d.id, nom: d.nom, chemin: d.chemin, role: d.role, lisible: d.lisible, texte: d.texte, pages: d.pages };
}

export { passagePresent };
