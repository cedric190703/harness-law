// Le jeu de test. Il répond à une question qu'un jury posera : « comment
// savez-vous que ça marche ? »
//
// Trois choses sont contrôlées, sans navigateur :
//   1. chaque écran se rend sans planter, y compris la fiche de chaque
//      affirmation (c'est là que vivent la pyramide, la frise et la
//      contradiction) ;
//   2. tout passage surligné existe mot pour mot dans le texte officiel —
//      c'est la promesse centrale de Visa ;
//   3. le verdict rendu correspond au verdict attendu, affirmation par
//      affirmation.
//
//   npm run verif

import { renderToString } from "react-dom/server";
import { Accueil } from "../src/views/Accueil";
import { Nouvelle } from "../src/views/Nouvelle";
import { Rapport } from "../src/views/Rapport";
import { Journal } from "../src/views/Journal";
import { Raisonnement } from "../src/views/Raisonnement";
import { lire, ouvrirAffirmation } from "../src/store";
import { passageDansSource } from "../src/engine/piste";
import { construireRaisonnement, quoiFaire } from "../src/engine/raisonnement";
import type { Verdict } from "../src/types";

/** Ce que des juristes attendent de chaque ligne du mémo piégé. */
const ATTENDU: Record<string, Verdict> = {
  A01: "vert",
  A02: "rouge", // article abrogé en 2008
  A03: "vert",
  A04: "vert",
  A05: "orange", // barème de 2017 appliqué à des faits de 2016
  A06: "rouge", // circulaire, et elle ne dit pas cela
  A07: "vert",
  A08: "orange", // décision postérieure aux faits
  A09: "rouge", // numéro de pourvoi inexistant
  A10: "rouge", // l'arrêt dit l'inverse
  A11: "vert",
  A12: "vert",
  A13: "vert",
  A14: "gris", // aucune source citée
};

let echecs = 0;
const rate = (quoi: string) => {
  echecs++;
  console.error(`  ✕ ${quoi}`);
};

console.log("\nLes écrans se rendent-ils ?");
for (const [nom, Vue] of [
  ["Accueil", Accueil],
  ["Soumettre un texte", Nouvelle],
  ["Le rapport", Rapport],
  ["Le journal d'audit", Journal],
  ["Le raisonnement", Raisonnement],
] as [string, () => JSX.Element][]) {
  try {
    renderToString(<Vue />);
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    rate(`${nom} — ${e instanceof Error ? e.message : e}`);
  }
}

const affirmations = lire().dossier.affirmations;

console.log("\nLa fiche de chaque affirmation se rend-elle ?");
for (const a of affirmations) {
  try {
    ouvrirAffirmation(a.id);
    renderToString(<Rapport />);
  } catch (e) {
    rate(`${a.id} — ${e instanceof Error ? e.message : e}`);
  }
}
console.log(`  ✓ ${affirmations.length} fiches`);
ouvrirAffirmation(null);

console.log("\nChaque passage surligné existe-t-il dans le texte officiel ?");
for (const a of affirmations) {
  const s = a.source;
  if (s?.passage && s.texte && !s.texte.includes(s.passage)) {
    rate(`${a.id} — le passage surligné est absent du texte officiel.`);
  }
  if (a.contradiction && s) {
    const retrouve = passageDansSource(s, a.contradiction.passage);
    if (retrouve !== a.contradiction.passageRetrouve) {
      rate(
        `${a.id} — la contradiction est annoncée « ${a.contradiction.passageRetrouve ? "retrouvée" : "écartée"} » ` +
          `mais la vérification mot pour mot dit le contraire.`,
      );
    }
  }
}
console.log("  ✓ tous les passages contrôlés");

console.log("\nLe fil du raisonnement dit-il la même chose que le rapport ?");
for (const a of affirmations) {
  const pas = construireRaisonnement(a, lire().dossier.dateDesFaits);

  // Le fil part toujours de l'affirmation et finit toujours par une conclusion.
  if (pas[0]?.genre !== "affirmation") rate(`${a.id} — le fil ne part pas de l'affirmation.`);
  const conclusion = pas.at(-1);
  if (conclusion?.genre !== "conclusion") rate(`${a.id} — le fil ne finit pas par une conclusion.`);

  // L'invariant qui compte : la conclusion du fil ne peut pas différer du
  // verdict du rapport, sinon Visa se contredirait d'un écran à l'autre.
  if (conclusion && conclusion.verdict !== a.verdict) {
    rate(`${a.id} — le fil conclut « ${conclusion.verdict} » quand le rapport dit « ${a.verdict} ».`);
  }

  // Les quatre contrôles sont toujours montrés, même quand l'un ne conclut rien.
  const controles = pas.filter((p) => p.genre === "controle");
  if (controles.length !== 4) rate(`${a.id} — ${controles.length} contrôles dans le fil au lieu de 4.`);
  controles.forEach((p, i) => {
    if (p.numeroControle !== i + 1) rate(`${a.id} — contrôle ${p.titre} numéroté ${p.numeroControle} au rang ${i + 1}.`);
  });
  for (const p of pas.filter((x) => x.genre !== "controle")) {
    if (p.numeroControle !== null) rate(`${a.id} — le pas ${p.id} porte un numéro de contrôle sans en être un.`);
  }

  // Les numéros sont consécutifs : un pas manquant serait un pas caché.
  pas.forEach((p, i) => {
    if (p.ordre !== i + 1) rate(`${a.id} — pas ${p.id} numéroté ${p.ordre} au rang ${i + 1}.`);
  });

  // Une requête affichée doit porter l'identifiant ou le numéro réellement cherché.
  const requete = pas.find((p) => p.requete)?.requete;
  if (a.citation && !requete) rate(`${a.id} — une source est citée mais aucune requête n'est montrée.`);
  if (requete && (requete.includes("LEGITEXT…") || requete.includes('"num": "…"'))) {
    rate(`${a.id} — la requête montrée est incomplète : ${requete.replace(/\n/g, " ")}`);
  }

  // Une conclusion doit dire quoi faire, pas seulement nommer une couleur.
  if (quoiFaire(a).length < 30) rate(`${a.id} — la conclusion ne dit pas quoi faire.`);
}
console.log(`  ✓ ${affirmations.length} fils contrôlés`);

console.log("\nLes verdicts correspondent-ils à ce que des juristes attendent ?");
let justes = 0;
for (const a of affirmations) {
  const attendu = ATTENDU[a.id];
  if (!attendu) {
    rate(`${a.id} — aucun verdict attendu n'est écrit dans le jeu de test.`);
  } else if (a.verdict !== attendu) {
    rate(`${a.id} — attendu « ${attendu} », rendu « ${a.verdict} ».`);
  } else {
    justes++;
  }
}
const total = affirmations.length;
console.log(`  ${justes === total ? "✓" : "✕"} ${justes} sur ${total} (${Math.round((justes / total) * 100)} %)`);

console.log(echecs ? `\n${echecs} problème(s).\n` : "\nTout passe.\n");
process.exit(echecs ? 1 : 0);
