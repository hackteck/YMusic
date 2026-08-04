import { get, post } from './client'
import type { Album, Artist, Playlist, Track } from './types'

export const getTracks = (ids: string[]) =>
  post<Track[]>('/tracks', { 'track-ids': ids.join(',') })

export const getTrack = async (id: string) => (await get<Track[]>(`/tracks/${id}`))[0]

export const getAlbum = (id: number | string) => get<Album>(`/albums/${id}/with-tracks`)

/**
 * The bulk route, for the pages that hold ids — likes and the history.
 *
 * An album that has since been taken down comes back as `{ id, error }` rather
 * than being dropped, and a stub with no title reaches the card as one. Filtered
 * here, so neither caller has to know the route answers two shapes.
 */
export async function getAlbums(ids: (number | string)[]): Promise<Album[]> {
  const albums = await post<(Album | { id: number; error: string })[]>('/albums', {
    'album-ids': ids.join(','),
  })
  return albums.filter((album): album is Album => !('error' in album))
}

export const getPlaylist = (uid: number | string, kind: number | string) =>
  get<Playlist>(`/users/${uid}/playlists/${kind}`)

export interface ArtistPage {
  artist: Artist
  popularTracks: Track[]
  albums: Album[]
  similarArtists: Artist[]
}

export const getArtist = (id: number | string) => get<ArtistPage>(`/artists/${id}/brief-info`)

interface ArtistTracks {
  tracks: Track[]
  pager?: { page: number; perPage: number; total: number }
}

const ARTIST_PAGE = 100

/**
 * A ceiling. This is both a play queue and a page, and a handful of artists
 * carry several thousand tracks — ten requests is as far as either is worth
 * waiting for. `total` says what was really there, so the page can admit it.
 */
const ARTIST_TRACKS = 1000

export interface ArtistTrackList {
  tracks: Track[]
  /** Everything the artist has, which past the ceiling is more than `tracks`. */
  total: number
}

/**
 * Everything the artist has, not the handful `brief-info` calls popular —
 * in the API's own order, most popular first.
 *
 * The first page carries the total, so the rest go out **together** rather than
 * one after another: a list that takes ten round trips to arrive is a button
 * that looks broken.
 */
export async function getArtistTracks(id: number | string): Promise<ArtistTrackList> {
  const page = (index: number) =>
    get<ArtistTracks>(`/artists/${id}/tracks`, { page: index, 'page-size': ARTIST_PAGE })

  const first = await page(0)
  const total = first.pager?.total ?? first.tracks.length

  const rest = []
  for (let index = 1; index * ARTIST_PAGE < Math.min(total, ARTIST_TRACKS); index++) {
    rest.push(page(index))
  }

  const pages = await Promise.all(rest)
  return { tracks: [first.tracks, ...pages.map((one) => one.tracks)].flat(), total }
}

export interface SearchResults {
  best?: { type: string; result: Track | Album | Artist | Playlist }
  tracks?: { results: Track[] }
  albums?: { results: Album[] }
  artists?: { results: Artist[] }
  playlists?: { results: Playlist[] }
}

/**
 * `/search` is the one endpoint that answers a track's `id` as a **number**;
 * every other one answers a string. Left as it arrives it reaches `id.split(…)`
 * in the likes store and in the audio loader, so a track found by searching
 * simply refuses to play. Coerced here, at the edge, rather than teaching four
 * call sites that one endpoint is different.
 */
const withStringId = (track: Track): Track => ({ ...track, id: String(track.id) })

export async function search(text: string, page = 0) {
  const results = await get<SearchResults>('/search', {
    text,
    type: 'all',
    page,
    nocorrect: 'false',
  })
  if (results.tracks) results.tracks.results = results.tracks.results.map(withStringId)
  return results
}

/** The artist page's own shelf carries ten; this carries all of them. */
export const getSimilarArtists = async (id: number | string) =>
  (await get<{ artist: Artist; similarArtists: Artist[] }>(`/artists/${id}/similar`))
