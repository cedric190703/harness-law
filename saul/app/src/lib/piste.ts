import { avecCache } from "./cache";

/**
 * Access to the official APIs through PISTE (piste.gouv.fr): Légifrance (DILA) and Judilibre (Cour de cassation).
 * Sandbox and production have separate credentials: PISTE_ENV=sandbox|prod.
 */
const PROD = process.env.PISTE_ENV === "prod";
const OAUTH = PROD
  ? "https://oauth.piste.gouv.fr/api/oauth/token"
  : "https://sandbox-oauth.piste.gouv.fr/api/oauth/token";
const API = PROD ? "https://api.piste.gouv.fr" : "https://sandbox-api.piste.gouv.fr";
const LEGIFRANCE = `${API}/dila/legifrance/lf-engine-app`;
const JUDILIBRE = `${API}/cassation/judilibre/v1.0`;

let jeton: { valeur: string; expire: number } | null = null;

export function pisteConfigure(): boolean {
  return Boolean(process.env.PISTE_CLIENT_ID && process.env.PISTE_CLIENT_SECRET);
}

async function obtenirJeton(): Promise<string> {
  if (jeton && Date.now() < jeton.expire - 60_000) return jeton.valeur;
  const res = await fetch(OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.PISTE_CLIENT_ID ?? "",
      client_secret: process.env.PISTE_CLIENT_SECRET ?? "",
      scope: "openid",
    }),
  });
  if (!res.ok) throw new Error(`PISTE OAuth ${res.status}: ${await res.text()}`);
  const d = await res.json();
  jeton = { valeur: d.access_token, expire: Date.now() + (d.expires_in ?? 3600) * 1000 };
  return jeton.valeur;
}

async function appel<T>(url: string, init: RequestInit): Promise<T | null> {
  for (let essai = 0; essai < 2; essai++) {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${await obtenirJeton()}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 401 && essai === 0) {
      jeton = null;
      continue;
    }
    if (res.status === 404 || res.status === 204) return null;
    if (!res.ok) throw new Error(`${url} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const texte = await res.text();
    return texte ? (JSON.parse(texte) as T) : null;
  }
  return null;
}

export async function legifrance<T = Record<string, unknown>>(chemin: string, corps: unknown): Promise<T | null> {
  const { valeur } = await avecCache("legifrance", { PROD, chemin, corps }, () =>
    appel<T>(`${LEGIFRANCE}${chemin}`, { method: "POST", body: JSON.stringify(corps) }),
  );
  return valeur;
}

export async function judilibre<T = Record<string, unknown>>(
  chemin: string,
  params: Record<string, string>,
): Promise<T | null> {
  const url = `${JUDILIBRE}${chemin}?${new URLSearchParams(params)}`;
  const { valeur } = await avecCache("judilibre", { PROD, url }, () => appel<T>(url, { method: "GET" }));
  return valeur;
}
