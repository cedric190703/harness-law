// L'ossature. Six écrans, dans l'ordre où un juriste traverse un audit :
// ce qu'on a reçu, ce qu'on cherche, ce qu'on a trouvé, d'où cela vient,
// ce que le vendeur en dit, et ce qu'on en fait au contrat.

import { useEffect } from "react";
import { DataRoom } from "./views/DataRoom";
import { Chantiers } from "./views/Chantiers";
import { Tableau } from "./views/Tableau";
import { Constats } from "./views/Constats";
import { Vendeur } from "./views/Vendeur";
import { Spa } from "./views/Spa";
import { Gravite } from "./components/ui";
import {
  GRAVITES,
  aller,
  chargerAudit,
  compterGravites,
  formaterDate,
  relancerAudit,
  useEtat,
  type Ecran,
} from "./store";

const ECRANS: { id: Ecran; num: string; nom: string; sur: string; intro: string }[] = [
  {
    id: "dataroom",
    num: "1",
    nom: "La data room",
    sur: "Ce qui est arrivé",
    intro:
      "Chaque fichier a été ouvert. Les doublons et les brouillons sont écartés avec leur motif, et ce qui n'a pas pu être lu est dit.",
  },
  {
    id: "chantiers",
    num: "2",
    nom: "Les chantiers",
    sur: "Ce qu'on cherche",
    intro:
      "Les constats suivent les chantiers de l'audit, pas l'arborescence du vendeur. Chaque chantier dit aussi où ses conclusions s'arrêtent.",
  },
  {
    id: "tableau",
    num: "3",
    nom: "Le tableau",
    sur: "Ce qui a été relevé",
    intro: "Une ligne par question d'audit. Chaque cellule porte le document, la clause et la page dont elle vient.",
  },
  {
    id: "constats",
    num: "4",
    nom: "Les constats",
    sur: "D'où cela vient",
    intro:
      "L'extrait du document et le texte rédigé, côte à côte, avec le chemin complet qui y mène. La vérification devient une relecture ciblée.",
  },
  {
    id: "vendeur",
    num: "5",
    nom: "Les réponses du vendeur",
    sur: "Ce qu'il en dit",
    intro: "Chaque réponse éprouvée contre les pièces, avec le constat et le passage qui la contredisent.",
  },
  {
    id: "spa",
    num: "6",
    nom: "Au contrat de cession",
    sur: "Ce qu'on en fait",
    intro:
      "Chaque risque traduit en garantie, condition suspensive ou ajustement de prix, avec le renvoi qui le justifie.",
  },
];

export function App() {
  const ecran = useEtat((e) => e.ecran);
  const audit = useEtat((e) => e.audit);
  const erreur = useEtat((e) => e.erreur);
  const enCours = useEtat((e) => e.enCours);

  useEffect(() => {
    chargerAudit();
  }, []);

  if (erreur && !audit) {
    return (
      <div className="demarrage">
        <div className="carte" style={{ maxWidth: 560 }}>
          <h2>L'audit n'a pas pu être chargé</h2>
          <p className="sous" style={{ marginTop: 8 }}>{erreur}</p>
          <p className="sous">Le serveur de développement doit tourner : <code>npm run dev</code>.</p>
          <button className="bouton fort" onClick={chargerAudit}>Réessayer</button>
        </div>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="demarrage">
        <div>
          <div className="marque" style={{ padding: 0, justifyContent: "center" }}>
            <span className="sceau">V</span>
            <div><b>Visa</b><small>Due diligence tracée</small></div>
          </div>
          <p className="sous" style={{ marginTop: 18, textAlign: "center" }}>Lecture de la data room…</p>
        </div>
      </div>
    );
  }

  const courant = ECRANS.find((e) => e.id === ecran)!;
  const g = compterGravites(audit.constats);
  const relus = audit.constats.filter((c) => c.relu).length;

  return (
    <div className="app">
      <aside className="cote">
        <div className="marque">
          <span className="sceau">V</span>
          <div>
            <b>Visa</b>
            <small>Due diligence tracée</small>
          </div>
        </div>

        <div className="cote-titre">L'audit, dans l'ordre</div>
        {ECRANS.map((e) => (
          <button key={e.id} className={`onglet ${ecran === e.id ? "actif" : ""}`} onClick={() => aller(e.id)}>
            <span className="num">{e.num}</span>
            {e.nom}
            {e.id === "dataroom" && <span className="apres">{audit.documents.length}</span>}
            {e.id === "constats" && <span className="apres">{relus}/{audit.constats.length}</span>}
            {e.id === "tableau" && <span className="apres">{audit.constats.length}</span>}
            {e.id === "vendeur" && (
              <span className="apres">{audit.epreuves.filter((x) => x.verdict === "inexacte").length}</span>
            )}
            {e.id === "spa" && <span className="apres">{audit.mecanismes.length}</span>}
          </button>
        ))}

        <div className="cote-pied">
          <div style={{ marginBottom: 7 }}>
            <b>{audit.operation.split(" — ")[0]}</b>
            <br />
            {audit.cible}
          </div>
          <div>Audit au {formaterDate(audit.dateReference)}</div>
          <div style={{ marginTop: 9, lineHeight: 1.5 }}>
            Toute information
            <br />
            porte son chemin.
          </div>
        </div>
      </aside>

      <main className="corps">
        <div className="entete">
          <div style={{ minWidth: 0 }}>
            <div className="sur-titre">Étape {courant.num} · {courant.sur}</div>
            <h1>{courant.nom}</h1>
            <p className="intro">{courant.intro}</p>
          </div>
          <div className="actions">
            {ecran !== "dataroom" && (
              <span className="rangee" style={{ gap: 7 }}>
                {GRAVITES.filter((x) => g[x]).map((x) => (
                  <Gravite key={x} gravite={x} texte={`${g[x]} ${x}`} />
                ))}
              </span>
            )}
            <button className="bouton" onClick={relancerAudit} disabled={Boolean(enCours)}>
              {enCours ? "Audit en cours…" : "Relancer l'audit"}
            </button>
          </div>
        </div>

        {enCours && (
          <div className="progression">
            {audit.etapes.map((et) => {
              const fait = enCours.find((x) => x.etape === et.id);
              return (
                <span key={et.id} className={`pas-progression ${fait ? "fait" : ""}`}>
                  {fait ? "✓" : "○"} {et.titre}
                  {fait && <small>{fait.detail}</small>}
                </span>
              );
            })}
          </div>
        )}

        {ecran === "dataroom" && <DataRoom audit={audit} />}
        {ecran === "chantiers" && <Chantiers audit={audit} />}
        {ecran === "tableau" && <Tableau audit={audit} />}
        {ecran === "constats" && <Constats audit={audit} />}
        {ecran === "vendeur" && <Vendeur audit={audit} />}
        {ecran === "spa" && <Spa audit={audit} />}
      </main>
    </div>
  );
}
