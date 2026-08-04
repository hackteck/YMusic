/** HMAC key lifted from the Android app — the same one for both schemes below. */
const SIGN_KEY = 'p93jhgh689SBReK6ghtw62'

let keyPromise: Promise<CryptoKey> | undefined

const hmacKey = () =>
  (keyPromise ??= crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SIGN_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  ))

async function hmacBase64(message: string) {
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(), new TextEncoder().encode(message))
  return btoa(String.fromCharCode(...new Uint8Array(mac)))
}

/**
 * `get-file-info` signs the parameter *values* concatenated in the order they
 * are sent, commas stripped, and drops the base64 padding.
 */
export function signFileInfo(ts: number, trackId: string, quality: string, codecs: string) {
  const message = `${ts}${trackId}${quality}${codecs}encraw`.replaceAll(',', '')
  return hmacBase64(message).then((sign) => sign.slice(0, -1))
}

/** Lyrics sign only `trackId + timestamp`, and keep the padding. */
export const signLyrics = (trackId: string, timeStamp: number) => hmacBase64(`${trackId}${timeStamp}`)
