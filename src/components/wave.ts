import { waveStation } from '@/api/rotor'
import type { Artist, Track } from '@/api/types'

/**
 * The two waves the UI can start from something on screen, named the way the
 * buttons that start them are. One place, because a track's wave is offered
 * from three (the row's menu, the player bar and the full-screen player) and
 * the name has to read the same in all of them.
 */
export const trackWave = (track: Track) =>
  waveStation('track', track.id, `Волна по треку «${track.title}»`)

export const artistWave = (artist: Artist) =>
  waveStation('artist', String(artist.id), `Волна по артисту «${artist.name}»`)
