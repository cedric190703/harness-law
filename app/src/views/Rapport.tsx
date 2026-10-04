// Le rapport, lu comme un document.
//
// C'est le volet de gauche, et le changement qui compte : le juriste ne parcourt
// pas une liste de fiches, il lit son rapport. Les passages qui viennent d'un
// constat portent son numéro en exposant et s'ouvrent d'un clic sur la preuve,
// à droite. Ce qui n'a pas été lu est posé en tête, parce que cela borne tout.

import type { Audit, Bloc } from "../types";
import { Gravite, classe } from "../components/ui";
import { choisir, useEtat } from "../store";

export function Rapport({ audit }: { audit: Audit }) {
  const choisi = useEtat((e) => e.choisi);
  return (
    <article className="rapport-lu">
      {audit.blocs.map((b, i) => (
        <BlocLu key={i} bloc={b} choisi={choisi} />
      ))}
      <div className="fin-rapport">
        Rapport établi par Visa · {audit.moteur.extraction}. La vérification reste celle de l'avocat : chaque
        renvoi permet de la faire sur la pièce.
      </div>
    </article>
  );
}

function BlocLu({ bloc: b, choisi }: { bloc: Bloc; choisi: string | null }) {
  if (b.type === "titre") {
    const H = b.niveau === 1 ? "h1" : b.niveau === 2 ? "h2" : "h3";
    return <H className={`t${b.niveau}`}>{b.texte}</H>;
  }

  if (b.type === "paragraphe") return <p className={b.discret ? "discret" : ""}>{b.texte}</p>;

  if (b.type === "bornes") {
    const rien = !b.illisibles.length && !b.ecartes.length && !b.manquants.length;
    return (
      <aside className="bornes">
        <div className="bornes-tete">
          <b>
            {b.lu} pièces dépouillées sur {b.verse} versées
          </b>
          {rien ? (
            <span> — rien n'a été écarté, et la liste de demandes est satisfaite.</span>
          ) : (
            <span> — les conclusions qui suivent ne portent que sur ce qui a été lu.</span>
          )}
        </div>
        {b.illisibles.length > 0 && (
          <Borne titre={`${b.illisibles.length} non lue${b.illisibles.length > 1 ? "s" : ""}`} grave>
            {b.illisibles.map((d) => (
              <li key={d.id}>
                <b>{d.nom}</b> — {d.pourquoi}
              </li>
            ))}
          </Borne>
        )}
        {b.ecartes.length > 0 && (
          <Borne titre={`${b.ecartes.length} écartée${b.ecartes.length > 1 ? "s" : ""}`}>
            {b.ecartes.map((d) => (
              <li key={d.id}>
                <b>{d.nom}</b> — {d.pourquoi}
              </li>
            ))}
          </Borne>
        )}
        {b.manquants.length > 0 && (
          <Borne titre={`${b.manquants.length} demande${b.manquants.length > 1 ? "s" : ""} sans réponse`} grave>
            {b.manquants.map((m) => (
              <li key={m.code}>
                <b>{m.code}</b> {m.quoi} — {m.etat === "manquant" ? "non reçu" : m.detail}
              </li>
            ))}
          </Borne>
        )}
      </aside>
    );
  }

  if (b.type === "constat") {
    const actif = choisi === b.cle;
    return (
      <div className={`bloc-constat g-${classe(b.gravite)} ${actif ? "actif" : ""}`}>
        <button className="constat-texte" onClick={() => choisir(b.cle)} title="Voir la preuve">
          <span className="chapeau">
            <Gravite gravite={b.gravite} />
            <span className="question">{b.question}</span>
            {b.relu && <span className="vu">✓ relu</span>}
            {b.corrige && <span className="vu ecrit">rédigé par vous</span>}
          </span>
          <p>
            {b.texte}
            <sup className="exposant">{b.id}</sup>
          </p>
          {b.renvoi.document && (
            <span className="renvoi-ligne">
              {b.renvoi.document}
              {b.renvoi.clause ? `, ${b.renvoi.clause}` : ""}
              {b.renvoi.page ? `, p. ${b.renvoi.page}` : ""}
              {b.renvoi.reconnaissance ? " — lu par reconnaissance" : ""}
            </span>
          )}
        </button>
        {b.impact && <p className="impact">{b.impact}</p>}
        {b.note && <p className="note-juriste">Note : {b.note}</p>}
      </div>
    );
  }

  if (b.type === "epreuve") {
    return (
      <div className={`bloc-epreuve v-${b.verdict.replace(/\s/g, "-")}`}>
        <span className="chapeau">
          <b>{b.question}</b>
          <span className="verdict">{b.verdict}</span>
        </span>
        <p className="affirmation">« {b.affirmation} »</p>
        <p>{b.texte}</p>
        {b.appuis.length > 0 && (
          <span className="renvoi-ligne">
            Établi par{" "}
            {b.appuis.map((a, i) => (
              <span key={a}>
                {i > 0 && ", "}
                {a}
              </span>
            ))}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bloc-clause">
      <span className="chapeau">
        <span className="code">{b.constat}</span>
        <Gravite gravite={b.gravite} />
        <span className="question">{b.question}</span>
      </span>
      <p>{b.texte}</p>
    </div>
  );
}

function Borne({ titre, grave, children }: { titre: string; grave?: boolean; children: React.ReactNode }) {
  return (
    <details className={`borne ${grave ? "grave" : ""}`}>
      <summary>{titre}</summary>
      <ul>{children}</ul>
    </details>
  );
}
