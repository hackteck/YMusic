import { token } from './session'

export const API = 'https://api.music.yandex.net'
export const OAUTH = 'https://oauth.yandex.ru'

/**
 * Yandex Music refuses requests from outside CIS, so every host it owns — api,
 * oauth, avatars and the audio CDNs — is fetched through the proxy in CIS named
 * by `VITE_YM_PROXY`: a URL-prefix proxy, the whole destination appended to it.
 *
 * Unset, the request goes straight to Yandex, which is what a deployment inside
 * CIS wants.
 */
const PROXY = import.meta.env.VITE_YM_PROXY

const prefix = PROXY ? (PROXY.endsWith('/') ? PROXY : `${PROXY}/`) : ''

export const withProxy = (url: string) => prefix + url

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const headers = () => ({
  Authorization: `OAuth ${token.value}`,
  'X-Yandex-Music-Client': 'YandexMusicAndroid/24023621',
  'Accept-Language': 'ru',
})

async function send(url: string, init?: RequestInit) {
  const response = await fetch(withProxy(url), {
    ...init,
    headers: { ...headers(), ...init?.headers },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new ApiError(response.status, body.slice(0, 200) || response.statusText)
  }
  return response
}

/** Unwraps the `{ invocationInfo, result }` envelope every JSON endpoint uses. */
export async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const entries = Object.entries(params ?? {}).map(([key, value]) => [key, String(value)])
  const query = entries.length ? `?${new URLSearchParams(entries)}` : ''
  const body = await (await send(API + path + query)).json()
  return 'result' in body ? body.result : body
}

/** POST with a form body — the shape Yandex uses for bulk ids. */
export async function post<T>(path: string, form: Record<string, string>): Promise<T> {
  const body = await (
    await send(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form),
    })
  ).json()
  return 'result' in body ? body.result : body
}

/** POST with a JSON body — only a station's `feedback` endpoint asks for one. */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const result = await (
    await send(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  ).json()
  return 'result' in result ? result.result : result
}

export async function getBytes(url: string, init?: RequestInit) {
  return (await send(url, init)).arrayBuffer()
}
