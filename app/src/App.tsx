// L'ossature : un écran, deux volets.
//
// À gauche le rapport, lu comme un document. À droite la preuve du passage
// qu'on vient de cliquer, le parcours des agents ou les pièces — et, dessous,
// le journal en direct. Rien d'autre : pas de menu à six entrées, pas d'écran
// à retrouver. Le juriste lit son rapport, et vérifie à côté.

import { useEffect, useState } from "react";
import { Dossiers } from "./views/Dossiers";
import { Rapport } from "./views/Rapport";
import { Preuve } from "./views/Preuve";
import { Parcours } from "./views/Parcours";
import { Pieces } from "./views/Pieces";
import { JournalDAudit } from "./views/Audit";
import { LecteurDocument } from "./views/LecteurDocument";
import { Journal } from "./components/Journal";
import { Gravite } from "./components/ui";
import {
  GRAVITES,
  allerOnglet,
  chargerDossiers,
  compterGravites,
  constatChoisi,
  depuis,
  fermerDossier,
  ouvrirDocument,
  poser,
  relancerAudit,
  useEtat,
  type Onglet,
} from "./store";

const ONGLETS: { id: Onglet; nom: string }[] = [
  { id: "preuve", nom: "La preuve" },
  { id: "parcours", nom: "Le parcours" },
  { id: "pieces", nom: "Les pièces" },
];

export function App() {
  const dossierOuvert = useEtat((e) => e.dossierOuvert);
  const audit = useEtat((e) => e.audit);
  const erreur = useEtat((e) => e.erreur);
  const enCours = useEtat((e) => e.enCours);
  const chargement = useEtat((e) => e.chargement);
  const onglet = useEtat((e) => e.onglet);
  const choisi = useEtat((e) => e.choisi);
  const documentOuvert = useEtat((e) => e.documentOuvert);
  const [lecture, setLecture] = useState<{ id: string; passage: string | null } | null>(null);

  useEffect(() => {
    chargerDossiers();
  }, []);

  const constat = choisi && audit ? constatChoisi() : null;

  return (
    <div className="ecran">
      <header className="barre">
        <button className="marque" onClick={fermerDossier} title="Revenir aux dossiers">
          <span className="sceau">V</span>
          <span className="nom-marque">Visa</span>
        </button>

        {audit ? (
          <>
            <span className="separateur" />
            <button className="fil-ariane" onClick={fermerDossier}>
              {audit.nomDossier}
            </button>
            <Sommaire audit={audit} />
            <div className="barre-actions">
              <button className="bouton sm" onClick={relancerAudit} disabled={Boolean(enCours)}>
                {enCours ? "passage en cours…" : "⟳ relancer"}
              </button>
            </div>
          </>
        ) : (
          <span className="accroche">
            Chaque information du rapport porte le chemin qui y mène.
          </span>
        )}
      </header>

      {erreur && (
        <div className="bandeau attention compact bandeau-barre">
          <span className="pastille">▲</span>
          <span>{erreur}</span>
          <button className="bouton discret sm" style={{ marginLeft: "auto" }} onClick={() => poser({ erreur: null })}>
            ✕
          </button>
        </div>
      )}

      {!dossierOuvert && <Dossiers />}

      {dossierOuvert && !audit && (
        <div className="vide">
          {chargement ? "Passage de l'audit sur les pièces du dossier…" : "Aucun audit pour ce dossier."}
        </div>
      )}

      {dossierOuvert && audit && (
        <div className="deux-volets">
          <section className="volet-gauche">
            <Rapport audit={audit} />
          </section>

          <section className="volet-droit">
            <nav className="onglets">
              {ONGLETS.map((o) => (
                <button key={o.id} className={`onglet-droit ${onglet === o.id ? "actif" : ""}`} onClick={() => allerOnglet(o.id)}>
                  {o.nom}
                  {o.id === "parcours" && <span className="compte-onglet">{audit.journal.length}</span>}
                  {o.id === "pieces" && <span className="compte-onglet">{audit.documents.length}</span>}
                </button>
              ))}
            </nav>
            <div className="volet-corps">
              {onglet === "preuve" && (
                <Preuve audit={audit} constat={constat} onLire={(id, passage) => setLecture({ id, passage })} />
              )}
              {onglet === "parcours" && <Parcours audit={audit} />}
              {onglet === "pieces" && <Pieces audit={audit} />}
            </div>
            <Journal audit={audit} enDirect={enCours} />
          </section>
        </div>
      )}

      {audit && <JournalDAudit audit={audit} />}

      {lecture && (
        <LecteurDocument id={lecture.id} surligner={lecture.passage} onFermer={() => setLecture(null)} />
      )}
      {documentOuvert && <LecteurDocument id={documentOuvert} onFermer={() => ouvrirDocument(null)} />}
    </div>
  );
}

/** Le sommaire de la barre : tout ce qu'il faut savoir d'un coup d'œil. */
function Sommaire({ audit }: { audit: Parameters<typeof Rapport>[0]["audit"] }) {
  const g = compterGravites(audit.constats);
  const cv = audit.couverture;
  const aRevoir = audit.changements.aRevoir.length;
  const relus = audit.constats.filter((c) => c.relu).length;

  return (
    <div className="sommaire">
      <span className="bloc-sommaire" title={`${cv.depouilles} pièces dépouillées sur ${cv.total} versées`}>
        <b>
          {cv.depouilles}/{cv.total}
        </b>
        lues
      </span>
      {cv.illisibles.length > 0 && (
        <span className="bloc-sommaire alerte" title="Pièces que Visa n'a pas pu lire">
          <b>{cv.illisibles.length}</b>
          non lue{cv.illisibles.length > 1 ? "s" : ""}
        </span>
      )}
      {cv.demandesManquantes > 0 && (
        <span className="bloc-sommaire alerte" title="Lignes de la liste de demandes restées sans réponse">
          <b>{cv.demandesManquantes}</b>
          manquantes
        </span>
      )}
      <span className="separateur" />
      {GRAVITES.filter((x) => g[x]).map((x) => (
        <Gravite key={x} gravite={x} texte={`${g[x]} ${x}`} />
      ))}
      <span className="separateur" />
      <span className="bloc-sommaire" title="Constats que vous avez relus">
        <b>
          {relus}/{audit.constats.length}
        </b>
        relus
      </span>
      {aRevoir > 0 && (
        <button
          className="bloc-sommaire perime-puce"
          onClick={() => poser({ onglet: "preuve", choisi: audit.changements.aRevoir[0].cle })}
          title="Des pièces arrivées depuis ont changé des constats que vous aviez validés"
        >
          <b>{aRevoir}</b>
          relecture{aRevoir > 1 ? "s" : ""} périmée{aRevoir > 1 ? "s" : ""}
        </button>
      )}
      <span className="bloc-sommaire discret" title={`Dernier passage ${depuis(audit.lanceLe)}`}>
        {depuis(audit.lanceLe)}
      </span>
    </div>
  );
}
