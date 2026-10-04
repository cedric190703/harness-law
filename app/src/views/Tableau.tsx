// Le tableau : une ligne par question d'audit, une colonne par ce dont le
// juriste a besoin pour décider. Chaque cellule porte son renvoi.
//
// C'est la vue qu'on recopie dans le rapport. Elle existe pour qu'on n'ait plus
// à retaper les références une par une.

import type { Audit, Constat } from "../types";
import { Gravite, NonEtabli, Renvoi } from "../components/ui";
import { nomChantier, ouvrirConstat, poser, useEtat } from "../store";

export function Tableau({ audit }: { audit: Audit }) {
  const chantierFiltre = useEtat((e) => e.chantierFiltre);
  const liste = chantierFiltre ? audit.constats.filter((c) => c.chantier === chantierFiltre) : audit.constats;

  return (
    <div className="vue">
      <div className="large">
        <div className="carte" style={{ marginBottom: 16 }}>
          <div className="rangee" style={{ gap: 8, flexWrap: "wrap" }}>
            <span className="sous" style={{ marginRight: 4 }}>Chantier :</span>
            <button className={`bouton sm ${!chantierFiltre ? "fort" : ""}`} onClick={() => poser({ chantierFiltre: null })}>
              Tous ({audit.constats.length})
            </button>
            {audit.chantiers.map((ch) => {
              const n = audit.constats.filter((c) => c.chantier === ch.id).length;
              if (!n) return null;
              return (
                <button
                  key={ch.id}
                  className={`bouton sm ${chantierFiltre === ch.id ? "fort" : ""}`}
                  onClick={() => poser({ chantierFiltre: chantierFiltre === ch.id ? null : ch.id })}
                >
                  {ch.nom} ({n})
                </button>
              );
            })}
          </div>
          <p className="sous" style={{ marginTop: 12, marginBottom: 0 }}>
            Chaque cellule « Ce qui a été relevé » porte le document, la clause et la page dont elle vient.
            Cliquez une ligne pour suivre le chemin complet.
          </p>
        </div>

        <div className="carte" style={{ padding: 0, overflow: "hidden" }}>
          <table className="grille">
            <thead>
              <tr>
                <th style={{ width: 74 }}>N°</th>
                <th style={{ width: 150 }}>Chantier</th>
                <th>Question d'audit</th>
                <th>Ce qui a été relevé</th>
                <th style={{ width: 230 }}>D'où cela vient</th>
                <th style={{ width: 96 }}>Gravité</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((c) => (
                <LigneTableau key={c.id} constat={c} audit={audit} />
              ))}
            </tbody>
          </table>
        </div>

        {audit.sansReponse.length > 0 && (
          <div className="carte" style={{ marginTop: 18 }}>
            <h3 style={{ marginBottom: 8 }}>Questions restées sans réponse dans la data room</h3>
            {audit.sansReponse.map((s) => (
              <div key={s.sonde} className="ligne-plate">
                <span className="code">{s.sonde}</span>
                <div>
                  <b>{s.question}</b>
                  <div className="sous">{s.motif}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {audit.rejets.length > 0 && (
          <div className="carte alerte-bord" style={{ marginTop: 18 }}>
            <h3 style={{ marginBottom: 8 }}>Constats rejetés avant d'entrer au rapport</h3>
            <p className="sous" style={{ marginBottom: 10 }}>
              Un constat dont le passage ne se retrouve pas mot pour mot dans le document nommé n'entre pas au
              registre. Le rejet est consigné ici plutôt que caché.
            </p>
            {audit.rejets.map((r, i) => (
              <div key={`${r.sonde}-${i}`} className="ligne-plate">
                <span className="code">{r.sonde}</span>
                <div className="sous">{r.motif}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LigneTableau({ constat: c, audit }: { constat: Constat; audit: Audit }) {
  return (
    <tr className="cliquable" onClick={() => ouvrirConstat(c.id)}>
      <td><b>{c.id}</b></td>
      <td className="sous">{nomChantier(audit.chantiers, c.chantier)}</td>
      <td>{c.question}</td>
      <td>
        {c.valeur}
        {c.nonEtabli && <div style={{ marginTop: 5 }}><NonEtabli /></div>}
      </td>
      <td>
        <Renvoi nom={c.provenance.nomRetenu} clause={c.provenance.clause} page={c.provenance.page} origine={c.provenance.origineTexte} compact />
        {c.provenance.ecartes.length > 0 && (
          <div className="sous" style={{ fontSize: 11.5, marginTop: 4 }}>
            {c.provenance.ecartes.length} document{c.provenance.ecartes.length > 1 ? "s" : ""} écarté
            {c.provenance.ecartes.length > 1 ? "s" : ""}
          </div>
        )}
      </td>
      <td><Gravite gravite={c.gravite} /></td>
    </tr>
  );
}
