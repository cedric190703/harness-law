// L'API que le navigateur appelle. Les clés ne sortent jamais d'ici.
//
// Quatre routes seulement :
//   GET  /api/audit          le dernier audit (instantané, lu sur disque)
//   POST /api/audit/relancer le relance et diffuse son avancement (SSE)
//   GET  /api/document       le texte d'un document, pour le lire à côté
//   GET  /api/etat           ce qui est joignable : Mistral, Légifrance

import { auditer, dernierAudit, enregistrer, texteDocument } from "./harnais.mjs";
import { etatDuModele } from "./mistral.mjs";
import * as piste from "./piste.mjs";

const RACINE = "./dataroom";

function json(res, code, corps) {
  const texte = JSON.stringify(corps);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(texte);
}

/** Traite une requête /api/*. Rend true si elle a été prise en charge. */
export async function traiter(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/")) return false;

  try {
    if (url.pathname === "/api/etat") {
      json(res, 200, {
        mistral: await etatDuModele(),
        piste: { disponible: await piste.disponible(), environnement: await piste.environnement() },
      });
      return true;
    }

    if (url.pathname === "/api/audit" && req.method === "GET") {
      let audit = await dernierAudit();
      if (!audit) {
        audit = await auditer({ racine: RACINE });
        await enregistrer(audit);
      }
      json(res, 200, audit);
      return true;
    }

    if (url.pathname === "/api/document" && req.method === "GET") {
      const quoi = url.searchParams.get("id") ?? url.searchParams.get("chemin");
      if (!quoi) return json(res, 400, { erreur: "Indiquez ?id= ou ?chemin=." }), true;
      const d = await texteDocument(RACINE, quoi);
      if (!d) return json(res, 404, { erreur: "Document introuvable dans la data room." }), true;
      json(res, 200, d);
      return true;
    }

    // Le relancement diffuse son avancement : l'interface montre le travail.
    if (url.pathname === "/api/audit/relancer") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const envoyer = (type, donnees) => res.write(`event: ${type}\ndata: ${JSON.stringify(donnees)}\n\n`);
      try {
        const audit = await auditer({
          racine: RACINE,
          avancer: (pas) => envoyer("etape", pas),
        });
        await enregistrer(audit);
        envoyer("fini", { id: audit.id, dureeMs: audit.dureeMs });
      } catch (e) {
        envoyer("erreur", { message: e.message });
      }
      res.end();
      return true;
    }

    json(res, 404, { erreur: "Route inconnue." });
    return true;
  } catch (e) {
    json(res, 500, { erreur: e.message });
    return true;
  }
}

/** Branche l'API dans le serveur de développement de Vite. */
export function pluginApi() {
  return {
    name: "visa-api",
    configureServer(serveur) {
      serveur.middlewares.use(async (req, res, suivant) => {
        if (!(await traiter(req, res))) suivant();
      });
    },
    configurePreviewServer(serveur) {
      serveur.middlewares.use(async (req, res, suivant) => {
        if (!(await traiter(req, res))) suivant();
      });
    },
  };
}
