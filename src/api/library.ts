import { get, post } from './client'
import { getAlbums, getTracks } from './catalog'
import type { Account, Album, Artist, Playlist, Track } from './types'

export const getAccount = async () => (await get<{ account: Account }>('/account/status')).account

export const getUserPlaylists = (uid: number) => get<Playlist[]>(`/users/${uid}/playlists/list`)

/** Likes come back as bare ids — the heart only ever needs these. */
export async function getLikedTrackIds(uid: number): Promise<string[]> {
  const { library } = await get<{ library: { tracks: { id: string }[] } }>(
    `/users/${uid}/likes/tracks`,
  )
  return library.tracks.map((entry) => entry.id)
}

/** The library page needs the entities too, which is a second, bulk call. */
export async function getLikedTracks(uid: number): Promise<Track[]> {
  const ids = await getLikedTrackIds(uid)
  return ids.length ? getTracks(ids) : []
}

// Not symmetric, and not a typo: adding goes through the bulk route (there is
// no single-track one), removing has its own. Both take `track-ids` and answer
// 200 with the usual envelope.
export const likeTrack = (uid: number, id: string) =>
  post<unknown>(`/users/${uid}/likes/tracks/add-multiple`, { 'track-ids': id })

export const unlikeTrack = (uid: number, id: string) =>
  post<unknown>(`/users/${uid}/likes/tracks/remove`, { 'track-ids': id })

export async function getLikedAlbums(uid: number): Promise<Album[]> {
  const likes = await get<{ id: number }[]>(`/users/${uid}/likes/albums`)
  const ids = likes.map((like) => like.id)
  return ids.length ? getAlbums(ids) : []
}

export const getLikedArtists = (uid: number) => get<Artist[]>(`/users/${uid}/likes/artists`)

// Asymmetric the same way the track routes are, and in the same direction —
// except the field names differ too: `artistId` singular to add, `artistIds`
// plural to remove. Both verified by a like/unlike round trip against the
// live API; sending the wrong one answers a `validate` error, not a 200.
export const likeArtist = (uid: number, id: number | string) =>
  post<unknown>(`/users/${uid}/likes/artists/add`, { artistId: String(id) })

export const unlikeArtist = (uid: number, id: number | string) =>
  post<unknown>(`/users/${uid}/likes/artists/remove`, { artistIds: String(id) })

export async function getLikedPlaylists(uid: number): Promise<Playlist[]> {
  const likes = await get<{ playlist: Playlist }[]>(`/users/${uid}/likes/playlists`)
  return likes.map((like) => like.playlist)
}
