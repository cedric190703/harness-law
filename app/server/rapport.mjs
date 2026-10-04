// L'export. Un audit qui ne sort pas de l'écran ne sert à rien : le rapport
// part au client, le tableau part dans un tableur, et les deux doivent porter
// leurs renvois.
//
// Le parti pris : on exporte en Markdown et en CSV, pas en .docx. Les deux
// s'ouvrent partout, se relisent en texte, et se convertissent sans perte. Un
// .docx engendré par une bibliothèque se remet en forme à la main de toute façon.

const ORDRE = ["critique", "élevée", "moyenne", "faible"];
const MECANISMES = ["condition suspensive", "garantie", "ajustement de prix"];

const date = (iso) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Le renvoi tel qu'un juriste l'écrit en note. */
function renvoi(p) {
  if (!p.nomRetenu) return "source non établie";
  return [p.nomRetenu, p.clause, p.page ? `p. ${p.page}` : null]
    .filter(Boolean)
    .join(", ")
    .concat(p.origineTexte?.par === "reconnaissance" ? " (lu par reconnaissance de caractères)" : "");
}

/** Le rapport complet, en Markdown. */
export function rapportMarkdown(audit) {
  const l = [];
  const ch = (id) => audit.chantiers.find((x) => x.id === id)?.nom ?? id;
  const compte = ORDRE.map((g) => [g, audit.constats.filter((c) => c.gravite === g).length]).filter(([, n]) => n);

  l.push(`# ${audit.nomDossier} — rapport de due diligence`);
  l.push("");
  l.push(`**Opération** : ${audit.operation}`);
  if (audit.cible) l.push(`**Cible** : ${audit.cible}`);
  l.push(`**Partie conseillée** : ${audit.cote}`);
  l.push(`**Date de référence** : ${date(audit.dateReference)}`);
  l.push(`**Passage de l'audit** : ${new Date(audit.lanceLe).toLocaleString("fr-FR")}`);
  l.push("");

  // Ce qui n'a pas été lu vient avant les constats : c'est ce qui borne tout
  // ce qui suit.
  const cv = audit.couverture;
  l.push("## Étendue de la revue");
  l.push("");
  l.push(`${cv.depouilles} documents ont été dépouillés sur ${cv.total} versés à la data room.`);
  l.push("");
  if (cv.illisibles.length) {
    l.push(`**${cv.illisibles.length} document${cv.illisibles.length > 1 ? "s n'ont" : " n'a"} pas pu être lu${cv.illisibles.length > 1 ? "s" : ""} :**`);
    l.push("");
    for (const d of cv.illisibles) l.push(`- *${d.nom}* — ${d.pourquoi}`);
    l.push("");
  }
  if (cv.ecartes.length) {
    l.push(`**${cv.ecartes.length} document${cv.ecartes.length > 1 ? "s ont" : " a"} été écarté${cv.ecartes.length > 1 ? "s" : ""} :**`);
    l.push("");
    for (const d of cv.ecartes) l.push(`- *${d.nom}* — ${d.pourquoi}`);
    l.push("");
  }
  if (audit.demandes.manquants.length) {
    l.push(`**${audit.demandes.manquants.length} ligne${audit.demandes.manquants.length > 1 ? "s" : ""} de la liste de demandes reste${audit.demandes.manquants.length > 1 ? "nt" : ""} sans réponse :**`);
    l.push("");
    for (const m of audit.demandes.manquants) l.push(`- **${m.code}** ${m.quoi} — ${m.etat === "manquant" ? "non reçu" : m.detail}`);
    l.push("");
  }
  l.push(
    "Les conclusions qui suivent ne portent que sur les documents effectivement lus. Chaque constat renvoie au document, à la clause et à la page dont il est tiré.",
  );
  l.push("");

  l.push("## Synthèse");
  l.push("");
  l.push(compte.map(([g, n]) => `**${n} ${g}${n > 1 && g !== "critique" ? "s" : n > 1 ? "s" : ""}**`).join(" · "));
  l.push("");
  l.push("| N° | Chantier | Point relevé | Gravité | Source |");
  l.push("|---|---|---|---|---|");
  for (const c of audit.constats) {
    l.push(`| ${c.id} | ${ch(c.chantier)} | ${c.valeur.replace(/\|/g, "\\|")} | ${c.gravite} | ${renvoi(c.provenance).replace(/\|/g, "\\|")} |`);
  }
  l.push("");

  l.push("## Constats, du plus grave au moins grave");
  l.push("");
  for (const c of audit.constats) {
    l.push(`### ${c.id} — ${c.question}`);
    l.push("");
    l.push(`**${c.gravite.toUpperCase()}** · ${ch(c.chantier)}${c.nonEtabli ? " · fait non établi par le dossier" : ""}`);
    l.push("");
    l.push(c.correction ?? c.redaction);
    l.push("");
    if (c.provenance.extrait) {
      l.push(`> ${c.provenance.extrait.replace(/\n+/g, " ")}`);
      l.push("");
      l.push(`*Source : ${renvoi(c.provenance)}.*`);
      l.push("");
    } else {
      l.push(`*Aucun passage : ${renvoi(c.provenance)}.*`);
      l.push("");
    }
    if (c.provenance.ecartes.length) {
      l.push(`*Écarté en route : ${c.provenance.ecartes.map((e) => `${e.nom} (${e.pourquoi.replace(/\.$/, "")})`).join(" ; ")}.*`);
      l.push("");
    }
    if (c.impact) {
      l.push(`**Conséquence pour ${audit.cote}.** ${c.impact}`);
      l.push("");
    }
    const d = c.droit?.resultat;
    if (d?.verifie && d.article) {
      l.push(`**Droit applicable.** ${d.article.reference} (${d.article.etat}, ${d.article.identifiant}) : « ${d.article.texte} »${d.jurisprudence ? ` ${d.jurisprudence.total} décisions au soutien dans Judilibre, dont ${d.jurisprudence.decisions.slice(0, 2).map((x) => `n° ${x.numero} du ${x.date}`).join(" et ")}.` : ""}`);
      l.push("");
    } else if (d && !d.verifie) {
      l.push(`**Droit applicable.** Non vérifié : ${d.motif}`);
      l.push("");
    }
    if (c.spa) {
      l.push(`**Traduction au contrat de cession — ${c.spa.mecanisme}.** ${c.spa.redaction}`);
      l.push("");
    }
    if (c.note) {
      l.push(`**Note du dossier.** ${c.note}`);
      l.push("");
    }
    if (c.relu) {
      l.push("*Relu et validé.*");
      l.push("");
    }
  }

  l.push("## Réponses du vendeur");
  l.push("");
  for (const e of audit.epreuves) {
    l.push(`**${e.question} — ${e.verdict}.** « ${e.affirmation} »`);
    l.push("");
    l.push(e.pourquoi);
    l.push("");
    if (e.appuis.length) {
      l.push(`*Établi par ${e.appuis.map((a) => `${a.constat} (${[a.document, a.clause, a.page ? `p. ${a.page}` : null].filter(Boolean).join(", ")})`).join(" ; ")}.*`);
      l.push("");
    }
  }

  l.push("## Traduction au contrat de cession");
  l.push("");
  for (const m of MECANISMES) {
    const liste = audit.mecanismes.filter((x) => x.mecanisme === m);
    if (!liste.length) continue;
    l.push(`### ${m[0].toUpperCase()}${m.slice(1)}`);
    l.push("");
    for (const x of liste.sort((a, b) => ORDRE.indexOf(a.gravite) - ORDRE.indexOf(b.gravite))) {
      l.push(`- **${x.constat}** (${x.gravite}) — ${x.redaction} *Justifié par ${[x.appui.document, x.appui.clause, x.appui.page ? `p. ${x.appui.page}` : null].filter(Boolean).join(", ")}.*`);
    }
    l.push("");
  }

  l.push("---");
  l.push("");
  l.push(
    `Rapport établi par Visa. Extraction : ${audit.moteur.extraction}. ` +
      `${audit.moteur.reconnaissance.employee ? `Documents scannés lus par ${audit.moteur.reconnaissance.modele} — les passages qui en viennent sont à confirmer sur l'original. ` : ""}` +
      `Droit applicable : ${audit.moteur.droit}. ` +
      `La vérification des constats relève de l'avocat : chaque renvoi permet de la faire sur la pièce.`,
  );
  l.push("");
  return l.join("\n");
}

/** Le tableau, en CSV, pour ouvrir dans un tableur. */
export function tableauCsv(audit) {
  const ch = (id) => audit.chantiers.find((x) => x.id === id)?.nom ?? id;
  const champ = (v) => {
    const s = String(v ?? "").replace(/\s+/g, " ").trim();
    return /[";,\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lignes = [
    [
      "N°", "Clé", "Chantier", "Question d'audit", "Point relevé", "Gravité", "Fait établi",
      "Document", "Clause", "Page", "Origine du texte", "Documents écartés",
      "Passage cité", "Rédaction", "Conséquence", "Mécanisme de cession", "Relu",
    ].join(";"),
  ];
  for (const c of audit.constats) {
    const p = c.provenance;
    lignes.push(
      [
        c.id, c.cle, ch(c.chantier), c.question, c.valeur, c.gravite, c.nonEtabli ? "non" : "oui",
        p.nomRetenu, p.clause, p.page, p.origineTexte?.par === "reconnaissance" ? "reconnaissance de caractères" : "fichier",
        p.ecartes.map((e) => e.nom).join(" | "), p.extrait, c.correction ?? c.redaction, c.impact,
        c.spa ? `${c.spa.mecanisme} : ${c.spa.redaction}` : "", c.relu ? "oui" : "non",
      ].map(champ).join(";"),
    );
  }
  // Le point-virgule et le BOM : c'est ce qu'attend un tableur en français.
  return `﻿${lignes.join("\r\n")}\r\n`;
}
