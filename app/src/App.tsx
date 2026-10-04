// L'ossature. Cinq écrans numérotés, dans l'ordre où on les traverse : on ne
// cache rien derrière un menu, et on ne demande jamais au juriste de deviner
// où il en est.

import { Accueil } from "./views/Accueil";
import { Nouvelle } from "./views/Nouvelle";
import { Controle } from "./views/Controle";
import { Rapport } from "./views/Rapport";
import { Journal } from "./views/Journal";
import { aller, afficherResultat, lancerLeControle, useEtat, type Ecran } from "./store";
import { compter, formaterDate } from "./engine/etapes";
import { MOT, ORDRE, Jeton } from "./components/ui";

const ECRANS: { id: Ecran; nom: string; num: string; soustitre: string; intro: string }[] = [
  {
    id: "accueil",
    nom: "Accueil",
    num: "1",
    soustitre: "Vos dossiers",
    intro: "Visa vérifie chaque phrase d'un texte juridique sur la source officielle, et garde la preuve.",
  },
  {
    id: "nouvelle",
    nom: "Soumettre un texte",
    num: "2",
    soustitre: "Nouveau contrôle",
    intro: "Collez le texte et indiquez la date des faits. C'est elle qui décide quelle version s'applique.",
  },
  {
    id: "controle",
    nom: "Le déroulé",
    num: "3",
    soustitre: "Comment Visa a procédé",
    intro: "Les six étapes du contrôle, de gauche à droite. Cliquez une carte pour voir ses tâches une par une.",
  },
  {
    id: "rapport",
    nom: "Le rapport",
    num: "4",
    soustitre: "Affirmation par affirmation",
    intro: "Une ligne par affirmation. Ouvrez-en une pour voir les quatre contrôles et le texte officiel.",
  },
  {
    id: "journal",
    nom: "Le journal d'audit",
    num: "5",
    soustitre: "La pièce pour le dossier",
    intro: "Sources, identifiants, versions comparées, verdicts, relecture. Prêt pour le guide CNB.",
  },
];

export function App() {
  const ecran = useEtat((e) => e.ecran);
  const dossier = useEtat((e) => e.dossier);
  const avancement = useEtat((e) => e.avancement);
  const enCours = useEtat((e) => e.enCours);
  const c = compter(dossier.affirmations);
  const courant = ECRANS.find((e) => e.id === ecran)!;
  const relues = dossier.affirmations.filter((a) => a.valideParLeJuriste).length;

  return (
    <div className="app">
      <aside className="cote">
        <div className="marque">
          <span className="sceau">V</span>
          <div>
            <b>Visa</b>
            <small>Le contrôle des sources juridiques</small>
          </div>
        </div>

        <div className="cote-titre">Le contrôle, dans l'ordre</div>
        {ECRANS.map((e) => (
          <button key={e.id} className={`onglet ${ecran === e.id ? "actif" : ""}`} onClick={() => aller(e.id)}>
            <span className="num">{e.num}</span>
            {e.nom}
            {e.id === "controle" && enCours && <span className="en-cours-point" style={{ marginLeft: "auto" }} />}
            {e.id === "rapport" && dossier.affirmations.length > 0 && !enCours && (
              <span className="apres">{dossier.affirmations.length}</span>
            )}
            {e.id === "journal" && dossier.affirmations.length > 0 && !enCours && (
              <span className="apres">
                {relues}/{dossier.affirmations.length}
              </span>
            )}
          </button>
        ))}

        <div className="cote-pied">
          <div style={{ marginBottom: 6 }}>
            Dossier en cours
            <br />
            <b>{dossier.nom.split(" — ")[0]}</b>
          </div>
          <div>Faits du {formaterDate(dossier.dateDesFaits)}</div>
          <div style={{ marginTop: 10, lineHeight: 1.5 }}>
            Sans preuve,
            <br />
            rien n'est vert.
          </div>
        </div>
      </aside>

      <main className="corps">
        <div className="entete">
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                color: "var(--encre-3)",
                fontWeight: 650,
                marginBottom: 5,
              }}
            >
              Étape {courant.num} · {courant.soustitre}
            </div>
            <h1>{courant.nom}</h1>
            <p className="intro">{courant.intro}</p>
          </div>

          <div className="actions">
            {ecran === "controle" && (
              <div className="etapes-ruban" style={{ marginRight: 6 }}>
                {dossier.etapes.map((e, i) => (
                  <span key={e.id} className={`pas ${e.etat === "terminée" ? "fait" : ""}`}>
                    {i + 1}. {e.titre}
                  </span>
                ))}
              </div>
            )}
            {dossier.affirmations.length > 0 && ecran !== "controle" && ecran !== "nouvelle" && (
              <span className="rangee" style={{ gap: 7 }}>
                {ORDRE.filter((v) => c[v]).map((v) => (
                  <Jeton key={v} verdict={v} texte={`${c[v]} ${MOT[v].toLowerCase()}`} />
                ))}
              </span>
            )}
            {avancement === 6 ? (
              <button className="bouton" onClick={lancerLeControle}>
                Rejouer le contrôle
              </button>
            ) : (
              <button className="bouton fort" onClick={enCours ? afficherResultat : lancerLeControle} disabled={enCours}>
                {enCours ? "Contrôle en cours…" : "Lancer le contrôle"}
              </button>
            )}
          </div>
        </div>

        {ecran === "accueil" && <Accueil />}
        {ecran === "nouvelle" && <Nouvelle />}
        {ecran === "controle" && <Controle />}
        {ecran === "rapport" && <Rapport />}
        {ecran === "journal" && <Journal />}
      </main>
    </div>
  );
}
