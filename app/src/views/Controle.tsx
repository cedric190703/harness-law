// Le déroulé du contrôle. C'est l'écran que le juriste regarde pendant que
// Visa travaille, et celui qu'il rouvre pour comprendre comment on a conclu.

import { FluxControle } from "../components/FluxControle";
import { TiroirEtape } from "../components/TiroirEtape";
import { ouvrirAffirmation, ouvrirEtape, useEtat } from "../store";

export function Controle() {
  const dossier = useEtat((e) => e.dossier);
  const etapeOuverte = useEtat((e) => e.etapeOuverte);
  const etape = dossier.etapes.find((e) => e.id === etapeOuverte) ?? null;

  return (
    <div className="vue pleine" style={{ position: "relative" }}>
      <FluxControle
        etapes={dossier.etapes}
        affirmations={dossier.affirmations}
        etapeOuverte={etapeOuverte}
        onOuvrir={ouvrirEtape}
      />
      {etape && (
        <TiroirEtape
          etape={etape}
          affirmations={dossier.affirmations}
          onFermer={() => ouvrirEtape(null)}
          onAffirmation={ouvrirAffirmation}
        />
      )}
    </div>
  );
}
