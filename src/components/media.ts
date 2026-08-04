import { coverUrl, playlistCoverUrl } from '@/api/cover'
import type { Collection, MixedEntity } from '@/api/landing'
import type { Album, Artist, Playlist, Track } from '@/api/types'
import { albumLink, artistLink, collectionLink, playlistLink } from '@/router/links'

/**
 * What a card needs, whatever it came from — so grids and shelves render one
 * shape and every page is a `.map()` instead of its own card markup.
 */
export interface MediaItem {
  to: string
  cover: string
  /** Set only on a collection, which has no cover of its own — see `collectionItem`. */
  covers?: string[]
  title: string
  subtitle?: string
  shape?: 'square' | 'circle'
  kind?: 'track' | 'album' | 'artist'
}

export const artistNames = (artists: Artist[] | undefined) =>
  (artists ?? []).map((artist) => artist.name).join(', ')

export const albumItem = (album: Album): MediaItem => ({
  to: albumLink(album),
  cover: coverUrl(album.coverUri),
  title: album.title,
  subtitle: artistNames(album.artists) || String(album.year ?? ''),
})

export const artistItem = (artist: Artist): MediaItem => ({
  to: artistLink(artist),
  cover: coverUrl(artist.cover?.uri),
  title: artist.name,
  shape: 'circle',
  kind: 'artist',
})

export const playlistItem = (playlist: Playlist): MediaItem => ({
  to: playlistLink(playlist),
  cover: playlistCoverUrl(playlist.cover),
  title: playlist.title,
  subtitle: playlist.description ?? playlist.owner?.name,
})

/** One entry of a mixed shelf, whichever of the three it turned out to be. */
export function mixedItem(mixed: MixedEntity): MediaItem {
  switch (mixed.type) {
    case 'playlist':
      return playlistItem(mixed.entity)
    case 'album':
      return albumItem(mixed.entity)
    case 'artist':
      return artistItem(mixed.entity)
  }
}

/** How many of each kind a collection holds — Russian needs the right noun. */
const COLLECTION_NOUNS = {
  'new-releases': ['альбом', 'альбома', 'альбомов'],
  'new-playlists': ['плейлист', 'плейлиста', 'плейлистов'],
} as const

/**
 * One card standing for a whole feed block. It borrows four of its own items'
 * covers rather than inventing artwork, so it reads as "several things" at a
 * glance and still looks like the shelf it sits in.
 */
export function collectionItem(collection: Collection): MediaItem {
  const [one, few, many] = COLLECTION_NOUNS[collection.key]
  return {
    to: collectionLink(collection.key),
    cover: '',
    covers: collection.items.slice(0, 4).map((item) => mixedItem(item).cover),
    title: collection.title,
    subtitle: plural(collection.items.length, one, few, many),
  }
}

export const trackAlbumItem = (track: Track): MediaItem => ({
  to: track.albums[0] ? albumLink(track.albums[0]) : '/',
  cover: coverUrl(track.coverUri),
  title: track.title,
  subtitle: artistNames(track.artists),
  kind: 'track',
})

const ruNumber = new Intl.NumberFormat('ru')

/** Chart listener counts run to seven digits — "404 700" reads, "404700" doesn't. */
export const formatCount = (count: number) => ruNumber.format(count)

const ruPlural = new Intl.PluralRules('ru')

/** Russian needs three forms — 1 трек, 2 трека, 5 треков. */
export function plural(count: number, one: string, few: string, many: string) {
  const forms = { one, few, many, two: few, other: many, zero: many }
  return `${count} ${forms[ruPlural.select(count)]}`
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00'
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** One track's length. */
export const formatDuration = (ms: number) => formatTime(ms / 1000)

/** A whole album or playlist — "385:54" is unreadable, "6 ч 26 мин" isn't. */
export function formatTotal(ms: number) {
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes} мин`
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`
}
