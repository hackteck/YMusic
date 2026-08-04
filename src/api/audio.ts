import { get, getBytes } from './client'
import { signFileInfo } from './sign'
import type { DownloadInfo } from './types'

/** mp3 only — the server maps `nq` to 192 kbps and `lossless` to 320 kbps. */
export type Quality = 'nq' | 'lossless'

const CODECS = 'mp3'
/** Enough for the current track plus a step in either direction. */
const CACHE_LIMIT = 3

const cache = new Map<string, string>()
const inFlight = new Map<string, Promise<string>>()

/** Composite ids ("<track>:<album>") sign and resolve by their numeric half. */
const numericId = (trackId: string) => trackId.split(':')[0]

async function downloadInfo(trackId: string, quality: Quality) {
  const ts = Math.floor(Date.now() / 1000)
  const id = numericId(trackId)
  const sign = await signFileInfo(ts, id, quality, CODECS)
  const { downloadInfo } = await get<{ downloadInfo: DownloadInfo }>('/get-file-info', {
    ts,
    trackId: id,
    quality,
    codecs: CODECS,
    transports: 'encraw',
    sign,
  })
  return downloadInfo
}

/**
 * AES-128-CTR over a zero counter block. The reference client counts in the
 * low 32 bits and this in all 128, which only diverges after 64 GB of audio.
 */
async function decrypt(bytes: ArrayBuffer, hexKey: string) {
  const raw = Uint8Array.from(hexKey.match(/../g)!, (byte) => parseInt(byte, 16))
  const key = await crypto.subtle.importKey('raw', raw, 'AES-CTR', false, ['decrypt'])
  return crypto.subtle.decrypt(
    { name: 'AES-CTR', counter: new Uint8Array(16), length: 128 },
    key,
    bytes,
  )
}

async function fetchAudio(trackId: string, quality: Quality) {
  const info = await downloadInfo(trackId, quality)
  const encrypted = await getBytes(info.urls[0])
  const audio = info.key ? await decrypt(encrypted, info.key) : encrypted
  return URL.createObjectURL(new Blob([audio], { type: 'audio/mpeg' }))
}

function remember(key: string, url: string) {
  cache.set(key, url)
  while (cache.size > CACHE_LIMIT) {
    const [oldest, oldestUrl] = cache.entries().next().value!
    URL.revokeObjectURL(oldestUrl)
    cache.delete(oldest)
  }
}

/**
 * A playable object URL for a track. The whole file is fetched and decrypted
 * up front — no MSE, no service worker: at the proxy's ~4 MB/s a track lands
 * in about a second, and `<audio>` then seeks and buffers natively.
 */
export function loadTrackAudio(trackId: string, quality: Quality): Promise<string> {
  const key = `${trackId}:${quality}`
  const cached = cache.get(key)
  if (cached) return Promise.resolve(cached)

  const pending = inFlight.get(key)
  if (pending) return pending

  const request = fetchAudio(trackId, quality)
    .then((url) => {
      remember(key, url)
      return url
    })
    .finally(() => inFlight.delete(key))

  inFlight.set(key, request)
  return request
}

/** Warms the cache for a track the user is likely to reach next. */
export const prefetchTrackAudio = (trackId: string, quality: Quality) => {
  loadTrackAudio(trackId, quality).catch(() => {})
}
