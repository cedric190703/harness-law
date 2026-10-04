// Ce que l'audit devient dans le contrat de cession.
//
// C'est là que va le temps rendu au juriste : transformer un risque en
// garantie, en condition suspensive ou en ajustement de prix. Chaque rédaction
// proposée garde le renvoi au document qui la justifie — c'est ce qu'il faudra
// opposer au conseil du vendeur.

import type { Audit } from "../types";
import { Chiffre, Gravite, Renvoi } from "../components/ui";
import { GRAVITES, nomChantier, ouvrirConstat } from "../store";

const MECANISMES = [
  {
    id: "condition suspensive",
    nom: "Conditions suspensives",
    quoi: "À lever avant la réalisation : sans cela, on ne signe pas ou on ne réalise pas.",
  },
  {
    id: "garantie",
    nom: "Déclarations et garanties",
    quoi: "Le vendeur répond du passé : on obtient l'indemnisation si le risque se matérialise.",
  },
  {
    id: "ajustement de prix",
    nom: "Ajustement de prix",
    quoi: "Le risque est chiffré et certain : il se déduit du prix ou se séquestre.",
  },
] as const;

export function Spa({ audit }: { audit: Audit }) {
  const parMecanisme = (id: string) => audit.mecanismes.filter((m) => m.mecanisme === id);
  const sansMecanisme = audit.constats.filter((c) => !c.spa);

  return (
    <div className="vue">
      <div className="large">
        <div className="carte">
          <h3 style={{ marginBottom: 4 }}>{audit.mecanismes.length} mécanismes proposés</h3>
          <p className="sous" style={{ marginBottom: 16 }}>
            Un constat sans traduction contractuelle ne protège personne. Chaque rédaction ci-dessous garde le
            renvoi au document qui la justifie.
          </p>
          <div className="puces-chiffres">
            {MECANISMES.map((m) => (
              <Chiffre key={m.id} valeur={`${parMecanisme(m.id).length}`} quoi={m.nom.toLowerCase()} />
            ))}
            <Chiffre valeur={`${sansMecanisme.length}`} quoi="constats sans traduction : points d'information" />
          </div>
        </div>

        {MECANISMES.map((m) => {
          const liste = parMecanisme(m.id);
          if (!liste.length) return null;
          return (
            <div key={m.id} style={{ marginTop: 24 }}>
              <div className="rangee" style={{ marginBottom: 10 }}>
                <h3>{m.nom}</h3>
                <span className="sous" style={{ marginLeft: 10 }}>{liste.length}</span>
              </div>
              <p className="sous" style={{ marginBottom: 14, maxWidth: "80ch" }}>{m.quoi}</p>
              {liste
                .slice()
                .sort((a, b) => GRAVITES.indexOf(a.gravite) - GRAVITES.indexOf(b.gravite))
                .map((x) => (
                  <div key={x.constat} className={`carte meca g-bord-${x.gravite === "élevée" ? "elevee" : x.gravite}`}>
                    <div className="rangee" style={{ gap: 10, flexWrap: "wrap", marginBottom: 9 }}>
                      <button className="lien-constat" onClick={() => ouvrirConstat(x.constat)}>{x.constat} →</button>
                      <Gravite gravite={x.gravite} />
                      <span className="sous">{nomChantier(audit.chantiers, x.chantier)} · {x.question}</span>
                    </div>
                    <p className="redaction clause-proposee">{x.redaction}</p>
                    <div className="sous" style={{ marginTop: 10 }}>
                      Justifié par <Renvoi nom={x.appui.document} clause={x.appui.clause} page={x.appui.page} compact />
                    </div>
                  </div>
                ))}
            </div>
          );
        })}

        {sansMecanisme.length > 0 && (
          <div className="carte" style={{ marginTop: 26 }}>
            <h3 style={{ marginBottom: 8 }}>Constats sans traduction contractuelle</h3>
            <p className="sous" style={{ marginBottom: 12 }}>
              Ils figurent au rapport comme points d'information : rien n'y appelle de clause.
            </p>
            {sansMecanisme.map((c) => (
              <div key={c.id} className="ligne-plate">
                <button className="lien-constat" onClick={() => ouvrirConstat(c.id)}>{c.id}</button>
                <div>
                  <b>{c.question}</b>
                  <div className="sous">{c.valeur}</div>
                </div>
                <span className="droite"><Gravite gravite={c.gravite} /></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
