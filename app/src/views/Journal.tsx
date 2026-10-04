// Le journal d'audit. C'est la pièce qu'on met au dossier client, et celle que
// demande le guide du CNB du 17 mars 2026 : qui, quand, avec quel outil, sur
// quelle source, et qui a relu.
//
// L'export se fait par l'impression du navigateur : le journal est du texte et
// un tableau, il n'y a aucune raison d'en faire autre chose.

import { compter, formaterDate } from "../engine/etapes";
import { accesReel, environnement } from "../engine/piste";
import { MODELES } from "../engine/mistral";
import { toutValider, useEtat } from "../store";
import { BandeauSource, Jeton, MOT, ORDRE } from "../components/ui";

export function Journal() {
  const dossier = useEtat((e) => e.dossier);
  const c = compter(dossier.affirmations);
  const relues = dossier.affirmations.filter((a) => a.valideParLeJuriste).length;
  const total = dossier.affirmations.length;

  if (total === 0) {
    return (
      <div className="vue">
        <div className="vide">
          <h3>Le journal est vide</h3>
          <p>Il se remplit au fur et à mesure du contrôle.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vue">
      <div className="large">
        <div className="carte">
          <div className="rangee" style={{ alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <h2>{dossier.nom}</h2>
              <div className="sous" style={{ marginTop: 5 }}>
                {dossier.matiere} · faits du {formaterDate(dossier.dateDesFaits)}
              </div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 9 }}>
              {relues < total && (
                <button className="bouton sm" onClick={toutValider}>
                  Tout marquer comme relu
                </button>
              )}
              <button className="bouton fort sm" onClick={() => window.print()}>
                Exporter en PDF
              </button>
            </div>
          </div>

          <div className="puces-chiffres">
            <Fiche valeur={String(total)} libelle="affirmations vérifiées" />
            <Fiche valeur={`${c.rouge}`} libelle="bloquantes : à retirer ou corriger" />
            <Fiche valeur={`${c.orange}`} libelle="à revoir : date, rang ou portée" />
            <Fiche valeur={`${relues}/${total}`} libelle="relues et validées par le juriste" />
          </div>

          <div style={{ marginTop: 20 }}>
            <BandeauSource reel={accesReel()} environnement={environnement()} />
          </div>
        </div>

        <div className="carte">
          <h3 style={{ marginBottom: 12 }}>Ce qui a été employé</h3>
          <table className="journal-table">
            <tbody>
              <Rang quoi="Texte soumis, rédigé avec" valeur={dossier.redigePar} />
              <Rang quoi="Date des faits retenue" valeur={formaterDate(dossier.dateDesFaits)} />
              <Rang quoi="Contrôle passé le" valeur={new Date(dossier.verifieLe).toLocaleString("fr-FR")} />
              <Rang quoi="Découpage et contradiction" valeur={`Mistral — ${MODELES.raisonnement}`} />
              <Rang
                quoi="Bases interrogées"
                valeur={
                  accesReel()
                    ? `Légifrance et Judilibre, via PISTE (${environnement()})`
                    : "Sources mises en cache pour la démonstration — aucun appel en direct"
                }
              />
              <Rang
                quoi="Règle appliquée"
                valeur="Sans preuve retrouvée dans le texte officiel, aucune affirmation n'est portée au vert."
              />
            </tbody>
          </table>
        </div>

        <div className="carte">
          <div className="rangee" style={{ marginBottom: 13 }}>
            <h3>Affirmation par affirmation</h3>
            <span className="rangee" style={{ marginLeft: "auto", gap: 8 }}>
              {ORDRE.filter((v) => c[v]).map((v) => (
                <Jeton key={v} verdict={v} texte={`${c[v]} ${MOT[v].toLowerCase()}`} />
              ))}
            </span>
          </div>
          <table className="journal-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Verdict</th>
                <th>Source citée</th>
                <th>Retrouvée</th>
                <th>Version appliquée</th>
                <th>Rang</th>
                <th>Relue</th>
              </tr>
            </thead>
            <tbody>
              {dossier.affirmations.map((a) => {
                const vig = a.controles.find((x) => x.id === "vigueur");
                return (
                  <tr key={a.id}>
                    <td>
                      <b>{a.id}</b>
                    </td>
                    <td>
                      <Jeton verdict={a.verdict} />
                    </td>
                    <td>{a.citation ?? <span className="sous">aucune</span>}</td>
                    <td>
                      {a.source?.identifiant ? (
                        <code>{a.source.identifiant}</code>
                      ) : (
                        <span style={{ color: "var(--rouge)" }}>introuvable</span>
                      )}
                    </td>
                    <td>{vig?.preuve ?? <span className="sous">—</span>}</td>
                    <td>{a.source && a.source.base !== "introuvable" ? rangLisible(a.source.rang) : "—"}</td>
                    <td>{a.valideParLeJuriste ? "✓" : <span className="sous">en attente</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="sous" style={{ marginTop: 16, marginBottom: 0 }}>
            Ce journal consigne ce que Visa a trouvé, avec l'identifiant de chaque source. Il ne vaut pas
            consultation : la responsabilité du contenu déposé reste celle de l'avocat, et c'est pourquoi la
            colonne « relue » existe.
          </p>
        </div>
      </div>
    </div>
  );
}

function Fiche({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <div className="chiffre">
      <b>{valeur}</b>
      <span>{libelle}</span>
    </div>
  );
}

function Rang({ quoi, valeur }: { quoi: string; valeur: string }) {
  return (
    <tr>
      <td style={{ width: 240, color: "var(--encre-3)" }}>{quoi}</td>
      <td>{valeur}</td>
    </tr>
  );
}

function rangLisible(rang: string): string {
  return (
    {
      constitution: "Constitution",
      international: "Traité / droit de l'Union",
      loi: "Loi",
      reglement: "Décret ou arrêté",
      jurisprudence: "Jurisprudence",
      circulaire: "Circulaire — ne lie pas le juge",
    } as Record<string, string>
  )[rang] ?? rang;
}
