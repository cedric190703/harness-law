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
import { auditer } from "../server/harnais.mjs";
import { passagePresent } from "../server/extraction.mjs";
import { DataRoom } from "../src/views/DataRoom";
import { Chantiers } from "../src/views/Chantiers";
import { Tableau } from "../src/views/Tableau";
import { Constats } from "../src/views/Constats";
import { Vendeur } from "../src/views/Vendeur";
import { Spa } from "../src/views/Spa";
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
const audit = (await auditer({ racine: "./dataroom", surCorpus: (d) => (documents = d) })) as unknown as Audit;
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
titre("7. Les écrans se rendent-ils ?");
poser({ audit });
for (const [nom, Vue] of [
  ["La data room", DataRoom],
  ["Les chantiers", Chantiers],
  ["Le tableau", Tableau],
  ["Les constats", Constats],
  ["Les réponses du vendeur", Vendeur],
  ["Au contrat de cession", Spa],
] as [string, (p: { audit: Audit }) => JSX.Element][]) {
  try {
    renderToString(<Vue audit={audit} />);
    ok(nom);
  } catch (e) {
    rate(`${nom} — ${e instanceof Error ? e.message : e}`);
  }
}
// La fiche d'un constat : c'est là que vivent le fil et le droit applicable.
for (const c of audit.constats) {
  try {
    poser({ audit, constatOuvert: c.id });
    renderToString(<Constats audit={audit} />);
  } catch (e) {
    rate(`fiche ${c.id} — ${e instanceof Error ? e.message : e}`);
  }
}
ok(`${audit.constats.length} fiches de constat`);
poser({ constatOuvert: null });

// ------------------------------------------------------------------- synthèse
const g = audit.constats.reduce<Record<string, number>>((a, c) => ({ ...a, [c.gravite]: (a[c.gravite] ?? 0) + 1 }), {});
console.log(
  `\n${audit.constats.length} constats (${Object.entries(g).map(([k, v]) => `${v} ${k}`).join(", ")}) · ` +
    `${audit.mecanismes.length} mécanismes · ${cv.demandesManquantes} demandes non satisfaites`,
);
console.log(`moteur : ${audit.moteur.extraction} | droit : ${audit.moteur.droit}`);
console.log(echecs ? `\n${echecs} problème(s).\n` : "\nTout passe.\n");
process.exit(echecs ? 1 : 0);
