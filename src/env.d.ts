/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The CIS URL-prefix proxy every Yandex host is fetched through. See `withProxy`. */
  readonly VITE_YM_PROXY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
