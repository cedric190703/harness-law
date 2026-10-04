import { NextResponse, type NextRequest } from "next/server";

/**
 * Version en ligne : si SAUL_MOT_DE_PASSE est défini, toute page et toute API demandent
 * ce mot de passe (authentification HTTP simple). En local, rien ne change.
 */
export function proxy(request: NextRequest) {
  const attendu = process.env.SAUL_MOT_DE_PASSE;
  if (!attendu) {
    if (process.env.SAUL_EN_LIGNE === "1") {
      return new NextResponse("Accès indisponible : protection non configurée", { status: 503 });
    }
    return NextResponse.next();
  }
  const entete = request.headers.get("authorization") ?? "";
  const [schema, valeur] = entete.split(" ");
  if (schema === "Basic" && valeur) {
    try {
      const identifiants = atob(valeur);
      const separateur = identifiants.indexOf(":");
      if (separateur >= 0 && identifiants.slice(separateur + 1) === attendu) return NextResponse.next();
    } catch {
      // Un en-tête mal formé reste un refus d'accès, pas une erreur serveur.
    }
  }
  return new NextResponse("Accès protégé", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Saul", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
