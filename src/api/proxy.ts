/**
 * The proxy address — where it comes from, and what happens when it dies.
 *
 * Every Yandex host is fetched through the box in CIS named by `VITE_YM_PROXY`:
 * a URL-prefix proxy, the whole destination URL appended to it. Unset, the
 * request goes straight to Yandex, which is what a deployment inside CIS asks
 * for.
 *
 * That address is inlined at **build** time and the box is reached through a
 * Cloudflare *quick* tunnel, whose hostname changes every restart — so a bundle
 * outlives its address. `update-proxy.yml` commits the new one and redeploys,
 * but between the rotation and that deploy landing — and for as long as a
 * browser, or an installed PWA, still holds the old shell — the built-in address
 * is dead and nothing works at all: no API, no covers, no audio.
 *
 * The rotation writes master's `.env` before it does anything else, so that file
 * is the fallback. It's read only once a request has actually failed, so a
 * healthy launch pays nothing for it, and the address it names is adopted for
 * the rest of the session and remembered for the next one.
 */

const BUILT_IN = import.meta.env.VITE_YM_PROXY ?? ''

/** master's own `.env`: the address the rotation commits, ahead of any build. */
const ENV_URL = 'https://raw.githubusercontent.com/hackteck/YMusic/refs/heads/master/.env'

const storageKey = 'ym-proxy'

const slashed = (url: string) => (url && !url.endsWith('/') ? `${url}/` : url)

let prefix = slashed(BUILT_IN)

export const withProxy = (url: string) => prefix + url

/**
 * A recovered address is remembered so the next launch doesn't have to fail to
 * find it again — but only against the build it stood in for. A later deploy
 * carries a fresh `VITE_YM_PROXY`, which is newer than anything stored and wins.
 */
function restore() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (stored?.proxy && stored.replaced === BUILT_IN) prefix = slashed(stored.proxy)
  } catch {
    // Unreadable or no storage at all (Safari, private) — the build's it is.
  }
}

function remember(proxy: string) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ proxy, replaced: BUILT_IN }))
  } catch {
    // Storage being full or off costs the next launch a retry, nothing more.
  }
}

restore()

/** Reads the address out of a dotenv file — one line, optionally quoted. */
function parseAddress(env: string) {
  const value = /^\s*VITE_YM_PROXY\s*=\s*(.+?)\s*$/m.exec(env)?.[1].replace(/^["']|["']$/g, '')

  // https or nothing: an https page can't fetch an http proxy, and a bad parse
  // would otherwise be written to storage and outlive the session.
  return value?.startsWith('https://') ? slashed(value) : ''
}

async function fetchAddress() {
  // `no-store` and a cachebuster, because raw.githubusercontent.com serves a
  // five-minute cache and the entire reason for reading this file is that it
  // changed. The query string isn't part of the path, so it can't 404.
  const response = await fetch(`${ENV_URL}?_=${Date.now()}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`.env answered ${response.status}`)
  return parseAddress(await response.text())
}

let attempt: Promise<boolean> | null = null

/**
 * Adopts master's address, and answers whether that gave us a new one to try.
 *
 * Once per page load, however many requests failed at once and whether or not it
 * worked: an address doesn't come back to life by itself, so a second read of
 * the same file has nothing to add, and a reload is the retry. `false` when the
 * file was unreachable or names the address that just failed.
 */
function switched(): Promise<boolean> {
  attempt ??= (async () => {
    // Nothing configured is a deliberate "talk to Yandex directly", not an
    // address to repair. Fetching one would quietly undo that choice.
    if (!BUILT_IN) return false

    try {
      const address = await fetchAddress()
      if (!address || address === prefix) return false
      prefix = address
      remember(address)
      return true
    } catch {
      return false
    }
  })()

  return attempt
}

/**
 * A dead tunnel is not an HTTP status the app gets to read: Cloudflare answers
 * 530 (its error 1033) with no CORS headers of its own, and once the hostname
 * stops resolving there's no answer at all — either way `fetch` rejects. So a
 * rejection is the signal, and the readable 5xx Cloudflare serves while a fresh
 * tunnel registers is taken as one too.
 */
const UNREACHABLE = new Set([502, 503, 530])

/**
 * `fetch` through the proxy, given the *destination* URL — prefixed here rather
 * than by the caller, so a retry goes to the address we've just switched to.
 *
 * Retrying is safe on any method, POSTs included: both branches below mean the
 * request never reached Yandex. A rejection is DNS, CORS or the tunnel, and the
 * proxy is the thing that answers with CORS headers at all — if it answered, it
 * forwarded; a 530 is Cloudflare with nowhere to forward to.
 */
export async function fetchProxied(url: string, init?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(withProxy(url), init)
    if (!UNREACHABLE.has(response.status)) return response
    return (await switched()) ? fetch(withProxy(url), init) : response
  } catch (error) {
    if (await switched()) return fetch(withProxy(url), init)
    throw error
  }
}
