/**
 * Only the fields the UI actually reads — the real payloads carry ~40 more
 * per entity, and modelling them would be a second, worse copy of the docs.
 */

export interface Cover {
  uri?: string
  itemsUri?: string[]
}

export interface Artist {
  id: number
  name: string
  cover?: Cover
  counts?: { tracks: number; directAlbums: number }
  description?: { text: string }
}

export interface Album {
  id: number
  title: string
  year?: number
  coverUri?: string
  genre?: string
  trackCount?: number
  artists?: Artist[]
  /** Where the track sits in this album — read by the download's tags. */
  trackPosition?: { volume: number; index: number }
  /** Only on `/albums/<id>/with-tracks`: one array per disc. */
  volumes?: Track[]
}

export interface Track {
  id: string
  title: string
  version?: string
  available: boolean
  durationMs: number
  coverUri?: string
  artists: Artist[]
  albums: Album[]
  /** `"explicit"` on the ones that carry the badge. */
  contentWarning?: string
  lyricsInfo?: { hasAvailableSyncLyrics: boolean; hasAvailableTextLyrics: boolean }
}

/** A track's standing in the chart — its place, and how it moved to get there. */
export interface ChartPosition {
  position: number
  progress: 'up' | 'down' | 'same' | 'new'
  /** Places gained or lost; negative on the way down, 0 on `same` and `new`. */
  shift: number
  /** How many people played it over the chart's week — the only play figure the API gives out. */
  listeners?: number
}

export interface Playlist {
  uid: number
  kind: number
  title: string
  description?: string
  trackCount: number
  durationMs?: number
  cover?: Cover
  owner?: { uid: number; name: string; login: string }
  /** Only on the single-playlist endpoint; the list endpoint omits it. */
  tracks?: { track: Track }[]
}

export interface Account {
  uid: number
  login: string
  displayName: string
  fullName?: string
}

/** What `get-file-info` hands back: where the audio is and how to decrypt it. */
export interface DownloadInfo {
  codec: string
  bitrate: number
  urls: string[]
  /** Hex AES-128 key; present means the bytes are encrypted. */
  key?: string
}
