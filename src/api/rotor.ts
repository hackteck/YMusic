import { get, postJson } from './client'
import type { Track } from './types'

/**
 * A station is addressed by a pair — `user:onyourwave`, `genre:rock`,
 * `artist:79215` — and that string is what every `/rotor/station/…` path takes.
 */
export interface StationId {
  type: string
  tag: string
}

export interface Station {
  id: StationId
  name: string
  /**
   * A `%%`-templated avatars path, like a cover, plus the tile colour Yandex
   * draws it on. Absent on the waves built below, which are never shown as a
   * tile — everything from `/rotor/stations/*` has one.
   */
  icon?: { backgroundColor: string; imageUrl: string }
  fullImageUrl?: string
  /** Only genre stations have one, and it is always another genre. */
  parentId?: StationId
}

export const stationKey = (id: StationId) => `${id.type}:${id.tag}`

/**
 * A wave built around one thing the user is looking at rather than picked from
 * the catalogue. `track:<id>` and `artist:<id>` are real stations — verified
 * against the live API — but they appear in **no** listing, so there is no
 * station object to look up and one is made here.
 *
 * Composite track ids (`"123:456"`) address by their numeric half, like
 * everything else that takes a track id.
 */
export const waveStation = (type: 'track' | 'artist', id: string, name: string): Station => ({
  id: { type, tag: String(id).split(':')[0] },
  name,
})

/** Both station endpoints wrap the station next to settings the UI doesn't set. */
interface StationEntry {
  station: Station
}

/** The user's own: "Моя волна" first, then the genres they actually listen to. */
export const getDashboard = async () =>
  (await get<{ stations: StationEntry[] }>('/rotor/stations/dashboard')).stations.map(
    (entry) => entry.station,
  )

/** Every station there is — ~700 of them, which is why only /radio asks for it. */
export const getStations = async () =>
  (await get<StationEntry[]>('/rotor/stations/list')).map((entry) => entry.station)

/**
 * A station hands out **five** tracks at a time, so a wave is a five-deep
 * window rather than a playlist: `queue` is the id of the last track handed
 * out, and passing it back is what asks for the next five.
 */
export interface StationBatch {
  /** Rides on every feedback event for these five tracks. */
  batchId: string
  tracks: Track[]
}

interface TracksResponse {
  sequence: { track: Track }[]
  batchId: string
}

export async function getStationTracks(id: StationId, after?: string): Promise<StationBatch> {
  const params: Record<string, string> = { settings2: 'true' }
  if (after) params.queue = after
  const { sequence, batchId } = await get<TracksResponse>(
    `/rotor/station/${stationKey(id)}/tracks`,
    params,
  )
  return { batchId, tracks: sequence.map((entry) => entry.track) }
}

/**
 * What personalises the wave. Unlike `/play-audio`, which a station stream
 * still works without, skipping this makes "Моя волна" stop learning — the
 * station keeps answering the same kind of thing forever.
 */
export type FeedbackType = 'radioStarted' | 'trackStarted' | 'trackFinished' | 'skip'

export interface Feedback {
  station: StationId
  type: FeedbackType
  batchId?: string
  trackId?: string
  /** Only the two events that end a track carry one. */
  totalPlayedSeconds?: number
}

export function sendFeedback(feedback: Feedback) {
  const { station, batchId, ...event } = feedback
  const query = batchId ? `?batch-id=${encodeURIComponent(batchId)}` : ''
  return postJson<string>(`/rotor/station/${stationKey(station)}/feedback${query}`, {
    ...event,
    timestamp: new Date().toISOString(),
    from: `radio-${stationKey(station)}`,
  })
}
