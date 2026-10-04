import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Le jeu de test tourne sous Node, pas dans un navigateur : il peut donc
// utiliser `await` au premier niveau, ce que la cible par défaut interdit.
export default defineConfig({
  plugins: [react()],
  build: { target: "node20", ssr: true, outDir: "verif/dist", emptyOutDir: false, minify: false },
});
