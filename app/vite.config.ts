import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error — module serveur en JavaScript, chargé tel quel par Vite.
import { pluginApi } from "./server/api.mjs";

export default defineConfig({
  // L'API vit dans le serveur de développement : les clés restent côté serveur
  // et n'entrent jamais dans le bundle navigateur.
  plugins: [react(), pluginApi()],
  server: { port: 5180, open: true },
  preview: { port: 5180 },
});
