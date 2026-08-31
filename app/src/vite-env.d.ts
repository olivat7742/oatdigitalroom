/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'cognigy' talks to the real agent through the dev proxy. Anything else uses fixtures. */
  readonly VITE_TRANSPORT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
