import { get, post } from './client'
import { getAlbums, getTracks } from './catalog'
import type { Album, Track } from './types'

export interface PlayReport {
  trackId: string
  /** The album this play is filed under — see `fromString`. */
  albumId?: number
  /** `<uid>:<kind>`, when the queue came from a playlist. */
  playlistId?: string
  /** The listener's own uid — the play is recorded against it. */
  uid: number
  /** Seconds of audio actually heard, which is not `currentTime` once anyone seeks. */
  played: number
  /** Where the head was when playback stopped. */
  position: number
  /** The track's own length. */
  length: number
}

/**
 * `<client>-<page>-<context>-<id>`, and the server does resolve it: sent as
 * `web-web-search-search` a play files under `context: unknown`, sent as
 * `android-album-album-<id>` it files under that album.
 *
 * **This is not cosmetic.** music.yandex.ru/music-history groups plays by
 * context and simply omits the ones it couldn't resolve — an unrecognised
 * `from` means the play is recorded and never seen. So every play names its
 * album, which every track has and which is the one context that was verified
 * to resolve; `playlist-id` still rides along when there is one.
 */
const fromString = (albumId: number | undefined) => `android-album-album-${albumId ?? ''}`

/**
 * Tells Yandex a track was played. Nothing else does — without this the app is
 * invisible to the site's history, to "Вы недавно слушали", and to everything
 * Yandex builds on top of them.
 */
export function reportPlay(report: PlayReport) {
  const now = new Date().toISOString()
  const form: Record<string, string> = {
    'track-id': report.trackId.split(':')[0],
    'album-id': String(report.albumId ?? ''),
    'from-cache': 'false',
    from: fromString(report.albumId),
    // Official clients send a per-play triple; the server only needs it to tell
    // two plays of the same track apart, which the timestamp already does.
    'play-id': '0-0-0',
    uid: String(report.uid),
    timestamp: now,
    'client-now': now,
    'track-length-seconds': String(Math.round(report.length)),
    'total-played-seconds': report.played.toFixed(2),
    'end-position-seconds': report.position.toFixed(2),
  }
  if (report.playlistId) form['playlist-id'] = report.playlistId

  return post<string>('/play-audio', form)
}

/** One track that was played, and when. */
export interface Listen {
  track: Track
  playedAt: Date
}

/** One album that was played, and when it last was. */
export interface AlbumListen {
  album: Album
  playedAt: Date
}

/** Both halves of `/contexts`, since they come out of the one response. */
export interface History {
  listens: Listen[]
  albums: AlbumListen[]
}

interface ContextsResponse {
  contexts: {
    context: string
    contextItem: string | number
    tracks: { trackId: { id: number | string }; timestamp: string }[]
  }[]
}

/**
 * How many contexts to ask for. Without it Yandex answers **five**, which is
 * the whole reason the history looked so short; 100 is its ceiling — a larger
 * number is accepted and still capped there. Each context carries only its
 * newest track, so this is also the number of plays that come back, spanning
 * about four months on an account in daily use.
 */
const CONTEXT_COUNT = 100

const newestPlay = (tracks: { timestamp: string }[]) =>
  new Date(Math.max(...tracks.map((entry) => Date.parse(entry.timestamp))))

/**
 * What was played, track by track. `/users/<uid>/contexts` is the only endpoint
 * that answers this — the landing block of the same name carries whole
 * playlists and albums instead, and the site's own /music-history page has no
 * endpoint on this API at all.
 *
 * It answers bare ids and timestamps, so the entities are a second, bulk call.
 * The response is grouped by the context a track was played from, and the
 * albums among those are worth keeping: they are what the history page's second
 * tab lists, and pulling them out here costs no extra round trip.
 */
export async function getListenHistory(uid: number): Promise<History> {
  const { contexts } = await get<ContextsResponse>(`/users/${uid}/contexts`, {
    contextCount: CONTEXT_COUNT,
  })

  const plays = contexts
    .flatMap((context) => context.tracks)
    .map((entry) => ({ id: String(entry.trackId.id), playedAt: new Date(entry.timestamp) }))
    .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())

  // `contextItem` is the album's id when the context is one; the other kinds —
  // artists, playlists, searches — have no tab here.
  const albumPlays = contexts
    .filter((context) => context.context === 'album' && context.tracks.length)
    .map((context) => ({ id: Number(context.contextItem), playedAt: newestPlay(context.tracks) }))
    .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())

  // One bulk call each for the distinct ids; both routes answer in their own
  // order and may drop an id, so entities are matched back by id, not position.
  const [tracks, albums] = await Promise.all([
    plays.length ? getTracks([...new Set(plays.map((play) => play.id))]) : [],
    albumPlays.length ? getAlbums(albumPlays.map((play) => play.id)) : [],
  ])

  const trackById = new Map(tracks.map((track) => [String(track.id).split(':')[0], track]))
  const albumById = new Map(albums.map((album) => [album.id, album]))

  return {
    listens: plays.flatMap((play) => {
      const track = trackById.get(play.id)
      return track ? [{ track, playedAt: play.playedAt }] : []
    }),
    albums: albumPlays.flatMap((play) => {
      const album = albumById.get(play.id)
      return album ? [{ album, playedAt: play.playedAt }] : []
    }),
  }
}
