// Légifrance et Judilibre, côté serveur.
//
// Les identifiants restent ici : rien de tout cela n'entre dans le bundle
// navigateur. Le navigateur n'appelle que notre propre /api.
//
// Deux principes. Un appel qui échoue lève : l'appelant doit conclure « non
// vérifié », jamais « vérifié ». Et une recherche sans résultat rend null,
// ce qui n'est pas la même chose qu'une erreur — on le dit différemment.

import { readFile } from "node:fs/promises";

let config = null;

/** Lit .env une fois. Les variables d'environnement ont la priorité. */
export async function charger(racine = ".") {
  if (config) return config;
  const lu = {};
  try {
    const brut = await readFile(`${racine}/.env`, "utf8");
    for (const ligne of brut.split("\n")) {
      const m = ligne.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m) lu[m[1]] = m[2].trim();
    }
  } catch {
    /* pas de .env : on se rabat sur l'environnement */
  }
  const v = (nom) => process.env[nom] || lu[nom] || "";
  config = {
    pisteId: v("PISTE_CLIENT_ID"),
    pisteSecret: v("PISTE_CLIENT_SECRET"),
    pisteEnv: v("PISTE_ENV") === "production" ? "production" : "sandbox",
    mistral: v("MISTRAL_API_KEY"),
  };
  return config;
}

const HOTES = {
  sandbox: {
    jeton: "https://sandbox-oauth.piste.gouv.fr/api/oauth/token",
    legifrance: "https://sandbox-api.piste.gouv.fr/dila/legifrance/lf-engine-app",
    judilibre: "https://sandbox-api.piste.gouv.fr/cassation/judilibre/v1.0",
  },
  production: {
    jeton: "https://oauth.piste.gouv.fr/api/oauth/token",
    legifrance: "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app",
    judilibre: "https://api.piste.gouv.fr/cassation/judilibre/v1.0",
  },
};

/** Les identifiants des codes les plus cités. */
export const CODES = {
  "code civil": "LEGITEXT000006070721",
  "code du travail": "LEGITEXT000006072050",
  "code de commerce": "LEGITEXT000005634379",
  "code pénal": "LEGITEXT000006070719",
  "code de procédure civile": "LEGITEXT000006070716",
  "code de la consommation": "LEGITEXT000006069565",
  "code de la sécurité sociale": "LEGITEXT000006073189",
  "code général des impôts": "LEGITEXT000006069577",
  "code monétaire et financier": "LEGITEXT000006072026",
  "code de la propriété intellectuelle": "LEGITEXT000006069414",
};

export async function disponible() {
  const c = await charger();
  return Boolean(c.pisteId && c.pisteSecret);
}

export async function environnement() {
  return (await charger()).pisteEnv === "production" ? "production" : "bac à sable";
}

let jeton = null;

async function obtenirJeton() {
  const c = await charger();
  if (!c.pisteId || !c.pisteSecret) throw new Error("Aucun identifiant PISTE.");
  if (jeton && Date.now() < jeton.expireLe) return jeton.valeur;
  const r = await fetch(HOTES[c.pisteEnv].jeton, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: c.pisteId,
      client_secret: c.pisteSecret,
      scope: "openid",
    }),
  });
  if (!r.ok) throw new Error(`PISTE a refusé les identifiants (${r.status}).`);
  const d = await r.json();
  jeton = { valeur: d.access_token, expireLe: Date.now() + (d.expires_in - 60) * 1000 };
  return jeton.valeur;
}

async function legifrance(chemin, corps) {
  const c = await charger();
  const r = await fetch(`${HOTES[c.pisteEnv].legifrance}${chemin}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await obtenirJeton()}`, "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  if (!r.ok) throw new Error(`Légifrance a répondu ${r.status} sur ${chemin}.`);
  return r.json();
}

/** Les dates arrivent en millisecondes ; une fin en 2999 veut dire « pas de fin ». */
export function dateDe(ms) {
  if (!ms) return null;
  const d = new Date(ms);
  if (d.getUTCFullYear() >= 2999) return null;
  return d.toISOString().slice(0, 10);
}

const sansBalises = (s) => (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** Un article de code, avec toutes ses versions datées. */
export async function article(code, numero) {
  const id = CODES[code.toLowerCase()];
  if (!id) throw new Error(`Code inconnu : ${code}.`);
  const d = await legifrance("/consult/getArticleWithIdAndNum", { id, num: numero });
  const a = d.article;
  if (!a) return null;

  let versions = [];
  try {
    const v = await legifrance("/consult/getArticleByCid", { cid: a.cid });
    versions = (v.listArticle ?? [])
      .map((x) => ({
        debut: dateDe(x.dateDebut),
        fin: dateDe(x.dateFin),
        etat: x.etat,
        texte: sansBalises(x.texte),
      }))
      .sort((p, q) => (p.debut ?? "").localeCompare(q.debut ?? ""));
  } catch {
    /* les versions sont un plus : leur absence ne doit pas perdre l'article */
  }

  return {
    reference: `Article ${numero.replace(/^([LRDA])/, "$1. ")} du ${code}`,
    identifiant: a.id,
    cid: a.cid,
    etat: a.etat,
    debut: dateDe(a.dateDebut),
    fin: dateDe(a.dateFin),
    texte: sansBalises(a.texte),
    versions,
    base: "Légifrance",
    lien: `https://www.legifrance.gouv.fr/codes/article_lc/${a.id}`,
  };
}

/** La version applicable à une date. Null si aucune ne la couvre. */
export function versionAu(versions, jour) {
  return versions.find((v) => v.debut && v.debut <= jour && (!v.fin || jour < v.fin)) ?? null;
}

/** Recherche dans Judilibre. Rend les décisions, jamais un résumé rédigé par nous. */
export async function judilibre(requete, taille = 3) {
  const c = await charger();
  const url = new URL(`${HOTES[c.pisteEnv].judilibre}/search`);
  url.searchParams.set("query", requete);
  url.searchParams.set("page_size", String(taille));
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${await obtenirJeton()}`, KeyId: c.pisteId },
  });
  if (!r.ok) throw new Error(`Judilibre a répondu ${r.status}.`);
  const d = await r.json();
  return {
    total: d.total ?? 0,
    decisions: (d.results ?? []).map((x) => ({
      numero: x.number,
      date: x.decision_date,
      juridiction: x.jurisdiction,
      chambre: x.chamber,
      resume: (x.summary ?? "").trim(),
      lien: x.number ? `https://www.courdecassation.fr/recherche-judilibre?search_api_fulltext=${x.number}` : null,
    })),
  };
}
