import { get } from './client'
import { fetchProxied } from './proxy'
import { signLyrics } from './sign'

export interface LyricLine {
  /** Milliseconds into the track; `undefined` for unsynced text. */
  time?: number
  text: string
}

const LRC_LINE = /^\[(\d+):(\d+(?:\.\d+)?)\]\s?(.*)$/

function parseLrc(source: string): LyricLine[] {
  return source
    .split('\n')
    .map((line) => {
      const match = LRC_LINE.exec(line.trim())
      if (!match) return { text: line.trim() }
      const [, minutes, seconds, text] = match
      return { time: (Number(minutes) * 60 + Number(seconds)) * 1000, text }
    })
    .filter((line) => line.text || line.time !== undefined)
}

/**
 * Synced lyrics when the track has them, plain text otherwise. Returns an
 * empty list rather than throwing — a missing lyric is not an error.
 */
export async function getLyrics(trackId: string, synced: boolean): Promise<LyricLine[]> {
  const timeStamp = Math.floor(Date.now() / 1000)
  const id = trackId.split(':')[0]
  const sign = await signLyrics(id, timeStamp)

  try {
    const { downloadUrl } = await get<{ downloadUrl: string }>(`/tracks/${id}/lyrics`, {
      format: synced ? 'LRC' : 'TEXT',
      timeStamp,
      sign,
    })
    const text = await (await fetchProxied(downloadUrl)).text()
    return synced ? parseLrc(text) : text.split('\n').map((line) => ({ text: line }))
  } catch {
    return []
  }
}
