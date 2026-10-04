import type { Carte } from "./carte";
import { MENTION, diffMots } from "./correction";

/**
 * La carte des sources en une page HTML autonome (aucune dépendance, ouvrable
 * hors ligne) : les affirmations à gauche, les sources à droite, un lien coloré
 * par vérification. Toutes les données passent par textContent, jamais par innerHTML.
 */
export function rendreCarte(carte: Carte): string {
  // Le passage avant / après de chaque réécriture, calculé ici pour que la page n'ait aucune règle à elle.
  const revisions = Object.fromEntries(
    carte.resultats.flatMap((r) =>
      r.reecriture && r.reecriture.propose !== null
        ? [[r.affirmation.id, diffMots(r.affirmation.passage, r.reecriture.propose)]]
        : [],
    ),
  );
  const donnees = JSON.stringify({ ...carte, revisions, mentions: MENTION }).replace(/</g, "\\u003c");
  const titre = `Carte des sources — ${carte.titre}`.replace(/[<>&"]/g, "");
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titre}</title>
<style>${CSS}</style>
</head>
<body>
<div class="page">
  <main class="principal">
    <header class="entete" id="entete"></header>
    <details class="texte" id="texte"><summary>Voir le texte analysé, passages surlignés</summary><div class="texte-corps" id="texte-corps"></div></details>
    <div class="carte" id="carte">
      <section class="colonne" id="col-aff"><h2>Ce que dit l'IA</h2></section>
      <div class="gouttiere" aria-hidden="true"></div>
      <section class="colonne" id="col-src"><h2>Sources citées</h2></section>
      <svg class="liens" id="liens" aria-hidden="true"></svg>
    </div>
    <footer class="pied" id="pied"></footer>
  </main>
  <aside class="panneau" id="panneau" aria-live="polite"></aside>
</div>
<script id="donnees" type="application/json">${donnees}</script>
<script>${JS}</script>
</body>
</html>
`;
}

const CSS = `
:root {
  --fond: #f6f6f3; --surface: #ffffff; --surface-2: #f0f0ec; --trait: #dedcd5; --texte: #1c1b19; --doux: #6a6862;
  --vert: #1a7f37; --orange: #b35c00; --rouge: #c9252d; --gris: #737a82; --accent: #2f5bd3;
  --ombre: 0 1px 2px rgba(0,0,0,.06);
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --fond: #0e1013; --surface: #161a1f; --surface-2: #1c2128; --trait: #2a3038; --texte: #e6e8eb; --doux: #8d96a0;
    --vert: #3fb950; --orange: #d9a03b; --rouge: #f8645c; --gris: #8d96a0; --accent: #6d9bff;
    --ombre: none; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --fond: #0e1013; --surface: #161a1f; --surface-2: #1c2128; --trait: #2a3038; --texte: #e6e8eb; --doux: #8d96a0;
  --vert: #3fb950; --orange: #d9a03b; --rouge: #f8645c; --gris: #8d96a0; --accent: #6d9bff;
  --ombre: none; color-scheme: dark;
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body { background: var(--fond); color: var(--texte); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.page { display: grid; grid-template-columns: minmax(0, 1fr) 420px; min-height: 100vh; }
.principal { padding: 24px 28px 40px; min-width: 0; }
.entete h1 { font-size: 20px; margin: 0 0 2px; letter-spacing: -.01em; }
.entete .sous { color: var(--doux); margin: 0 0 12px; }
.compteurs { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 12px; }
.compteur { background: var(--surface); border: 1px solid var(--trait); border-radius: 8px; padding: 6px 10px; box-shadow: var(--ombre); }
.compteur b { font-size: 16px; margin-right: 4px; font-variant-numeric: tabular-nums; }
.alerte { border: 1px solid color-mix(in srgb, var(--orange) 45%, transparent); background: color-mix(in srgb, var(--orange) 10%, transparent); border-radius: 8px; padding: 8px 12px; margin: 0 0 10px; }
.legende { display: flex; flex-wrap: wrap; gap: 14px; color: var(--doux); font-size: 12px; margin: 0 0 14px; }
.legende span { display: inline-flex; align-items: center; gap: 6px; }
.legende svg { width: 28px; height: 8px; }
.texte { background: var(--surface); border: 1px solid var(--trait); border-radius: 10px; margin: 0 0 18px; }
.texte summary { cursor: pointer; padding: 10px 14px; color: var(--doux); }
.texte-corps { padding: 0 14px 14px; white-space: pre-wrap; max-height: 420px; overflow: auto; }
.texte-corps mark { background: color-mix(in srgb, var(--c) 16%, transparent); color: inherit; border-bottom: 2px solid var(--c); cursor: pointer; padding: 0 1px; }
.carte { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 110px minmax(0, 1fr); align-items: start; }
.colonne { display: flex; flex-direction: column; gap: 10px; position: relative; z-index: 1; }
.colonne h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--doux); margin: 0 0 2px; font-weight: 600; }
#col-src { padding-top: 0; }
.liens { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: visible; }
.liens path { fill: none; stroke-width: 1.6; transition: opacity .15s; }
.liens circle { transition: opacity .15s; }
.bloc { background: var(--surface); border: 1px solid var(--trait); border-radius: 10px; padding: 10px 12px; cursor: pointer; box-shadow: var(--ombre); transition: opacity .15s, border-color .15s, transform .15s; text-align: left; color: inherit; font: inherit; width: 100%; }
.bloc:hover { border-color: var(--doux); }
.bloc:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.bloc.choisi { border-color: var(--c); box-shadow: 0 0 0 1px var(--c); }
.haut { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px; }
.panneau > .haut { justify-content: flex-start; }
.etiquette { font-size: 10.5px; text-transform: uppercase; letter-spacing: .07em; color: var(--doux); font-weight: 600; }
.pastille { font-size: 11px; font-weight: 600; border-radius: 999px; padding: 1px 8px; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); white-space: nowrap; }
.bloc .corps { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.bloc .note { color: var(--doux); font-size: 12px; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.bloc .titre-src { font-weight: 600; }
.estompe .bloc:not(.actif) { opacity: .35; }
.estompe .liens path:not(.actif), .estompe .liens circle:not(.actif) { opacity: .12; }
.st-vert { --c: var(--vert); } .st-orange { --c: var(--orange); } .st-rouge { --c: var(--rouge); } .st-gris { --c: var(--gris); }
.panneau { border-left: 1px solid var(--trait); background: var(--surface); padding: 22px 22px 40px; position: sticky; top: 0; height: 100vh; overflow: auto; }
.panneau h2 { font-size: 17px; margin: 6px 0 8px; }
.panneau h3 { font-size: 13px; margin: 18px 0 6px; }
.panneau .vide { color: var(--doux); }
.citation { border-left: 3px solid var(--c, var(--trait)); padding: 4px 0 4px 12px; margin: 8px 0; }
.controles { list-style: none; padding: 0; margin: 6px 0; display: grid; gap: 6px; }
.controles li { display: grid; grid-template-columns: 18px 92px 1fr; gap: 6px; align-items: start; font-size: 13px; }
.controles .icone { color: var(--c); font-weight: 700; text-align: center; }
.controles .nom { color: var(--doux); }
.raisonnement { margin: 6px 0; padding-left: 20px; }
.raisonnement li { margin: 2px 0; }
.preuve { font-size: 12px; font-weight: 600; color: var(--c); }
.source-bloc { border: 1px solid var(--trait); border-radius: 10px; padding: 10px 12px; margin: 10px 0; }
.lien { color: var(--accent); text-decoration: none; } .lien:hover { text-decoration: underline; }
.officiel { white-space: pre-wrap; background: var(--surface-2); border-radius: 8px; padding: 10px 12px; max-height: 360px; overflow: auto; font-size: 13px; }
.officiel mark { background: color-mix(in srgb, var(--vert) 25%, transparent); color: inherit; }
.versions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.versions .officiel { max-height: 240px; }
.puces { display: flex; flex-wrap: wrap; gap: 6px; }
.puce { border: 1px solid var(--trait); background: var(--surface-2); border-radius: 999px; padding: 2px 10px; cursor: pointer; font: inherit; color: inherit; }
.revision { font-size: 14px; line-height: 1.55; margin: 8px 0; }
.revision del { color: var(--rouge); background: color-mix(in srgb, var(--rouge) 12%, transparent); }
.revision ins { color: var(--vert); background: color-mix(in srgb, var(--vert) 14%, transparent); text-decoration: underline 2px; text-underline-offset: 2px; }
.pied { color: var(--doux); font-size: 12px; margin-top: 28px; }
.fermer { float: right; background: none; border: 1px solid var(--trait); color: var(--doux); border-radius: 6px; cursor: pointer; font: inherit; padding: 2px 8px; display: none; }
@media (max-width: 1100px) {
  .page { grid-template-columns: minmax(0, 1fr); }
  .panneau { position: fixed; left: 0; right: 0; bottom: 0; top: auto; height: auto; max-height: 62vh; border-left: 0; border-top: 1px solid var(--trait); box-shadow: 0 -8px 24px rgba(0,0,0,.18); transform: translateY(100%); transition: transform .2s; z-index: 5; }
  .panneau.ouvert { transform: none; }
  .fermer { display: inline-block; }
}
@media (max-width: 720px) {
  .principal { padding: 16px; }
  .carte { grid-template-columns: minmax(0, 1fr); gap: 18px; }
  .gouttiere, .liens { display: none; }
}
`;

const JS = `
(function () {
  var carte = JSON.parse(document.getElementById("donnees").textContent);
  var LIBELLE_AFF = { vert: "vérifiée", orange: "à revoir", rouge: "fausse", gris: "non vérifiée" };
  var LIBELLE_SRC = { vert: "retrouvée", orange: "à revoir", rouge: "problème", gris: "non vérifiée" };
  var LIBELLE_CTRL = { existe: "Existe ?", date: "En vigueur ?", rang: "Rang", contenu: "Dit-elle ça ?" };
  var ICONE = { vert: "✓", orange: "!", rouge: "✗", gris: "?" };
  var TYPE = { article_code: "Article de code", decision: "Décision", loi: "Loi", ordonnance: "Ordonnance", decret: "Décret", arrete: "Arrêté", circulaire: "Circulaire", piece: "Pièce du dossier", autre: "Autre" };
  var PIRE = ["rouge", "orange", "gris", "vert"];

  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "texte") n.textContent = attrs[k];
      else if (k === "classe") n.className = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return n;
  }
  function pire(statuts) { for (var i = 0; i < PIRE.length; i++) if (statuts.indexOf(PIRE[i]) >= 0) return PIRE[i]; return "gris"; }
  function dateFr(iso) { if (!iso) return "?"; var p = iso.split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso; }
  function norm(t) { return (t || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

  // Les sources, dédoublonnées : une source citée par plusieurs affirmations n'a qu'un bloc.
  var sources = [], parCle = {}, liens = [];
  carte.resultats.forEach(function (r) {
    r.verifications.forEach(function (v, j) {
      var cle = v.officielle ? v.officielle.base + ":" + v.officielle.id : "cite:" + norm(v.citee.brut);
      var s = parCle[cle];
      if (!s) {
        s = { cle: cle, citee: v.citee, officielle: v.officielle, version: v.versionApplicable, statuts: [], refs: [] };
        parCle[cle] = s; sources.push(s);
      }
      v.controles.forEach(function (c) { if (c.nom !== "contenu") s.statuts.push(c.statut); });
      s.refs.push({ aff: r.affirmation.id, j: j });
      liens.push({ aff: r.affirmation.id, src: cle, statut: v.statut, j: j });
    });
  });
  sources.forEach(function (s) { s.statut = s.statuts.length ? pire(s.statuts) : "gris"; });

  // En-tête
  var entete = document.getElementById("entete");
  var syn = carte.synthese, n = carte.resultats.length;
  var origine = carte.origineDate === "saisie" ? "saisie" : carte.origineDate === "texte" ? "trouvée dans le texte" : "inconnue : vérifié à la date du jour";
  entete.appendChild(el("h1", { texte: carte.titre }));
  entete.appendChild(el("p", { classe: "sous", texte: "Carte des sources · date des faits : " + dateFr(carte.dateFaits) + " (" + origine + ")" }));
  if (!carte.basesConnectees) entete.appendChild(el("p", { classe: "alerte", texte: "Bases officielles non connectées : les textes de loi et les décisions n'ont pas pu être vérifiés. Ils restent en gris." }));
  if (carte.origineDate === "aujourd'hui") entete.appendChild(el("p", { classe: "alerte", texte: "Date des faits inconnue : les textes sont contrôlés dans leur version d'aujourd'hui. Relance avec la date des faits pour vérifier la bonne version." }));
  entete.appendChild(el("div", { classe: "compteurs" },
    el("span", { classe: "compteur" }, el("b", { texte: String(n) }), n > 1 ? "affirmations" : "affirmation"),
    el("span", { classe: "compteur st-vert" }, el("b", { texte: String(syn.vert), style: "color:var(--c)" }), "vérifiées"),
    el("span", { classe: "compteur st-orange" }, el("b", { texte: String(syn.orange), style: "color:var(--c)" }), "à revoir"),
    el("span", { classe: "compteur st-rouge" }, el("b", { texte: String(syn.rouge), style: "color:var(--c)" }), "fausses"),
    el("span", { classe: "compteur st-gris" }, el("b", { texte: String(syn.gris), style: "color:var(--c)" }), "non vérifiées")
  ));
  var legende = el("div", { classe: "legende" });
  [["vert", "", "la source dit bien cela"], ["orange", "", "à revoir"], ["rouge", "6 4", "fausse ou introuvable"], ["gris", "2 4", "non vérifiée"]].forEach(function (l) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "0"); line.setAttribute("y1", "4"); line.setAttribute("x2", "28"); line.setAttribute("y2", "4");
    line.setAttribute("stroke", "var(--" + l[0] + ")"); line.setAttribute("stroke-width", "2");
    if (l[1]) line.setAttribute("stroke-dasharray", l[1]);
    svg.appendChild(line);
    legende.appendChild(el("span", null, svg, l[2]));
  });
  legende.appendChild(el("span", { texte: "Survole ou clique un bloc pour suivre ses liens." }));
  entete.appendChild(legende);

  // Blocs
  var colAff = document.getElementById("col-aff"), colSrc = document.getElementById("col-src");
  var blocsAff = {}, blocsSrc = {};
  if (n === 0) colAff.appendChild(el("p", { classe: "vide", texte: "Aucune affirmation juridique dans ce texte." }));
  carte.resultats.forEach(function (r) {
    var a = r.affirmation;
    var b = el("button", { classe: "bloc st-" + r.statut, type: "button" },
      el("div", { classe: "haut" }, el("span", { classe: "etiquette", texte: "Affirmation " + a.id }), el("span", { classe: "pastille", texte: LIBELLE_AFF[r.statut] })),
      el("div", { classe: "corps", texte: a.passage }),
      r.statut !== "vert" && r.message ? el("div", { classe: "note", texte: r.message }) : null,
      r.reecriture ? el("div", { classe: "note", texte: r.reecriture.type === "remplacer" ? "Correction proposée, sourcée" : "Correction : " + (carte.mentions || {})[r.reecriture.type] }) : null,
      a.sources.length === 0 ? el("div", { classe: "note", texte: "Aucune source citée." }) : null
    );
    b.addEventListener("mouseenter", function () { survoler({ aff: a.id }); });
    b.addEventListener("mouseleave", function () { survoler(null); });
    b.addEventListener("click", function () { choisir({ aff: a.id }); });
    blocsAff[a.id] = b; colAff.appendChild(b);
  });
  if (sources.length === 0 && n > 0) colSrc.appendChild(el("p", { classe: "vide", texte: "Aucune source citée." }));
  sources.forEach(function (s) {
    var o = s.officielle;
    var detail = o ? o.base + (o.rang > 0 ? " · " + o.rangLibelle : "") : s.statut === "rouge" ? "introuvable" : "non retrouvée";
    var b = el("button", { classe: "bloc st-" + s.statut, type: "button" },
      el("div", { classe: "haut" }, el("span", { classe: "etiquette", texte: TYPE[s.citee.type] || "Source" }), el("span", { classe: "pastille", texte: LIBELLE_SRC[s.statut] })),
      el("div", { classe: "corps titre-src", texte: o ? o.titre : s.citee.brut }),
      el("div", { classe: "note", texte: detail + " · citée " + s.refs.length + " fois" })
    );
    b.addEventListener("mouseenter", function () { survoler({ src: s.cle }); });
    b.addEventListener("mouseleave", function () { survoler(null); });
    b.addEventListener("click", function () { choisir({ src: s.cle }); });
    blocsSrc[s.cle] = b; colSrc.appendChild(b);
  });

  // Liens
  var svg = document.getElementById("liens"), zone = document.getElementById("carte");
  var traces = [];
  function dessiner() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    traces = [];
    var z = zone.getBoundingClientRect();
    liens.forEach(function (l) {
      var a = blocsAff[l.aff].getBoundingClientRect(), s = blocsSrc[l.src].getBoundingClientRect();
      var x1 = a.right - z.left, y1 = a.top + a.height / 2 - z.top;
      var x2 = s.left - z.left, y2 = s.top + Math.min(s.height / 2, 22) - z.top;
      var dx = Math.max(30, (x2 - x1) / 2);
      var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", "M" + x1 + " " + y1 + " C" + (x1 + dx) + " " + y1 + " " + (x2 - dx) + " " + y2 + " " + x2 + " " + y2);
      p.setAttribute("stroke", "var(--" + l.statut + ")");
      if (l.statut === "rouge") p.setAttribute("stroke-dasharray", "6 4");
      if (l.statut === "gris") p.setAttribute("stroke-dasharray", "2 4");
      var c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", x2); c.setAttribute("cy", y2); c.setAttribute("r", "3.2"); c.setAttribute("fill", "var(--" + l.statut + ")");
      svg.appendChild(p); svg.appendChild(c);
      traces.push({ lien: l, path: p, point: c });
    });
    appliquer();
  }

  // Survol et sélection
  var survol = null, choix = null;
  function cible() { return survol || choix; }
  function appliquer() {
    var t = cible();
    zone.classList.toggle("estompe", !!t);
    var affs = {}, srcs = {};
    traces.forEach(function (tr) {
      var actif = !!t && ((t.aff && tr.lien.aff === t.aff) || (t.src && tr.lien.src === t.src));
      tr.path.classList.toggle("actif", actif); tr.point.classList.toggle("actif", actif);
      if (actif) { affs[tr.lien.aff] = 1; srcs[tr.lien.src] = 1; }
    });
    if (t && t.aff) affs[t.aff] = 1;
    if (t && t.src) srcs[t.src] = 1;
    Object.keys(blocsAff).forEach(function (k) { blocsAff[k].classList.toggle("actif", !!affs[k]); blocsAff[k].classList.toggle("choisi", !!choix && choix.aff === k); });
    Object.keys(blocsSrc).forEach(function (k) { blocsSrc[k].classList.toggle("actif", !!srcs[k]); blocsSrc[k].classList.toggle("choisi", !!choix && choix.src === k); });
  }
  function survoler(t) { survol = t; appliquer(); }
  function choisir(t) { choix = t; survol = null; appliquer(); remplirPanneau(); }

  // Panneau de détail
  var panneau = document.getElementById("panneau");
  function remplirPanneau() {
    while (panneau.firstChild) panneau.removeChild(panneau.firstChild);
    panneau.classList.toggle("ouvert", !!choix);
    if (!choix) {
      panneau.appendChild(el("h2", { texte: "Détail" }));
      panneau.appendChild(el("p", { classe: "vide", texte: "Clique une affirmation pour voir ses contrôles, le raisonnement de l'avocat adverse et le passage exact du texte officiel. Clique une source pour lire le texte." }));
      panneau.appendChild(el("p", { classe: "vide", texte: "Règle : sans preuve, rien n'est vert. Un verdict ne compte que si son extrait est retrouvé mot pour mot dans le texte officiel." }));
      return;
    }
    panneau.appendChild(el("button", { classe: "fermer", type: "button", texte: "Fermer", onclick: function () { choisir(null); } }));
    if (choix.aff) panneauAffirmation(choix.aff); else panneauSource(choix.src);
  }
  function listeControles(controles) {
    var ul = el("ul", { classe: "controles" });
    controles.forEach(function (c) {
      ul.appendChild(el("li", { classe: "st-" + c.statut }, el("span", { classe: "icone", texte: ICONE[c.statut] }), el("span", { classe: "nom", texte: LIBELLE_CTRL[c.nom] || c.nom }), el("span", { texte: c.message })));
    });
    return ul;
  }
  function texteSurligne(texte, extraits) {
    var box = el("div", { classe: "officiel" });
    var plages = [];
    extraits.forEach(function (x) { if (!x) return; var i = texte.indexOf(x); if (i >= 0) plages.push([i, i + x.length]); });
    plages.sort(function (a, b) { return a[0] - b[0]; });
    var pos = 0;
    plages.forEach(function (p) {
      if (p[0] < pos) return;
      box.appendChild(document.createTextNode(texte.slice(pos, p[0])));
      box.appendChild(el("mark", { texte: texte.slice(p[0], p[1]) }));
      pos = p[1];
    });
    box.appendChild(document.createTextNode(texte.slice(pos)));
    var m = box.querySelector("mark");
    if (m) setTimeout(function () { box.scrollTop = Math.max(0, m.offsetTop - 40); }, 0);
    return box;
  }
  function panneauAffirmation(id) {
    var r = carte.resultats.filter(function (x) { return x.affirmation.id === id; })[0];
    var a = r.affirmation;
    panneau.appendChild(el("div", { classe: "haut st-" + r.statut }, el("span", { classe: "etiquette", texte: "Affirmation " + a.id + " · " }), el("span", { classe: "pastille", texte: LIBELLE_AFF[r.statut] })));
    panneau.appendChild(el("blockquote", { classe: "citation st-" + r.statut, texte: a.passage }));
    if (a.resume) panneau.appendChild(el("p", { classe: "vide", texte: a.resume }));
    if (r.message && r.statut !== "vert") panneau.appendChild(el("p", { texte: r.message }));
    if (r.reecriture) panneau.appendChild(blocReecriture(r));
    r.verifications.forEach(function (v) {
      var o = v.officielle, j = v.jugement;
      var bloc = el("div", { classe: "source-bloc st-" + v.statut });
      bloc.appendChild(el("div", { classe: "haut" }, el("span", { classe: "etiquette", texte: TYPE[v.citee.type] || "Source" }), el("span", { classe: "pastille", texte: LIBELLE_AFF[v.statut] })));
      bloc.appendChild(el("div", { classe: "titre-src", texte: "Cité : " + v.citee.brut }));
      if (o) bloc.appendChild(el("div", null, "Retrouvé : ", o.url ? el("a", { classe: "lien", href: o.url, target: "_blank", rel: "noopener", texte: o.titre }) : o.titre));
      bloc.appendChild(listeControles(v.controles));
      if (j) {
        bloc.appendChild(el("h3", { texte: "Avocat adverse : " + j.verdict.replace(/_/g, " ").toLowerCase() }));
        if (j.raisonnement && j.raisonnement.length) {
          var ol = el("ol", { classe: "raisonnement" });
          j.raisonnement.forEach(function (e) { ol.appendChild(el("li", { texte: e })); });
          bloc.appendChild(ol);
        }
        if (j.extrait) {
          bloc.appendChild(el("blockquote", { classe: "citation " + (j.extraitRetrouve ? "st-vert" : "st-rouge"), texte: j.extrait }));
          bloc.appendChild(el("div", { classe: "preuve " + (j.extraitRetrouve ? "st-vert" : "st-rouge"), texte: j.extraitRetrouve ? "✓ Extrait retrouvé mot pour mot dans le texte officiel" : "✗ Extrait introuvable dans le texte officiel : verdict écarté" }));
        }
        if (j.correction) bloc.appendChild(el("p", null, el("b", { texte: "Ce que dit vraiment le texte : " }), j.correction));
      }
      if (o && o.versions && o.versions.length > 1 && v.versionApplicable) {
        var courante = o.versions[o.versions.length - 1];
        if (courante.texte !== v.versionApplicable.texte) {
          var d = el("details", null, el("summary", { texte: "Comparer la version des faits et la version actuelle" }));
          d.appendChild(el("div", { classe: "versions" },
            el("div", null, el("div", { classe: "etiquette", texte: "Au " + dateFr(carte.dateFaits) + " (du " + dateFr(v.versionApplicable.debut) + ")" }), el("div", { classe: "officiel", texte: v.versionApplicable.texte })),
            el("div", null, el("div", { classe: "etiquette", texte: "Aujourd'hui (depuis le " + dateFr(courante.debut) + ")" }), el("div", { classe: "officiel", texte: courante.texte }))
          ));
          bloc.appendChild(d);
        }
      }
      panneau.appendChild(bloc);
    });
    if (a.sources.length === 0) panneau.appendChild(el("p", { classe: "vide", texte: "Aucune source n'est citée à l'appui : cette affirmation est à vérifier à la main." }));
  }
  function blocReecriture(r) {
    var p = r.reecriture, s = p.source, d = (carte.revisions || {})[r.affirmation.id];
    var bloc = el("div", { classe: "source-bloc " + (p.type === "remplacer" ? "st-vert" : "st-orange") });
    bloc.appendChild(el("div", { classe: "haut" }, el("span", { classe: "etiquette", texte: p.type === "remplacer" ? "Correction proposée" : "Correction" }), el("span", { classe: "pastille", texte: (carte.mentions || {})[p.type] || "" })));
    if (d) bloc.appendChild(el("p", { classe: "revision" }, d.prefixe, d.retire ? el("del", { texte: d.retire }) : null, d.retire && d.ajoute ? " " : null, d.ajoute ? el("ins", { texte: d.ajoute }) : null, d.suffixe));
    bloc.appendChild(el("p", { texte: p.motif }));
    if (s) {
      bloc.appendChild(el("div", null, "Source : ", s.url ? el("a", { classe: "lien", href: s.url, target: "_blank", rel: "noopener", texte: s.citation }) : s.citation, " — " + s.base + (s.version ? ", version " + s.version : "")));
      bloc.appendChild(el("blockquote", { classe: "citation st-vert", texte: s.extrait }));
      bloc.appendChild(el("div", { classe: "preuve st-vert", texte: "✓ Extrait retrouvé mot pour mot dans le texte officiel" }));
    }
    return bloc;
  }
  function panneauSource(cle) {
    var s = parCle[cle], o = s.officielle;
    panneau.appendChild(el("div", { classe: "haut st-" + s.statut }, el("span", { classe: "etiquette", texte: (TYPE[s.citee.type] || "Source") + " · " }), el("span", { classe: "pastille", texte: LIBELLE_SRC[s.statut] })));
    panneau.appendChild(el("h2", { texte: o ? o.titre : s.citee.brut }));
    if (o) {
      panneau.appendChild(el("p", { classe: "vide" }, o.base + (o.rang > 0 ? " · " + o.rangLibelle : "") + (o.date ? " · " + dateFr(o.date) : "") + " · ", o.url ? el("a", { classe: "lien", href: o.url, target: "_blank", rel: "noopener", texte: "ouvrir la source officielle" }) : ""));
    } else {
      panneau.appendChild(el("p", { classe: "vide", texte: "Cette source n'a pas été retrouvée telle que citée." }));
    }
    panneau.appendChild(el("h3", { texte: "Citée par" }));
    var puces = el("div", { classe: "puces" });
    s.refs.forEach(function (ref) { puces.appendChild(el("button", { classe: "puce", type: "button", texte: ref.aff, onclick: function () { choisir({ aff: ref.aff }); } })); });
    panneau.appendChild(puces);
    var premiere = null, extraits = [];
    carte.resultats.forEach(function (r) { r.verifications.forEach(function (v) {
      var k = v.officielle ? v.officielle.base + ":" + v.officielle.id : "cite:" + norm(v.citee.brut);
      if (k !== cle) return;
      if (!premiere) premiere = v;
      if (v.jugement && v.jugement.extraitRetrouve) extraits.push(v.jugement.extrait);
    }); });
    if (premiere) panneau.appendChild(listeControles(premiere.controles.filter(function (c) { return c.nom !== "contenu"; })));
    if (o) {
      var texte = (s.version && s.version.texte) || o.texte;
      if (texte) {
        panneau.appendChild(el("h3", { texte: s.version ? "Texte en vigueur au " + dateFr(carte.dateFaits) : "Texte officiel" }));
        panneau.appendChild(texteSurligne(texte, extraits));
      }
    }
  }

  // Texte analysé, passages surlignés
  (function () {
    var corps = document.getElementById("texte-corps"), t = carte.reponse || "";
    var plages = [];
    carte.resultats.forEach(function (r) { var i = t.indexOf(r.affirmation.passage); if (i >= 0) plages.push([i, i + r.affirmation.passage.length, r]); });
    plages.sort(function (a, b) { return a[0] - b[0]; });
    var pos = 0;
    plages.forEach(function (p) {
      if (p[0] < pos) return;
      corps.appendChild(document.createTextNode(t.slice(pos, p[0])));
      var r = p[2];
      corps.appendChild(el("mark", { classe: "st-" + r.statut, title: r.affirmation.id + " · " + LIBELLE_AFF[r.statut], texte: t.slice(p[0], p[1]), onclick: function () { choisir({ aff: r.affirmation.id }); blocsAff[r.affirmation.id].scrollIntoView({ block: "center", behavior: "smooth" }); } }));
      pos = p[1];
    });
    corps.appendChild(document.createTextNode(t.slice(pos)));
  })();

  document.getElementById("pied").textContent = "Généré le " + new Date(carte.generee).toLocaleString("fr-FR") + " par le skill « vérifier les sources » de Visa. Sans preuve, rien n'est vert.";
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") choisir(null); });
  zone.addEventListener("click", function (e) { if (e.target === zone || e.target.classList.contains("gouttiere") || e.target.classList.contains("colonne")) choisir(null); });
  remplirPanneau();
  dessiner();
  if (window.ResizeObserver) new ResizeObserver(dessiner).observe(zone);
  window.addEventListener("resize", dessiner);
  document.getElementById("texte").addEventListener("toggle", dessiner);
})();
`;
