// Le rapport : une ligne par affirmation, et la fiche complète de celle qu'on
// ouvre. Tout ce qui est affirmé ici est appuyé sur un passage copié du texte
// officiel — jamais sur une reformulation.

import { useState } from "react";
import { CONTROLES, compter, formaterDate } from "../engine/etapes";
import { basculerValidation, ouvrirAffirmation, useEtat } from "../store";
import { BarreSynthese, FriseVersions, Jeton, MOT, ORDRE, Pyramide, TexteOfficiel } from "../components/ui";
import { passageDansSource } from "../engine/piste";
import type { Affirmation, Verdict } from "../types";

export function Rapport() {
  const dossier = useEtat((e) => e.dossier);
  const ouverte = useEtat((e) => e.affirmationOuverte);
  const [filtre, setFiltre] = useState<Verdict | null>(null);
  const c = compter(dossier.affirmations);
  const affirmation = dossier.affirmations.find((a) => a.id === ouverte) ?? null;
  const liste = filtre ? dossier.affirmations.filter((a) => a.verdict === filtre) : dossier.affirmations;

  if (dossier.affirmations.length === 0) {
    return (
      <div className="vue">
        <div className="vide">
          <h3>Aucun contrôle n'a encore été passé</h3>
          <p>Lancez un contrôle depuis l'accueil pour voir le rapport.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vue">
      <div className="large">
        <div className="carte" style={{ marginBottom: 20 }}>
          <BarreSynthese compte={c} total={dossier.affirmations.length} />
          <div className="rangee" style={{ marginTop: 16, gap: 8, flexWrap: "wrap" }}>
            <span className="sous" style={{ marginRight: 4 }}>N'afficher que :</span>
            <button className={`bouton sm ${filtre === null ? "fort" : ""}`} onClick={() => setFiltre(null)}>
              Tout ({dossier.affirmations.length})
            </button>
            {ORDRE.filter((v) => c[v]).map((v) => (
              <button
                key={v}
                className={`bouton sm ${filtre === v ? "fort" : ""}`}
                onClick={() => setFiltre(filtre === v ? null : v)}
              >
                {MOT[v]} ({c[v]})
              </button>
            ))}
          </div>
        </div>

        <div className="rapport">
          <div>
            {liste.map((a) => (
              <button
                key={a.id}
                className={`ligne b-${a.verdict} ${ouverte === a.id ? "ouvert" : ""}`}
                onClick={() => ouvrirAffirmation(a.id)}
              >
                <div className="tete">
                  <span className="ref">{a.id}</span>
                  <Jeton verdict={a.verdict} />
                  {a.citation ? (
                    <span className="cit">{a.citation}</span>
                  ) : (
                    <span className="cit" style={{ color: "var(--encre-3)" }}>
                      aucune source citée
                    </span>
                  )}
                  {a.valideParLeJuriste && <span className="vu">✓ relu</span>}
                </div>
                <div className="txt">{a.phrase}</div>
                <div className="dit">{a.resume}</div>
              </button>
            ))}
          </div>

          <div className="panneau">
            {affirmation ? (
              <Fiche affirmation={affirmation} dateDesFaits={dossier.dateDesFaits} />
            ) : (
              <div className="carte">
                <h3>Choisissez une affirmation</h3>
                <p className="sous" style={{ marginBottom: 0 }}>
                  Vous verrez les quatre contrôles, le texte officiel avec le passage surligné, le rang de la
                  source dans la hiérarchie des normes, et ce que l'adversaire pourrait opposer.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fiche({ affirmation: a, dateDesFaits }: { affirmation: Affirmation; dateDesFaits: string }) {
  const s = a.source;
  const rangDouteux = a.controles.find((c) => c.id === "rang")?.verdict !== "vert";
  // Le passage de l'adversaire est vérifié ici, à l'affichage, sur le texte
  // officiel : on ne se contente pas de la réponse du modèle.
  const retrouve = Boolean(a.contradiction && s && passageDansSource(s, a.contradiction.passage));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="carte">
        <div className="rangee" style={{ marginBottom: 11 }}>
          <span className="ref" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--encre-3)" }}>
            {a.id}
          </span>
          <Jeton verdict={a.verdict} />
          <button className="bouton discret sm ferme" onClick={() => ouvrirAffirmation(null)} aria-label="Fermer">
            ✕
          </button>
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 11 }}>{a.phrase}</p>
        <div className="sous">{a.citation ? <>Cité comme : <b style={{ color: "var(--marine-clair)" }}>{a.citation}</b></> : "Aucune référence citée."}</div>
        <button
          className={`bouton sm ${a.valideParLeJuriste ? "" : "fort"}`}
          style={{ marginTop: 14 }}
          onClick={() => basculerValidation(a.id)}
        >
          {a.valideParLeJuriste ? "✓ Relue — annuler" : "Marquer comme relue"}
        </button>
      </div>

      <div className="carte">
        <h3 style={{ marginBottom: 8 }}>Les quatre contrôles</h3>
        <div className="controles-liste">
          {CONTROLES.map((ctl) => {
            const c = a.controles.find((x) => x.id === ctl.id)!;
            return (
              <div key={ctl.id} className="controle-ligne">
                <div className="q">
                  <Jeton verdict={c.verdict} />
                  {ctl.titre}
                </div>
                <div className="r">{c.reponse}</div>
                {c.preuve && <div className="p">{c.preuve}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {s && (
        <div className="carte">
          <h3 style={{ marginBottom: 3 }}>{s.base === "introuvable" ? "Aucune source" : "Le texte officiel"}</h3>
          <div className="sous" style={{ marginBottom: 12 }}>
            {s.intitule}
            {s.identifiant && (
              <>
                {" · "}
                <code style={{ fontSize: 11.5 }}>{s.identifiant}</code>
                {" · "}
                {s.base}
              </>
            )}
          </div>
          <TexteOfficiel source={s} />
          {s.lien && (
            <a href={s.lien} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 11, fontSize: 13 }}>
              Ouvrir sur {s.base} ↗
            </a>
          )}
        </div>
      )}

      {s && s.versions.length > 1 && (
        <div className="carte">
          <h3 style={{ marginBottom: 3 }}>Quelle version s'appliquait ?</h3>
          <div className="sous" style={{ marginBottom: 12 }}>
            Faits du {formaterDate(dateDesFaits)}. Visa compare la version applicable à ce jour-là et celle que
            l'auteur a citée.
          </div>
          <FriseVersions source={s} dateDesFaits={dateDesFaits} />
        </div>
      )}

      {s && s.base !== "introuvable" && (
        <div className="carte">
          <h3 style={{ marginBottom: 3 }}>Son rang dans la hiérarchie des normes</h3>
          <div className="sous" style={{ marginBottom: 13 }}>
            {rangDouteux
              ? "Attention : la source est invoquée comme si elle liait le juge."
              : "La source a bien l'autorité qu'on lui prête."}
          </div>
          <Pyramide rang={s.rang} alerte={rangDouteux} />
        </div>
      )}

      {a.contradiction && (
        <div className="carte">
          <h3 style={{ marginBottom: 3 }}>Ce que l'adversaire opposerait</h3>
          <div className="sous" style={{ marginBottom: 12 }}>
            Un second agent plaide contre vous. Il doit citer un passage exact, et Visa vérifie mot pour mot
            qu'il existe dans le texte officiel.
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.6 }}>{a.contradiction.argument}</p>
          <div className="citation" style={{ marginTop: 12 }}>
            « {a.contradiction.passage} »
          </div>
          <div className="sous" style={{ marginTop: 10 }}>
            {retrouve ? (
              <>
                <b style={{ color: "var(--vert)" }}>✓ Passage retrouvé mot pour mot</b> dans le texte officiel :
                l'objection tient.
              </>
            ) : (
              <>
                <b style={{ color: "var(--rouge)" }}>✕ Passage introuvable</b> dans le texte officiel : Visa
                écarte l'objection. Le contradicteur non plus n'a pas le droit d'inventer.
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
