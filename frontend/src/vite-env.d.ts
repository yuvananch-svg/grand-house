/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE?: "local" | "gas";
  readonly VITE_GAS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
