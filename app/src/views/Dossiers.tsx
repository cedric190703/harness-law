// Les dossiers du cabinet. C'est la porte d'entrée : on y ouvre une opération,
// on en ouvre une nouvelle, et on voit d'un coup d'œil où en est chacune.

import { useState } from "react";
import type { Dossier } from "../types";
import { chargerDossiers, creerDossier, depuis, formaterDate, ouvrirDossier, supprimerDossier, useEtat } from "../store";

export function Dossiers() {
  const dossiers = useEtat((e) => e.dossiers);
  const chargement = useEtat((e) => e.chargement);
  const [ouvertureEnCours, setOuverture] = useState(false);

  return (
    <div className="vue">
      <div className="large">
        <div className="rangee" style={{ marginBottom: 16 }}>
          <h3>
            {dossiers.length} dossier{dossiers.length > 1 ? "s" : ""}
          </h3>
          <button className="bouton fort" style={{ marginLeft: "auto" }} onClick={() => setOuverture(true)}>
            + Ouvrir un dossier
          </button>
        </div>

        {chargement && !dossiers.length && <div className="vide">Lecture des dossiers…</div>}

        {!chargement && !dossiers.length && (
          <div className="vide">
            <h3>Aucun dossier</h3>
            <p>Ouvrez-en un, versez-y les pièces de la data room, et l'audit se fera.</p>
          </div>
        )}

        {dossiers.map((d) => (
          <LigneDossier key={d.id} dossier={d} />
        ))}

        {ouvertureEnCours && <Ouverture onFini={() => setOuverture(false)} />}
      </div>
    </div>
  );
}

function LigneDossier({ dossier: d }: { dossier: Dossier }) {
  const [suppression, setSuppression] = useState(false);
  return (
    <div className="dossier-carte">
      <button className="dossier-corps" onClick={() => ouvrirDossier(d.id)}>
        <div className="quoi">
          <div className="rangee" style={{ gap: 9 }}>
            <span className="nom">{d.nom}</span>
            {d.demonstration && <span className="jeton g-inconnu"><span className="puce" />démonstration</span>}
          </div>
          <div className="meta">
            {d.operation}
            {d.cible ? ` · ${d.cible}` : ""} · conseil de {d.cote}
          </div>
          <div className="meta">
            Audit au {formaterDate(d.dateReference)}
            {d.responsable ? ` · ${d.responsable}` : ""}
          </div>
        </div>
        <div className="compteurs">
          <span><b>{d.pieces}</b>pièces</span>
          <span><b>{d.nombreAudits}</b>passages</span>
          <span><b>{d.relus}</b>relus</span>
          <span className="quand">{depuis(d.dernierAudit)}</span>
        </div>
        <span className="bouton sm">Ouvrir →</span>
      </button>
      {!d.demonstration && (
        <div className="dossier-pied">
          {suppression ? (
            <>
              <span className="sous">Fermer ce dossier supprime ses pièces et son historique.</span>
              <button className="bouton sm" onClick={() => setSuppression(false)}>Annuler</button>
              <button className="bouton sm danger" onClick={() => supprimerDossier(d.id)}>Supprimer</button>
            </>
          ) : (
            <button className="bouton discret sm" onClick={() => setSuppression(true)}>Fermer le dossier</button>
          )}
        </div>
      )}
    </div>
  );
}

function Ouverture({ onFini }: { onFini: () => void }) {
  const [champs, setChamps] = useState({
    nom: "",
    operation: "Acquisition de 100 % des titres",
    cible: "",
    cote: "l'acquéreur",
    dateReference: new Date().toISOString().slice(0, 10),
    responsable: "",
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const champ = (c: keyof typeof champs) => ({
    value: champs[c],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setChamps({ ...champs, [c]: e.target.value }),
  });

  const soumettre = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const d = await creerDossier(champs);
      onFini();
      ouvrirDossier(d.id);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEnvoi(false);
    }
  };

  return (
    <div className="voile" onClick={onFini}>
      <div className="lecteur" style={{ width: "min(560px, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h3>Ouvrir un dossier</h3>
            <div className="sous">Les pièces se versent ensuite, par lots.</div>
          </div>
          <button className="bouton discret sm" onClick={onFini} aria-label="Fermer">✕</button>
        </header>
        <div className="corps-lecteur" style={{ padding: "18px 22px 22px" }}>
          <label className="etiquette" htmlFor="nom">Nom du dossier</label>
          <input id="nom" className="champ" placeholder="Projet Delta" autoFocus {...champ("nom")} />

          <label className="etiquette" style={{ marginTop: 15 }} htmlFor="operation">Opération</label>
          <input id="operation" className="champ" {...champ("operation")} />

          <label className="etiquette" style={{ marginTop: 15 }} htmlFor="cible">Cible</label>
          <input id="cible" className="champ" placeholder="DELTA FLUIDES SAS, RCS Lyon 000 000 000" {...champ("cible")} />

          <div className="colonnes" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 15 }}>
            <div>
              <label className="etiquette" htmlFor="cote">Nous conseillons</label>
              <select id="cote" className="champ" {...champ("cote")}>
                <option value="l'acquéreur">l'acquéreur</option>
                <option value="le cédant">le cédant</option>
                <option value="le prêteur">le prêteur</option>
              </select>
            </div>
            <div>
              <label className="etiquette" htmlFor="date">Date de référence</label>
              <input id="date" className="champ" type="date" {...champ("dateReference")} />
            </div>
          </div>
          <p className="sous" style={{ marginTop: 9 }}>
            La date de référence décide quelle version de chaque texte s'applique, et de quel côté se lit chaque
            risque.
          </p>

          <label className="etiquette" style={{ marginTop: 15 }} htmlFor="resp">Responsable</label>
          <input id="resp" className="champ" placeholder="Associé en charge" {...champ("responsable")} />

          {erreur && <div className="bandeau attention" style={{ marginTop: 16 }}><span className="pastille">▲</span><span>{erreur}</span></div>}

          <div className="rangee" style={{ marginTop: 20, gap: 9 }}>
            <button className="bouton fort" disabled={!champs.nom.trim() || envoi} onClick={soumettre}>
              {envoi ? "Ouverture…" : "Ouvrir le dossier"}
            </button>
            <button className="bouton" onClick={onFini}>Annuler</button>
            <button className="bouton discret sm" style={{ marginLeft: "auto" }} onClick={chargerDossiers}>
              Rafraîchir la liste
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
