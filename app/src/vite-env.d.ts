/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PISTE_CLIENT_ID?: string;
  readonly VITE_PISTE_CLIENT_SECRET?: string;
  readonly VITE_PISTE_ENV?: string;
  readonly VITE_MISTRAL_API_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
