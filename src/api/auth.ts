import { OAUTH } from './client'
import { fetchProxied, withProxy } from './proxy'
import { token } from './session'

/** Public OAuth credentials of the official Yandex Music Android app. */
const CLIENT_ID = '23cabbbdc6cd418abb4b39c32c41195d'
const CLIENT_SECRET = '53bc75238f0c4d08a118e51fe9203300'

export interface DeviceCode {
  device_code: string
  user_code: string
  verification_url: string
  expires_in: number
  interval: number
}

const form = async <T>(path: string, body: Record<string, string>): Promise<T> => {
  const response = await fetchProxied(OAUTH + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  return response.json()
}

export const requestDeviceCode = () =>
  form<DeviceCode>('/device/code', {
    client_id: CLIENT_ID,
    device_id: Math.random().toString(36).slice(2, 12),
    device_name: 'YMusic Web',
  })

/**
 * One poll of the device flow. `authorization_pending` means the user hasn't
 * confirmed yet — keep calling; any other error is fatal.
 */
export const pollForToken = (deviceCode: string) =>
  form<{ access_token?: string; error?: string }>('/token', {
    grant_type: 'device_code',
    code: deviceCode,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  })

/**
 * The account's avatar, which `/account/status` doesn't carry — it's the
 * passport that has one, and the same OAuth token reads it. `default_avatar_id`
 * is a path segment on `avatars.yandex.net`, so the size is ours to pick.
 *
 * Empty string rather than a throw: the header falls back to the initials, and
 * a missing picture is not a failed sign-in.
 */
export async function getAvatarUrl(): Promise<string> {
  try {
    const response = await fetchProxied('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${token.value}` },
    })
    if (!response.ok) return ''

    const info: { default_avatar_id?: string; is_avatar_empty?: boolean } = await response.json()
    if (!info.default_avatar_id || info.is_avatar_empty) return ''
    return withProxy(`https://avatars.yandex.net/get-yapic/${info.default_avatar_id}/islands-200`)
  } catch {
    return ''
  }
}
