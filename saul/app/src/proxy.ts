import { NextResponse, type NextRequest } from "next/server";

/**
 * Version en ligne : si SAUL_MOT_DE_PASSE est défini, toute page et toute API demandent
 * ce mot de passe (authentification HTTP simple). En local, rien ne change.
 */
export function proxy(request: NextRequest) {
  const attendu = process.env.SAUL_MOT_DE_PASSE;
  if (!attendu) return NextResponse.next();
  const entete = request.headers.get("authorization") ?? "";
  const [schema, valeur] = entete.split(" ");
  if (schema === "Basic" && valeur) {
    const motDePasse = atob(valeur).split(":").slice(1).join(":");
    if (motDePasse === attendu) return NextResponse.next();
  }
  return new NextResponse("Accès protégé", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Saul", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
