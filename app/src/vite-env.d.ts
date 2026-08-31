/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'cognigy' talks to the real agent through the dev proxy. Anything else uses fixtures. */
  readonly VITE_TRANSPORT?: string
  /** 'false' in a static build where the demo videos are not deployed. */
  readonly VITE_MEDIA_AVAILABLE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
