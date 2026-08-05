# YMusic

A Yandex Music client for the browser — Vue 3, mobile first, installable as a PWA.

It plays your library, the chart, radio stations and search results; it reports
plays back so the account's history stays real; and it downloads tracks with
their cover art and ID3 tags attached. The interface is Russian, because the API
answers in Russian and the service is CIS-only.

> **Unofficial.** This is a personal project built on Yandex Music's private
> mobile API, reverse-engineered from the Android client. It is not affiliated
> with, endorsed by, or supported by Yandex. You sign in with your own account
> and it only ever acts as that account. Some of it (lyrics) needs Plus.

---

## What it does

| | |
|---|---|
| **Home** | The personalised feed, normalised into shelves — "Плейлист дня" first, new releases and popular playlists folded into one card each |
| **Search** | One field, in the header, with a type-ahead panel: artists, tracks, albums and playlists under a heading each |
| **Library** | Liked tracks, albums, artists and playlists. The track list is virtualised — a 978-track library mounts ~34 rows, not all of them |
| **Radio** | 697 stations folded into seven browsable groups, plus a wave around any track or artist |
| **Chart** | The full hundred, Россия and Мир, with movement markers and listener counts |
| **History** | What was played, grouped into tracks and albums, with a play-count chart over the same data. Switchable off in settings |
| **Player** | A bar and a full-screen view (cover / lyrics / queue), MediaSession, shuffle, repeat, swipe-to-skip |
| **Downloads** | The bare CDN mp3 remuxed with cover art, tags and lyrics — nothing re-encoded |

Deliberately absent: podcasts, audiobooks, playlist editing, a queue *editor*,
offline caching of audio, i18n. See the end of [CLAUDE.md](CLAUDE.md) for why
each one.

---

## You need a proxy in CIS

This is the one piece of setup that isn't `npm install`, and there is no way
around it.

`VITE_YM_PROXY` names a **URL-prefix proxy** — the destination URL is appended
whole to it (`https://proxy.example/https://api.music.yandex.net/…`).
Everything Yandex owns goes through it: the API, OAuth, `avatars.yandex.net`
for covers, and the `strm.yandex.net` audio CDNs.

It is doing **two** jobs:

1. **Geography.** Yandex Music refuses requests from outside CIS.
2. **CORS.** `api.music.yandex.net` sends no `Access-Control-Allow-Origin` to
   this app's origin, and refuses the preflight for the `Authorization` header —
   so a request carrying the token can't be sent from a browser at all. The
   proxy answers with the headers Yandex won't.

Only the first job goes away inside CIS. **Running the app from Moscow with
`VITE_YM_PROXY` unset still gives you a broken app**, because the second one
doesn't.

The proxy **has to be https**. `crypto.subtle` signs every `get-file-info`
request and needs a secure context, so the page is https, and an https page
can't fetch an http proxy — mixed content. With both ends https there's nothing
left to bridge, which is why there's no serverless function in this repo doing
the hop.

The address is committed in [`.env`](.env) — it's public the moment the bundle
ships, and a clone should build something that works. Override it in
`.env.local` (gitignored) or with a real environment variable. **It's inlined at
build time**, so changing it means a rebuild, not just an edit.

Which is why the app has a way back when that address dies — the reference
deployment is on a rotating tunnel, and a bundle outlives its hostname. When a
request through the proxy can't be reached at all, `fetchProxied()` in
[src/api/proxy.ts](src/api/proxy.ts) re-reads `VITE_YM_PROXY` out of **master's
committed `.env`**, adopts it and retries once. Nothing is probed up front, so a
healthy launch pays nothing for it. If you're running your own fork, that's the
URL to change at the top of that file.

Installing the PWA changes none of this. A PWA is the same document in the same
browser engine under the same origin: requests still leave from the user's IP,
and a service worker's `fetch` obeys CORS exactly as the page's does.

---

## Running it

Node 20.19+ or 22.12+ (Vite 8's requirement; CI builds on the current LTS).

```bash
npm install
npm run dev      # vite, bound to 0.0.0.0 so a phone on the LAN can reach it
npm run build    # vue-tsc -b && vite build
npm run preview
npm run icons    # redraw public/icons/*.png from public/icons/icons.mjs
```

To point at your own proxy, write `.env.local`:

```
VITE_YM_PROXY=https://your-proxy.example/
```

Then open the app and sign in. Authentication is Yandex's OAuth **device flow**:
the login screen shows a code, you confirm it on `ya.ru/device`, and the app
polls until a token comes back. The code is a button — pressing it copies. A
token you already have can be pasted into the form below instead. It lives in
`localStorage`; there is no server side to this app and nothing else sees it.

### Developing against a local surstromming

The UI kit ([`@surstromming/*`](https://www.npmjs.com/search?q=%40surstromming))
is installed from npm. To try a kit change before publishing it, add
`"workspaces": ["../surstromming/packages/*"]` to `package.json`,
`resolve.dedupe: ['vue']` to `vite.config.ts` and `"preserveSymlinks": true` to
`tsconfig.app.json` — all three, or you get two Vues in one bundle and a
typechecker that stops unwrapping refs. **All three come back out before a
deploy**, since the path doesn't exist on CI. Don't reach for
`install-links=true`: it copies instead of symlinking and then quietly serves
stale code.

---

## How the interesting parts work

**Audio is decrypted in the browser.** `get-file-info` answers `encraw` CDN
links plus a hex AES key; the bytes are AES-128-CTR over a zero counter block.
The file is fetched and decrypted **whole** through WebCrypto, then handed to
`<audio>` as a blob URL — at the measured ~3.7 MB/s a track arrives in about a
second and a half, and once it's a blob the browser owns seeking and buffering
for free. A 3-entry LRU holds the current track plus a step either way, and the
next track is prefetched on every change.

**Downloads are remuxed, not re-encoded.** The CDN hands over a bare mp3 with no
title, artist or artwork. `src/api/tags.ts` runs a single-thread FFmpeg 4.3 wasm
build (`-c copy`) to attach ID3v2.3 tags, the cover — converted to JPEG first,
since 4.3 has no PNG decoder — and lyrics where there are any. Single-thread
means no `SharedArrayBuffer`, which means none of the cross-origin isolation
headers a static host can't easily send. The 19 MB of wasm is loaded lazily on
the first download and is deliberately kept out of the service worker's
precache.

**Listening is reported explicitly.** `POST /play-audio` is the only thing that
puts a track in the account's history, and its `from` parameter has to resolve
to a real context or the play is accepted and then silently dropped — so every
play names its album. Short plays are dropped by Yandex too; the app reports
what was actually heard, ignoring seeks, and doesn't try to guess the threshold.
Radio adds `/rotor/…/feedback`, which is what "Моя волна" learns from.

**Radio is a window, not a playlist.** `/rotor` hands out five tracks at a time
and `&queue=<last id>` asks for the next five, so the queue extends one track
before it runs out and never has an end to hit.

---

## Layout

```
src/
  api/          Yandex Music protocol. Knows nothing about stores or components.
                client.ts (the proxy + the envelope), audio.ts (AES-CTR),
                tags.ts (ffmpeg), sign.ts, history.ts, rotor.ts, …
  components/   media.ts maps any entity to one MediaItem — every page is a
                .map(), not its own card markup. player/ is the bar and screen.
  composables/  useTheme, useSidebar, useVirtualRows, useTrackDownload, …
  css/          shell.scss (the app grid) and tokens.scss (app-level tokens)
  pages/        One directory per route
  stores/       player, auth, likes — app state only
public/
  ffmpeg/       The 19 MB single-thread FFmpeg 4.3 build
  icons/        The PNG set, and icons.mjs that draws it (npm run icons)
```

Styling is SCSS + CSS Modules on top of
[surstromming](https://www.npmjs.com/search?q=%40surstromming). The kit is repainted
through the tokens its own variants already read — never by out-specifying its
CSS — so hover, focus rings and dark mode keep working. Where the kit itself is
wrong it gets fixed and republished there, not forked here.

[CLAUDE.md](CLAUDE.md) is the long-form record of every decision in this repo
and why it went that way, including the ones that were wrong first.

---

## Deploying

`.github/workflows/vercel.yml` ships every push to `master`, and also takes a
manual dispatch — which is what a rotated proxy address needs, since the address
is inlined at build time. It writes `vercel.json` itself (a rewrite of
everything to `index.html`, for the history router). Needs one secret:

- `VERCEL_TOKEN`

`.github/workflows/update-proxy.yml` exists because the reference deployment
uses a Cloudflare **quick** tunnel, whose hostname rotates on every start. It
restarts the tunnel over SSH, reads the new hostname out of the log, **proves it
forwards** before writing anything, commits `.env`, then dispatches the other
workflows by hand — a push authenticated with `GITHUB_TOKEN` fires no `push`
event, so the deploy would otherwise never run. Its schedule is commented out;
enable it if you're on a quick tunnel too. Needs:

- `VDSINA_SSH_KEY` — the private key for the box in CIS
- `VDSINA_HOST` / `VDSINA_USER` — optional, override the defaults in the file

If your proxy has a stable hostname, delete this workflow and set
`VITE_YM_PROXY` once — the runtime fallback then never has anything to do, since
`.env` on master and the build agree.

---

## License

[MIT](LICENSE) © Evgeniy Mnatsakanov
