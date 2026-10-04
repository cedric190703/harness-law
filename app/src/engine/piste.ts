// Accès aux bases officielles : Légifrance et Judilibre, via PISTE.
//
// Visa marche sans identifiants : il lit alors les sources mises en cache dans
// `data/sources.ts`, et le bandeau de l'écran le dit clairement. Avec des
// identifiants, ce fichier interroge les vraies API.
//
// Rien ici n'invente : une recherche sans résultat renvoie `null`, et une API
// en panne lève une erreur. Dans les deux cas, l'appelant doit conclure
// « non vérifié » (gris), jamais « vérifié » (vert).

const ENV = (import.meta.env.VITE_PISTE_ENV ?? "sandbox") === "production" ? "production" : "sandbox";

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
}[ENV];

const CLIENT_ID = import.meta.env.VITE_PISTE_CLIENT_ID ?? "";
const CLIENT_SECRET = import.meta.env.VITE_PISTE_CLIENT_SECRET ?? "";

/** Les identifiants des codes les plus cités, pour `getArticleWithIdAndNum`. */
export const CODES: Record<string, string> = {
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

/** Visa dispose-t-il d'un accès réel aux bases ? */
export function accesReel(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

export function environnement(): string {
  return ENV === "production" ? "production" : "bac à sable";
}

let jeton: { valeur: string; expireLe: number } | null = null;

/** Le jeton PISTE dure environ une heure ; on le renouvelle une minute avant. */
async function obtenirJeton(): Promise<string> {
  if (jeton && Date.now() < jeton.expireLe) return jeton.valeur;
  const corps = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "openid",
  });
  const reponse = await fetch(HOTES.jeton, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corps,
  });
  if (!reponse.ok) throw new Error(`PISTE a refusé les identifiants (${reponse.status}).`);
  const data = (await reponse.json()) as { access_token: string; expires_in: number };
  jeton = { valeur: data.access_token, expireLe: Date.now() + (data.expires_in - 60) * 1000 };
  return jeton.valeur;
}

async function legifrance<T>(chemin: string, corps: unknown): Promise<T> {
  const reponse = await fetch(`${HOTES.legifrance}${chemin}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await obtenirJeton()}`, "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  if (!reponse.ok) throw new Error(`Légifrance a répondu ${reponse.status} sur ${chemin}.`);
  return (await reponse.json()) as T;
}

/** Les dates arrivent en millisecondes ; une fin en 2999 signifie « pas de fin ». */
export function dateLegifrance(ms: number | null | undefined): string | null {
  if (!ms) return null;
  const d = new Date(ms);
  if (d.getFullYear() >= 2999) return null;
  return d.toISOString().slice(0, 10);
}

type ArticleBrut = {
  id: string;
  cid: string;
  num: string;
  texte: string;
  etat: string;
  dateDebut: number;
  dateFin: number;
};

/** Un article de code par son numéro, par exemple « L1235-3 » du code du travail. */
export async function article(code: string, numero: string): Promise<ArticleBrut | null> {
  const id = CODES[code.toLowerCase()];
  if (!id) throw new Error(`Code inconnu de Visa : ${code}. Ajoutez son identifiant LEGITEXT.`);
  const data = await legifrance<{ article?: ArticleBrut }>("/consult/getArticleWithIdAndNum", { id, num: numero });
  return data.article ?? null;
}

/** Toutes les versions d'un article, pour savoir laquelle s'appliquait aux faits. */
export async function versionsArticle(cid: string): Promise<ArticleBrut[]> {
  const data = await legifrance<{ listArticle?: ArticleBrut[] }>("/consult/getArticleByCid", { cid });
  return data.listArticle ?? [];
}

/** La version applicable à une date donnée, ou null si aucune ne la couvre. */
export function versionApplicable(versions: ArticleBrut[], dateIso: string): ArticleBrut | null {
  const jour = dateIso.slice(0, 10);
  return (
    versions.find((v) => {
      const debut = dateLegifrance(v.dateDebut);
      const fin = dateLegifrance(v.dateFin);
      return Boolean(debut) && debut! <= jour && (!fin || jour < fin);
    }) ?? null
  );
}

/** Une décision par son numéro de pourvoi, au fonds JURI de Légifrance. */
export async function decisionParPourvoi(numero: string): Promise<string | null> {
  const data = await legifrance<{ results?: { titles?: { id: string }[] }[] }>("/search", {
    fond: "JURI",
    recherche: {
      champs: [
        {
          typeChamp: "NUM_AFFAIRE",
          criteres: [{ typeRecherche: "EXACTE", valeur: numero, operateur: "ET" }],
          operateur: "ET",
        },
      ],
      operateur: "ET",
      pageSize: 5,
      pageNumber: 1,
      sort: "PERTINENCE",
      typePagination: "DEFAUT",
    },
  });
  return data.results?.[0]?.titles?.[0]?.id ?? null;
}

/** Le texte intégral d'une décision judiciaire. */
export async function texteDecision(textId: string): Promise<string | null> {
  const data = await legifrance<{ text?: { texteHtml?: string; texte?: string } }>("/consult/juri", { textId });
  const brut = data.text?.texte ?? data.text?.texteHtml ?? null;
  return brut ? brut.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null;
}

/** Recherche dans Judilibre, par numéro de pourvoi. */
export async function judilibre(numero: string): Promise<{ id: string; texte: string } | null> {
  const url = new URL(`${HOTES.judilibre}/search`);
  url.searchParams.set("query", numero);
  url.searchParams.set("field", "numero");
  url.searchParams.set("page_size", "5");
  const reponse = await fetch(url, { headers: { Authorization: `Bearer ${await obtenirJeton()}`, KeyId: CLIENT_ID } });
  if (!reponse.ok) throw new Error(`Judilibre a répondu ${reponse.status}.`);
  const data = (await reponse.json()) as { results?: { id: string; text?: string }[] };
  const premier = data.results?.[0];
  return premier ? { id: premier.id, texte: premier.text ?? "" } : null;
}

/**
 * La vérification mot pour mot : le passage cité existe-t-il dans le texte
 * officiel ? On ne normalise que les espaces, les apostrophes et la casse —
 * jamais les mots. C'est ce contrôle qui empêche le contradicteur d'inventer.
 */
export function passagePresent(texteOfficiel: string, passage: string): boolean {
  const normaliser = (s: string) =>
    s
      .toLowerCase()
      .replace(/[’‘`]/g, "'")
      .replace(/[«»"]/g, "")
      // Une coupure éditoriale s'écrit « […] », « [...] » ou « … » : les trois
      // disent la même chose, et les crochets ne sont pas des mots.
      .replace(/\[\s*(…|\.\.\.)\s*\]/g, "...")
      .replace(/[…]/g, "...")
      .replace(/[[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const cible = normaliser(passage);
  if (cible.length < 12) return false; // trop court pour prouver quoi que ce soit
  // Un passage abrégé par « … » se vérifie morceau par morceau, dans l'ordre.
  const morceaux = cible.split("...").map((m) => m.trim()).filter((m) => m.length >= 8);
  const officiel = normaliser(texteOfficiel);
  let curseur = 0;
  for (const morceau of morceaux.length ? morceaux : [cible]) {
    const trouve = officiel.indexOf(morceau, curseur);
    if (trouve === -1) return false;
    curseur = trouve + morceau.length;
  }
  return true;
}

/**
 * Le passage cité se trouve-t-il quelque part dans la source ? On regarde le
 * texte courant **et** le texte de chaque version connue : une objection peut
 * très bien reposer sur la version applicable aux faits, qui n'est pas celle
 * qui est en vigueur aujourd'hui.
 *
 * C'est cette fonction, et non une donnée stockée, qui décide si une
 * contradiction est recevable. Un passage qu'on ne retrouve pas est écarté.
 */
export function passageDansSource(
  source: { texte: string; versions: { extrait: string }[] },
  passage: string,
): boolean {
  const candidats = [source.texte, ...source.versions.map((v) => v.extrait)];
  return candidats.some((t) => t && passagePresent(t, passage));
}
