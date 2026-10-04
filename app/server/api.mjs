// L'API que le navigateur appelle. Les clés ne sortent jamais d'ici.
//
//   GET    /api/etat                      ce qui est joignable : Mistral, Légifrance
//   GET    /api/dossiers                  la liste des dossiers
//   POST   /api/dossiers                  ouvrir un dossier
//   DELETE /api/dossiers/:id              le fermer
//   GET    /api/dossiers/:id/audit        le dernier audit (instantané)
//   POST   /api/dossiers/:id/audit        le relancer, en diffusant l'avancement
//   GET    /api/dossiers/:id/historique   les passages précédents
//   POST   /api/dossiers/:id/pieces       verser des pièces
//   PATCH  /api/dossiers/:id/travail      la relecture, les notes, les corrections
//   GET    /api/dossiers/:id/document     le texte d'une pièce
//   GET    /api/dossiers/:id/rapport.md   le rapport
//   GET    /api/dossiers/:id/tableau.csv  le tableau

import { auditer, enrichir, texteDocument } from "./harnais.mjs";
import { rapportMarkdown, tableauCsv } from "./rapport.mjs";
import * as dossiers from "./dossiers.mjs";
import { etatDuModele } from "./mistral.mjs";
import * as piste from "./piste.mjs";

function json(res, code, corps) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(corps));
}

function fichier(res, nom, type, contenu) {
  res.writeHead(200, {
    "Content-Type": `${type}; charset=utf-8`,
    "Content-Disposition": `attachment; filename="${nom}"`,
    "Cache-Control": "no-store",
  });
  res.end(contenu);
}

/** Lit un corps JSON, en refusant ce qui est trop gros pour être honnête. */
async function corpsJson(req, maxOctets = 64 * 1024 * 1024) {
  const morceaux = [];
  let total = 0;
  for await (const m of req) {
    total += m.length;
    if (total > maxOctets) throw new Error("Corps de requête trop volumineux.");
    morceaux.push(m);
  }
  if (!total) return {};
  return JSON.parse(Buffer.concat(morceaux).toString("utf8"));
}

/** Calcule l'audit d'un dossier et l'ajoute à son historique. */
async function passer(id, avancer) {
  const audit = await auditer({ dossier: id, avancer });
  await dossiers.enregistrerAudit(id, audit);
  return enrichir(audit);
}

/** Traite une requête /api/*. Rend true si elle a été prise en charge. */
export async function traiter(req, res) {
  const url = new URL(req.url, "http://localhost");
  const chemin = url.pathname;
  if (!chemin.startsWith("/api/")) return false;

  try {
    if (chemin === "/api/etat") {
      json(res, 200, {
        mistral: await etatDuModele(),
        piste: { disponible: await piste.disponible(), environnement: await piste.environnement() },
      });
      return true;
    }

    if (chemin === "/api/dossiers" && req.method === "GET") {
      json(res, 200, { dossiers: await dossiers.lister() });
      return true;
    }

    if (chemin === "/api/dossiers" && req.method === "POST") {
      const d = await dossiers.creer(await corpsJson(req));
      json(res, 201, d);
      return true;
    }

    // Tout ce qui suit porte sur un dossier nommé.
    const m = chemin.match(/^\/api\/dossiers\/([^/]+)(?:\/(.*))?$/);
    if (!m) {
      json(res, 404, { erreur: "Route inconnue." });
      return true;
    }
    const id = decodeURIComponent(m[1]);
    const quoi = m[2] ?? "";

    if (!quoi && req.method === "DELETE") {
      await dossiers.supprimer(id);
      json(res, 200, { supprime: id });
      return true;
    }

    if (!quoi && req.method === "GET") {
      json(res, 200, await dossiers.charger(id));
      return true;
    }

    if (quoi === "audit" && req.method === "GET") {
      // Un dossier jamais audité l'est à la première ouverture : l'utilisateur
      // n'a pas à savoir qu'un calcul manquait.
      const enregistre = await dossiers.dernierAudit(id);
      json(res, 200, enregistre ? enrichir(enregistre) : await passer(id));
      return true;
    }

    // Le relancement diffuse son avancement : l'interface montre le travail.
    if (quoi === "audit" && req.method === "POST") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const envoyer = (type, donnees) => res.write(`event: ${type}\ndata: ${JSON.stringify(donnees)}\n\n`);
      try {
        const audit = await passer(id, (pas) => envoyer(pas.type === "journal" ? "journal" : "etape", pas));
        envoyer("fini", {
          id: audit.id,
          dureeMs: audit.dureeMs,
          constats: audit.constats.length,
          aRevoir: audit.changements.aRevoir.length,
        });
      } catch (e) {
        // L'interface doit savoir que ce qu'elle affiche reste le passage
        // précédent : sans cela elle présenterait un audit périmé comme neuf.
        envoyer("erreur", { message: e.message, auditInchange: true });
      }
      res.end();
      return true;
    }

    if (quoi === "historique" && req.method === "GET") {
      json(res, 200, { audits: await dossiers.listerAudits(id) });
      return true;
    }

    if (quoi === "pieces" && req.method === "POST") {
      const { fichiers, lot } = await corpsJson(req);
      if (!Array.isArray(fichiers) || !fichiers.length) {
        json(res, 400, { erreur: "Aucun fichier à verser." });
        return true;
      }
      const verse = await dossiers.verser(id, fichiers, lot);
      // Le versement déclenche un passage : c'est tout l'intérêt. Le rapport se
      // refait, et l'audit dira quelles relectures sont périmées.
      const audit = await passer(id);
      json(res, 201, { ...verse, changements: audit.changements });
      return true;
    }

    if (quoi === "travail" && req.method === "PATCH") {
      const travail = await dossiers.ecrireTravail(id, await corpsJson(req, 1024 * 1024));
      json(res, 200, travail);
      return true;
    }

    if (quoi === "document" && req.method === "GET") {
      const cible = url.searchParams.get("id") ?? url.searchParams.get("chemin");
      if (!cible) {
        json(res, 400, { erreur: "Indiquez ?id= ou ?chemin=." });
        return true;
      }
      const d = await texteDocument(id, cible);
      if (!d) {
        json(res, 404, { erreur: "Pièce introuvable dans ce dossier." });
        return true;
      }
      json(res, 200, d);
      return true;
    }

    if (quoi === "rapport.md" || quoi === "tableau.csv") {
      const audit = (await dossiers.dernierAudit(id)) ?? (await passer(id));
      const base = `${id}-${audit.lanceLe.slice(0, 10)}`;
      if (quoi === "rapport.md") fichier(res, `${base}-rapport.md`, "text/markdown", rapportMarkdown(audit));
      else fichier(res, `${base}-tableau.csv`, "text/csv", tableauCsv(audit));
      return true;
    }

    json(res, 404, { erreur: "Route inconnue." });
    return true;
  } catch (e) {
    // Un identifiant refusé n'est pas une erreur du serveur.
    const code = /invalide|introuvable|besoin d'un nom|ne se supprime pas/i.test(e.message) ? 400 : 500;
    json(res, code, { erreur: e.message });
    return true;
  }
}

/** Branche l'API dans le serveur de Vite, en développement comme en aperçu. */
export function pluginApi() {
  // Ne rien renvoyer : Vite prendrait une valeur de retour pour un post-hook, et
  // `middlewares.use` rend l'application elle-même.
  function brancher(serveur) {
    serveur.middlewares.use(async (req, res, suivant) => {
      if (!(await traiter(req, res))) suivant();
    });
  }
  return { name: "visa-api", configureServer: brancher, configurePreviewServer: brancher };
}
