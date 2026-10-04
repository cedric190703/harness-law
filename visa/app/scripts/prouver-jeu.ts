/**
 * Preuve des étiquettes du jeu de test français, sur les vraies bases officielles.
 *
 *   bun scripts/prouver-jeu.ts
 *
 * Pour chaque affirmation du jeu (src/eval/jeu-fr.ts), retrouve la source sur Légifrance / Judilibre
 * et confirme ce qui fonde l'étiquette : existence, version applicable à la date des faits,
 * extrait mot pour mot. Aucun appel au modèle. Écrit src/eval/preuves.json.
 * À lancer depuis app/ (clés PISTE dans .env.local).
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { controlerDateEtRang, texteApplicable } from "@/lib/controles";
import { legifrance, pisteConfigure } from "@/lib/piste";
import { normaliserNumeroArticle, retrouverSource } from "@/lib/sources";
import type { SourceCitee, SourceOfficielle } from "@/lib/types";
import { contientVerbatim, normaliser } from "@/lib/verbatim";
import { JEU_FR, texteNote, type CasAttendu, type NoteDeTest } from "@/eval/jeu-fr";

type Brut = Record<string, unknown>;

interface Preuve {
  id: string;
  type: string;
  attendu: string;
  ok: boolean;
  constats: string[];
  url: string | null;
  versionDesFaits: { debut: string | null; fin: string | null } | null;
}

/** L'article apparaît-il dans la recherche Légifrance des codes, à cette date ? (second avis pour « inexistant ») */
async function articleDansRecherche(code: string, numero: string, date: string): Promise<boolean> {
  const num = normaliserNumeroArticle(numero);
  const r = await legifrance<{ results?: Brut[] }>("/search", {
    fond: "CODE_DATE",
    recherche: {
      champs: [
        { typeChamp: "NUM_ARTICLE", criteres: [{ typeRecherche: "EXACTE", valeur: num, operateur: "ET" }], operateur: "ET" },
      ],
      filtres: [
        { facette: "NOM_CODE", valeurs: [code] },
        { facette: "DATE_VERSION", singleDate: new Date(date).getTime() },
      ],
      operateur: "ET",
      pageSize: 10,
      pageNumber: 1,
      sort: "PERTINENCE",
      typePagination: "ARTICLE",
    },
  });
  const titres: string[] = [];
  const parcourir = (n: Brut) => {
    for (const e of (n.extracts as Brut[]) ?? []) titres.push(String(e.title ?? ""));
    for (const s of (n.sections as Brut[]) ?? []) parcourir(s);
  };
  for (const res of r?.results ?? []) parcourir(res);
  return titres.some((t) => normaliser(t) === normaliser(num));
}

/** La circulaire figure-t-elle, avec cet intitulé exact, dans le fonds des circulaires de Légifrance ? */
async function circulaireExiste(intitule: string): Promise<string | null> {
  const r = await legifrance<{ results?: Brut[] }>("/search", {
    fond: "CIRC",
    recherche: {
      champs: [
        {
          typeChamp: "ALL",
          criteres: [{ typeRecherche: "TOUS_LES_MOTS_DANS_UN_CHAMP", valeur: intitule, operateur: "ET" }],
          operateur: "ET",
        },
      ],
      operateur: "ET",
      pageSize: 10,
      pageNumber: 1,
      sort: "PERTINENCE",
      typePagination: "DEFAUT",
    },
  });
  for (const res of r?.results ?? []) {
    const t = (res.titles as Brut[] | undefined)?.[0];
    const titre = String(t?.title ?? "").replace(/<\/?mark>/g, "");
    if (normaliser(titre) === normaliser(intitule)) return String(t?.id);
  }
  return null;
}

function texteCourant(o: SourceOfficielle): string {
  return o.versions.length > 0 ? o.versions[o.versions.length - 1].texte : o.texte;
}

async function prouver(note: NoteDeTest, c: CasAttendu): Promise<Preuve> {
  const constats: string[] = [];
  let ok = true;
  const echec = (m: string) => {
    ok = false;
    constats.push(`ÉCHEC : ${m}`);
  };
  const preuve: Preuve = { id: c.id, type: c.type, attendu: c.attendu, ok, constats, url: null, versionDesFaits: null };

  if (c.type === "reference_floue") {
    if (c.source) echec("une référence floue ne doit pas avoir de source");
    if (/\barticle\b|\bn° ?\d|cass\.|circulaire/i.test(c.passage)) echec("le passage cite pourtant une source");
    constats.push("Aucune source identifiable dans le passage : gris par définition.");
    return { ...preuve, ok, constats };
  }
  if (!c.source) {
    echec("source manquante");
    return { ...preuve, ok, constats };
  }

  if (c.type === "circulaire") {
    const id = c.intitule ? await circulaireExiste(c.intitule) : null;
    if (id) constats.push(`Circulaire trouvée dans le fonds CIRC de Légifrance (id ${id}).`);
    else echec(`circulaire introuvable sous l'intitulé « ${c.intitule} »`);
    return { ...preuve, ok, constats };
  }

  const s: SourceCitee = c.source;
  const r = await retrouverSource(s, []);

  if (c.type === "article_inexistant" || c.type === "decision_inventee") {
    if (r && r !== "non_identifiable") echec(`la source existe : ${r.titre} (${r.url})`);
    else if (r === "non_identifiable") echec("référence non identifiable : impossible de prouver l'inexistence");
    else constats.push(s.type === "decision" ? "Introuvable sur Légifrance (JURI) et Judilibre." : "Introuvable sur Légifrance.");
    if (s.type === "article_code" && s.code && s.numero) {
      for (const date of [note.dateFaits, new Date().toISOString().slice(0, 10)]) {
        if (await articleDansRecherche(s.code, s.numero, date)) echec(`la recherche Légifrance trouve l'article au ${date}`);
        else constats.push(`Recherche Légifrance des codes au ${date} : aucun article ${s.numero}.`);
      }
    }
    return { ...preuve, ok, constats };
  }

  if (!r || r === "non_identifiable") {
    echec(`source introuvable (${r})`);
    return { ...preuve, ok, constats };
  }
  preuve.url = r.url;
  constats.push(`Trouvée : ${r.titre}.`);

  const { version, controles } = controlerDateEtRang(s, r, note.dateFaits);
  preuve.versionDesFaits = version ? { debut: version.debut, fin: version.fin } : null;
  const date = controles.find((x) => x.nom === "date" && x.statut !== "vert")?.statut ?? "vert";
  const rang = controles.find((x) => x.nom === "rang")?.statut ?? "vert";
  constats.push(
    `Date des faits ${note.dateFaits} : ${version ? `version du ${version.debut} au ${version.fin ?? "aujourd'hui"}` : r.versions.length ? "aucune version en vigueur" : "décision (pas de versions)"} → contrôle date ${date}.`,
  );
  const texteFaits = texteApplicable(r, version);
  const courant = texteCourant(r);

  if (c.preuve) {
    if (contientVerbatim(texteFaits, c.preuve)) constats.push(`Extrait retrouvé mot pour mot : « ${c.preuve} ».`);
    else echec(`extrait absent du texte applicable : « ${c.preuve} »`);
  }
  if (c.preuveActuelle) {
    if (!contientVerbatim(courant, c.preuveActuelle)) echec(`extrait absent de la version actuelle : « ${c.preuveActuelle} »`);
    else if (version && contientVerbatim(version.texte, c.preuveActuelle))
      echec(`l'extrait « ${c.preuveActuelle} » figure déjà dans la version des faits`);
    else constats.push(`Version actuelle seulement : « ${c.preuveActuelle} ».`);
  }
  if (s.type === "decision" && s.date !== r.date) echec(`date citée ${s.date} ≠ date réelle ${r.date}`);

  switch (c.type) {
    case "juste":
      if (date !== "vert") echec(`contrôle date ${date} : le texte a changé ou n'était pas en vigueur`);
      if (rang !== "vert") echec(`rang ${rang}`);
      if (!c.preuve) echec("extrait de preuve manquant");
      break;
    case "ne_dit_pas_ca":
      if (date === "rouge") echec("pas en vigueur : ce serait « pas en vigueur », pas « ne dit pas ça »");
      if (!c.preuve) echec("extrait de preuve manquant");
      break;
    case "texte_modifie":
      if (date !== "orange") echec(`contrôle date ${date}, attendu orange`);
      if (!c.preuve) echec("extrait de la version des faits manquant");
      break;
    case "pas_en_vigueur":
      if (date === "vert") echec("en vigueur à la date des faits");
      if (date === "orange" && !c.preuveActuelle) echec("version différente à la date des faits : il faut un extrait actuel");
      break;
  }
  return { ...preuve, ok, constats };
}

async function main() {
  if (!pisteConfigure()) throw new Error("Clés PISTE absentes de .env.local");
  const preuves: Preuve[] = [];
  const ids = new Set<string>();

  for (const note of JEU_FR) {
    const texte = texteNote(note);
    console.log(`\n${note.id} — ${note.titre} (faits du ${note.dateFaits})`);
    for (const c of note.cas) {
      let p: Preuve;
      if (ids.has(c.id)) {
        p = { id: c.id, type: c.type, attendu: c.attendu, ok: false, constats: ["ÉCHEC : identifiant en double"], url: null, versionDesFaits: null };
      } else if (texte.split(c.passage).length !== 2) {
        p = { id: c.id, type: c.type, attendu: c.attendu, ok: false, constats: ["ÉCHEC : passage absent ou répété dans la note"], url: null, versionDesFaits: null };
      } else {
        try {
          p = await prouver(note, c);
        } catch (e) {
          p = { id: c.id, type: c.type, attendu: c.attendu, ok: false, constats: [`ÉCHEC : erreur ${String(e).slice(0, 200)}`], url: null, versionDesFaits: null };
        }
      }
      ids.add(c.id);
      preuves.push(p);
      console.log(`  ${p.ok ? "✓" : "✗"} ${c.id} [${c.attendu} · ${c.type}]`);
      for (const k of p.constats) console.log(`      ${k}`);
    }
  }

  // Témoins : la même méthode retrouve bien un article et une décision qui existent.
  const temoinArticle = await articleDansRecherche("Code du travail", "L1232-1", "2023-06-15");
  const temoinDecision = await retrouverSource(
    { brut: "", type: "decision", juridiction: "Cass. soc.", numero_affaire: "00-45.135" },
    [],
  );
  const temoins = temoinArticle && Boolean(temoinDecision && temoinDecision !== "non_identifiable");
  console.log(`\nTémoins (un article et une décision réels retrouvés par la même méthode) : ${temoins ? "OK" : "ÉCHEC"}`);

  const echecs = preuves.filter((p) => !p.ok);
  const parEtiquette: Record<string, number> = {};
  for (const p of preuves) parEtiquette[p.attendu] = (parEtiquette[p.attendu] ?? 0) + 1;
  console.log(`${preuves.length} affirmations, ${preuves.length - echecs.length} prouvées, ${echecs.length} en échec.`);
  console.log(`Par étiquette : ${JSON.stringify(parEtiquette)}`);

  await writeFile(
    path.join(process.cwd(), "src/eval/preuves.json"),
    `${JSON.stringify({ date: new Date().toISOString(), temoins, preuves }, null, 2)}\n`,
  );
  if (echecs.length > 0 || !temoins) process.exit(1);
}

await main();
