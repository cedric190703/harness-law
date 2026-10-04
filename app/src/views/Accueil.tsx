// L'accueil : pourquoi Visa existe, et le dossier en cours.
// Un écran qu'un juriste doit comprendre sans qu'on lui explique.

import { compter, formaterDate } from "../engine/etapes";
import { accesReel, environnement } from "../engine/piste";
import { afficherResultat, aller, lancerLeControle, useEtat } from "../store";
import { BandeauSource, BarreSynthese, Jeton, MOT, ORDRE, SENS } from "../components/ui";

export function Accueil() {
  const dossier = useEtat((e) => e.dossier);
  const avancement = useEtat((e) => e.avancement);
  const fait = avancement === 6;
  const c = compter(dossier.affirmations);

  return (
    <div className="vue">
      <div className="large">
        <div className="carte" style={{ padding: "26px 28px" }}>
          <h2>Visa vérifie, phrase par phrase, ce que l'IA a écrit.</h2>
          <p className="sous" style={{ marginTop: 9, maxWidth: "72ch", fontSize: 14.5 }}>
            Vous collez une note, des conclusions ou un mémo rédigé avec l'aide d'une IA, et vous indiquez la
            date des faits. Visa retrouve chaque source dans le texte officiel, pose quatre questions
            toujours les mêmes, et garde la preuve de ce qu'il a trouvé.
          </p>
          <p style={{ marginTop: 14, fontSize: 14.5, maxWidth: "72ch" }}>
            <b>La règle de la maison : sans preuve, rien n'est vert.</b> Si une base est en panne ou si une
            citation reste floue, la ligne passe au gris « non vérifié ». Jamais au vert par défaut.
          </p>
          <div style={{ marginTop: 20 }}>
            <BandeauSource reel={accesReel()} environnement={environnement()} />
          </div>
        </div>

        <div className="carte">
          <div className="rangee" style={{ marginBottom: 14 }}>
            <h3>Les quatre questions posées à chaque affirmation</h3>
          </div>
          <div className="colonnes" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
            {[
              ["Elle existe ?", "La référence se trouve-t-elle dans une base officielle — Légifrance, Judilibre ? Sinon, elle est inventée."],
              ["En vigueur à la date des faits ?", "Un texte voté après les faits ne s'applique pas. Visa compare la version citée et la version applicable."],
              ["Quel rang ?", "Une circulaire ne lie pas le juge. Visa place la source dans la hiérarchie des normes."],
              ["Elle dit bien cela ?", "Visa retrouve le passage mot pour mot dans le texte officiel. C'est l'erreur la plus difficile à voir."],
            ].map(([titre, quoi], i) => (
              <div key={titre} style={{ borderTop: "2px solid var(--trait)", paddingTop: 11 }}>
                <div style={{ fontSize: 11, color: "var(--encre-3)", fontWeight: 700, letterSpacing: "0.08em" }}>
                  CONTRÔLE {i + 1}
                </div>
                <div style={{ fontWeight: 650, marginTop: 4 }}>{titre}</div>
                <div className="sous" style={{ marginTop: 5 }}>{quoi}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="carte">
          <h3 style={{ marginBottom: 12 }}>Ce que veulent dire les quatre couleurs</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ORDRE.map((v) => (
              <div key={v} className="rangee" style={{ alignItems: "flex-start", gap: 13 }}>
                <span style={{ width: 118, flex: "none" }}>
                  <Jeton verdict={v} />
                </span>
                <span className="sous" style={{ color: "var(--encre-2)" }}>{SENS[v]}</span>
              </div>
            ))}
          </div>
        </div>

        <h3 style={{ margin: "30px 0 12px" }}>Vos dossiers</h3>
        <button className="dossier-ligne" onClick={() => (fait ? afficherResultat() : lancerLeControle())}>
          <div className="quoi">
            <span className="nom">{dossier.nom}</span>
            <div className="meta">
              {dossier.matiere} · faits du {formaterDate(dossier.dateDesFaits)} · {dossier.redigePar}
            </div>
          </div>
          <div className="droite">
            {fait ? (
              <>
                {ORDRE.filter((v) => c[v]).map((v) => (
                  <Jeton key={v} verdict={v} texte={`${c[v]} ${MOT[v].toLowerCase()}`} />
                ))}
                <span className="bouton sm">Ouvrir →</span>
              </>
            ) : (
              <span className="bouton fort sm">Lancer le contrôle</span>
            )}
          </div>
        </button>

        {fait && (
          <div className="carte" style={{ marginTop: 18 }}>
            <div className="rangee" style={{ marginBottom: 13 }}>
              <h3>Ce que le contrôle a trouvé</h3>
              <button className="bouton sm" style={{ marginLeft: "auto" }} onClick={() => aller("rapport")}>
                Voir le rapport
              </button>
            </div>
            <BarreSynthese compte={c} total={dossier.affirmations.length} />
            <p className="sous" style={{ marginTop: 14, marginBottom: 0 }}>
              {c.rouge > 0 ? (
                <>
                  <b style={{ color: "var(--rouge)" }}>
                    {c.rouge} affirmation{c.rouge > 1 ? "s" : ""} ne peut être déposée en l'état.
                  </b>{" "}
                  Une référence n'existe pas, un article est abrogé, un arrêt dit l'inverse.
                </>
              ) : (
                "Aucune affirmation bloquante."
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
