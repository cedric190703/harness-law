// Comment Visa a conclu, sur une affirmation donnée.
//
// On choisit une ligne en haut, et le fil se déroule : chaque pas apparaît dans
// l'ordre où il a été franchi, jusqu'à la conclusion. Un pas se clique pour
// être lu en entier — avec, s'il y en a une, la requête exacte envoyée à la base.

import { useEffect, useState } from "react";
import { FilRaisonnement } from "../components/FilRaisonnement";
import { Jeton } from "../components/ui";
import { construireRaisonnement, quoiFaire, type PasRaisonnement } from "../engine/raisonnement";
import { ouvrirAffirmation, useEtat } from "../store";

export function Raisonnement() {
  const dossier = useEtat((e) => e.dossier);
  const choisie = useEtat((e) => e.affirmationOuverte);
  const [pasOuvert, setPasOuvert] = useState<string | null>(null);

  const affirmations = dossier.affirmations;
  const a = affirmations.find((x) => x.id === choisie) ?? affirmations[0] ?? null;

  // Changer d'affirmation referme le pas qu'on lisait : il n'existe plus.
  useEffect(() => setPasOuvert(null), [a?.id]);

  if (!a) {
    return (
      <div className="vue">
        <div className="vide">
          <h3>Aucun contrôle n'a encore été passé</h3>
          <p>Le fil du raisonnement se dessine à partir d'un contrôle. Lancez-en un depuis l'accueil.</p>
        </div>
      </div>
    );
  }

  const pas = construireRaisonnement(a, dossier.dateDesFaits);
  const lu = pas.find((p) => p.id === pasOuvert) ?? null;

  return (
    <div className="vue pleine" style={{ position: "relative" }}>
      <div className="choix-affirmation">
        <span className="choix-titre">Quelle affirmation ?</span>
        <div className="choix-liste">
          {affirmations.map((x) => (
            <button
              key={x.id}
              className={`puce-affirmation c-${x.verdict} ${x.id === a.id ? "actif" : ""}`}
              onClick={() => ouvrirAffirmation(x.id)}
              title={x.phrase}
            >
              <span className="rond" />
              {x.id}
            </button>
          ))}
        </div>
      </div>

      <div className="fil-entete">
        <div className="fil-phrase">
          <Jeton verdict={a.verdict} />
          <span>{a.phrase}</span>
        </div>
        <div className="fil-cite">
          {a.citation ? (
            <>
              Cité comme <b>{a.citation}</b>
            </>
          ) : (
            "Aucune référence citée"
          )}
        </div>
      </div>

      <FilRaisonnement pas={pas} cle={a.id} pasOuvert={pasOuvert} onOuvrir={setPasOuvert} />

      {lu ? (
        <LecturePas pas={lu} onFermer={() => setPasOuvert(null)} />
      ) : (
        <aside className="tiroir fil-tiroir">
          <header>
            <h3>La conclusion</h3>
            <div className="sous">Ce que Visa retient, au bout de la chaîne.</div>
          </header>
          <div className="liste" style={{ padding: "16px 20px" }}>
            <div className="rangee" style={{ marginBottom: 14 }}>
              <Jeton verdict={a.verdict} />
              <span className="sous">le plus sévère des quatre contrôles</span>
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.6 }}>{quoiFaire(a)}</p>
            <div className="sous" style={{ marginTop: 18, lineHeight: 1.55 }}>
              Cliquez n'importe quel pas du fil pour le lire en entier : ce que Visa a fait, ce qu'il a
              constaté, et la requête exacte qu'il a envoyée à la base.
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

function LecturePas({ pas, onFermer }: { pas: PasRaisonnement; onFermer: () => void }) {
  return (
    <aside className="tiroir fil-tiroir">
      <header>
        <div className="rangee" style={{ alignItems: "flex-start" }}>
          <div>
            <div className="pas-genre" style={{ marginBottom: 4 }}>
              Pas {pas.ordre}
            </div>
            <h3>{pas.titre}</h3>
          </div>
          <button className="bouton discret sm" onClick={onFermer} aria-label="Fermer">
            ✕
          </button>
        </div>
        {pas.verdict && (
          <div style={{ marginTop: 11 }}>
            <Jeton verdict={pas.verdict} />
          </div>
        )}
      </header>

      <div className="liste" style={{ padding: "16px 20px 24px" }}>
        <Bloc titre="Ce que Visa a fait">{pas.action}</Bloc>

        {pas.requete && (
          <Bloc titre="La requête envoyée">
            <pre className="requete">{pas.requete}</pre>
            <div className="sous" style={{ marginTop: 7 }}>
              Visa va chercher le texte lui-même. Il ne se fie jamais à ce que le modèle croit savoir.
            </div>
          </Bloc>
        )}

        {pas.constat && (
          <Bloc titre="Ce qu'il a constaté">
            <div className="citation">{pas.constat}</div>
          </Bloc>
        )}

        {pas.deduction && <Bloc titre="Ce qu'il en déduit">{pas.deduction}</Bloc>}

        {pas.outil && (
          <div className="sous" style={{ marginTop: 6, paddingTop: 12, borderTop: "1px solid var(--trait)" }}>
            Outil employé : <b style={{ color: "var(--encre-2)" }}>{pas.outil}</b>
          </div>
        )}
      </div>
    </aside>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <span className="etiquette">{titre}</span>
      <div style={{ fontSize: 14.5, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}
