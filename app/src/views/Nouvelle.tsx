// Soumettre un texte. Deux choses à renseigner, pas une de plus : le texte,
// et la date des faits. Tout le reste, Visa le déduit.

import { useState } from "react";
import { TEXTE_SOUMIS } from "../data/dossier";
import { lancerLeControle, useEtat } from "../store";

export function Nouvelle() {
  const dossier = useEtat((e) => e.dossier);
  const [texte, setTexte] = useState(TEXTE_SOUMIS);
  const [date, setDate] = useState(dossier.dateDesFaits);
  const [outil, setOutil] = useState("ChatGPT (GPT-5)");
  const mots = texte.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="vue">
      <div className="large" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 330px", gap: 22, alignItems: "start" }}>
        <div className="carte">
          <label className="etiquette" htmlFor="texte">
            Le texte à vérifier
          </label>
          <textarea
            id="texte"
            className="champ"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder="Collez ici la note, les conclusions ou le mémo. Visa ne le réécrit pas : il le découpe en affirmations et va chercher chaque source."
          />
          <div className="sous" style={{ marginTop: 9 }}>
            {mots} mots. Visa ne conserve ce texte que le temps du contrôle, et ne le transmet à aucun tiers
            hors des API officielles et du modèle que vous avez choisi.
          </div>
        </div>

        <div>
          <div className="carte">
            <label className="etiquette" htmlFor="date">
              La date des faits
            </label>
            <input id="date" className="champ" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <p className="sous" style={{ marginTop: 10, marginBottom: 0 }}>
              C'est la date la plus importante de l'écran. Elle décide quelle <b>version</b> de chaque texte
              s'applique : le barème de 2017 ne vaut rien pour des faits de 2016.
            </p>
          </div>

          <div className="carte">
            <label className="etiquette" htmlFor="outil">
              Rédigé avec quel outil ?
            </label>
            <input id="outil" className="champ" value={outil} onChange={(e) => setOutil(e.target.value)} />
            <p className="sous" style={{ marginTop: 10, marginBottom: 0 }}>
              Entre au journal d'audit. Le guide du CNB du 17 mars 2026 demande de documenter les usages de
              l'IA : cette ligne y répond.
            </p>
          </div>

          <div className="carte">
            <h3>Visa va faire six choses</h3>
            <ol className="sous" style={{ margin: "9px 0 0", paddingLeft: 20, lineHeight: 1.8 }}>
              <li>Lire le texte sans le réécrire</li>
              <li>Le découper en affirmations</li>
              <li>Retrouver chaque source officielle</li>
              <li>Passer les quatre contrôles</li>
              <li>Faire contredire par un second agent</li>
              <li>Consigner le tout au journal d'audit</li>
            </ol>
            <button
              className="bouton fort"
              style={{ width: "100%", justifyContent: "center", marginTop: 18 }}
              disabled={!texte.trim() || !date}
              onClick={lancerLeControle}
            >
              Lancer le contrôle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
