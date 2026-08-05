import { withProxy } from './proxy'
import type { Cover } from './types'

/** Sizes Yandex actually renders; anything else falls back to the original. */
export type CoverSize = 50 | 100 | 200 | 400 | 600 | 1000

/**
 * A `coverUri` is a template — `avatars.yandex.net/…/%%` — with the size
 * substituted in. Covers live on a Yandex host too, so they need the proxy.
 */
export function coverUrl(uri: string | undefined, size: CoverSize = 400) {
  if (!uri) return ''
  return withProxy(`https://${uri.replace('%%', `${size}x${size}`)}`)
}

/** Auto-generated playlists have no single cover, only a mosaic of tracks. */
export const playlistCoverUrl = (cover: Cover | undefined, size?: CoverSize) =>
  coverUrl(cover?.uri ?? cover?.itemsUri?.[0], size)
