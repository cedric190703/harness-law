// Le journal des agents, en direct. Le bandeau sombre, en bas du volet droit.
//
// Il existe pour une raison simple : le juriste doit pouvoir dire qui a fait
// quoi. Chaque ligne nomme son acteur, et celles qui ont établi un constat
// mènent à ce constat.

import { useEffect, useRef } from "react";
import type { Audit } from "../types";
import { choisir } from "../store";

const COULEUR: Record<string, string> = {
  Trieur: "#9ca3af",
  Lecteur: "#c4b5fd",
  Cadreur: "#67e8f9",
  Chercheur: "#93c5fd",
  "Règles": "#86efac",
  Droit: "#fcd34d",
  Contradicteur: "#fca5a5",
  "Rédacteur": "#fdba74",
};

export function Journal({ audit, enDirect }: { audit: Audit; enDirect: { acteur: string; action: string; detail: string | null }[] | null }) {
  const bas = useRef<HTMLDivElement>(null);
  const lignes = enDirect?.length
    ? enDirect.map((e, i) => ({ t: "", acteur: e.acteur, action: e.action, detail: e.detail, constat: null, rang: i }))
    : audit.journal.map((e, i) => ({ ...e, rang: i }));

  useEffect(() => {
    bas.current?.scrollTo({ top: 1e9, behavior: enDirect ? "smooth" : "auto" });
  }, [lignes.length, enDirect]);

  return (
    <div className="journal">
      <div className="journal-tete">
        Journal des agents {enDirect ? "— en direct" : `— ${audit.journal.length} actions`}
      </div>
      <div className="journal-corps" ref={bas}>
        {lignes.map((e) => (
          <div key={e.rang} className="journal-ligne">
            {e.t && <span className="h">{e.t.slice(11, 19)}</span>}
            <span className="a" style={{ color: COULEUR[e.acteur] ?? "#9ca3af" }}>{e.acteur}</span>
            <span className="x">
              {e.action}
              {e.detail && <span className="d"> — {e.detail}</span>}
            </span>
            {e.constat && (
              <button className="c" onClick={() => ouvrir(audit, e.constat!)}>{e.constat}</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ouvrir(audit: Audit, id: string) {
  const c = audit.constats.find((x) => x.id === id);
  if (c) choisir(c.cle);
}
