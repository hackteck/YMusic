import type { CollectionKey } from '@/api/landing'
import type { Album, Artist, Playlist } from '@/api/types'

/** One place that knows how an entity maps to a URL. */
export const albumLink = (album: Pick<Album, 'id'>) => `/album/${album.id}`
export const artistLink = (artist: Pick<Artist, 'id'>) => `/artist/${artist.id}`
export const playlistLink = (playlist: Pick<Playlist, 'uid' | 'kind'>) =>
  `/playlist/${playlist.uid}/${playlist.kind}`

/** The feed block's own key is the URL segment; there is nothing else to name it by. */
export const collectionLink = (key: CollectionKey) => `/collection/${key}`
