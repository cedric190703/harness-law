// Le moteur. Il applique les sondes à la data room et tient un registre.
//
// Une règle gouverne tout ce fichier : **un constat n'entre au registre que si
// le passage sur lequel il repose existe mot pour mot dans le document nommé.**
// Un constat dont le passage ne se retrouve pas est rejeté, et le rejet est
// consigné. Le juriste voit donc toujours soit une preuve, soit un trou — jamais
// une affirmation flottante.
//
// C'est aussi ce qui rend le moteur remplaçable : que le passage soit trouvé par
// un motif ou proposé par un modèle, il passe la même barrière.

import { clauseDe, situer } from "./documents.mjs";

/** Les rôles dont les documents entrent dans le dépouillement. */
const DEPOUILLES = new Set(["retenu", "avenant"]);

/**
 * Le pliage des accents, lettre par lettre.
 *
 * Il est volontairement de longueur constante : chaque caractère plié en vaut
 * exactement un, de sorte qu'un indice trouvé dans le texte plié désigne le même
 * endroit dans le texte d'origine. C'est ce qui permet de chercher sans accents
 * tout en recopiant l'extrait mot pour mot.
 *
 * Il faut chercher sans accents parce qu'une data room en contient toujours :
 * documents saisis à la hâte, scans reconnus, exports d'anciens systèmes. Un
 * moteur qui exige « résilié » ne trouvera jamais « resilie ».
 */
const PLIAGE = {
  à: "a", á: "a", â: "a", ã: "a", ä: "a", å: "a",
  è: "e", é: "e", ê: "e", ë: "e",
  ì: "i", í: "i", î: "i", ï: "i",
  ò: "o", ó: "o", ô: "o", õ: "o", ö: "o",
  ù: "u", ú: "u", û: "u", ü: "u",
  ý: "y", ÿ: "y", ñ: "n", ç: "c",
  À: "A", Á: "A", Â: "A", Ã: "A", Ä: "A", Å: "A",
  È: "E", É: "E", Ê: "E", Ë: "E",
  Ì: "I", Í: "I", Î: "I", Ï: "I",
  Ò: "O", Ó: "O", Ô: "O", Õ: "O", Ö: "O",
  Ù: "U", Ú: "U", Û: "U", Ü: "U",
  Ý: "Y", Ñ: "N", Ç: "C",
};

/** Plie les accents sans changer la longueur de la chaîne. */
export function plier(s) {
  return s.replace(/[\u00C0-\u00FF]/g, (c) => PLIAGE[c] ?? c);
}

/**
 * Compile un motif pour chercher dans un document réel.
 *
 * Deux adaptations, et la seconde est indispensable : les documents juridiques
 * sont coupés en lignes, de sorte qu'une phrase cherchée tombe presque toujours
 * à cheval sur deux. Un motif qui exige une espace littérale ne trouve alors
 * rien — et ne le dit pas. Chaque espace du motif accepte donc n'importe quelle
 * suite d'espaces, retours à la ligne compris.
 *
 * Les espaces écrites dans une classe de caractères sont laissées telles quelles :
 * les y remplacer casserait la classe.
 */
export function compiler(motif, drapeauxEnPlus = "") {
  let source = "";
  let dansClasse = false;
  const brut = plier(motif.source);
  for (let i = 0; i < brut.length; i += 1) {
    const c = brut[i];
    if (c === "\\") {
      source += c + (brut[i + 1] ?? "");
      i += 1;
      continue;
    }
    if (c === "[") dansClasse = true;
    else if (c === "]") dansClasse = false;
    source += c === " " && !dansClasse ? "\\s+" : c;
  }
  const drapeaux = [...new Set([...motif.flags, ...drapeauxEnPlus])].join("");
  return new RegExp(source, drapeaux);
}

/**
 * Normalisation minimale : espaces, apostrophes et accents. Jamais les mots.
 *
 * Les accents sont pliés ici aussi : « résilié » et « resilie » sont le même
 * mot, et refuser le second rejetterait un passage pourtant exact.
 */
function normaliser(s) {
  return plier(s)
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Le passage existe-t-il mot pour mot dans ce texte ? C'est la barrière. */
export function passagePresent(texte, passage) {
  if (!passage || passage.length < 15) return false;
  return normaliser(texte).includes(normaliser(passage));
}

/**
 * Le paragraphe qui contient une occurrence. On rend le texte tel quel, afin
 * qu'il reste vérifiable mot pour mot dans le document.
 */
function paragrapheAutour(texte, index, maxi = 460) {
  let debut = texte.lastIndexOf("\n\n", index);
  debut = debut === -1 ? 0 : debut + 2;
  let fin = texte.indexOf("\n\n", index);
  fin = fin === -1 ? texte.length : fin;
  let extrait = texte.slice(debut, fin).trim();
  if (extrait.length <= maxi) return extrait;
  // Trop long : on resserre sur la phrase qui porte l'occurrence.
  const local = index - debut;
  const phrases = [...extrait.matchAll(/[^.!?]+[.!?]?/g)];
  let curseur = 0;
  for (const p of phrases) {
    const suivant = curseur + p[0].length;
    if (local >= curseur && local < suivant) return p[0].trim();
    curseur = suivant;
  }
  return extrait.slice(0, maxi).trim();
}

/**
 * Tous les passages d'un document qui répondent aux motifs d'une sonde.
 *
 * La recherche se fait sur le texte plié — accents retirés de part et d'autre —
 * mais l'extrait est découpé dans le texte d'origine, aux mêmes indices. Le
 * passage recopié reste donc identique au document, accents compris.
 */
function chercherDans(doc, motifs) {
  const trouves = [];
  const vus = new Set();
  const cherchable = plier(doc.texte);
  for (const motif of motifs) {
    const rx = compiler(motif, "g");
    for (const m of cherchable.matchAll(rx)) {
      const extrait = paragrapheAutour(doc.texte, m.index);
      if (!extrait || vus.has(extrait)) continue;
      vus.add(extrait);
      const ou = situer(doc, extrait);
      trouves.push({
        document: doc,
        extrait,
        // L'extrait plié, pour que les sondes s'interrogent sans se soucier des
        // accents. L'extrait d'origine reste celui qu'on recopie au rapport.
        plie: plier(extrait),
        motif: motif.source,
        page: ou?.page ?? null,
        ligne: ou?.ligne ?? null,
        clause: clauseDe(doc, extrait),
      });
    }
  }
  return trouves;
}

/**
 * Applique une sonde à la data room et rend ses constats, chacun avec sa
 * provenance complète : ce qui a été parcouru, ce qui a été retenu, ce qui a
 * été écarté et pourquoi.
 */
function appliquer(sonde, documents, contexte, trace, j) {
  const depouilles = documents.filter((d) => DEPOUILLES.has(d.role));
  const parDoc = depouilles.map((d) => ({ doc: d, trouves: chercherDans(d, sonde.motifs) }));
  const candidats = parDoc.filter((x) => x.trouves.length);
  const trouvailles = candidats.flatMap((x) => x.trouves);

  j?.dire("Chercheur", `cherche « ${sonde.question.toLowerCase()} »`, {
    detail: candidats.length
      ? `${candidats.length} pièce${candidats.length > 1 ? "s" : ""} sur ${depouilles.length} en porte${candidats.length > 1 ? "nt" : ""} un passage`
      : `aucune des ${depouilles.length} pièces dépouillées ne répond`,
    pistes: candidats.map((x) => x.doc.id),
    outil: "recherche par motifs",
  });
  trace.push({
    quoi: "recherche",
    sonde: sonde.id,
    question: sonde.question,
    parcourus: depouilles.length,
    candidats: candidats.map((x) => x.doc.id),
    passages: trouvailles.length,
    moteur: "motifs",
  });

  if (!trouvailles.length) {
    return {
      constats: [],
      sansReponse: {
        sonde: sonde.id,
        chantier: sonde.chantier,
        question: sonde.question,
        pourquoi: sonde.pourquoi,
        motif: `Aucun passage répondant à cette question dans les ${depouilles.length} documents dépouillés.`,
      },
    };
  }

  const bruts = sonde.constater(trouvailles, contexte) ?? [];
  const constats = [];
  const rejets = [];
  // Combien de constats de cette sonde reposent déjà sur le même document : une
  // sonde peut en tirer plusieurs (le montant d'une garantie, puis le débiteur
  // garanti), et leurs clés doivent rester distinctes.
  const parDocument = new Map();

  for (const [i, b] of bruts.entries()) {
    const appui = b.appui ?? null;
    const docAppui = appui?.document ?? documents.find((d) => d.chemin === b.document) ?? null;

    // La barrière. Un constat non appuyé sur un passage retrouvé est rejeté,
    // sauf s'il se présente lui-même comme non établi (cas du scan illisible).
    if (!b.nonEtabli) {
      if (!docAppui || !appui) {
        rejets.push({ sonde: sonde.id, rang: i, motif: "Constat sans passage d'appui." });
        continue;
      }
      if (!passagePresent(docAppui.texte, appui.extrait)) {
        rejets.push({
          sonde: sonde.id,
          rang: i,
          motif: `Le passage cité ne se retrouve pas dans « ${docAppui.nom} ». Constat écarté.`,
        });
        continue;
      }
    }

    // Ce qui a été vu mais pas retenu, et pourquoi : c'est ce que le juriste
    // veut pouvoir contester en une seconde.
    const ecartes = [];
    for (const c of candidats) {
      if (c.doc === docAppui) continue;
      ecartes.push({
        document: c.doc.id,
        nom: c.doc.nom,
        pourquoi:
          c.doc.role === "avenant"
            ? "Avenant : lu pour établir le texte en vigueur."
            : b.ecrase && b.ecrase.document === c.doc
              ? "Texte d'origine, modifié par un avenant postérieur."
              : b.nonEtabli
                ? "Lu, mais il ne porte pas l'information recherchée."
                : "Contient un passage proche, moins précis que celui retenu.",
      });
    }
    for (const d of documents.filter((x) => x.role === "ecarte")) {
      if (!chercherDans(d, sonde.motifs).length) continue;
      ecartes.push({ document: d.id, nom: d.nom, pourquoi: d.motifTri });
    }

    constats.push({
      id: `${sonde.id}${bruts.length > 1 ? `.${i + 1}` : ""}`,
      // La clé, elle, ne bouge pas.
      //
      // Le numéro affiché est positionnel : verser une pièce peut faire passer
      // CORP-03.1 à CORP-03.2, et la relecture du juriste se rattacherait alors
      // au mauvais constat. La clé repose sur la question posée, le document
      // retenu et le rang dans la sonde — trois choses qui ne changent pas
      // quand le lot de pièces grossit.
      cle: cleStable(sonde.id, docAppui, parDocument),
      sonde: sonde.id,
      chantier: sonde.chantier,
      question: sonde.question,
      pourquoi: sonde.pourquoi,
      valeur: b.valeur,
      redaction: b.redaction,
      gravite: b.gravite,
      impact: b.impact ?? null,
      liens: b.liens ?? [],
      spa: b.spa ?? null,
      nonEtabli: Boolean(b.nonEtabli),
      droit: sonde.droit ? { demande: sonde.droit, resultat: null } : null,
      provenance: {
        parcourus: depouilles.map((d) => d.id),
        consultes: candidats.map((x) => x.doc.id),
        retenu: docAppui?.id ?? null,
        nomRetenu: docAppui?.nom ?? null,
        cheminRetenu: docAppui?.chemin ?? b.document ?? null,
        page: appui?.page ?? null,
        ligne: appui?.ligne ?? null,
        clause: appui?.clause ?? null,
        extrait: appui?.extrait ?? null,
        motif: appui?.motif ?? null,
        // D'où vient le texte dans lequel le passage a été retrouvé : le fichier
        // lui-même, ou une reconnaissance de caractères sur une image. La
        // seconde demande confirmation sur l'original.
        origineTexte: docAppui?.origineTexte ?? null,
        ecartes,
      },
      relu: false,
    });
  }

  for (const c of constats) {
    j?.dire("Règles", `établit ${c.id} — ${c.valeur}`, {
      detail: c.provenance.extrait
        ? `passage retrouvé mot pour mot dans « ${c.provenance.nomRetenu} »${c.provenance.clause ? `, ${c.provenance.clause}` : ""}`
        : "aucun passage : le constat se déclare non établi",
      pistes: c.provenance.retenu ? [c.provenance.retenu] : [],
      constat: c.id,
      outil: "vérification mot pour mot",
    });
  }
  for (const r of rejets) {
    j?.dire("Règles", `écarte un constat de ${sonde.id}`, { detail: r.motif, pistes: [], outil: "vérification mot pour mot" });
  }
  if (rejets.length) trace.push({ quoi: "rejets", sonde: sonde.id, rejets });
  return { constats, rejets, sansReponse: null };
}

/**
 * La clé d'un constat. Le compteur est passé par référence pour que deux
 * constats de la même sonde sur le même document se distinguent.
 */
function cleStable(sonde, docAppui, parDocument) {
  const chemin = docAppui?.chemin ?? "sans-source";
  const rang = (parDocument.get(chemin) ?? 0) + 1;
  parDocument.set(chemin, rang);
  return rang === 1 ? `${sonde}|${chemin}` : `${sonde}|${chemin}|${rang}`;
}

/** Ce que la liste de demandes réclame, et ce qui n'est pas arrivé. */
export function lireListeDeDemandes(documents) {
  const liste = documents.find((d) => d.role === "liste-demandes");
  if (!liste) return { lignes: [], manquants: [] };
  const lignes = [];
  for (const m of liste.texte.matchAll(/^([A-Z]\d+)\s+(.+?)\s{2,}\[(.+?)\]\s*$/gm)) {
    const etat = m[3].trim();
    lignes.push({
      code: m[1],
      quoi: m[2].trim(),
      etat: /^NON REÇU$/i.test(etat) ? "manquant" : /,/.test(etat) ? "partiel" : "reçu",
      detail: etat,
    });
  }
  return { lignes, manquants: lignes.filter((l) => l.etat !== "reçu"), document: liste.id };
}

/** La couverture : ce qui a été lu, et surtout ce qui ne l'a pas été. */
export function couverture(documents, demandes) {
  const par = (r) => documents.filter((d) => d.role === r);
  return {
    total: documents.length,
    depouilles: documents.filter((d) => DEPOUILLES.has(d.role)).length,
    ecartes: par("ecarte").map((d) => ({ id: d.id, nom: d.nom, pourquoi: d.motifTri })),
    illisibles: par("illisible").map((d) => ({
      id: d.id,
      nom: d.nom,
      pourquoi: d.motifTri,
      aReconnaitre: Boolean(d.aReconnaitre),
    })),
    procedure: documents.filter((d) => d.role === "liste-demandes" || d.role === "reponses-vendeur").length,
    demandesManquantes: demandes.manquants.length,
    demandesTotal: demandes.lignes.length,
  };
}

/** Le dépouillement complet. */
export function depouiller(documents, sondes, contexte, j) {
  const trace = [];
  const constats = [];
  const sansReponse = [];
  const rejets = [];
  for (const sonde of sondes) {
    const r = appliquer(sonde, documents, contexte, trace, j);
    constats.push(...r.constats);
    if (r.sansReponse) sansReponse.push(r.sansReponse);
    if (r.rejets?.length) rejets.push(...r.rejets);
  }
  return { constats, sansReponse, rejets, trace };
}
