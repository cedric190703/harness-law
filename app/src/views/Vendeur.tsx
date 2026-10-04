// Les réponses du vendeur, éprouvées une à une contre les documents.
//
// C'est le travail que les juristes refont à la main : on reprend chaque
// réponse, on la confronte aux pièces, et on note l'écart. Ici chaque verdict
// porte le constat et le passage qui le fondent — ou dit qu'il ne peut rien
// conclure.

import type { Audit, Epreuve } from "../types";
import { Chiffre, Renvoi } from "../components/ui";
import { ouvrirConstat } from "../store";

const TON: Record<Epreuve["verdict"], string> = {
  inexacte: "critique",
  "non vérifiable": "inconnu",
  "non éprouvée": "inconnu",
  exacte: "faible",
};

const MOT: Record<Epreuve["verdict"], string> = {
  inexacte: "contredite par les pièces",
  "non vérifiable": "non vérifiable en l'état",
  "non éprouvée": "non éprouvée",
  exacte: "confirmée",
};

export function Vendeur({ audit }: { audit: Audit }) {
  const inexactes = audit.epreuves.filter((e) => e.verdict === "inexacte").length;
  const nonVerifiables = audit.epreuves.filter((e) => e.verdict === "non vérifiable").length;

  return (
    <div className="vue">
      <div className="large">
        <div className="carte">
          <h3 style={{ marginBottom: 4 }}>Les réponses du vendeur, confrontées aux documents</h3>
          <p className="sous" style={{ marginBottom: 16 }}>
            Chaque réponse est éprouvée contre le registre des constats. Une réponse n'est déclarée inexacte que
            si un constat, appuyé sur un passage retrouvé, l'établit.
          </p>
          <div className="puces-chiffres">
            <Chiffre valeur={`${inexactes}/${audit.epreuves.length}`} quoi="réponses contredites par les pièces" ton={inexactes ? "alerte" : "calme"} />
            <Chiffre valeur={`${nonVerifiables}`} quoi="non vérifiables : la pièce manque ou est illisible" />
            <Chiffre valeur={`${audit.demandes.manquants.length}`} quoi="demandes restées sans réponse" />
          </div>
          {inexactes >= 3 && (
            <p className="sous" style={{ marginTop: 16, marginBottom: 0 }}>
              <b style={{ color: "var(--encre)" }}>
                {inexactes} réponses sur {audit.epreuves.length} sont contredites par les documents que le
                vendeur a lui-même versés.
              </b>{" "}
              Au-delà de chaque point, c'est la fiabilité générale des déclarations qui doit se traduire au
              contrat : élargissement des déclarations et garanties, et allongement de leur durée.
            </p>
          )}
        </div>

        {audit.epreuves.map((e) => (
          <div key={e.question} className={`carte epreuve t-${TON[e.verdict]}`}>
            <div className="rangee" style={{ alignItems: "flex-start", gap: 12 }}>
              <span className="code gros">{e.question}</span>
              <div style={{ minWidth: 0 }}>
                <blockquote className="affirmation">« {e.affirmation} »</blockquote>
                <div className="rangee" style={{ marginTop: 10, gap: 9 }}>
                  <span className={`jeton g-${TON[e.verdict]}`}><span className="puce" />{MOT[e.verdict]}</span>
                </div>
                <p className="redaction" style={{ marginTop: 11 }}>{e.pourquoi}</p>

                {e.appuis.length > 0 && (
                  <div className="appuis">
                    <span className="etiquette">Ce qui l'établit</span>
                    {e.appuis.map((a) => (
                      <div key={a.constat} className="appui">
                        <button className="lien-constat" onClick={() => ouvrirConstat(a.constat)}>{a.constat} →</button>
                        <Renvoi nom={a.document} clause={a.clause} page={a.page} compact />
                        {a.extrait && <blockquote className="verbatim petit">{a.extrait}</blockquote>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
