// Le parcours des agents, en couloirs.
//
// Une ligne par pièce, un point par passage, de gauche à droite dans le temps.
// Le schéma remplace un grand graphe : il tient dans un volet, et il répond
// d'un coup d'œil à la question qui compte — quelle pièce a servi à quoi.
//
// Deux états de ligne, et c'est là qu'est la valeur :
//   — une ligne pleine : la pièce a été exploitée ;
//   — une ligne creuse : elle a été ouverte et n'a rien donné.
// C'est l'information que les outils d'extraction taisent.

import { useMemo, useState } from "react";
import type { Audit } from "../types";
import { choisir, court } from "../store";

const COULEUR: Record<string, string> = {
  Trieur: "#6b7280",
  Lecteur: "#7c3aed",
  Cadreur: "#0e7490",
  Chercheur: "#1d4ed8",
  "Règles": "#15803d",
  Droit: "#a16207",
  Contradicteur: "#b91c1c",
  "Rédacteur": "#9a3412",
};

const HAUT = 17;
const GAUCHE = 182;
const PAS = 13;

export function Parcours({ audit }: { audit: Audit }) {
  const [acteur, setActeur] = useState<string | null>(null);
  const p = audit.parcours;
  const pas = useMemo(() => (acteur ? p.pas.filter((x) => x.acteur === acteur) : p.pas), [p.pas, acteur]);
  const largeur = GAUCHE + Math.max(pas.length, 20) * PAS + 24;
  const hauteur = p.lignes.length * HAUT + 10;
  const rang = new Map(p.lignes.map((l, i) => [l.id, i]));

  return (
    <div className="parcours">
      <div className="rangee" style={{ gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
        <button className={`puce-acteur ${!acteur ? "actif" : ""}`} onClick={() => setActeur(null)}>
          tous
        </button>
        {audit.acteurs.map((a) => {
          const n = p.pas.filter((x) => x.acteur === a.id).length;
          if (!n) return null;
          return (
            <button
              key={a.id}
              className={`puce-acteur ${acteur === a.id ? "actif" : ""}`}
              style={{ ["--c" as string]: COULEUR[a.id] ?? "#6b7280" }}
              onClick={() => setActeur(acteur === a.id ? null : a.id)}
              title={a.quoi}
            >
              <i /> {a.id} {n}
            </button>
          );
        })}
      </div>

      <div className="schema">
        <svg width={largeur} height={hauteur} role="img" aria-label="Le parcours des agents sur chaque pièce">
          {p.lignes.map((l, i) => (
            <g key={l.id}>
              <text x={0} y={i * HAUT + 12} className={`ligne-nom ${l.exploitee ? "" : "creuse"} r-${l.role}`}>
                {court(l.nom, 28)}
              </text>
              <line
                x1={GAUCHE}
                x2={largeur - 20}
                y1={i * HAUT + 8}
                y2={i * HAUT + 8}
                className={l.exploitee ? "rail" : "rail creux"}
              />
            </g>
          ))}
          {pas.map((x, i) =>
            x.pistes.map((piste) => {
              const r = rang.get(piste);
              if (r === undefined) return null;
              return (
                <circle
                  key={`${x.rang}-${piste}`}
                  cx={GAUCHE + i * PAS + 6}
                  cy={r * HAUT + 8}
                  r={x.exploite ? 4 : 2.6}
                  fill={COULEUR[x.acteur] ?? "#6b7280"}
                  opacity={x.exploite ? 0.95 : 0.5}
                  className={x.constat ? "point cliquable" : "point"}
                  onClick={() => x.constat && ouvrirDepuisParcours(audit, x.constat)}
                >
                  <title>
                    {`${x.acteur} — ${x.action}${x.detail ? `\n${x.detail}` : ""}`}
                  </title>
                </circle>
              );
            }),
          )}
        </svg>
      </div>

      {p.sansSuite.length > 0 && (
        <div className="sans-suite">
          <b>
            {p.sansSuite.length} pièce{p.sansSuite.length > 1 ? "s" : ""} ouverte
            {p.sansSuite.length > 1 ? "s" : ""} sans rien donner
          </b>
          <ul>
            {p.sansSuite.map((l) => (
              <li key={l.id}>
                {l.nom} <span className="sous">({l.role === "ecarte" ? "écartée au triage" : "retenue, mais aucune question n'y a trouvé de réponse"})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="toutes-actions">
        <summary>Toutes les actions, dans l'ordre ({p.pas.length})</summary>
        <div className="actions-liste">
          {pas.map((x) => (
            <div key={x.rang} className="action-ligne">
              <span className="heure">{x.t.slice(11, 19)}</span>
              <b style={{ color: COULEUR[x.acteur] ?? "#6b7280" }}>{x.acteur}</b>
              <span>
                {x.action}
                {x.detail && <span className="sous"> — {x.detail}</span>}
              </span>
              {x.constat && (
                <button className="lien-constat" onClick={() => ouvrirDepuisParcours(audit, x.constat!)}>
                  {x.constat}
                </button>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

/** Le journal nomme les constats par leur numéro ; on retrouve leur clé. */
function ouvrirDepuisParcours(audit: Audit, id: string) {
  const c = audit.constats.find((x) => x.id === id);
  if (c) choisir(c.cle);
}
