"use client";

import { useMemo, useRef, useState } from "react";
import { DATE_FAITS_DEMO, MEMO_DEMO } from "@/demo/memo";
import { RANGS } from "@/lib/hierarchie";
import type {
  Affirmation,
  Controle,
  EntreeJournal,
  Evenement,
  ResultatAffirmation,
  Statut,
  VerificationSource,
} from "@/lib/types";

const STYLE: Record<Statut | "attente", { fond: string; trait: string; texte: string; libelle: string }> = {
  vert: { fond: "bg-vert-fond", trait: "border-vert", texte: "text-vert", libelle: "Vérifié" },
  orange: { fond: "bg-orange-fond", trait: "border-orange", texte: "text-orange", libelle: "À revoir" },
  rouge: { fond: "bg-rouge-fond", trait: "border-rouge", texte: "text-rouge", libelle: "Faux" },
  gris: { fond: "bg-gris-fond", trait: "border-gris", texte: "text-gris", libelle: "Non vérifiable" },
  attente: { fond: "bg-gris-fond/60 animate-pulse", trait: "border-trait", texte: "text-gris", libelle: "En cours…" },
};

const NOMS_CONTROLES: Record<Controle["nom"], string> = {
  existe: "Existe",
  date: "En vigueur à la date des faits",
  rang: "Rang dans la hiérarchie",
  contenu: "Dit vraiment ça",
};

export default function Visa() {
  const [texte, setTexte] = useState("");
  const [dateFaits, setDateFaits] = useState("");
  const [phase, setPhase] = useState<"saisie" | "analyse" | "fini">("saisie");
  const [affirmations, setAffirmations] = useState<Affirmation[]>([]);
  const [resultats, setResultats] = useState<Record<string, ResultatAffirmation>>({});
  const [journal, setJournal] = useState<EntreeJournal[]>([]);
  const [dateRetenue, setDateRetenue] = useState<string>("");
  const [selection, setSelection] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [debut, setDebut] = useState<string>("");
  const journalRef = useRef<HTMLDivElement>(null);

  async function lancer() {
    setPhase("analyse");
    setAffirmations([]);
    setResultats({});
    setJournal([]);
    setSelection(null);
    setErreur(null);
    setDebut(new Date().toISOString());
    const res = await fetch("/api/verifier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texte, dateFaits: dateFaits || null }),
    });
    if (!res.ok || !res.body) {
      setErreur(`Erreur ${res.status}`);
      setPhase("saisie");
      return;
    }
    const lecteur = res.body.getReader();
    const decodeur = new TextDecoder();
    let tampon = "";
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      tampon += decodeur.decode(value, { stream: true });
      const lignes = tampon.split("\n");
      tampon = lignes.pop() ?? "";
      for (const l of lignes) if (l.trim()) traiter(JSON.parse(l) as Evenement);
    }
    setPhase("fini");
  }

  function traiter(e: Evenement) {
    if (e.type === "journal") {
      setJournal((j) => [...j, e.entree]);
      requestAnimationFrame(() => journalRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }));
    } else if (e.type === "affirmations") {
      setAffirmations(e.affirmations);
      setDateRetenue(e.dateFaits);
    } else if (e.type === "resultat") {
      setResultats((r) => ({ ...r, [e.resultat.affirmation.id]: e.resultat }));
    } else if (e.type === "erreur") {
      setErreur(e.message);
    }
  }

  const synthese = useMemo(() => {
    const s: Record<Statut, number> = { vert: 0, orange: 0, rouge: 0, gris: 0 };
    for (const r of Object.values(resultats)) s[r.statut]++;
    return s;
  }, [resultats]);

  const choisi = selection ? resultats[selection] : null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print flex items-center justify-between border-b border-trait bg-white px-6 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-2xl font-semibold tracking-tight text-accent">Visa</span>
          <span className="text-sm text-gris">Chaque phrase, vérifiée sur le texte officiel.</span>
        </div>
        {phase !== "saisie" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              disabled={phase !== "fini"}
              className="rounded-md border border-accent px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent hover:text-white disabled:opacity-40"
            >
              Exporter le journal d&apos;audit
            </button>
            <button
              onClick={() => setPhase("saisie")}
              className="rounded-md px-3 py-1.5 text-sm text-gris hover:bg-gris-fond"
            >
              Nouveau texte
            </button>
          </div>
        )}
      </header>

      {phase === "saisie" ? (
        <Saisie
          texte={texte}
          setTexte={setTexte}
          dateFaits={dateFaits}
          setDateFaits={setDateFaits}
          lancer={lancer}
          erreur={erreur}
        />
      ) : (
        <>
          <div className="no-print grid flex-1 grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="border-r border-trait p-6">
              <Synthese synthese={synthese} total={affirmations.length} enCours={phase === "analyse"} date={dateRetenue} />
              <Document texte={texte} affirmations={affirmations} resultats={resultats} selection={selection} choisir={setSelection} />
            </section>
            <section className="flex flex-col bg-white">
              <div className="flex-1 overflow-auto p-6">
                {choisi ? (
                  <Detail r={choisi} dateFaits={dateRetenue} />
                ) : (
                  <Liste affirmations={affirmations} resultats={resultats} choisir={setSelection} />
                )}
                {erreur && <p className="mt-4 rounded bg-rouge-fond p-3 text-sm text-rouge">{erreur}</p>}
              </div>
              <Journal entrees={journal} refConteneur={journalRef} />
            </section>
          </div>
          <Audit
            texte={texte}
            debut={debut}
            dateFaits={dateRetenue}
            affirmations={affirmations}
            resultats={resultats}
            journal={journal}
            synthese={synthese}
          />
        </>
      )}
    </div>
  );
}

function Saisie(p: {
  texte: string;
  setTexte: (t: string) => void;
  dateFaits: string;
  setDateFaits: (d: string) => void;
  lancer: () => void;
  erreur: string | null;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="font-serif text-3xl font-semibold">Votre IA a écrit une note. Peut-on la plaider ?</h1>
      <p className="mt-2 text-gris">
        Collez un texte produit par ChatGPT, Legora, Hector ou tout autre outil. Visa retrouve chaque source sur
        Légifrance et Judilibre, vérifie qu&apos;elle existe, qu&apos;elle était en vigueur à la date des faits, son rang,
        et qu&apos;elle dit vraiment ce qu&apos;on lui fait dire.
      </p>
      <textarea
        value={p.texte}
        onChange={(e) => p.setTexte(e.target.value)}
        placeholder="Collez ici la note, les conclusions ou la consultation…"
        className="mt-6 h-80 w-full rounded-lg border border-trait bg-white p-4 font-serif text-[15px] leading-relaxed outline-none focus:border-accent"
      />
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          Date des faits
          <input
            type="date"
            value={p.dateFaits}
            onChange={(e) => p.setDateFaits(e.target.value)}
            className="rounded border border-trait bg-white px-2 py-1"
          />
        </label>
        <button
          onClick={() => {
            p.setTexte(MEMO_DEMO);
            p.setDateFaits(DATE_FAITS_DEMO);
          }}
          className="text-sm text-accent underline"
        >
          Charger l&apos;exemple
        </button>
        <button
          onClick={p.lancer}
          disabled={!p.texte.trim()}
          className="ml-auto rounded-lg bg-accent px-5 py-2.5 font-medium text-white disabled:opacity-40"
        >
          Vérifier
        </button>
      </div>
      {p.erreur && <p className="mt-4 rounded bg-rouge-fond p-3 text-sm text-rouge">{p.erreur}</p>}
    </main>
  );
}

function Synthese({
  synthese,
  total,
  enCours,
  date,
}: {
  synthese: Record<Statut, number>;
  total: number;
  enCours: boolean;
  date: string;
}) {
  const faits = synthese.vert + synthese.orange + synthese.rouge + synthese.gris;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
      <span className="mr-2 font-medium">
        {total === 0 ? "Lecture du texte…" : `${faits}/${total} affirmations vérifiées`}
        {enCours && total > 0 && faits < total && " …"}
      </span>
      {(["rouge", "orange", "vert", "gris"] as Statut[]).map((s) => (
        <span key={s} className={`rounded-full px-2.5 py-0.5 ${STYLE[s].fond} ${STYLE[s].texte}`}>
          {synthese[s]} {STYLE[s].libelle.toLowerCase()}
        </span>
      ))}
      {date && <span className="ml-auto text-gris">Date des faits : {formatDate(date)}</span>}
    </div>
  );
}

function Document({
  texte,
  affirmations,
  resultats,
  selection,
  choisir,
}: {
  texte: string;
  affirmations: Affirmation[];
  resultats: Record<string, ResultatAffirmation>;
  selection: string | null;
  choisir: (id: string) => void;
}) {
  const segments = useMemo(() => {
    const zones = affirmations
      .map((a) => ({ id: a.id, debut: texte.indexOf(a.passage), fin: 0 }))
      .filter((z) => z.debut >= 0)
      .map((z) => ({ ...z, fin: z.debut + affirmations.find((a) => a.id === z.id)!.passage.length }))
      .sort((a, b) => a.debut - b.debut);
    const res: { texte: string; id?: string }[] = [];
    let curseur = 0;
    for (const z of zones) {
      if (z.debut < curseur) continue;
      res.push({ texte: texte.slice(curseur, z.debut) });
      res.push({ texte: texte.slice(z.debut, z.fin), id: z.id });
      curseur = z.fin;
    }
    res.push({ texte: texte.slice(curseur) });
    return res;
  }, [texte, affirmations]);

  return (
    <article className="whitespace-pre-wrap rounded-lg border border-trait bg-white p-6 font-serif text-[15.5px] leading-[1.75]">
      {segments.map((s, i) => {
        if (!s.id) return <span key={i}>{s.texte}</span>;
        const r = resultats[s.id];
        const st = STYLE[r?.statut ?? "attente"];
        return (
          <mark
            key={i}
            onClick={() => choisir(s.id!)}
            className={`cursor-pointer rounded-sm border-b-2 px-0.5 text-encre ${st.fond} ${st.trait} ${
              selection === s.id ? "ring-2 ring-accent" : ""
            }`}
          >
            {s.texte}
            <sup className={`ml-0.5 font-sans text-[10px] font-semibold ${st.texte}`}>{s.id}</sup>
          </mark>
        );
      })}
    </article>
  );
}

function Liste({
  affirmations,
  resultats,
  choisir,
}: {
  affirmations: Affirmation[];
  resultats: Record<string, ResultatAffirmation>;
  choisir: (id: string) => void;
}) {
  const ordre: (Statut | "attente")[] = ["rouge", "orange", "gris", "vert", "attente"];
  const tries = [...affirmations].sort(
    (a, b) => ordre.indexOf(resultats[a.id]?.statut ?? "attente") - ordre.indexOf(resultats[b.id]?.statut ?? "attente"),
  );
  if (affirmations.length === 0) return <p className="text-gris">L&apos;extracteur lit le texte…</p>;
  return (
    <div className="space-y-2">
      <p className="mb-3 text-sm text-gris">Cliquez sur une affirmation pour voir la preuve.</p>
      {tries.map((a) => {
        const r = resultats[a.id];
        const st = STYLE[r?.statut ?? "attente"];
        return (
          <button
            key={a.id}
            onClick={() => choisir(a.id)}
            className={`block w-full rounded-lg border-l-4 p-3 text-left ${st.trait} ${st.fond}`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className={st.texte}>
                {a.id} · {st.libelle}
              </span>
            </div>
            <div className="mt-1 text-sm">{a.resume}</div>
            {r && r.statut !== "vert" && <div className="mt-1 text-xs text-gris">{r.message}</div>}
          </button>
        );
      })}
    </div>
  );
}

function Detail({ r, dateFaits }: { r: ResultatAffirmation; dateFaits: string }) {
  const st = STYLE[r.statut];
  return (
    <div>
      <div className={`rounded-lg border-l-4 p-4 ${st.trait} ${st.fond}`}>
        <div className={`text-xs font-bold uppercase tracking-wide ${st.texte}`}>
          {r.affirmation.id} · {st.libelle}
        </div>
        <p className="mt-1 font-serif text-[15px]">« {r.affirmation.passage} »</p>
        <p className="mt-2 text-sm">{r.message}</p>
      </div>
      {r.verifications.map((v, i) => (
        <SourceDetail key={i} v={v} dateFaits={dateFaits} />
      ))}
    </div>
  );
}

function SourceDetail({ v, dateFaits }: { v: VerificationSource; dateFaits: string }) {
  const [voirVersions, setVoirVersions] = useState(false);
  const o = v.officielle;
  const courante = o?.versions.length ? o.versions[o.versions.length - 1] : null;
  return (
    <div className="mt-5 rounded-lg border border-trait p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-gris">Source citée</div>
          <div className="font-medium">{v.citee.brut}</div>
          {o && (
            <div className="mt-0.5 text-sm text-gris">
              {o.base} ·{" "}
              {o.url ? (
                <a href={o.url} target="_blank" rel="noreferrer" className="text-accent underline">
                  {o.titre}
                </a>
              ) : (
                o.titre
              )}
            </div>
          )}
        </div>
        <Pyramide rang={o?.rang ?? null} />
      </div>

      <ul className="mt-4 space-y-1.5">
        {v.controles.map((c, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <Pastille statut={c.statut} />
            <span>
              <span className="font-medium">{NOMS_CONTROLES[c.nom]}</span> — {c.message}
            </span>
          </li>
        ))}
      </ul>

      {v.jugement && (
        <div className="mt-4 rounded-md bg-papier p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-gris">
            Raisonnement de l&apos;avocat adverse
          </div>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {v.jugement.raisonnement.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ol>
          {v.jugement.extrait && (
            <blockquote className="mt-3 border-l-2 border-accent pl-3 font-serif text-[14px] italic">
              « {v.jugement.extrait} »
              <span
                className={`ml-2 not-italic font-sans text-[11px] font-semibold ${
                  v.jugement.extraitRetrouve ? "text-vert" : "text-rouge"
                }`}
              >
                {v.jugement.extraitRetrouve ? "✓ retrouvé mot pour mot dans le texte officiel" : "✗ introuvable dans le texte officiel"}
              </span>
            </blockquote>
          )}
        </div>
      )}

      {v.versionApplicable && courante && v.versionApplicable !== courante && (
        <div className="mt-4">
          <button onClick={() => setVoirVersions(!voirVersions)} className="text-sm text-accent underline">
            {voirVersions ? "Masquer" : "Comparer"} la version du {formatDate(dateFaits)} et la version actuelle
          </button>
          {voirVersions && (
            <div className="mt-2 grid grid-cols-2 gap-3 text-[13px]">
              <VersionBloc titre={`Applicable aux faits (${formatDate(v.versionApplicable.debut)} → ${formatDate(v.versionApplicable.fin)})`} texte={v.versionApplicable.texte} />
              <VersionBloc titre={`Actuelle (depuis le ${formatDate(courante.debut)})`} texte={courante.texte} />
            </div>
          )}
        </div>
      )}
      {!v.versionApplicable && o?.texte && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-accent">Lire le texte officiel</summary>
          <p className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-serif text-[13px] text-gris">{o.texte.slice(0, 6000)}</p>
        </details>
      )}
    </div>
  );
}

function VersionBloc({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div className="rounded border border-trait p-2">
      <div className="mb-1 text-[11px] font-semibold uppercase text-gris">{titre}</div>
      <p className="max-h-72 overflow-auto whitespace-pre-wrap font-serif">{texte}</p>
    </div>
  );
}

function Pyramide({ rang }: { rang: number | null }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-[2px]" title="Hiérarchie des normes">
      {RANGS.slice(0, 6).map((r, i) => (
        <div
          key={r.rang}
          className={`h-[7px] rounded-sm ${rang === r.rang ? "bg-accent" : "bg-trait"}`}
          style={{ width: `${18 + i * 9}px` }}
          title={r.libelle}
        />
      ))}
      <div className="mt-1 text-[10px] text-gris">
        {rang === null ? "—" : rang === 0 ? "pièce" : rang === 7 ? "jurisprudence" : RANGS.find((x) => x.rang === rang)?.libelle}
      </div>
    </div>
  );
}

function Pastille({ statut }: { statut: Statut }) {
  const couleur = { vert: "bg-vert", orange: "bg-orange", rouge: "bg-rouge", gris: "bg-gris" }[statut];
  return <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${couleur}`} />;
}

const COULEUR_ACTEUR: Record<EntreeJournal["acteur"], string> = {
  Visa: "text-accent",
  Extracteur: "text-[#6d28d9]",
  Chercheur: "text-[#0e7490]",
  Règles: "text-[#4d7c0f]",
  "Avocat adverse": "text-rouge",
};

function Journal({ entrees, refConteneur }: { entrees: EntreeJournal[]; refConteneur: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="border-t border-trait bg-[#16161a] text-[12px] text-[#d4d4d8]">
      <div className="px-4 pt-2 text-[11px] uppercase tracking-wide text-[#8b8b93]">Journal des agents (en direct)</div>
      <div ref={refConteneur} className="h-44 overflow-auto px-4 pb-3 pt-1 font-mono">
        {entrees.map((e, i) => (
          <div key={i} className="leading-5">
            <span className="text-[#6b6b73]">{e.t.slice(11, 19)}</span>{" "}
            <span className={`font-semibold ${COULEUR_ACTEUR[e.acteur]}`}>{e.acteur}</span> {e.action}
            {e.detail && <span className="text-[#8b8b93]"> — {e.detail}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Version imprimable : le journal d'audit (export PDF via l'impression du navigateur). */
function Audit(p: {
  texte: string;
  debut: string;
  dateFaits: string;
  affirmations: Affirmation[];
  resultats: Record<string, ResultatAffirmation>;
  journal: EntreeJournal[];
  synthese: Record<Statut, number>;
}) {
  return (
    <div className="hidden p-10 text-[12px] print:block">
      <h1 className="font-serif text-2xl font-semibold">Journal d&apos;audit Visa</h1>
      <p className="mt-1 text-gris">
        Vérification lancée le {new Date(p.debut).toLocaleString("fr-FR")} · Date des faits retenue : {formatDate(p.dateFaits)} ·
        Empreinte du texte : {p.journal[0]?.empreinte ?? "—"}
      </p>
      <p className="mt-1">
        Résultat : {p.synthese.vert} vérifiées, {p.synthese.orange} à revoir, {p.synthese.rouge} fausses, {p.synthese.gris} non
        vérifiables.
      </p>
      <h2 className="mt-6 font-serif text-lg font-semibold">Affirmations</h2>
      {p.affirmations.map((a) => {
        const r = p.resultats[a.id];
        return (
          <div key={a.id} className="mt-3 break-inside-avoid border-t border-trait pt-2">
            <div className="font-semibold">
              {a.id} — {r ? STYLE[r.statut].libelle : "non traitée"}
            </div>
            <div className="font-serif italic">« {a.passage} »</div>
            {r?.verifications.map((v, i) => (
              <div key={i} className="mt-1 pl-3">
                <div>
                  Source : {v.citee.brut}
                  {v.officielle && ` → ${v.officielle.base}, ${v.officielle.titre}${v.officielle.url ? ` (${v.officielle.url})` : ""}`}
                </div>
                {v.controles.map((c, j) => (
                  <div key={j}>
                    [{c.statut}] {NOMS_CONTROLES[c.nom]} : {c.message}
                  </div>
                ))}
                {v.jugement?.extrait && (
                  <div>
                    Extrait officiel ({v.jugement.extraitRetrouve ? "vérifié mot pour mot" : "non retrouvé"}) : « {v.jugement.extrait} »
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
      <h2 className="mt-6 font-serif text-lg font-semibold">Journal des opérations</h2>
      {p.journal.map((e, i) => (
        <div key={i} className="font-mono text-[10px]">
          {e.t} · {e.acteur} · {e.action}
          {e.detail ? ` — ${e.detail}` : ""}
          {e.modele ? ` [modèle ${e.modele}]` : ""}
        </div>
      ))}
      <div className="mt-8 border-t border-trait pt-4">
        Validé par l&apos;avocat : ______________________ Date : __________ Signature : __________
      </div>
    </div>
  );
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "aujourd'hui";
  const [a, m, j] = d.split("-");
  return `${j}/${m}/${a}`;
}
