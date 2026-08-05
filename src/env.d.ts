/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The CIS URL-prefix proxy every Yandex host is fetched through. See `api/proxy.ts`. */
  readonly VITE_YM_PROXY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
