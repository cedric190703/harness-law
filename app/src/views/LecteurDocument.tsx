// Le document lui-même, lu à l'écran. Un juriste doit pouvoir vérifier dans le
// texte, pas seulement dans un extrait qu'on lui présente.

import { useEffect, useState } from "react";
import type { TexteDocument } from "../types";
import { texteDocument } from "../store";

export function LecteurDocument({
  id,
  surligner,
  onFermer,
}: {
  id: string;
  /** Le passage à mettre en évidence, et vers lequel on fait défiler. */
  surligner?: string | null;
  onFermer: () => void;
}) {
  const [doc, setDoc] = useState<TexteDocument | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    setDoc(null);
    setErreur(null);
    texteDocument(id)
      .then((d) => {
        if (!vivant) return;
        if (d) setDoc(d);
        else setErreur("Ce document est introuvable dans la data room.");
      })
      .catch((e) => vivant && setErreur(String(e)));
    return () => {
      vivant = false;
    };
  }, [id]);

  // La touche Échap ferme : c'est ce qu'attend quelqu'un qui lit vite.
  useEffect(() => {
    const sur = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", sur);
    return () => window.removeEventListener("keydown", sur);
  }, [onFermer]);

  useEffect(() => {
    if (!doc || !surligner) return;
    const cible = document.querySelector("#passage-surligne");
    cible?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [doc, surligner]);

  return (
    <div className="voile" onClick={onFermer}>
      <div className="lecteur" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h3>{doc?.nom ?? "Chargement…"}</h3>
            {doc && (
              <div className="sous">
                {doc.chemin} · {doc.pages.length} page{doc.pages.length > 1 ? "s" : ""}
              </div>
            )}
          </div>
          <button className="bouton discret sm" onClick={onFermer} aria-label="Fermer">✕</button>
        </header>
        <div className="corps-lecteur">
          {erreur && <div className="vide">{erreur}</div>}
          {!doc && !erreur && <div className="vide">Lecture du document…</div>}
          {doc?.pages.map((p) => (
            <section key={p.numero} className="page">
              <div className="numero-page">page {p.numero}</div>
              <pre>{rendre(p.lignes, surligner)}</pre>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Surligne le passage retenu, s'il tombe sur cette page. */
function rendre(texte: string, surligner?: string | null) {
  if (!surligner) return texte;
  const i = texte.indexOf(surligner);
  if (i === -1) return texte;
  return (
    <>
      {texte.slice(0, i)}
      <mark id="passage-surligne">{surligner}</mark>
      {texte.slice(i + surligner.length)}
    </>
  );
}
