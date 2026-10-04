// Les chantiers de l'audit. Un juriste travaille par chantier et croise ensuite
// les constats entre eux : l'écran suit ce découpage plutôt que l'arborescence
// imposée par le vendeur.

import type { Audit } from "../types";
import { BarreGravites, Gravite } from "../components/ui";
import { aller, compterGravites, ouvrirConstat, poser } from "../store";

export function Chantiers({ audit }: { audit: Audit }) {
  return (
    <div className="vue">
      <div className="large">
        <div className="carte">
          <h3 style={{ marginBottom: 4 }}>{audit.constats.length} constats sur {audit.chantiers.length} chantiers</h3>
          <p className="sous" style={{ marginBottom: 16 }}>
            Le découpage suit les chantiers de l'audit, pas l'arborescence de la data room. Les constats qui se
            renforcent d'un chantier à l'autre sont signalés.
          </p>
          <BarreGravites constats={audit.constats} />
        </div>

        <div className="colonnes" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", marginTop: 18 }}>
          {audit.chantiers.map((ch) => {
            const constats = audit.constats.filter((c) => c.chantier === ch.id);
            const g = compterGravites(constats);
            const demandes = audit.demandes.lignes.filter((l) => prefixe(ch.id) === l.code[0]);
            const manquants = demandes.filter((l) => l.etat !== "reçu");
            const sans = audit.sansReponse.filter((s) => s.chantier === ch.id);
            return (
              <div key={ch.id} className="carte chantier">
                <div className="rangee" style={{ alignItems: "flex-start" }}>
                  <div>
                    <h3>{ch.nom}</h3>
                    <div className="sous">{ch.quoi}</div>
                  </div>
                  <span style={{ marginLeft: "auto", fontFamily: "var(--serif)", fontSize: 25 }}>{constats.length}</span>
                </div>

                <div className="rangee" style={{ gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                  {(["critique", "élevée", "moyenne", "faible"] as const)
                    .filter((x) => g[x])
                    .map((x) => <Gravite key={x} gravite={x} texte={`${g[x]} ${x}`} />)}
                </div>

                <div className="liste-constats">
                  {constats.map((c) => (
                    <button
                      key={c.id}
                      className={`mini-constat g-bord-${c.gravite === "élevée" ? "elevee" : c.gravite}`}
                      onClick={() => { poser({ chantierFiltre: null, graviteFiltre: null }); ouvrirConstat(c.id); }}
                    >
                      <span className="q">{c.question}</span>
                      <span className="v">{c.valeur}</span>
                    </button>
                  ))}
                  {!constats.length && <div className="sous">Aucun constat sur ce chantier.</div>}
                </div>

                {(manquants.length > 0 || sans.length > 0) && (
                  <div className="borne">
                    {manquants.length > 0 && (
                      <div>
                        <b>{manquants.length} pièce{manquants.length > 1 ? "s" : ""} manquante{manquants.length > 1 ? "s" : ""}</b> :{" "}
                        {manquants.map((m) => m.code).join(", ")}. Les conclusions de ce chantier s'arrêtent là.
                      </div>
                    )}
                    {sans.map((s) => (
                      <div key={s.sonde}>
                        <b>{s.question}</b> : {s.motif}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="carte" style={{ marginTop: 20 }}>
          <div className="rangee">
            <h3>Les constats qui se renforcent entre chantiers</h3>
            <button className="bouton sm" style={{ marginLeft: "auto" }} onClick={() => aller("constats")}>
              Tous les constats
            </button>
          </div>
          {audit.constats.filter((c) => c.liens.length).length === 0 ? (
            <p className="sous" style={{ marginTop: 8, marginBottom: 0 }}>Aucun recoupement relevé.</p>
          ) : (
            audit.constats
              .filter((c) => c.liens.length)
              .map((c) => (
                <div key={c.id} className="croisement">
                  <button className="lien-constat" onClick={() => ouvrirConstat(c.id)}>{c.id} — {c.question}</button>
                  <span className="sous"> se renforce de </span>
                  {c.liens.map((l) => {
                    const autre = audit.constats.find((x) => x.sonde === l || x.id === l);
                    return (
                      <button key={l} className="lien-constat" onClick={() => autre && ouvrirConstat(autre.id)}>
                        {autre ? `${autre.id} — ${autre.question}` : l}
                      </button>
                    );
                  })}
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}

/** La lettre que porte le code de la liste de demandes pour ce chantier. */
function prefixe(chantier: string): string {
  return { corporate: "C", contrats: "K", social: "S", fiscal: "F", contentieux: "L", donnees: "D" }[chantier] ?? "";
}
