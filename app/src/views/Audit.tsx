// La sortie imprimable : le journal d'audit.
//
// C'est la pièce qu'on met au dossier client. Elle ne reprend pas l'écran : elle
// donne ce qu'un relecteur doit pouvoir contrôler sans l'application — l'étendue
// de la revue, chaque constat avec son renvoi et son passage, les réponses du
// vendeur, les clauses proposées, le journal des agents, et la signature.
//
// Visible seulement à l'impression (@media print), d'où le `print:block`.

import type { Audit } from "../types";

export function JournalDAudit({ audit }: { audit: Audit }) {
  const cv = audit.couverture;
  const g = (["critique", "élevée", "moyenne", "faible"] as const).map((x) => [x, audit.constats.filter((c) => c.gravite === x).length] as const).filter(([, n]) => n);

  return (
    <div className="impression">
      <h1>{audit.nomDossier} — journal d'audit</h1>
      <p className="chapeau-impression">
        {audit.operation}
        {audit.cible ? ` · ${audit.cible}` : ""} · conseil de {audit.cote}
        <br />
        Revue arrêtée au {audit.dateReference} · passage du {new Date(audit.lanceLe).toLocaleString("fr-FR")} ·{" "}
        {audit.travail.relus} constats relus sur {audit.constats.length}
        <br />
        Extraction : {audit.moteur.extraction}.{" "}
        {audit.moteur.reconnaissance.employee
          ? `Scans lus par ${audit.moteur.reconnaissance.modele} — les passages qui en viennent sont à confirmer sur l'original.`
          : ""}{" "}
        Droit applicable : {audit.moteur.droit}.
      </p>

      <h2>Étendue de la revue</h2>
      <p>
        {cv.depouilles} pièces dépouillées sur {cv.total} versées. {g.map(([x, n]) => `${n} ${x}`).join(", ")}.
      </p>
      {cv.illisibles.length > 0 && (
        <>
          <h3>Pièces non lues</h3>
          <ul>
            {cv.illisibles.map((d) => (
              <li key={d.id}>
                <b>{d.nom}</b> — {d.pourquoi}
              </li>
            ))}
          </ul>
        </>
      )}
      {cv.ecartes.length > 0 && (
        <>
          <h3>Pièces écartées</h3>
          <ul>
            {cv.ecartes.map((d) => (
              <li key={d.id}>
                <b>{d.nom}</b> — {d.pourquoi}
              </li>
            ))}
          </ul>
        </>
      )}
      {audit.demandes.manquants.length > 0 && (
        <>
          <h3>Liste de demandes restée sans réponse</h3>
          <ul>
            {audit.demandes.manquants.map((m) => (
              <li key={m.code}>
                <b>{m.code}</b> {m.quoi} — {m.etat === "manquant" ? "non reçu" : m.detail}
              </li>
            ))}
          </ul>
        </>
      )}
      {audit.parcours.sansSuite.length > 0 && (
        <>
          <h3>Pièces ouvertes sans rien donner</h3>
          <ul>
            {audit.parcours.sansSuite.map((l) => (
              <li key={l.id}>{l.nom}</li>
            ))}
          </ul>
        </>
      )}

      <h2>Constats</h2>
      {audit.constats.map((c) => (
        <div key={c.cle} className="constat-impression">
          <div className="titre-constat">
            {c.id} — {c.gravite.toUpperCase()} — {c.question}
            {c.nonEtabli ? " — fait non établi" : ""}
            {c.relu ? " — relu" : ""}
          </div>
          <p>{c.correction ?? c.redaction}</p>
          {c.provenance.extrait ? (
            <>
              <p className="extrait-impression">« {c.provenance.extrait} »</p>
              <p className="renvoi-impression">
                Source : {c.provenance.nomRetenu}
                {c.provenance.clause ? `, ${c.provenance.clause}` : ""}
                {c.provenance.page ? `, p. ${c.provenance.page}` : ""}
                {c.provenance.origineTexte?.par === "reconnaissance" ? " (lu par reconnaissance de caractères)" : ""}
                {" · "}
                {c.provenance.parcourus.length} pièces parcourues, {c.provenance.consultes.length} consultées.
              </p>
            </>
          ) : (
            <p className="renvoi-impression">Aucun passage : le dossier ne porte pas l'information.</p>
          )}
          {c.provenance.ecartes.length > 0 && (
            <p className="renvoi-impression">
              Écarté en route : {c.provenance.ecartes.map((e) => `${e.nom} (${e.pourquoi.replace(/\.$/, "")})`).join(" ; ")}.
            </p>
          )}
          {c.impact && <p>Conséquence pour {audit.cote} : {c.impact}</p>}
          {c.droit?.resultat?.verifie && c.droit.resultat.article && (
            <p className="renvoi-impression">
              Droit applicable : {c.droit.resultat.article.reference} ({c.droit.resultat.article.etat},{" "}
              {c.droit.resultat.article.identifiant}).
            </p>
          )}
          {c.spa && <p>Au contrat de cession — {c.spa.mecanisme} : {c.spa.redaction}</p>}
          {c.note && <p>Note du dossier : {c.note}</p>}
        </div>
      ))}

      <h2>Réponses du vendeur</h2>
      {audit.epreuves.map((e) => (
        <div key={e.question} className="constat-impression">
          <div className="titre-constat">
            {e.question} — {e.verdict}
          </div>
          <p className="extrait-impression">« {e.affirmation} »</p>
          <p>{e.pourquoi}</p>
          {e.appuis.length > 0 && (
            <p className="renvoi-impression">
              Établi par {e.appuis.map((a) => `${a.constat} (${[a.document, a.clause, a.page ? `p. ${a.page}` : null].filter(Boolean).join(", ")})`).join(" ; ")}.
            </p>
          )}
        </div>
      ))}

      <h2>Journal des agents</h2>
      <table className="journal-impression">
        <tbody>
          {audit.journal.map((e, i) => (
            <tr key={i}>
              <td>{e.t.slice(11, 19)}</td>
              <td>{e.acteur}</td>
              <td>
                {e.action}
                {e.detail ? ` — ${e.detail}` : ""}
              </td>
              <td>{e.outil ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="signature">
        Relu et validé par ______________________________ Date ____________ Signature ____________
        <br />
        La vérification des constats relève de l'avocat. Chaque renvoi ci-dessus permet de la faire sur la pièce.
      </div>
    </div>
  );
}
