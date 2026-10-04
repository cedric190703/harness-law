// Le jeu de test. Il répond à la question qu'un jury posera : « comment savez-vous
// que le rapport ne dit rien de faux ? »
//
// Il n'y a pas de navigateur ici. On contrôle les promesses du produit, dans
// l'ordre de leur importance :
//
//   1. tout passage cité existe MOT POUR MOT dans le document nommé ;
//   2. le renvoi (clause, page) désigne bien l'endroit du passage ;
//   3. rien n'a été tiré d'un document illisible ou écarté ;
//   4. ce que le rapport affirme sans preuve est marqué « non établi » ;
//   5. chaque réponse du vendeur déclarée inexacte est appuyée sur un passage ;
//   6. la couverture est exacte : le compte des non-lus ne peut pas être minoré ;
//   7. chaque écran se rend sans planter.
//
//   npm run verif

import { renderToString } from "react-dom/server";
import { clauseDe, situer, LIGNES_PAR_PAGE, type DocumentLu } from "../server/documents.mjs";
import { auditer, enrichir } from "../server/harnais.mjs";
import * as magasin from "../server/dossiers.mjs";
import { rapportMarkdown, tableauCsv } from "../server/rapport.mjs";
import { passagePresent } from "../server/extraction.mjs";
import { Dossiers } from "../src/views/Dossiers";
import { Rapport } from "../src/views/Rapport";
import { Preuve } from "../src/views/Preuve";
import { Parcours } from "../src/views/Parcours";
import { Pieces } from "../src/views/Pieces";
import { JournalDAudit } from "../src/views/Audit";
import { poser } from "../src/store";
import type { Audit } from "../src/types";

let echecs = 0;
const rate = (quoi: string) => {
  echecs++;
  console.error(`  ✕ ${quoi}`);
};
const titre = (t: string) => console.log(`\n${t}`);
const ok = (t: string) => console.log(`  ✓ ${t}`);

// On éprouve le corpus exact qui a servi à l'audit : un document scanné puis lu
// par reconnaissance n'est plus le même que sur le disque.
let documents: DocumentLu[] = [];
const audit = enrichir(
  await auditer({ dossier: "sodimex", surCorpus: (d) => (documents = d) }),
) as unknown as Audit;
const parId = new Map(documents.map((d) => [d.id, d]));

// ------------------------------------------------------------------- 1. preuve
titre("1. Tout passage cité existe-t-il mot pour mot dans le document nommé ?");
let avecPreuve = 0;
for (const c of audit.constats) {
  const p = c.provenance;
  if (!p.extrait) {
    if (!c.nonEtabli) rate(`${c.id} — aucun passage cité et le constat ne se dit pas « non établi ».`);
    continue;
  }
  const doc = p.retenu ? parId.get(p.retenu) : null;
  if (!doc) {
    rate(`${c.id} — le document retenu « ${p.retenu} » n'existe pas dans la data room.`);
    continue;
  }
  if (!passagePresent(doc.texte, p.extrait)) {
    rate(`${c.id} — le passage cité ne se retrouve pas dans « ${doc.nom} ».`);
    continue;
  }
  avecPreuve++;
}
ok(`${avecPreuve} constats appuyés sur un passage retrouvé`);

// -------------------------------------------------------------- 1bis. identité
titre("1bis. Les clés de constat sont-elles uniques et stables ?");
const cles = new Map<string, string>();
for (const c of audit.constats) {
  if (!c.cle) {
    rate(`${c.id} — sans clé stable : la relecture du juriste ne pourrait pas s'y rattacher.`);
    continue;
  }
  const deja = cles.get(c.cle);
  if (deja) rate(`${c.id} partage sa clé « ${c.cle} » avec ${deja} : une relecture porterait sur les deux.`);
  else cles.set(c.cle, c.id);
  // La clé ne doit pas dépendre du numéro affiché, qui se décale.
  if (c.cle.includes(`.${c.id.split(".")[1] ?? "~"}`) && c.id.includes(".")) {
    rate(`${c.id} — sa clé reprend son numéro affiché, donc elle se décalera aussi.`);
  }
}
ok(`${cles.size} clés distinctes pour ${audit.constats.length} constats`);

// -------------------------------------------------------------------- 2. renvoi
titre("2. Le renvoi désigne-t-il l'endroit du passage ?");
for (const c of audit.constats) {
  const p = c.provenance;
  if (!p.extrait || !p.retenu) continue;
  const doc = parId.get(p.retenu)!;
  const ou = situer(doc, p.extrait);
  if (!ou) {
    rate(`${c.id} — le passage ne peut pas être situé dans « ${doc.nom} ».`);
    continue;
  }
  if (p.page !== ou.page) rate(`${c.id} — page annoncée ${p.page}, page réelle ${ou.page}.`);
  if (p.ligne !== ou.ligne) rate(`${c.id} — ligne annoncée ${p.ligne}, ligne réelle ${ou.ligne}.`);
  const attendue = clauseDe(doc, p.extrait);
  if (p.clause !== attendue) rate(`${c.id} — clause annoncée « ${p.clause} », clause réelle « ${attendue} ».`);
  // Une page annoncée doit exister dans le document.
  if (p.page && p.page > Math.ceil(doc.texte.split("\n").length / LIGNES_PAR_PAGE)) {
    rate(`${c.id} — page ${p.page} au-delà de la fin de « ${doc.nom} ».`);
  }
}
ok("tous les renvois vérifiés contre le document");

// ------------------------------------------------------- 3. rien des non-lus
titre("3. Rien n'a-t-il été tiré d'un document illisible ou écarté ?");
const interdits = new Set(documents.filter((d) => d.role === "illisible" || d.role === "ecarte").map((d) => d.id));
for (const c of audit.constats) {
  const r = c.provenance.retenu;
  if (!r || !interdits.has(r)) continue;
  const doc = parId.get(r)!;
  // Un constat peut *nommer* un illisible, mais alors il n'en tire rien et se
  // déclare non établi. C'est exactement ce qu'on veut vérifier.
  if (doc.role === "illisible" && c.nonEtabli && !c.provenance.extrait) continue;
  rate(`${c.id} — repose sur « ${doc.nom} » (${doc.role}) sans se déclarer non établi.`);
}
for (const c of audit.constats) {
  for (const id of c.provenance.consultes) {
    const d = parId.get(id);
    if (d && (d.role === "illisible" || d.role === "ecarte")) {
      rate(`${c.id} — « ${d.nom} » (${d.role}) compté parmi les documents consultés.`);
    }
  }
}
ok("aucun constat ne tire d'information d'un document non lu");

// ------------------------------------------------- 3bis. texte lu par machine
titre("3bis. Un passage lu par reconnaissance est-il signalé comme tel ?");
const parReconnaissance = audit.constats.filter((c) => c.provenance.origineTexte?.par === "reconnaissance");
for (const c of parReconnaissance) {
  const o = c.provenance.origineTexte!;
  if (!o.aConfirmer) rate(`${c.id} — lu par reconnaissance sans demander confirmation sur l'original.`);
  if (!o.modele) rate(`${c.id} — lu par reconnaissance sans nommer le modèle employé.`);
  const doc = parId.get(c.provenance.retenu!)!;
  // Le passage doit se retrouver dans le texte reconnu, pas ailleurs.
  if (!passagePresent(doc.texte, c.provenance.extrait!)) {
    rate(`${c.id} — le passage ne se retrouve pas dans le texte reconnu de « ${doc.nom} ».`);
  }
}
// Le moteur doit déclarer la reconnaissance dès qu'elle a servi.
const r = audit.moteur.reconnaissance;
if (parReconnaissance.length && !r.employee) {
  rate("le moteur ne déclare pas la reconnaissance alors que des constats en viennent.");
}
if (r.employee) {
  for (const c of parReconnaissance) {
    if (!r.documents.includes(c.provenance.retenu!)) {
      rate(`${c.id} — vient de ${c.provenance.retenu}, absent de la liste des documents reconnus.`);
    }
  }
}
// Et il ne doit jamais s'attribuer un modèle qui n'a pas tourné.
if (/magistral|mistral-medium/i.test(audit.moteur.extraction) && !audit.moteur.modele.disponible) {
  rate("le moteur annonce une extraction par Mistral alors que le modèle n'a pas répondu.");
}
ok(
  parReconnaissance.length
    ? `${parReconnaissance.length} constats issus d'un scan, tous signalés et à confirmer`
    : "aucun constat issu d'un scan",
);

// ------------------------------------------------------------- 4. non établi
titre("4. Ce qui n'est pas prouvé est-il marqué « non établi » ?");
const nonEtablis = audit.constats.filter((c) => c.nonEtabli);
for (const c of nonEtablis) {
  if (!c.impact) rate(`${c.id} — non établi mais sans explication de ce que cela coûte.`);
  if (c.provenance.extrait) rate(`${c.id} — se dit non établi tout en citant un passage.`);
}
ok(`${nonEtablis.length} constats se déclarent non établis, aucun n'affirme un fait`);

// ------------------------------------------------------ 5. réponses vendeur
titre("5. Chaque réponse déclarée inexacte est-elle appuyée sur un passage ?");
for (const e of audit.epreuves) {
  if (e.verdict !== "inexacte") continue;
  if (!e.appuis.length) {
    rate(`${e.question} — déclarée inexacte sans aucun constat au soutien.`);
    continue;
  }
  const avecExtrait = e.appuis.filter((a) => a.extrait);
  if (!avecExtrait.length) rate(`${e.question} — déclarée inexacte sans aucun passage cité.`);
  for (const a of avecExtrait) {
    const c = audit.constats.find((x) => x.id === a.constat);
    if (!c) {
      rate(`${e.question} — renvoie au constat ${a.constat}, qui n'existe pas.`);
      continue;
    }
    const doc = c.provenance.retenu ? parId.get(c.provenance.retenu) : null;
    if (doc && !passagePresent(doc.texte, a.extrait!)) {
      rate(`${e.question} — le passage cité n'est pas dans « ${doc.nom} ».`);
    }
  }
}
const inexactes = audit.epreuves.filter((e) => e.verdict === "inexacte").length;
ok(`${inexactes} réponses contredites, chacune appuyée sur un passage retrouvé`);

// -------------------------------------------------------------- 6. couverture
titre("6. La couverture est-elle exacte ?");
const cv = audit.couverture;
if (cv.total !== documents.length) rate(`couverture : ${cv.total} documents annoncés, ${documents.length} réels.`);
const depouillesReels = documents.filter((d) => d.role === "retenu" || d.role === "avenant").length;
if (cv.depouilles !== depouillesReels) rate(`couverture : ${cv.depouilles} dépouillés annoncés, ${depouillesReels} réels.`);
const illisiblesReels = documents.filter((d) => d.role === "illisible").length;
if (cv.illisibles.length !== illisiblesReels) rate(`couverture : ${cv.illisibles.length} illisibles annoncés, ${illisiblesReels} réels.`);
for (const i of cv.illisibles) if (!i.pourquoi) rate(`couverture : « ${i.nom} » illisible sans motif.`);
for (const e of cv.ecartes) if (!e.pourquoi) rate(`couverture : « ${e.nom} » écarté sans motif.`);
const somme = cv.depouilles + cv.illisibles.length + cv.ecartes.length + cv.procedure;
if (somme !== cv.total) rate(`couverture : ${somme} documents classés pour ${cv.total} versés — un fichier échappe au compte.`);
ok(`${cv.total} documents, tous classés et chacun avec son motif`);

// ------------------------------------------------------------------- 7. écrans
titre("7. Les volets se rendent-ils ?");
poser({ audit, dossierOuvert: audit.dossier });
for (const [nom, Vue] of [
  ["Le rapport", Rapport],
  ["Le parcours", Parcours],
  ["Les pièces", Pieces],
  ["Le journal d'audit imprimé", JournalDAudit],
] as [string, (p: { audit: Audit }) => JSX.Element][]) {
  try {
    renderToString(<Vue audit={audit} />);
    ok(nom);
  } catch (e) {
    rate(`${nom} — ${e instanceof Error ? e.message : e}`);
  }
}
try {
  poser({ dossiers: await magasin.lister(), chargement: false });
  renderToString(<Dossiers />);
  ok("Les dossiers");
} catch (e) {
  rate(`Les dossiers — ${e instanceof Error ? e.message : e}`);
}
// La preuve de chaque constat : c'est le volet que le juriste ouvre le plus.
for (const c of audit.constats) {
  try {
    renderToString(<Preuve audit={audit} constat={c} onLire={() => {}} />);
  } catch (e) {
    rate(`la preuve de ${c.id} — ${e instanceof Error ? e.message : e}`);
  }
}
try {
  renderToString(<Preuve audit={audit} constat={null} onLire={() => {}} />);
} catch (e) {
  rate(`la preuve sans constat choisi — ${e instanceof Error ? e.message : e}`);
}
ok(`${audit.constats.length} preuves de constat`);

// ------------------------------------------------- 7bis. le rapport et le parcours
titre("7bis. Le rapport lu et le parcours disent-ils la même chose que le registre ?");
const blocsConstat = audit.blocs.filter((b) => b.type === "constat") as Extract<Audit["blocs"][number], { type: "constat" }>[];
if (blocsConstat.length !== audit.constats.length) {
  rate(`le rapport porte ${blocsConstat.length} constats pour ${audit.constats.length} au registre.`);
}
for (const b of blocsConstat) {
  const c = audit.constats.find((x) => x.cle === b.cle);
  if (!c) {
    rate(`le rapport porte un constat « ${b.id} » qui n'est pas au registre.`);
    continue;
  }
  // Le bloc affiche la correction du juriste quand il y en a une, sinon la
  // rédaction : jamais autre chose.
  if (b.texte !== (c.correction ?? c.redaction)) rate(`${c.id} — le rapport n'affiche ni la rédaction ni la correction.`);
  if (b.gravite !== c.gravite) rate(`${c.id} — gravité ${b.gravite} au rapport, ${c.gravite} au registre.`);
  if (b.renvoi.document !== c.provenance.nomRetenu) rate(`${c.id} — le renvoi du rapport ne désigne pas le document retenu.`);
}
// Le schéma doit porter une ligne par pièce, et dire ce qui n'a rien donné.
const lignesPieces = audit.parcours.lignes.filter((l) => l.piece);
if (lignesPieces.length !== audit.documents.length) {
  rate(`le schéma porte ${lignesPieces.length} lignes de pièce pour ${audit.documents.length} pièces.`);
}
for (const l of audit.parcours.sansSuite) {
  const ligne = audit.parcours.lignes.find((x) => x.id === l.id);
  if (ligne?.exploitee) rate(`${l.nom} est annoncée sans suite alors que le schéma la dit exploitée.`);
}
for (const c of audit.constats) {
  if (!c.provenance.retenu) continue;
  const ligne = audit.parcours.lignes.find((x) => x.id === c.provenance.retenu);
  if (ligne && !ligne.exploitee) rate(`${c.id} repose sur une pièce que le schéma dit n'avoir rien donné.`);
}
// Le journal nomme ses acteurs, et seulement ceux qui existent.
const connus = new Set(audit.acteurs.map((a) => a.id));
for (const e of audit.journal) {
  if (!connus.has(e.acteur)) rate(`le journal nomme un acteur inconnu : ${e.acteur}.`);
  if (!e.action) rate(`une entrée du journal (${e.acteur}) n'a pas d'action.`);
}
ok(`${audit.blocs.length} blocs, ${audit.parcours.pas.length} pas, ${audit.journal.length} entrées de journal`);

// --------------------------------------------------------- 8. la plateforme
titre("8. Un dossier se travaille-t-il sur plusieurs jours ?");
const essai = `essai-${Date.now()}`;
try {
  const d = await magasin.creer({ nom: essai, operation: "Contrôle automatique", cote: "l'acquéreur" });

  // Un dossier vide s'audite sans planter, et ne conclut rien.
  const vide = (await auditer({ dossier: d.id })) as unknown as Audit;
  if (vide.constats.length) rate(`un dossier sans pièce rend ${vide.constats.length} constats.`);
  if (!vide.changements.premier) rate("le premier passage d'un dossier ne se déclare pas comme tel.");
  await magasin.enregistrerAudit(d.id, vide);

  // Une pièce versée est lue, et le changement est annoncé.
  const piece = [
    "CONTRAT DE PRESTATIONS",
    "ENTRE ESSAI SERVICES SAS ET CIBLE SAS",
    "Signe le 3 mars 2024.",
    "",
    "ARTICLE 9 - RESILIATION",
    "Le contrat sera resilie de plein droit en cas de changement du controle de",
    "Cible SAS au sens de l article L. 233-3 du code de commerce.",
  ].join("\n");
  await magasin.verser(d.id, [{ nom: "contrat essai.txt", contenu: Buffer.from(piece).toString("base64") }], "lot 1");
  const un = (await auditer({ dossier: d.id })) as unknown as Audit;
  if (!un.changements.documents.ajoutes.length) rate("une pièce versée n'apparaît pas dans les changements.");
  // Le document est sans accents : la recherche doit tout de même le trouver.
  if (!un.constats.length) rate("une clause de changement de contrôle sans accents n'est pas trouvée.");
  for (const c of un.constats) {
    const doc = documentsDe(un).get(c.provenance.retenu ?? "");
    if (c.provenance.extrait && doc && !piece.includes(c.provenance.extrait)) {
      rate(`${c.id} — l'extrait n'est pas recopié tel quel depuis la pièce versée.`);
    }
  }
  await magasin.enregistrerAudit(d.id, un);

  // Le juriste relit, puis une pièce change le constat : sa relecture est périmée.
  const cible = un.constats[0];
  if (cible) {
    await magasin.ecrireTravail(d.id, { relus: [cible.id], notes: { [cible.id]: "Vu avec le client." } });
    const relu = (await auditer({ dossier: d.id })) as unknown as Audit;
    const porte = relu.constats.find((c) => c.id === cible.id);
    if (!porte?.relu) rate("la relecture enregistrée n'est pas reprise au passage suivant.");
    if (porte?.note !== "Vu avec le client.") rate("la note du juriste ne survit pas au passage suivant.");
    await magasin.enregistrerAudit(d.id, relu);

    const avenant = [
      "AVENANT N 1 AU CONTRAT DE PRESTATIONS DU 3 MARS 2024",
      "ENTRE ESSAI SERVICES SAS ET CIBLE SAS",
      "Signe le 1 septembre 2026.",
      "",
      "ARTICLE 1 - MODIFICATION DE L ARTICLE 9",
      "Le changement de controle de Cible SAS est assimile a une cession et requiert",
      "l accord ecrit prealable du prestataire.",
    ].join("\n");
    await magasin.verser(d.id, [{ nom: "avenant essai.txt", contenu: Buffer.from(avenant).toString("base64") }], "lot 2");
    const apres = (await auditer({ dossier: d.id })) as unknown as Audit;
    const change = apres.changements.constats.modifies.some((c) => c.id === cible.id);
    if (change && !apres.changements.aRevoir.some((c) => c.id === cible.id)) {
      rate(`${cible.id} a changé après un versement sans que la relecture soit signalée périmée.`);
    }
    ok(
      change
        ? "un versement qui change un constat relu signale la relecture comme périmée"
        : "un versement est annoncé dans les changements",
    );
  }

  // Les exports sortent, et portent les renvois.
  const md = rapportMarkdown(un);
  const csv = tableauCsv(un);
  if (!md.includes("Étendue de la revue")) rate("le rapport ne dit pas l'étendue de la revue.");
  if (!md.includes(essai)) rate("le rapport ne nomme pas le dossier.");
  if (csv.split("\r\n").length - 1 !== un.constats.length + 1) rate("le tableau n'a pas une ligne par constat.");
  for (const c of un.constats) {
    if (c.provenance.nomRetenu && !md.includes(c.provenance.nomRetenu)) {
      rate(`${c.id} — le rapport ne porte pas le renvoi au document retenu.`);
    }
  }
  ok("le rapport et le tableau sortent avec leurs renvois");

  // Un identifiant malveillant ne doit pas sortir du répertoire des dossiers.
  for (const mauvais of ["../secret", "a/../..", "..", "C:\\x", ""]) {
    let refuse = false;
    try {
      magasin.cheminDossier(mauvais);
    } catch {
      refuse = true;
    }
    if (!refuse) rate(`l'identifiant « ${mauvais} » n'est pas refusé.`);
  }
  ok("les identifiants de dossier hors périmètre sont refusés");

  await magasin.supprimer(d.id);
  if ((await magasin.lister()).some((x) => x.id === d.id)) rate("le dossier d'essai n'a pas été supprimé.");
} catch (e) {
  rate(`la plateforme : ${e instanceof Error ? e.message : e}`);
  await magasin.supprimer(magasin.identifiant(essai)).catch(() => {});
}

// Le dossier de démonstration ne se supprime pas par inadvertance.
let protege = false;
try {
  await magasin.supprimer("sodimex");
} catch {
  protege = true;
}
if (!protege) rate("le dossier de démonstration a pu être supprimé.");
ok("le dossier de démonstration est protégé");

function documentsDe(a: Audit) {
  return new Map(a.documents.map((d) => [d.id, d]));
}

// ------------------------------------------------------------------- synthèse
const g = audit.constats.reduce<Record<string, number>>((a, c) => ({ ...a, [c.gravite]: (a[c.gravite] ?? 0) + 1 }), {});
console.log(
  `\n${audit.constats.length} constats (${Object.entries(g).map(([k, v]) => `${v} ${k}`).join(", ")}) · ` +
    `${audit.mecanismes.length} mécanismes · ${cv.demandesManquantes} demandes non satisfaites`,
);
console.log(`moteur : ${audit.moteur.extraction} | droit : ${audit.moteur.droit}`);
console.log(echecs ? `\n${echecs} problème(s).\n` : "\nTout passe.\n");
process.exit(echecs ? 1 : 0);
