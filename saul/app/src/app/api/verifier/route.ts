import { verifierTexte } from "@/lib/moteur";
import type { Piece } from "@/lib/sources";
import type { Evenement } from "@/lib/types";

export const maxDuration = 300;

/** NDJSON stream: every line is one event (agent log, statements, results). */
export async function POST(request: Request) {
  const { texte, dateFaits, pieces } = (await request.json()) as {
    texte: string;
    dateFaits?: string | null;
    pieces?: Piece[];
  };
  if (!texte?.trim()) return Response.json({ erreur: "Empty text" }, { status: 400 });

  const encodeur = new TextEncoder();
  const flux = new ReadableStream({
    async start(controleur) {
      const emettre = (e: Evenement) => controleur.enqueue(encodeur.encode(JSON.stringify(e) + "\n"));
      try {
        await verifierTexte(texte, dateFaits ?? null, pieces ?? [], emettre);
      } catch (e) {
        emettre({ type: "erreur", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controleur.close();
      }
    },
  });
  return new Response(flux, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
}
