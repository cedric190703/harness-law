// Le rapport, en blocs, pour être lu comme un document.
//
// C'est le changement qui compte pour le juriste : il ne lit pas une liste de
// fiches, il lit son rapport. Les phrases qui viennent d'un constat portent
// l'identifiant de ce constat, de sorte qu'un clic ouvre la preuve à côté.
//
// Rien n'est inventé ici : chaque bloc de constat reprend la rédaction du
// registre, ou la correction que le juriste a écrite.

const ORDRE = ["critique", "élevée", "moyenne", "faible"];

const pluriel = (n, mot, pl = "s") => `${n} ${mot}${n > 1 ? pl : ""}`;

/**
 * Les blocs du rapport. Quatre types seulement :
 *   titre       — un intertitre
 *   paragraphe  — du texte courant, sans source attachée
 *   constat     — la rédaction d'un constat, cliquable
 *   bornes      — ce qui n'a pas été lu, qui borne tout ce qui suit
 */
export function blocsDuRapport(audit) {
  const blocs = [];
  const ch = (id) => audit.chantiers.find((x) => x.id === id)?.nom ?? id;
  const cv = audit.couverture;
  const g = ORDRE.map((x) => [x, audit.constats.filter((c) => c.gravite === x).length]).filter(([, n]) => n);

  blocs.push({ type: "titre", niveau: 1, texte: `${audit.nomDossier} — rapport de due diligence` });
  blocs.push({
    type: "paragraphe",
    texte:
      `${audit.operation}${audit.cible ? ` · ${audit.cible}` : ""}. Nous conseillons ${audit.cote}. ` +
      `Revue arrêtée au ${jour(audit.dateReference)}.`,
    discret: true,
  });

  // Ce qui n'a pas été lu vient avant les constats : cela borne tout le reste.
  blocs.push({
    type: "bornes",
    lu: cv.depouilles,
    verse: cv.total,
    illisibles: cv.illisibles,
    ecartes: cv.ecartes,
    manquants: audit.demandes.manquants,
  });

  blocs.push({ type: "titre", niveau: 2, texte: "Ce que nous retenons" });
  blocs.push({
    type: "paragraphe",
    texte:
      `La revue relève ${pluriel(audit.constats.length, "point")}, dont ` +
      `${g.map(([x, n]) => `${n} ${x}${n > 1 && x !== "critique" && x !== "élevée" ? "s" : n > 1 ? "s" : ""}`).join(", ")}. ` +
      (audit.epreuves.filter((e) => e.verdict === "inexacte").length >= 3
        ? `${pluriel(audit.epreuves.filter((e) => e.verdict === "inexacte").length, "réponse")} du vendeur sur ${audit.epreuves.length} sont contredites par les pièces qu'il a lui-même versées : au-delà de chaque point, c'est la fiabilité de ses déclarations qui doit se traduire au contrat.`
        : ""),
  });

  // Les constats, par chantier, du plus grave au moins grave.
  for (const chantier of audit.chantiers) {
    const liste = audit.constats.filter((c) => c.chantier === chantier.id);
    if (!liste.length) continue;
    blocs.push({ type: "titre", niveau: 2, texte: ch(chantier.id) });
    for (const c of liste) {
      blocs.push({
        type: "constat",
        id: c.id,
        cle: c.cle,
        gravite: c.gravite,
        question: c.question,
        texte: c.correction ?? c.redaction,
        corrige: Boolean(c.correction),
        impact: c.impact,
        note: c.note,
        relu: c.relu,
        nonEtabli: c.nonEtabli,
        renvoi: {
          document: c.provenance.nomRetenu,
          clause: c.provenance.clause,
          page: c.provenance.page,
          reconnaissance: c.provenance.origineTexte?.par === "reconnaissance",
        },
        spa: c.spa,
      });
    }
    // Les questions restées sans réponse sur ce chantier : le rapport le dit.
    const sans = audit.sansReponse.filter((s) => s.chantier === chantier.id);
    if (sans.length) {
      blocs.push({
        type: "paragraphe",
        texte: `Sur ce chantier, ${pluriel(sans.length, "question")} reste${sans.length > 1 ? "nt" : ""} sans réponse dans les pièces versées : ${sans.map((s) => s.question.toLowerCase()).join(", ")}.`,
        discret: true,
      });
    }
  }

  // Les réponses du vendeur, chacune rattachée aux constats qui l'éprouvent.
  if (audit.epreuves.length) {
    blocs.push({ type: "titre", niveau: 2, texte: "Les réponses du vendeur" });
    for (const e of audit.epreuves) {
      blocs.push({
        type: "epreuve",
        question: e.question,
        affirmation: e.affirmation,
        verdict: e.verdict,
        texte: e.pourquoi,
        appuis: e.appuis.map((a) => a.constat),
      });
    }
  }

  // La traduction au contrat de cession.
  if (audit.mecanismes.length) {
    blocs.push({ type: "titre", niveau: 2, texte: "Au contrat de cession" });
    for (const m of ["condition suspensive", "garantie", "ajustement de prix"]) {
      const liste = audit.mecanismes
        .filter((x) => x.mecanisme === m)
        .sort((a, b) => ORDRE.indexOf(a.gravite) - ORDRE.indexOf(b.gravite));
      if (!liste.length) continue;
      blocs.push({ type: "titre", niveau: 3, texte: `${m[0].toUpperCase()}${m.slice(1)}` });
      for (const x of liste) {
        blocs.push({ type: "clause", constat: x.constat, gravite: x.gravite, question: x.question, texte: x.redaction });
      }
    }
  }

  return blocs;
}

function jour(iso) {
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const d = new Date(iso);
  return `${d.getDate()}${d.getDate() === 1 ? "er" : ""} ${mois[d.getMonth()]} ${d.getFullYear()}`;
}
