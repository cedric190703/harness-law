// Le détail d'une étape : ses tâches, séparées, dans l'ordre où elles se sont
// faites, chacune avec sa preuve. C'est le niveau où le juriste vérifie que
// Visa n'a pas sauté une ligne.

import type { Affirmation, Etape } from "../types";
import { CONTROLES } from "../engine/etapes";
import { Jeton } from "./ui";

export function TiroirEtape({
  etape,
  affirmations,
  onFermer,
  onAffirmation,
}: {
  etape: Etape;
  affirmations: Affirmation[];
  onFermer: () => void;
  onAffirmation: (id: string) => void;
}) {
  const parId = new Map(affirmations.map((a) => [a.id, a]));
  const faites = etape.taches.filter((t) => t.etat === "terminée").length;

  return (
    <aside className="tiroir">
      <header>
        <div className="rangee">
          <div>
            <h3>{etape.titre}</h3>
            <div className="sous">{etape.explication}</div>
          </div>
          <button className="bouton discret sm" onClick={onFermer} aria-label="Fermer le détail">
            ✕
          </button>
        </div>
        <div className="rangee" style={{ marginTop: 13, gap: 14, flexWrap: "wrap" }}>
          <span className="sous">
            <b style={{ color: "var(--encre)" }}>
              {faites} tâche{faites > 1 ? "s" : ""}
            </b>{" "}
            sur {etape.taches.length}
          </span>
          <span className="sous" style={{ marginLeft: "auto" }}>
            {etape.outil}
          </span>
        </div>
      </header>

      <div className="liste">
        {etape.id === "controles" ? (
          // Pour les quatre contrôles, la bonne unité n'est pas la tâche mais
          // l'affirmation : le juriste veut la ligne qui coince.
          <ParControle affirmations={affirmations} onAffirmation={onAffirmation} />
        ) : (
          etape.taches.map((t) => {
            const a = t.affirmationId ? parId.get(t.affirmationId) : null;
            return (
              <button
                key={t.id}
                className={`tache ${a ? "cliquable" : ""}`}
                onClick={a ? () => onAffirmation(a.id) : undefined}
              >
                <div className="haut">
                  <span className={`marque-etat ${t.etat === "terminée" ? "ok" : "attente"}`}>
                    {t.etat === "terminée" ? "✓" : t.etat === "en cours" ? "◍" : "○"}
                  </span>
                  <span className="lib">{t.libelle}</span>
                  {a && <span style={{ marginLeft: "auto" }}><Jeton verdict={a.verdict} /></span>}
                </div>
                {t.detail && <div className="det">{t.detail}</div>}
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

/** Les quatre contrôles, chacun suivi des affirmations qu'il met en cause. */
function ParControle({
  affirmations,
  onAffirmation,
}: {
  affirmations: Affirmation[];
  onAffirmation: (id: string) => void;
}) {
  return (
    <>
      {CONTROLES.map((ctl) => {
        const ennuis = affirmations.filter((a) => {
          const v = a.controles.find((c) => c.id === ctl.id)?.verdict;
          return v === "rouge" || v === "orange";
        });
        return (
          <div key={ctl.id} style={{ padding: "6px 4px 14px" }}>
            <div style={{ padding: "0 8px 7px" }}>
              <div style={{ fontWeight: 650, fontSize: 14 }}>{ctl.titre}</div>
              <div className="sous" style={{ fontSize: 12.5 }}>{ctl.question}</div>
            </div>
            {ennuis.length === 0 ? (
              <div className="tache">
                <div className="haut">
                  <span className="marque-etat ok">✓</span>
                  <span className="lib" style={{ fontWeight: 450, color: "var(--encre-2)" }}>
                    Les {affirmations.length} affirmations passent ce contrôle.
                  </span>
                </div>
              </div>
            ) : (
              ennuis.map((a) => {
                const c = a.controles.find((x) => x.id === ctl.id)!;
                return (
                  <button key={a.id} className="tache cliquable" onClick={() => onAffirmation(a.id)}>
                    <div className="haut">
                      <span className="marque-etat" style={{ color: `var(--${c.verdict})` }}>
                        ●
                      </span>
                      <span className="lib">
                        {a.id} — {c.reponse}
                      </span>
                      <span style={{ marginLeft: "auto" }}>
                        <Jeton verdict={c.verdict} />
                      </span>
                    </div>
                    {c.preuve && <div className="det">{c.preuve}</div>}
                  </button>
                );
              })
            )}
          </div>
        );
      })}
    </>
  );
}
