"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { DATE_FAITS_DEMO, MEMO_DEMO } from "@/demo/memo";
import { memoFinalEnTexte, preuve, revision, type Boucle, type Difference } from "@/lib/boucle";
import { diffMots, resumePourAvocat, type Point } from "@/lib/correction";
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
  vert: { fond: "bg-vert-fond", trait: "border-vert", texte: "text-vert", libelle: "Verified" },
  orange: { fond: "bg-orange-fond", trait: "border-orange", texte: "text-orange", libelle: "To review" },
  rouge: { fond: "bg-rouge-fond", trait: "border-rouge", texte: "text-rouge", libelle: "False" },
  gris: { fond: "bg-gris-fond", trait: "border-gris", texte: "text-gris", libelle: "Not verifiable" },
  attente: { fond: "bg-gris-fond/60 animate-pulse", trait: "border-trait", texte: "text-gris", libelle: "Running…" },
};

const NOMS_CONTROLES: Record<Controle["nom"], string> = {
  existe: "Exists",
  date: "In force at the date of the facts",
  rang: "Rank in the hierarchy",
  contenu: "Really says that",
};

export default function Saul() {
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
  const [vue, setVue] = useState<"verifie" | "corrige">("verifie");
  const [boucle, setBoucle] = useState<Boucle | null>(null);
  const journalRef = useRef<HTMLDivElement>(null);

  async function lancer() {
    setPhase("analyse");
    setAffirmations([]);
    setResultats({});
    setJournal([]);
    setSelection(null);
    setErreur(null);
    setVue("verifie");
    setBoucle(null);
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
    } else if (e.type === "boucle") {
      setBoucle(e.boucle);
      setVue("corrige");
    } else if (e.type === "erreur") {
      setErreur(e.message);
    }
  }

  const synthese = useMemo(() => {
    const s: Record<Statut, number> = { vert: 0, orange: 0, rouge: 0, gris: 0 };
    for (const r of Object.values(resultats)) s[r.statut]++;
    return s;
  }, [resultats]);

  // After the loop, the current state is the last version's (same ids as version 1).
  const finale = boucle ? boucle.versions[boucle.versions.length - 1] : null;
  const courants = useMemo(
    () => (finale ? Object.fromEntries(finale.resultats.map((r) => [r.affirmation.id, r])) : resultats),
    [finale, resultats],
  );
  const choisi = selection ? courants[selection] : null;

  /** Opens a statement's detail and brings its passage into view. */
  function montrer(id: string) {
    setSelection(id);
    requestAnimationFrame(() =>
      document.querySelector(`[data-aff="${id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print flex items-center justify-between border-b border-trait bg-white px-6 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-2xl font-semibold tracking-tight text-accent">Saul</span>
          <span className="text-sm text-gris">Every sentence, checked against the official text.</span>
          <Link href="/" className="no-print text-sm text-accent underline-offset-2 hover:underline">
            ← Espace de travail
          </Link>
        </div>
        {phase !== "saisie" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              disabled={phase !== "fini"}
              className="rounded-md border border-accent px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent hover:text-white disabled:opacity-40"
            >
              Export the audit log
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
              <Synthese
                synthese={synthese}
                total={affirmations.length}
                enCours={phase === "analyse"}
                date={dateRetenue}
                compteurs={!boucle}
              />
              <ResumeAvocat resultats={courants} enCours={phase === "analyse"} montrer={montrer} />
              <Versions boucle={boucle} enCours={phase === "analyse"} v1={synthese} />
              <Onglets vue={vue} setVue={setVue} boucle={boucle} />
              {vue === "verifie" ? (
                <Document texte={texte} affirmations={affirmations} resultats={resultats} selection={selection} choisir={setSelection} />
              ) : (
                <MemoFinal boucle={boucle} enCours={phase === "analyse"} selection={selection} choisir={setSelection} />
              )}
            </section>
            <section className="flex flex-col bg-white">
              <div className="flex-1 overflow-auto p-6">
                {choisi ? (
                  <Detail r={choisi} dateFaits={dateRetenue} boucle={boucle} />
                ) : (
                  <Liste
                    affirmations={affirmations}
                    resultats={courants}
                    supprimes={finale?.supprimes ?? []}
                    choisir={setSelection}
                  />
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
            boucle={boucle}
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
      <h1 className="font-serif text-3xl font-semibold">Your AI wrote a note. Can you argue it?</h1>
      <p className="mt-2 text-gris">
        Paste a text produced by ChatGPT, Legora, Hector or any other tool. Saul finds every source on Légifrance
        and Judilibre, checks that it exists, that it was in force at the date of the facts, where it ranks, and that
        it really says what it is made to say.
      </p>
      <textarea
        value={p.texte}
        onChange={(e) => p.setTexte(e.target.value)}
        placeholder="Paste the note, the pleadings or the opinion here…"
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
          Load the example
        </button>
        <button
          onClick={p.lancer}
          disabled={!p.texte.trim()}
          className="ml-auto rounded-lg bg-accent px-5 py-2.5 font-medium text-white disabled:opacity-40"
        >
          Verify
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
  compteurs,
}: {
  synthese: Record<Statut, number>;
  total: number;
  enCours: boolean;
  date: string;
  compteurs: boolean;
}) {
  const faits = synthese.vert + synthese.orange + synthese.rouge + synthese.gris;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
      <span className="mr-2 font-medium">
        {total === 0 ? "Reading the text…" : `${faits}/${total} statements checked`}
        {enCours && total > 0 && faits < total && " …"}
      </span>
      {compteurs &&
        (["rouge", "orange", "vert", "gris"] as Statut[]).map((s) => (
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
            data-aff={s.id}
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

/** The summary for the lawyer: what to fix before sending, what to re-read, what is verified. */
function ResumeAvocat({
  resultats,
  enCours,
  montrer,
}: {
  resultats: Record<string, ResultatAffirmation>;
  enCours: boolean;
  montrer: (id: string) => void;
}) {
  const r = useMemo(() => resumePourAvocat(Object.values(resultats)), [resultats]);
  if (Object.keys(resultats).length === 0) return null;
  const ligne = (statut: Statut, titre: string, points: Point[], vide: string) => (
    <div className="grid grid-cols-[11rem_minmax(0,1fr)] items-baseline gap-x-2">
      <span className={`font-semibold ${STYLE[statut].texte}`}>
        {titre} ({points.length})
      </span>
      <div className="flex flex-wrap gap-1.5">
        {points.length === 0 ? (
          <span className="text-gris">{enCours ? "…" : vide}</span>
        ) : (
          points.map((p) => (
            <button
              key={p.id}
              onClick={() => montrer(p.id)}
              title={p.resume}
              className={`rounded-full border px-2.5 py-0.5 text-left text-[13px] hover:shadow-sm ${STYLE[statut].fond} ${STYLE[statut].trait}`}
            >
              <span className="font-semibold">{p.id}</span> · {p.motif}
            </button>
          ))
        )}
      </div>
    </div>
  );
  return (
    <div className="mb-5 space-y-2 rounded-lg border border-trait bg-white p-4 text-sm">
      {ligne("rouge", "Fix before sending", r.aCorriger, "nothing")}
      {ligne("orange", "To re-read", r.aRelire, "nothing")}
      <div className="grid grid-cols-[11rem_minmax(0,1fr)] items-baseline gap-x-2">
        <span className={`font-semibold ${STYLE.vert.texte}`}>Verified ({r.verifies})</span>
        <span>
          {r.verifies} statement{r.verifies > 1 ? "s" : ""} conforming to the official text
          {r.nonVerifiables > 0 && (
            <span className="text-gris">
              {" "}
              · {r.nonVerifiables} not verifiable, to check by hand
            </span>
          )}
          {enCours && " …"}
        </span>
      </div>
    </div>
  );
}

/** The successive versions of the memo, with the count at each round. */
function Versions({ boucle, enCours, v1 }: { boucle: Boucle | null; enCours: boolean; v1: Record<Statut, number> }) {
  const versions = boucle?.versions ?? [];
  const compte = (s: Record<Statut, number>) => (
    <span className="whitespace-nowrap">
      <span className="text-rouge">{s.rouge} false</span> · <span className="text-orange">{s.orange} to review</span> ·{" "}
      <span className="text-vert">{s.vert} verified</span>
    </span>
  );
  return (
    <div className="mb-4 rounded-lg border border-trait bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold">Version 1</span> {compte(versions[0]?.synthese ?? v1)}
        {versions.slice(1).map((v) => (
          <span key={v.numero} className="flex items-center gap-2">
            <span className="text-gris">→</span>
            <span className="font-semibold">Version {v.numero}</span> {compte(v.synthese)}
          </span>
        ))}
        {enCours && (
          <span className="text-gris">
            → {boucle ? "the AI is correcting…" : "checking version 1…"}
          </span>
        )}
      </div>
      {boucle?.arret && !enCours && <p className="mt-1 text-gris">{boucle.arret}</p>}
      <p className="mt-1 text-[12px] text-gris">
        At each round, Saul sends the false or questionable passages back to the AI that wrote the memo, with the evidence. A
        correction is kept only if re-checking turns it green or orange.
      </p>
    </div>
  );
}

function Onglets({
  vue,
  setVue,
  boucle,
}: {
  vue: "verifie" | "corrige";
  setVue: (v: "verifie" | "corrige") => void;
  boucle: Boucle | null;
}) {
  const n = boucle ? boucle.versions.length : 0;
  const onglet = (v: "verifie" | "corrige", libelle: string) => (
    <button
      onClick={() => setVue(v)}
      className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
        vue === v ? "border-accent font-medium text-accent" : "border-transparent text-gris hover:text-encre"
      }`}
    >
      {libelle}
    </button>
  );
  return (
    <div className="mb-3 flex gap-1 border-b border-trait">
      {onglet("verifie", "Version 1, checked")}
      {onglet("corrige", n > 1 ? `Final memo (version ${n}), in revision` : "Final memo, in revision")}
    </div>
  );
}

/** The passage in revision mode: struck through what was removed, underlined what the AI corrected. */
function PassageRevise({ d }: { d: Difference }) {
  if (d.apres === null) return <del className="bg-rouge-fond/60 text-rouge decoration-rouge">{d.avant}</del>;
  if (d.tour === null) {
    const st = STYLE[d.resultat?.statut ?? "gris"];
    return (
      <>
        <span className={`border-b-2 border-dashed ${st.trait} ${st.fond}`}>{d.avant}</span>
        <span className={`ml-1 whitespace-nowrap rounded px-1 font-sans text-[11px] font-semibold ${st.fond} ${st.texte}`}>
          {d.resultat?.statut === "rouge" ? "still false" : "to re-read"}
        </span>
      </>
    );
  }
  const m = diffMots(d.avant, d.apres);
  // Underlined in the colour of the re-check: green, or orange if it still needs review.
  const st = STYLE[d.resultat?.statut ?? "vert"];
  return (
    <>
      {m.prefixe}
      {m.retire && <del className="bg-rouge-fond/60 text-rouge decoration-rouge">{m.retire}</del>}
      {m.retire && m.ajoute && " "}
      {m.ajoute && (
        <ins className={`underline decoration-current decoration-2 underline-offset-2 ${st.fond} ${st.texte}`}>{m.ajoute}</ins>
      )}
      {m.suffixe}
    </>
  );
}

function Revision({ boucle, selection, choisir }: { boucle: Boucle; selection?: string | null; choisir?: (id: string) => void }) {
  const { segments, differences } = useMemo(() => revision(boucle), [boucle]);
  return (
    <>
      <article className="whitespace-pre-wrap rounded-lg border border-trait bg-white p-6 font-serif text-[15.5px] leading-[1.75]">
        {segments.map((s, i) => {
          if ("texte" in s) return <span key={i}>{s.texte}</span>;
          const d = s.difference;
          return (
            <span
              key={i}
              data-aff={d.id}
              onClick={() => choisir?.(d.id)}
              className={`${choisir ? "cursor-pointer" : ""} rounded-sm ${selection === d.id ? "ring-2 ring-accent" : ""}`}
            >
              <PassageRevise d={d} />
              <sup className="ml-0.5 font-sans text-[10px] font-semibold text-accent">[{d.note}]</sup>
            </span>
          );
        })}
      </article>
      {differences.length > 0 && (
        <ol className="mt-4 space-y-2 text-[13px]">
          {differences.map((d) => (
            <li key={d.id} className="flex gap-2">
              <span className="w-7 shrink-0 font-semibold text-accent">[{d.note}]</span>
              <div className="min-w-0">
                <button onClick={() => choisir?.(d.id)} className="font-semibold">
                  {d.id}
                </button>{" "}
                ·{" "}
                {d.apres === null ? (
                  <span>deleted by the AI (round {d.tour})</span>
                ) : d.tour === null ? (
                  <span className={STYLE[d.resultat!.statut].texte}>
                    {d.resultat!.statut === "rouge" ? "still false" : "to re-read"}: {d.resultat!.message}
                  </span>
                ) : (
                  <>
                    <span className={STYLE[d.resultat!.statut].texte}>
                      corrected by the AI (round {d.tour}), re-checked: {STYLE[d.resultat!.statut].libelle.toLowerCase()}
                    </span>
                    <div className="mt-0.5 text-gris">{preuve(d.resultat)}</div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function MemoFinal({
  boucle,
  enCours,
  selection,
  choisir,
}: {
  boucle: Boucle | null;
  enCours: boolean;
  selection: string | null;
  choisir: (id: string) => void;
}) {
  const [copie, setCopie] = useState<"" | "ok" | "echec">("");
  if (!boucle) {
    return (
      <p className="text-sm text-gris">
        {enCours ? "The correction loop starts once version 1 is checked…" : "No correction loop."}
      </p>
    );
  }
  const b = boucle;
  async function copier() {
    try {
      await navigator.clipboard.writeText(memoFinalEnTexte(b));
      setCopie("ok");
    } catch {
      setCopie("echec");
    }
    setTimeout(() => setCopie(""), 2500);
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <p className="flex-1 text-gris">
          Differences between version 1 and version {b.versions.length}: struck through, what the AI removed; underlined, what
          it corrected and Saul re-checked. Dotted, what is still flagged.
        </p>
        <button
          onClick={copier}
          className="rounded-md border border-accent px-3 py-1.5 font-medium text-accent hover:bg-accent hover:text-white"
        >
          {copie === "ok" ? "Copied" : copie === "echec" ? "Copy failed" : "Copy the final memo"}
        </button>
      </div>
      <Revision boucle={b} selection={selection} choisir={choisir} />
    </div>
  );
}

function Liste({
  affirmations,
  resultats,
  supprimes,
  choisir,
}: {
  affirmations: Affirmation[];
  resultats: Record<string, ResultatAffirmation>;
  supprimes: string[];
  choisir: (id: string) => void;
}) {
  const ordre: (Statut | "attente")[] = ["rouge", "orange", "gris", "vert", "attente"];
  const tries = [...affirmations].sort(
    (a, b) => ordre.indexOf(resultats[a.id]?.statut ?? "attente") - ordre.indexOf(resultats[b.id]?.statut ?? "attente"),
  );
  if (affirmations.length === 0) return <p className="text-gris">The extractor is reading the text…</p>;
  return (
    <div className="space-y-2">
      <p className="mb-3 text-sm text-gris">Click a statement to see the evidence.</p>
      {tries.map((a) => {
        const r = resultats[a.id];
        if (supprimes.includes(a.id)) {
          return (
            <div key={a.id} className="rounded-lg border-l-4 border-trait bg-gris-fond p-3 text-left">
              <div className="text-xs font-semibold text-gris">{a.id} · Deleted by the AI</div>
              <div className="mt-1 text-sm text-gris line-through">{a.resume}</div>
            </div>
          );
        }
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
            <div className="mt-1 text-sm">{r && r.affirmation.passage !== a.passage ? r.affirmation.resume : a.resume}</div>
            {r && r.statut !== "vert" && <div className="mt-1 text-xs text-gris">{r.message}</div>}
            {r && r.affirmation.passage !== a.passage && (
              <div className="mt-1 text-xs font-medium text-vert">Corrected by the AI, re-checked</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Detail({ r, dateFaits, boucle }: { r: ResultatAffirmation; dateFaits: string; boucle: Boucle | null }) {
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
      <Historique id={r.affirmation.id} boucle={boucle} />
      {r.verifications.map((v, i) => (
        <SourceDetail key={i} v={v} dateFaits={dateFaits} />
      ))}
    </div>
  );
}

/** Ce que la boucle a fait de ce passage : version 1, puis chaque tentative de l'IA. */
function Historique({ id, boucle }: { id: string; boucle: Boucle | null }) {
  if (!boucle) return null;
  const v1 = boucle.versions[0].resultats.find((r) => r.affirmation.id === id);
  const tentatives = boucle.tours.flatMap((t) => t.tentatives.filter((x) => x.id === id).map((x) => ({ ...x, tour: t.numero })));
  if (!v1 || tentatives.length === 0) return null;
  return (
    <div className="mt-4 rounded-lg border border-trait bg-white p-4 text-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-gris">Correction par l&apos;IA</div>
      <div className="mt-2">
        <span className="font-medium">Version 1</span> ·{" "}
        <span className={STYLE[v1.statut].texte}>{STYLE[v1.statut].libelle.toLowerCase()}</span>
        <p className="font-serif text-[14px] text-gris">« {v1.affirmation.passage} »</p>
      </div>
      {tentatives.map((t) => (
        <div key={t.tour} className="mt-2 border-t border-trait pt-2">
          <span className="font-medium">Tour {t.tour}</span> ·{" "}
          <span className={t.retenue ? "text-vert" : "text-rouge"}>{t.retenue ? "correction kept" : "correction rejected"}</span>
          <span className="text-gris"> ({t.raison})</span>
          <p className="font-serif text-[14px]">{t.propose ? `“${t.propose}”` : "Passage deleted."}</p>
        </div>
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
          <div className="text-xs uppercase tracking-wide text-gris">Source cited</div>
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
                {v.jugement.extraitRetrouve ? "✓ found word for word in the official text" : "✗ not found in the official text"}
              </span>
            </blockquote>
          )}
        </div>
      )}

      {v.versionApplicable && courante && v.versionApplicable !== courante && (
        <div className="mt-4">
          <button onClick={() => setVoirVersions(!voirVersions)} className="text-sm text-accent underline">
            {voirVersions ? "Hide" : "Compare"} the version of {formatDate(dateFaits)} and the current one
          </button>
          {voirVersions && (
            <div className="mt-2 grid grid-cols-2 gap-3 text-[13px]">
              <VersionBloc titre={`Applicable to the facts (${formatDate(v.versionApplicable.debut)} → ${formatDate(v.versionApplicable.fin)})`} texte={v.versionApplicable.texte} />
              <VersionBloc titre={`Current (since ${formatDate(courante.debut)})`} texte={courante.texte} />
            </div>
          )}
        </div>
      )}
      {!v.versionApplicable && o?.texte && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-accent">Read the official text</summary>
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
    <div className="flex shrink-0 flex-col items-center gap-[2px]" title="Hierarchy of norms">
      {RANGS.slice(0, 6).map((r, i) => (
        <div
          key={r.rang}
          className={`h-[7px] rounded-sm ${rang === r.rang ? "bg-accent" : "bg-trait"}`}
          style={{ width: `${18 + i * 9}px` }}
          title={r.libelle}
        />
      ))}
      <div className="mt-1 text-[10px] text-gris">
        {rang === null ? "—" : rang === 0 ? "document" : rang === 7 ? "case law" : RANGS.find((x) => x.rang === rang)?.libelle}
      </div>
    </div>
  );
}

function Pastille({ statut }: { statut: Statut }) {
  const couleur = { vert: "bg-vert", orange: "bg-orange", rouge: "bg-rouge", gris: "bg-gris" }[statut];
  return <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${couleur}`} />;
}

const COULEUR_ACTEUR: Record<EntreeJournal["acteur"], string> = {
  Saul: "text-accent",
  Extractor: "text-[#6d28d9]",
  Researcher: "text-[#0e7490]",
  Rules: "text-[#4d7c0f]",
  "Opposing counsel": "text-rouge",
  Drafter: "text-[#be185d]",
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
  boucle: Boucle | null;
}) {
  const b = p.boucle;
  return (
    <div className="hidden p-10 text-[12px] print:block">
      <h1 className="font-serif text-2xl font-semibold">Saul audit log</h1>
      <p className="mt-1 text-gris">
        Check started on {new Date(p.debut).toLocaleString("en-GB")} · Date of the facts used: {formatDate(p.dateFaits)} ·
        Text hash: {p.journal[0]?.empreinte ?? "—"}
      </p>
      <p className="mt-1">
        Result: {p.synthese.vert} verified, {p.synthese.orange} to review, {p.synthese.rouge} false, {p.synthese.gris} not
        verifiable.
      </p>
      <h2 className="mt-6 font-serif text-lg font-semibold">Statements</h2>
      {p.affirmations.map((a) => {
        const r = p.resultats[a.id];
        return (
          <div key={a.id} className="mt-3 break-inside-avoid border-t border-trait pt-2">
            <div className="font-semibold">
              {a.id} — {r ? STYLE[r.statut].libelle : "not processed"}
            </div>
            <div className="font-serif italic">“{a.passage}”</div>
            {r?.verifications.map((v, i) => (
              <div key={i} className="mt-1 pl-3">
                <div>
                  Source: {v.citee.brut}
                  {v.officielle && ` → ${v.officielle.base}, ${v.officielle.titre}${v.officielle.url ? ` (${v.officielle.url})` : ""}`}
                </div>
                {v.controles.map((c, j) => (
                  <div key={j}>
                    [{c.statut}] {NOMS_CONTROLES[c.nom]}: {c.message}
                  </div>
                ))}
                {v.jugement?.extrait && (
                  <div>
                    Official excerpt ({v.jugement.extraitRetrouve ? "verified word for word" : "not found"}): “{v.jugement.extrait}”
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
      {b && (
        <>
          <h2 className="mt-6 font-serif text-lg font-semibold">Tours de correction</h2>
          <p>
            {b.versions.map((v) => `Version ${v.numero}: ${v.synthese.rouge} false, ${v.synthese.orange} to review, ${v.synthese.vert} verified`).join(" → ")}.{" "}
            {b.arret}
          </p>
          {b.tours.map((t) => (
            <div key={t.numero} className="mt-3 break-inside-avoid border-t border-trait pt-2">
              <div className="font-semibold">Tour {t.numero}</div>
              <div>
                Flagged to the AI: {t.signales.map((x) => `${x.id} (${STYLE[x.statut].libelle.toLowerCase()}: ${x.message})`).join(" ; ")}
              </div>
              {t.tentatives.map((x) => (
                <div key={x.id} className="pl-3">
                  {x.id} — {x.retenue ? "corrected" : "correction rejected"} ({x.raison}): {x.propose ? `“${x.propose}”` : "passage deleted"}
                </div>
              ))}
            </div>
          ))}
          <div className="mt-3">
            Remaining:{" "}
            {(() => {
              const reste = b.versions[b.versions.length - 1].resultats.filter((r) => r.statut === "rouge" || r.statut === "orange");
              return reste.length === 0
                ? "nothing false or to review."
                : reste.map((r) => `${r.affirmation.id} (${STYLE[r.statut].libelle.toLowerCase()}: ${r.message})`).join(" ; ");
            })()}
          </div>
          <div className="break-before-page">
            <h2 className="mt-6 font-serif text-lg font-semibold">Final memo (version {b.versions.length}), in revision</h2>
            <p className="mb-2 text-gris">Struck through: removed by the AI. Underlined: corrected by the AI and re-checked by Saul.</p>
            <Revision boucle={b} />
          </div>
        </>
      )}
      <h2 className="mt-6 font-serif text-lg font-semibold">Operations log</h2>
      {p.journal.map((e, i) => (
        <div key={i} className="font-mono text-[10px]">
          {e.t} · {e.acteur} · {e.action}
          {e.detail ? ` — ${e.detail}` : ""}
          {e.modele ? ` [model ${e.modele}]` : ""}
        </div>
      ))}
      <div className="mt-8 border-t border-trait pt-4">
        Approved by the lawyer: ______________________ Date: __________ Signature: __________
      </div>
    </div>
  );
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "today";
  const [a, m, j] = d.split("-");
  return `${j}/${m}/${a}`;
}
