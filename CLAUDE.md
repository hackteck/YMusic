# Project decisions & requirements

A Yandex Music client for the browser — Vue 3 + SCSS/CSS Modules, built on the
**surstromming** UI kit (`@surstromming/*`, installed from npm; source lives at
`D:\Dev\surstromming`). **Mobile first.** Code is written for humans: short,
explicit, DRY, no cleverness. Comments explain a non-obvious *why* — never
narrate what the code plainly does.

The API protocol was reverse-engineered in `D:\Dev\yandex-music`; its
`docs/API.md` is the reference for anything not repeated here.

## The proxy — the browser talks to it directly

Yandex Music rejects requests from outside CIS. All of it —
`api.music.yandex.net`, `oauth.yandex.ru`, `avatars.yandex.net` (covers) and the
`strm.yandex.net` audio CDNs — goes through the box in CIS, and all of that
arrangement lives in `src/api/proxy.ts`: `withProxy()` prepends `VITE_YM_PROXY`
to the destination URL — a **URL-prefix proxy** (`https://…/https://api.music…`)
— and `fetchProxied()` is that plus the recovery below. Unset, the URL is used
as-is. Nothing outside that module prefixes a URL itself, which is what lets the
address change under a running app.

It is doing **two** jobs, and they're worth keeping apart, because only one of
them is about geography: it puts the request in CIS, *and* it answers with the
CORS headers `api.music.yandex.net` won't. Inside CIS the first job is redundant
and the second is not, so unsetting it there still leaves a broken app — the
bullets below have the measurement.

The address lives in `.env`, committed: it's public the moment the bundle ships,
and a clone should build something that works. `.env.local` (gitignored) or a
real environment variable overrides it — that's the order Vite's `loadEnv` reads
them in — and it's inlined at **build** time, so a new address means a rebuild,
not just an edit.

### So a bundle outlives its address, and reads the new one off master

The tunnel rotates (see `update-proxy.yml` below) and the address is baked into
the bundle, so there is always a window where what's running points at a hostname
nothing is listening on: between the rotation and the deploy finishing, and for
however long a browser — or an installed PWA, whose shell is precached — keeps
serving the old build. In that window *nothing* works, not just one request: no
API, no covers, no audio.

The rotation writes master's `.env` before it does anything else, so that file is
always at least as current as any build, and it's plain text on
`raw.githubusercontent.com` with `access-control-allow-origin: *` — a page can
just read it. So `fetchProxied()` catches the failure and repairs itself: it
re-reads that file, adopts the address it names, and retries the request once.

The parts of that worth not re-deriving:

- **A dead quick tunnel is not a status code the app gets to read.** Cloudflare
  answers 530 (its error 1033) with no CORS headers of its own, and once the
  hostname stops resolving there's nothing at all — either way `fetch` *rejects*.
  So a rejection is the signal, and the 502/503/530 Cloudflare serves while a
  fresh tunnel registers is treated as one too (the same statuses
  `update-proxy.yml` retries past).
- **Retrying is safe on any method, POSTs included**, because both of those
  branches mean the request never reached Yandex: the proxy is the thing that
  answers with CORS headers at all, so if it answered it forwarded, and a 530 is
  Cloudflare with nowhere to forward to.
- **It's a repair, not a probe.** Nothing is checked up front — a healthy launch
  pays nothing, and the cost only lands on the launch that was already broken.
  One read of the file per page load however many requests failed at once, and
  whether or not it worked: an address doesn't come back to life by itself, so a
  second read has nothing to add and a reload is the retry.
- **The recovered address is remembered, but only against the build it stood in
  for** — stored with the `VITE_YM_PROXY` it replaced. A later deploy carries a
  fresh one, which is newer than anything in localStorage and wins; without that
  comparison a recovered address would outlive its own rotation and every launch
  would start by failing.
- **`withProxy()` stays synchronous**, because `<img src>` (covers, the avatar)
  needs a URL and not a promise. It reads a mutable prefix, so the repair reaches
  everything built after it — which is every cover, since covers come from the
  API response whose request is what triggers the repair.
- **Nothing configured is left alone.** Unset means "talk to Yandex directly", a
  deliberate choice inside CIS, not an address to go and fix.
- What this can't fix is a tunnel that rotated *without* the workflow, since then
  master's `.env` is stale too, and a client that can't reach GitHub either.

**The proxy has to be https**, and that is the whole reason this shape works.
`crypto.subtle` signs every `get-file-info` and needs a secure context, so the
page is https; an https page can't fetch an http proxy (mixed content), which
is what confined the app to `localhost` before the proxy was published under a
TLS hostname. With both ends https there's nothing left to bridge.

**There is no `/api/proxy` function any more.** The app did route every request
through an edge function, so the page could be https while the hop to the http
proxy happened server-side. Vercel's edge runtime only permits outbound fetch on
ports 80 and 443, so it could never reach the proxy on `:8080` — and a Node
function caps its response at 4.5 MB, less than a track. Giving the proxy a TLS
hostname solved the same problem without a hop.

`vercel.json` (written by the deploy workflow, not committed) rewrites
everything to `index.html`, for the history router. The workflow ships **every
push to `master`**, and still takes a manual dispatch — which is what a rotated
proxy address needs, since it's inlined at build time.

**The address is a Cloudflare quick tunnel, so it rotates, and
`update-proxy.yml` is what keeps up with it.** Every start of
`cloudflared tunnel --url` mints a fresh `*.trycloudflare.com` and kills the one
before it, so overnight the workflow restarts the tunnel on the box in CIS over
SSH, reads the new hostname out of its log, **proves it forwards** before
writing anything — a dead address committed and deployed is a broken app until
someone notices — then rewrites `.env` and pushes. It ends by starting every
other workflow itself: a push authenticated with `GITHUB_TOKEN` deliberately
fires no `push` event, so the deploy would never run, and `workflow_dispatch` is
the documented exception to that rule. Without the rebuild the commit is inert
anyway. It asks the API which workflows the repo has rather than naming
`vercel.yml`, so a new workflow doesn't mean remembering this one — the cost is
that anything without a `workflow_dispatch:` trigger can't be started this way,
which a PAT or a deploy key would fix by making the push a real push.
It needs one secret, `VDSINA_SSH_KEY` — `GITHUB_TOKEN` is minted per run and is
not one to add; the host and user are literals
with `VDSINA_HOST` / `VDSINA_USER` overriding them if the repo should stop
naming the box.

Verified, and the reason the app needs nothing else of its own:

- **CORS is not a free pass, and `api.music.yandex.net` is the host that isn't.**
  This used to read "Yandex answers `access-control-allow-origin: *` on every
  host" — it doesn't, and the mistake was measuring *through the proxy*, which
  adds that header itself and got credited for Yandex's. Re-measured 2026-07-27
  from a browser in CIS, straight at each host, no proxy: `avatars.yandex.net`,
  `oauth.yandex.ru` and `login.yandex.ru` all allow the app's origin, and the
  API host allows nothing. A plain `GET /landing3` is blocked with "No
  'Access-Control-Allow-Origin' header is present", and — the half that really
  settles it — the **preflight** for the `Authorization` header is refused the
  same way, so a request carrying the token can't be sent at all, whatever a
  200 would have answered. (`Access-Control-Allow-Origin` is not a safelisted
  response header, so reading it back off `Response.headers` says `null` even
  where it's present and working. Whether the fetch *throws* is the signal.)
  So **the proxy is doing two jobs, not one**, and only the geoblock half goes
  away inside CIS. Untested since: whether the audio CDNs still allow a direct
  fetch — their URLs are signed and short-lived, so there was nothing to probe
  with.
- The CDNs honour `Range` (206). Nothing uses it: audio is fetched whole.
- Measured throughput ≈ **3.7 MB/s** — a 4-minute 192 kbps track is ~5.5 MB.

## Installing it — and no, that doesn't retire the proxy

The app is an installable PWA: a manifest, an icon set and a service worker, all
of it configured in one `VitePWA({ … })` block in `vite.config.ts` so the
manifest has one place to live.

**Installing retires neither half of the proxy.** It's tempting to read
"installed app" as "not a web page any more", and it isn't: a PWA is the same
document in the same browser engine, under the same origin, with the same
network stack. Requests still leave from the user's own IP, so the geoblock is
untouched — and **installation grants no CORS privileges either**, which is the
tempting half to believe, since the app does have a service worker now. A
worker's `fetch` obeys CORS exactly as the page's does; `no-cors` buys an
opaque response the app can't read a byte of, and there is no manifest key that
relaxes any of it. What genuinely does escape CORS is a *different runtime* —
an extension with `host_permissions`, Electron with `webSecurity` off, a
Capacitor/Cordova native HTTP plugin. A PWA, and an Android TWA, are neither.

So the box in CIS stays necessary installed, in a tab, and inside CIS: see the
CORS bullet above for which of its two jobs each of those does and doesn't drop.

What the worker does buy is the shell offline — precached app, no reason for a
launch from the home screen to ever show a browser error page — and the
installability Chrome asks a service worker for. That's the end of it: the
audio, the API, the covers and the 19 MB of ffmpeg are all deliberately
uncached, so "offline caching" stays where it is under **Deliberately absent**.
An installed app that opens, says it has no music and can't play any is not
worth the cache it would take. `globIgnores` keeps ffmpeg out by name — the
whole point of it is being lazy, and precaching it would charge every install
for a feature most sessions never reach.

`registerType: 'prompt'`, and **not `autoUpdate`** — that reloads the tab as
soon as a new build lands, which stops whatever is playing mid-track. Nothing
calls the prompt either, so a new worker just waits and takes over the next time
the app is launched with nothing else open, the way the plain SW lifecycle
already does. A "new version available" bar is UI this app hasn't earned.

`navigateFallback` is what makes the history router survive a cold offline
launch: any path the network can't answer is `index.html`, which is precached.

### The icons, and the chrome around them

`public/icons/icons.mjs` draws the four PNGs beside it (`npm run icons`) from
the same six capsules `favicon.svg` strokes, so the mark is defined once. It
lives with its output rather than in a `scripts/` of its own, and the price of
that is `public/` being copied verbatim — the generator ships to `/icons/`
along with the icons. It's 4 KB of arithmetic with nothing private in it, so
that's a fair trade for keeping the two together. It has no
dependencies on purpose — the whole icon is six line segments and a rounded
square, which is less code than a rasteriser is a dependency, and Node's own
zlib is the only hard part of writing a PNG. The `any` pair round their own
corners since nothing else will; the maskable one and Apple's are full bleed
with a smaller mark, because Android crops to the inner 80% and iOS lays its
squircle over the top. They're committed; the script is for when the brand
colour or the mark changes.

The manifest's `theme_color` can't follow the theme toggle, so it commits to
dark and only ever covers the splash. The running page is governed by
`<meta name="theme-color">`, which `useTheme` rewrites on every flip — installed,
that meta *is* the status bar on iOS and the title bar everywhere else, so it
has to keep in step or half the chrome is the wrong colour.

`apple-mobile-web-app-status-bar-style` is **`black-translucent`**, which is the
only one of the three that suits both themes: the other two paint a fixed white
or black band above an app that might be either. Translucent means the page runs
under the status bar and paints it itself — the reason the shell carries safe
areas at all. They land in three places, and the split is about positioning, not
taste:

- `shell.scss` holds the top inset as padding on `#app`, not on the header. The
  body is already painted `background`, which is the header's own colour, so the
  strip above it needs nothing else to fill it — and a rule on the header would
  have to restate the package's `spacing(2)` to add to it rather than replace it.
- The bottom inset goes on the **player**, so its `sidebar` background fills the
  home indicator's strip instead of leaving a band of another colour under it.
  With nothing playing there's no `<footer>` at all, and `:not(:has(> footer))`
  hands it to `main` instead — whatever is genuinely last takes it.
- `AppNav`'s drawer and `PlayerScreen` are `position: fixed`, measured against
  the viewport, so the shell's padding passes them by and each holds its own.
  The drawer's is mobile-only: from `md` it's back in the grid and a second
  helping would count the inset twice.

In a browser tab every one of those insets is `0` and none of it shows.

## Audio: whole file → WebCrypto → blob URL

`get-file-info` returns `transports=encraw` CDN links plus a hex AES key; the
bytes are **AES-128-CTR** over a zero counter block (`src/api/audio.ts`). The
reference client counts in the low 32 bits and WebCrypto here in all 128 —
identical until 64 GB of audio.

The file is fetched and decrypted **in full**, then handed to `<audio>` as a
blob URL. MSE and a decrypting service worker were both considered and
rejected: at 3.7 MB/s a track arrives in ~1.5 s, and once it's a blob the
browser owns seeking and buffering for free. Revisit only if the proxy gets
slow — the shape to reach for then is a service worker translating `Range`
requests (CTR is seekable: block = `offset / 16`).

A 3-entry LRU keeps the current track plus a step either way, and the **next
track is prefetched** on every change, so next/prev are instant. `inFlight`
dedupes concurrent requests for the same track. Downloading a track reads that
cached blob back rather than asking the CDN again — see below.

## Downloads carry their cover and their tags

The CDN's bytes are a bare mp3: no title, no artist, no artwork. `src/api/tags.ts`
remuxes them (`-c copy` — nothing is re-encoded) with ffmpeg-wasm, the same
single-thread **FFmpeg 4.3** build the extension in `D:\Dev\yandex-music` uses,
copied into `public/ffmpeg`. Single-thread is the whole reason it fits here: no
SharedArrayBuffer, so the page needs none of the cross-origin isolation headers
a threaded build would — which a static host can't easily send anyway.

Three things it will hang or fail on, learned there and repeated here:

- **`-nostdin` or `callMain` never returns.** ffmpeg blocks on its interactive
  stdin reader. This is the flag the whole thing turns on.
- **One fresh Module per track.** The build is `EXIT_RUNTIME=1`; the runtime
  tears itself down after `callMain`. The wasm stays browser-cached, so this
  costs a compile, not the 19 MB again.
- **The cover goes in as JPEG.** 4.3 has no PNG or WebP decoder, so the browser's
  own codecs convert it first (`createImageBitmap` → `OffscreenCanvas`) and
  ffmpeg only ever `-c copy`s it.

`-id3v2_version 3` because more players read v2.3 than v2.4. `comment` lands as
a `TXXX` frame rather than `COMM` — that's ffmpeg's mapping, not a mistake.
Lyrics are embedded only where `lyricsInfo.hasAvailableTextLyrics` says there
are some; the synced form is a separate file's job and there isn't one.

The 19 MB of wasm is loaded **lazily, on the first download**, by a `<script>`
tag — `ffmpeg.js` is a classic script that leaves `_createFFmpeg` on `window`,
so it can't be imported. A failed load isn't cached, or one bad moment would
break every download after it. And if tagging fails at all the track still
saves, just bare: an untagged file is worth more than no file. The buttons show
a spinner, because this is seconds now rather than instant.

Two signing schemes, easy to mix up: `get-file-info` signs the parameter
*values* in send order with commas stripped and **drops** the base64 padding;
lyrics sign `trackId + timestamp` and **keep** it. Composite ids (`"123:456"`)
sign by the numeric half.

Lyrics need a Plus subscription — without one the endpoint returns a single
"подключите подписку" line. That renders fine; nothing to fix.

## Layers

- `src/api/` knows nothing about stores or components. `session.ts` owns the
  token (a plain ref + localStorage) so `client.ts` can read it without
  importing a store — the alternative is an `auth store ⇄ client` import cycle.
- **The avatar comes from the passport, not the music API.** `/account/status`
  carries no picture at all; `login.yandex.ru/info?format=json`, which the same
  OAuth token opens, answers `default_avatar_id` — a path segment on
  `avatars.yandex.net/get-yapic/<id>/<size>`, so the size is ours to pick. It's
  a second request to another host, so it isn't awaited: the initials hold the
  header's place until it lands, and an account with no picture keeps them.
- `landing.ts` **normalises** the feed into `MixedEntity` — a playlist, album or
  artist carrying which of the three it is — because Yandex's own shelves mix
  them, as "Собираем для вас" does. One `mixedItem()` in `media.ts` maps any of
  them to a card.
- **"Собираем для вас" is one shelf over three blocks, and they don't flatten
  the same way.** `personalplaylists` is four unrelated playlists and each earns
  a card — **"Плейлист дня" first**, pulled to the front by the entry's own
  `type: playlistOfTheDay` rather than by its title, since the order the feed
  hands those four back in is arbitrary and that one is what the shelf is opened
  for. The other two are *lists* — ten new albums, ten popular playlists —
  and spilling twenty more cards into the same row buried the four actually
  picked for you. So each becomes **one** card, the way "Плейлист дня" is one
  card, opening `/collection/<block>`. The block key is the URL segment — there
  is nothing else to name a feed block by — and the page validates it against
  `COLLECTIONS` rather than asking Yandex for a block that isn't one.
- A collection card borrows **four of its own items' covers** as a 2×2 mosaic
  (`CoverMosaic`), the same thing Yandex does for a playlist with no artwork.
  One album's cover on a card titled "Новые релизы" reads as that album.
- **The chart is not a landing block.** `blocks=chart` carries ten tracks;
  `/landing3/chart/russia` carries all hundred, in the same `{ track, chart }`
  shape, wrapped in the real playlist Yandex publishes the chart as. Its
  `chart.listeners` is the **only play figure the API exposes**, and it's what
  the chart rows show (desktop only — a phone row has no width to spare).
  **`world` is not a second chart on a CIS account**: it answers `selected` on
  its own menu entry and then hands back the same published playlist, 98 of
  whose 100 tracks are the Russian one's. The tab is kept because that is the
  region switch Yandex documents, not because it shows something different.
  It's fetched the first time its tab is opened, and the panel that waits for it
  **holds the height of the list it replaces** (`ROW_HEIGHT`, exported from
  `TrackList` for it). `Tabs` unmounts the chart that was showing, and a spinner
  six thousand pixels shorter than the chart collapses the page under the
  scroller, which clamps and throws the reader to the top.
- `types.ts` models **only the fields the UI reads**. The real payloads carry
  ~40 more per entity; copying them would be a second, worse copy of the docs.
- Stores are app state only: `player` (queue, playback, MediaSession) and
  `auth`. `queue` is the list the user sees, `order` is the sequence it plays
  in — shuffle rebuilds `order` around the current track, so the song playing
  doesn't jump.
- **`/search` answers a track's `id` as a number.** Every other endpoint answers
  a string. Left alone it reaches `id.split(':')` in the likes store and in the
  audio loader, and a track found by searching silently refuses to play — which
  is exactly what "TEST" → "Test & Recognise" was. Coerced once, at the edge, in
  `catalog.ts`; nothing downstream knows one endpoint is different.
- `src/components/media.ts` maps any entity to one `MediaItem`, which is what
  `MediaCard`/`MediaGrid`/`MediaShelf` render. Every page is a `.map()`, not
  its own card markup. Stations are the one thing that **isn't** a `MediaItem`:
  they have no URL, so `StationCard`/`StationGrid`/`StationShelf` are their own
  three and take a `Station` directly.

## Shell

`src/css/shell.scss` — a grid over semantic direct children `header` / `main` /
`footer` (player) / `nav`, no wrapper divs, mirroring `design.layout()` in its
**default** shape, not `$sidebarInset`: from `md` the rail runs the full height
with the header beside it. The player still spans both columns — its scrubber is
the width of the app, not of the page — so the rail reaches the player, not the
window's bottom edge. Viewport-locked; `main` is the only scroller, so none of
the chrome scrolls away.

**There is no bottom tab bar.** On a phone the same `nav` is a *drawer*:
`position: fixed`, parked at `translateX(-100%)` and slid in by the header's
toggle, so the mobile grid is only `header / main / player` and `> nav` takes a
`grid-area` from `md` up. It's one component and one set of links either way —
a tab bar was a second nav to keep in step with the rail.

Because the rail is full height, **the wordmark lives at its top** — in the
drawer too, which is why the phone header has none. The header carries the
toggle, a `Separator`, the search, the theme toggle and the account, at every
width.

The header's inline padding is set from `shell.scss`'s own `> header` rule rather
than a class on the component: the package ships `spacing(2)` all round, a class
of ours would only *tie* with it, and lining the gutter up with the page's is the
shell's business anyway.

One `PanelLeft` button, two meanings, and `useSidebar` holds both. On a desktop
it **collapses the rail to its icons**, never away — hiding it outright would
leave the wordmark as the only way anywhere — and that is persisted to
localStorage (the shape `useTheme` uses); collapsed, the wordmark drops its text
and keeps its mark, so the rail's top row stays put. On a phone it slides the
drawer in, and that state is deliberately **not** persisted: a panel covering
the content is something you opened, not a preference, and restoring it would
open the drawer on every load. The drawer closes on a link, on the scrim
(`Backdrop layer="sidebar"`, which puts it at 49 under the rail's 50) and on
Escape — the Escape listener is attached only while it's open, so it stays off
every keystroke in the search field.

`.links` needs **`padding-inline-start: 0`**. `list-style: none` drops the
marker but not the 40 px the UA reserves for it, which is the entire content box
of a collapsed rail — the icons rendered at zero width. It was silently pushing
the expanded rail's rows right the whole time too.

Every page is `<AppPage>` (`ScrollArea as="main"` + the padded column inside),
and `App.vue` keys the `RouterView` on `route.fullPath` — album→album navigation
remounts, which refetches and puts the scroller back at the top. There is **no
`scrollBehavior`**: the document doesn't scroll.

`ScrollArea` gets `:auto-hide="isMobile"` (util's reactive breakpoint). A parked
bar would eat 18 px of every row on a phone; on desktop the browser-like bar is
what the library wants. Every `ScrollArea` in the app also names its
`orientation` — since 0.1.1 both axes scroll by default, and naming one is how
you *forbid* the other, so a page or a lyrics pane can't sprout a sideways bar
off content that should simply be clipped.

`TrackList` mounts **only the rows on screen** (`useVirtualRows`) — about 34 of
them, wherever on screen happens to be. A 978-track library mounted whole is
~12 800 DOM nodes and 76 MB of heap.

Two decisions hold each other up, and getting one without the other is what the
list went through:

- **The rows it hasn't mounted still take up their height**, as a spacer above
  and below the window. The list is therefore always exactly its full height, so
  the scrollbar never moves under the thumb as content arrives.
- **The window is derived from the scroll offset**, not from how far the reader
  has walked. It has to be: reserving the height is precisely what lets someone
  drag the thumb straight to the bottom, and the "reveal the next slice when a
  sentinel at the end comes into view" scheme that came first has nothing to
  show there — its sentinel is fifty thousand pixels above, never intersects,
  and the page just stays blank.

Both depend on the row height being *exact*, which is why `TrackRow` pins itself
to `spacing(15)` instead of letting its content add up to 60 by coincidence; the
two constants name each other in comments. The scroller is found by walking up
for an `overflow-y` that scrolls, because it's `ScrollArea`'s private viewport
and naming it would be reaching into the package's DOM. Its offset is measured
once per resize, never per scroll, so scrolling reads only `scrollTop` and costs
no layout.

**`StationGrid` rides the same window**, and the 447-tile micro-genre grid is
why. A grid row is just a row of several: `columns` and the pitch from one row
to the next are read back off the laid-out grid — `gridTemplateColumns` resolves
to its used track list and `rowGap` to pixels — rather than named twice, so the
tile size stays defined in the stylesheet alone. Two things follow. The reserved
height is **padding on a wrapper**, not spacer cells: a child of the grid takes a
row of its own and a gap with it, and the arithmetic has to land exactly. And a
station's name is pinned to **two lines** whether or not it needs both, because a
row that measures a wrapping name against one that doesn't is a row of the wrong
height. `useReveal` — reveal a slice behind a sentinel — was what the grid used
before, and is gone with it.

The overscan is **600px, not ten rows**: the two callers' rows are 60px and
~200px tall, and ten rows of slack for a track list is two thousand pixels of
unfetched artwork for a grid of tiles. The window is also **pinned to the end of
a list that shrinks under it** — a radio tab swaps 75 rows of micro-genres for 27
of genres, and a window left past the new end reserves a height nothing fills
while the scroller, still exactly as tall as it was, has no reason to fire the
scroll event that would put it right.

## Search lives in the header

`HeaderSearch` is the app's **only** search field. It writes `/search?q=…`, and
`SearchPage` renders no field of its own — it reads the query back off the
route, which is what makes a result page linkable and the back button work.
Debounced in one place (the field), so the page fetches only settled queries;
both still check the response is the newest before showing it.

Typing drops a type-ahead panel: three each of artists, tracks, albums and
playlists **under a heading each**, a track playing rather than navigating, and
a last row through to the full page (also what `Enter` does). The headings are
not decoration — four kinds of thing in one list look identical, and a name on
its own doesn't say whether it's an artist or a playlist. The panel's spinner is
centred by a box around it, not by a class on the Spinner: that class lands on
the Spinner's own root, where a flex rule centres nothing. `@surstromming/combobox` is the obvious
component for this and **doesn't fit** — its query is private state with no
`v-model` or emit, so a remote search can't see what was typed, and it re-filters
whatever you hand it by substring on the label, which drops every result the
query doesn't literally appear in. It's a `Select` with a search box, not a
search box. `Popover` + `Input` is the pair to build on.

The panel is only *floored* at its trigger's width and grows with its content,
so one long track title stretched it across the window. It's sized instead from
the field, measured with a `ResizeObserver` — less `PANEL_CHROME`, the border
plus the gutter the panel's own scrollbar parks in, which sit outside that
width.

On a phone the field is an **icon** until tapped, then it lays itself over the
header (`position: absolute` against the sticky header) instead of squeezing the
wordmark and the account into what's left. It folds back on blur — but only when
the panel is closed, since clicking a result blurs the field first and
unmounting it there eats the click.

## Consuming surstromming without forking it

Components are repainted **through the tokens their own variants already read**,
never by out-specifying the package's CSS:

- `app.brand-button` (`src/css/tokens.scss`) sets `--primary` /
  `--primary-foreground` on a `Button`, so its hover, focus ring and dark rules
  keep working. Same trick for the scrubber's `--primary`. This is the
  documented runtime-theming hatch, not a workaround.
- App-level tokens the design package doesn't own (`brand`) live in
  `src/css/tokens.scss` in **exactly its getter shape** — `var(--name, fallback)`,
  unknown name fails the build — and are read as `app.color(brand)` alongside
  `design.color(primary)`. Dark values are in `public/globals.css`.
- **Button pins its icons to 1rem** (`.root svg`). A player's glyphs are bigger,
  so their size is set in CSS from the parent's class, not via `Icon`'s `:size`.
- Where a rule only *ties* with a package rule (one class each), write two
  classes — `.field .input` — since a tie is settled by whichever stylesheet
  loaded last.
- `<Transition>` class names are generated from `name` and can't be hashed, so
  the player screen's live in a `:global { … }` block with a prefixed name.
- `RouterLink`'s active class is passed as `:exact-active-class="$style.isActive"`
  — the hashed name, so it stays inside the module. `exact`, because `/` is a
  prefix of every route.
- `useImageStatus` (avatar) is reused by `CoverArt`: it preloads off-DOM, so a
  broken cover shows the placeholder instead of flashing a half-painted image.

`optimizeDeps.exclude` lists `@surstromming/design` — the packages ship raw
`.vue`/`.scss` and esbuild's pre-bundler can't read them.

**To try a kit change before it's published**, `workspaces:
["../surstromming/packages/*"]` in `package.json` links the whole kit in from
`D:\Dev\surstromming` — npm accepts a plain relative path out of the repo and
symlinks all 41 packages, so an edit there is live here with no reinstall. Two
lines have to go with it: `resolve.dedupe: ['vue']` in `vite.config.ts` (the kit
resolves through its real path, so Sass finds `@fontsource-variable/geist` in
the kit's `node_modules` — and would find the kit's *Vue* there too, and two
Vues in one bundle is a broken app) and `preserveSymlinks` in
`tsconfig.app.json` (the typechecker's half: on the kit's own Vue, `Ref` carries
a different unique symbol, vue-tsc stops unwrapping refs in templates, and every
`isMobile` binding fails). **All three come out before a deploy** — the path
doesn't exist on Vercel. `install-links=true` is the trap to avoid: it copies
instead of symlinking, and then neither `npm i` nor an explicit
`npm i <pkg>@file:…` refreshes the copy, so you quietly test stale code.

Where the kit itself is wrong, it gets fixed in `D:\Dev\surstromming`, bumped
and republished — this app sees nothing until then. Twice so far, both found
through the ⋯ menu on a track row, which is the app's longest list of popovers:

- **dropdown-menu 0.1.2** — closing a menu returned focus to its trigger and
  scrolled it back into view. In a virtualised list that is a jump to wherever
  the row is: opening the ⋯ menu on the first track, scrolling well past it and
  pressing another row's ⋯ threw the library back to the top. The return is
  `preventScroll` now; the press that closed the menu places focus itself a
  moment later, so only the scroll was given up.
- **popover 0.1.3** (and tooltip 0.1.2, on a shared `useAnchored` in util
  0.1.1) — under pinch-zoom the ⋯ menu opened hundreds of pixels left of its
  trigger, or not visibly at all. Safari on a phone and on a Mac trackpad;
  never a desktop browser, because only a pinch separates the **visual**
  viewport from the **layout** one. WebKit measures `getBoundingClientRect()`
  against the visual viewport while `position: fixed` is placed against the
  layout one, so the panel was drawn `visualViewport.offsetLeft` away from
  where it was measured — off screen entirely once the page is panned right to
  reach a row's trailing controls. 0.1.2 was a wrong first guess at this (it
  fixed the clamping bound, which was not the half that was broken) and is why
  the same screenshot came back twice.
- **design 0.1.1** — `touch-action: manipulation` on interactive elements. The
  ⋯ took about half a second to answer a tap, which is Safari waiting to see
  whether the tap is the start of a double-tap-to-zoom. Only on those elements,
  so pinch-zoom itself is untouched.
- **scroll-area 0.1.2** — and this was the one that made the ⋯ do *nothing* on
  a phone. `ScrollArea` set `hovering` from `pointerenter` whatever the pointer
  was; iOS fires it for a finger, on every tap, and with `autoHide` — which
  `AppPage` turns on exactly when `isMobile` — that flips the idle bar visible
  mid-gesture. WebKit re-hit-tests at `touchend`, sees the layer under the
  finger changed, and never synthesizes the click. **Every** control inside
  `main` was dead: the ⋯, the heart, everything. The header's buttons worked,
  which is what made it look like a menu bug for so long. It presents as
  portrait-only (that's the breakpoint) and as intermittent (a bar already up
  from a recent scroll leaves nothing to change).

  Worth remembering how it was found, because no amount of reading got there:
  a probe (`?debug`, now deleted) planted plain `<button>`s at each depth —
  `<body>`, `.page`, the list, the row — and reported which ones took a click.
  `<body>` yes, everything under `main` no, and a switch that hid the bars
  turned the ⋯ back on.

## The track row

`TrackRow` is modelled on Yandex's own: rank, cover, title with an **E** badge
off `contentWarning`, artist, then download, the heart, and a trailing slot where
the **duration gives way to the `⋯` menu on hover**. One slot, because the row
under the pointer is the only one whose menu is reachable. The swap is behind
`@media (hover: hover)` — on touch both stay put, since there's no hover to trade
one for the other — and `:focus-within` reveals it too, for keyboards, which
never hover. The menu opens `side="bottom" align="end"`; Popover has no `center`.

**The cover shows on every list**; `numbered` adds a rank column beside it, it
doesn't replace it — a place in a list and the thing in that place are two
facts. Albums, the chart, artist top-tracks and the library rank their rows;
a playlist doesn't, since its ordering isn't part of the track.

A bare `<button>` wrapping a cover **must reset its padding**. The UA's
`1px 6px` survives everything else, and the player bar's expand overlay is
pinned to the button's edges — which made it 68×58 around a 56×56 cover, with
the dark scrim sticking out either side of the artwork.

The cover is the row's **play/pause**, and the only thing in the row that plays:
the **title links to the album and the artist to the artist**, the way the
player's do. There is no track page — `/album/<id>` is the page a song lives on
— so "play the list from here" is the cover's job alone, which is why the row is
a `div` holding a button and two links rather than one big button (a button
can't hold a link either). Pressing the cover of the track that's playing pauses
it. So the row that is **paused shows the play glyph in brand orange**, not
frozen equalizer bars: bars say "playing", and a stopped row should show what
starts it again. The bars appear only while it really is playing — which is
`nowPlaying`, not `current`; see the player, where the spinner that stands in
for them is described.

The chart adds a **movement marker** under the number, from the `chart`
`{ position, progress, shift }` the landing block carries next to each track.
That runs as an array **parallel to `items`** rather than living on the `Track`:
a chart standing belongs to the list, not to the song, and the same track in the
library has no place in one. Solid triangles built from borders, not lucide —
a stroked chevron reads as an affordance at 8px and the set has no solid caret,
the same call `ScrollArea`'s own carets make. `same` is a dash, `new` a brand
dot (an empty box would leave its tooltip nothing to hover), and the movement is
only readable through that `title`, so it always says which way and by how much.
`chart-up` / `chart-down` are app tokens: a track slipping a place is not
`destructive`.

## History — the app has to say it played something

Nothing about listening is implicit. `POST /play-audio` (`src/api/history.ts`) is
the only thing that puts a track in music.yandex.ru's history, in "Вы недавно
слушали", or into anything Yandex builds on those. Without it the app is
invisible: the account looks like it was never used.

Two things were established against the live API rather than guessed, and both
decide whether a play is *seen*:

- **`from` has to resolve.** It's `<client>-<page>-<context>-<id>`, and the
  server reads the third segment as the context type. Sent as
  `web-web-search-search` a play files under `context: unknown`; sent as
  `android-album-album-<id>` it files under that album. The site's history is
  **grouped by context and drops the ones it couldn't resolve** — an
  unrecognised `from` means the play is accepted (`result: ok`) and never
  appears. So every play names its album, which every track has. Neither
  `playlist-id=<uid>:<kind>` nor `<uid>_<kind>` ever resolved to a playlist
  context; the id is still sent when there is one, but the album is what files
  the play.
- **A short play is dropped.** `total-played-seconds: 10` of a 170-second track
  answers `ok` and never shows up; ~90% of the track does. Yandex decides, so
  the app doesn't try to guess the threshold — it reports what was actually
  heard and lets the server judge. Below five seconds it doesn't bother at all:
  that's a track being skipped past.

`heard` in the player store is **not** `currentTime` — it accumulates the
`timeupdate` deltas and ignores any jump of a second or more, because a seek
isn't listening. A track is reported once per pass, on the change *and* on
`ended`: the last track of a queue with repeat off finishes without the position
ever moving. A track still playing when the tab closes goes unreported —
`sendBeacon` can't carry the `Authorization` header.

Reading it back is one endpoint. `/users/<uid>/contexts` answers bare ids and
timestamps, grouped by the context each track was played from, and `history.ts`
hydrates them with one bulk `/tracks` call. The site's own `/music-history` page
has no endpoint on this API and there is no more history than this to show.

**Ask for `contextCount=100` or Yandex answers five.** That default is why the
history looked so short; 100 is the ceiling — a larger number is accepted and
still capped — and each context carries only its *newest* track, so a hundred
contexts is a hundred plays, about four months on an account in daily use.

The `play-contexts` landing block, which answers the same recent contexts as
whole entities, is **gone**: `/history` showed it as a "Вы недавно слушали"
shelf above the track list, and it was the same listening said twice. The albums
tab below says it better, from data the page already has.

`/history` is therefore three views of that one response — the chart, then
**Треки** and **Альбомы** behind a tab each. The albums are the contexts whose
`context` is `album`, newest play first, hydrated by the bulk `/albums` route
(`getAlbums` in `catalog.ts`, which the liked-albums call now shares); artists
and playlists arrive in the same response and have no tab, since two is what
was asked for and a third would be a list of names with no covers to carry it.

### Turning it off, and the only statistics there are

`/settings` (from the account menu) carries one switch: **Сохранять историю
прослушиваний**, on unless it's been turned off. Off stops the report to Yandex
— checked in `reportListen`, so the single decision about what counts as a play
stays in one place — and with it everything `/history` draws. Switching it *off*
opens an `alertdialog` naming what stops working; switching it back on needs no
ceremony, so only that direction asks.

The checkbox keeps **state of its own** rather than reading the setting
directly, and it has to: `Checkbox` wraps a real `<input>`, so a click flips the
DOM before anything in the page gets a say. Bound straight to the setting,
cancelling the dialog left the box drawn unchecked with the setting still on —
the value never changed, so Vue had nothing to patch back.

**The play-count chart is the history, bucketed** — `listenChart` in
`pages/history/stats.ts`, over the same hundred plays the tabs list. It used to
be a local tally in localStorage, written from `reportListen`, because
`/contexts` was thought to answer only the last handful; `contextCount` answers
four months, so the tally was a worse copy of data the account already has and
it's gone. The chart now shows what was played on the phone too, and a browser
that has never played anything here still draws them.

Buckets run **backwards from today**, so the newest plays are always the
right-hand point, and the empty ones are still emitted — a line that skips its
quiet days draws a week of silence as a straight climb. **Weeks, not days, past
a month of history**: a hundred plays over four months average less than one a
day, and per-day that is a field of zeros with a spike in it. Days are keyed by
*local* midnight (`toISOString` is UTC and would file a play at 01:00 in Moscow
under yesterday) and shifted by `setDate` rather than by ±86 400 000 ms, which
is 23 or 25 hours wrong across a clock change.

The home page's "Вы слушали" tab is **gone** with it — a chart and a track list
sitting under "Чарт" were the whole of `/history` in a tab, so the sidebar entry
and the tab answered the same question. "Чарт" is Россия and Мир again.

## Signing in — a code you don't have to type twice

The OAuth **device flow**: `/device/code` answers a `user_code` and
`verification_url` (`https://ya.ru/device`), the user confirms the code there,
and `/token` is polled every `interval` seconds until it hands one back. That
much is `src/api/auth.ts` and is not ours to change.

What the screen does with it is:

- **The code is a button, and pressing it copies.** Picking eight monospaced
  characters at `letter-spacing: 0.2em` out of a phone's text selection was the
  worst thing on the screen.
- **`document.execCommand('copy')` is tried first and `navigator.clipboard` is
  the fallback**, deprecated though that order sounds. `execCommand` copies
  inside the click with nothing to ask anyone for; the async API needs a
  permission and can be refused outright. It copies out of a **throwaway
  off-screen `<textarea>`**, not the code element — a selection inside a
  `<button>` is not something every browser allows — which is read-only so iOS
  doesn't raise its keyboard, `position: fixed` so handing it the selection
  can't scroll the page, and given `setSelectionRange` explicitly because iOS
  ignores `select()` on its own.
- If **both** are refused the code still carries `user-select: all`
  (**prefixed too**: nothing autoprefixes in this build and Safari only dropped
  the `-webkit-` in 17), so one long press takes the whole of it rather than a
  character at a time.
- **The Yandex page is opened by `window.open`, not an `<a target="_blank">`,
  and `noopener` is deliberately absent** — it would null the handle, and the
  handle is the entire point: a window this page opened is a window it may
  close, cross-origin or not, so the poll closes the Yandex tab the moment the
  token lands instead of leaving the user to find their way back. The price is
  that Yandex's own OAuth page gets a `window.opener`; nothing else does. It
  has to be called **straight from the click** — behind the `await` that
  fetches the code it's a popup a blocker has every reason to stop, which is
  why opening is its own button in step 2 rather than part of starting the flow.
- The two steps are **numbered and separated** ("Скопируйте код", "Введите его
  на странице Яндекса"), and step 2 has a way out — "Начать заново" clears the
  poller, since a code expires in five minutes and reloading the page was the
  only exit before.
- The manual-token form **stacks**. The card is 384px, and a password field
  sharing a row with a button leaves neither of them enough of it.

## Likes

Two write routes, verified against the live API (a like/unlike round trip moves
the count and reverts it):

- `POST /users/<uid>/likes/tracks/add-multiple`, form `track-ids`
- `POST /users/<uid>/likes/tracks/remove`, same field

Not symmetric and not a typo — there is no single-track *add*, only the bulk one.
Neither is in the reverse-engineering notes; both answer 200 with the usual
envelope.

Artists have their own pair, asymmetric in the same direction and with the field
names differing too: `POST /users/<uid>/likes/artists/add` takes **`artistId`**,
`.../remove` takes **`artistIds`**. Sending the wrong one answers a `validate`
error, not a 200. There is no store for it — an artist heart only ever appears
on that artist's page, so the page asks `/likes/artists` on arrival and holds
one boolean. It is also **not** optimistic, unlike the track heart: that one is
pressed from a list of fifty and has to feel instant, this is one button pressed
once, so it says "working" and then says what actually happened.

The `likes` store holds **only the ids**, one set for the whole app, so a heart
is right wherever the same track appears; the library page fetches the entities
separately. Ids are stored by their **numeric half** — a track can arrive
composite (`"123:456"`) but `/likes/tracks` only ever answers in bare ids, so a
composite would never match. Toggling is optimistic and rolls back on failure:
the heart is its own feedback, and waiting ~300 ms for Yandex to agree makes it
feel broken. Loaded once from the router guard and deliberately **not awaited** —
a heart filling a moment late is fine, a first paint waiting on ~1000 ids isn't.

## The player

**`current` is what the queue points at; `nowPlaying` is what you can hear, and
the player shows the second one.** They differ for as long as a track takes to
arrive: the file is fetched and decrypted whole, and `audio.src` isn't replaced
until the bytes are there, so the previous track keeps sounding the entire time.
Showing `current` meant the bar renamed itself the instant a row was pressed and
then sat there, titled with a song that wasn't playing, while another one came
out of the speakers. `nowPlaying` is set where `await audio.play()` resolves —
the moment audio really starts — and with it go the bar, the full-screen player,
its extras, the lyrics and the MediaSession metadata.

Two things follow from that:

- **The clock is not reset on a track change either.** The scrubber keeps
  running on the track it belongs to; the audio element's own `loadedmetadata`
  brings the new length when the new blob loads.
- **A load failure still presents the track that failed**, even though it never
  played — the message reads "Не удалось загрузить трек" under a title, and that
  title has to be the one it happened to.

Waiting has to show somewhere, and it shows **on the cover that was pressed**: a
`TrackRow` has three overlay states — a spinner while its track is being
fetched, the bars while it's the one sounding, the play glyph otherwise — and
the bars therefore stay on the row you're still hearing until the new one really
starts. A spinner is not a pause button, so a row in that state ignores presses;
pausing there would stop a different song. `StationCard` does the same, and has
further to wait: a wave is a request for the batch and then a whole track.

`PlayerProgress` is the seek line, **above the bar and the full width of it at
every breakpoint** — on a phone that length is the difference between seeking
and not. It's the kit's `Slider` repainted two classes deep (`.root .slider`,
since a single class would only tie): a 3px track that thickens to 6px, with a
knob that grows to match. The band the input occupies stays 16px whatever the
line is doing — that's the grab target. It thickens on **its own** hover, not
the bar's, and on a phone it is simply always thick: there is no hovering to
reach for it with. A **mouse releasing a seek doesn't un-hover it**: `pointerup`
used to end the state whatever the pointer was, so the line dropped back to a
hairline under a cursor that hadn't moved, which read as a flinch. Only a finger
lifting ends it now.

**The kit's halo around the knob is off on hover**, in all three of the app's
sliders — the seek line, the full-screen scrubber and the volume. A ring
swelling in and out as the pointer crosses the line is the "pulse" it was
reported as. It stays on `:focus-visible`, where it's the keyboard's only cue.

Two time bubbles sit above the line while it's being used — hovered on a
desktop, held on a phone. One tracks the head, one is pinned to the end, and
**the pinned one drops once the head gets close enough to sit on it**. Both are
placed in *pixels* off a `ResizeObserver`, because both questions are about
pixels: whether a bubble is falling off an edge, and whether two are about to
collide. A percentage threshold tuned on a 390px phone would hide the duration a
third of the way through a 1280px window.

The bar's three left-hand parts each go somewhere of their own: the **cover** is
the full-screen button and the only thing that shows the expand glyph on hover,
the **title** links to the album and the **artist** to the artist. There is no
track page to link a title at — `/album/<id>` is the page that song lives on.

`PlayerControls` takes a `variant`, and the two are **never drawn as one row**.
`transport` acts on playback; `extras` — lyrics, the heart, download, queue,
shuffle, repeat — acts on the track or on the session. Side by side that's eight
controls, 396px of content in a 350px phone.

So the full-screen player stacks them at every width, phone and desktop alike,
and the bar puts the extras **at the right, with the volume**, leaving the middle
of the bar to the three buttons that are actually about playing. The phone's bar
carries the transport and nothing else. There is no ⋯ menu on the full-screen
player any more: download is a button in that row and the title links to the
album the way the bar's does. The desktop bar drops the elapsed/total readout
the old inline scrubber had; the full-screen player still shows both.

**Next and previous disable at the ends of the queue** — `canNext` /
`canPrevious` on the store, which repeat opens back up, since a repeating queue
is a loop with no ends. They ask only about the queue: `previous` also restarts
a track more than three seconds in, but a button that enables itself three
seconds into every first track reads as a glitch. `skip(-1)` wraps only when
repeat is on, which is the rule `skip(1)` already followed.

The full-screen cover is sized `width: min(100%, 100cqh)` against a
`container-type: size` stage. A cover is square and has to stay square, and
`height: 100%` alone doesn't manage it: `max-width` then clamps the width, the
aspect ratio loses, and a 600×600 cover renders into a 460×501 box with the art
cropped. `cqh` is how the width asks about the height — the one question plain
CSS can't answer. The stage is a size container safely because its height comes
from `flex: 1`, never from what's on it.

**Under 600px tall the full-screen player drops its chrome.** A 560px window
left the queue 185px — three rows — with the title, the scrubber and a 64px play
button taking the rest; below the threshold those give way and the stage keeps
what's left (296px at 500px tall, five rows). The two control rows still don't
merge: that rule is about *width*, and what's short here is height, so the
transport shrinks to `sm` rather than joining the extras. The cover view is
exempt — there the stage *is* the artwork, and shrinking chrome to grow a
picture buys nothing. `viewportHeight` is its own module-level ref because
`isMobile` from the util package answers about width, and this is a laptop in
landscape rather than a phone.

The full-screen player's stage is a **three-way**: cover, lyrics or the queue,
never two at once — on a phone there's only room for one. `usePlayerScreen` owns
`open` and `view` at module level rather than threading them through `App.vue`,
because the bar's queue button has to open the screen *and* say what it should
be showing, and that's one action. The queue lists `order`, not `queue` —
shuffled, those differ, and what's coming next is the one worth showing — and a
row calls `player.jumpTo`. Changing track clears the lyrics but **not** the
queue: the queue is about the session, the lyrics about the song.

**Swiping the stage steps through the queue** — left for the next track, right
for the one before, and it obeys `canNext` / `canPrevious` the way the transport
buttons do. The **stage only**, deliberately: the scrubber below it is a
horizontal drag of its own and its `pointerup` bubbles up to the screen, so a
gesture bound to the whole panel would skip a track every time someone seeked.
Touch and pen only — a mouse dragging the cover starts a native image drag,
which swallows the `pointerup` the gesture ends on. A swipe has to clear 60px
*and* beat its own vertical travel by half again, so scrolling the queue or the
lyrics isn't a skip; the browser's `pointercancel` when it takes the gesture
over for scrolling drops it too.

## Details worth keeping

- Russian needs three plural forms — `plural()` in `media.ts` uses
  `Intl.PluralRules`, not hand-rolled modulo. "1 треков" was the bug.
- **A shelf is a `ScrollArea orientation="horizontal"`** since 0.1.1 brought a
  horizontal bar. It was a native scroller themed to a hairline before, which
  was the one place in the app with a scrollbar the kit hadn't drawn. The bleed
  moves to the ScrollArea root and the padding to the rail inside it, and the
  rail is `width: max-content` — a viewport-wide rail puts its trailing padding
  on the scroller's edge instead of past the last card.
- **The shelf lost `scroll-snap`** in that move. Snapping is set on the scroll
  container, which is now `ScrollArea`'s private viewport; reaching it means
  selecting into the package's DOM. If it's wanted back, it belongs in the kit
  as a prop, not here.
- Cover sizes are a fixed set — `512x512` **404s**. MediaSession artwork uses
  400/200.
- The seek bar writes straight through the drag (`get`/`set` computed) — the
  audio is a loaded blob, so commit-on-release would only feel laggy.
- A load failure shows on the track it happened to, in the player bar. A toast
  would float away from the thing that failed (and `@surstromming/toast` is not
  a dependency).
- The UI is Russian: the API returns Russian titles and the service is CIS-only.
- **`useTheme` opens on the system's side.** It used to be dark outright —
  music players are — but that is a preference the OS already holds, and an app
  that ignores it is the odd one out on a phone at night. `matchMedia` decides
  the first paint and a `change` listener follows the OS live, but **only while
  nothing is stored**: the moment the toggle is pressed that choice is the one
  that counts, so the listener asks localStorage rather than keeping a flag of
  its own. There is deliberately **no third `system` setting** — the toggle is
  still one button flipping light and dark, because "follow the system" is what
  not having chosen already means, and a state you can only reach by clearing
  storage is not worth a third of a button. Someone who had already chosen
  keeps what they chose.

## Radio — a queue with no end

`/rotor` hands out **five tracks at a time**: `GET /rotor/station/<id>/tracks?
settings2=true` starts a session and `&queue=<last track id>` asks for the next
five, so a station is a *window* that keeps extending, not a playlist. A station
is addressed as `type:tag` — `user:onyourwave`, `genre:rock`, and `artist:<id>`
works too. None of it needs Plus.

`player.station` is what tells the rest of the store the queue isn't a finished
list: `canNext` is always true, the end of the window is a wait rather than a
stop, and shuffle turns itself off — Yandex has already sequenced the stream and
the five tracks that happen to be loaded are not a list to shuffle. `extend()`
runs one track *before* the end, so `next` never waits on a request, and it
dedupes, so a fast skip can't ask twice.

**`station` is a `shallowRef`, and it has to be.** A plain `ref` hands back a
reactive proxy of what was assigned to it, so `station.value === next` is false
for the very object just stored — and every "did the station change while this
was in flight?" guard abandons its own load. That failure is silent: the request
succeeds, `loading` never clears, nothing plays.

`POST /rotor/station/<id>/feedback?batch-id=<batchId>` (JSON, hence `postJson`
in `client.ts`) carries `radioStarted`, `trackStarted`, and then `trackFinished`
or `skip` — which one depends on whether the audio element saw the track out,
which is what the `ended` flag records. This is **what "Моя волна" learns from**,
and skipping it fails harder than skipping `/play-audio`: the stream still
plays, it just never adapts. `/play-audio` is still sent as well, so a wave shows
up in the history like anything else.

`GET /rotor/stations/list` answers **697** stations across fifteen internal
`id.type`s, several of which are the same idea twice (`mood`/`mix-by-mood`,
`tempo`/`mix-by-tempo`). `groups.ts` folds them into the seven a person browses
by and the page puts a tab on each. `micro-genre` is kept apart from `genre`
deliberately — 447 of the 697 are micro-genres, and mixing them in buries the
159 genres anyone starts from. Genres carry a `parentId` on 131 of them, and
sorting each parent's children in behind it is all the hierarchy the UI needs:
what you're doing is scanning for a name, and one ordered grid beats a nested
one for that.

A station **card is a button, not a link** — a station has no page to open, and
pressing it starts the wave. The list is 2 MB, so only `/radio` asks for it; the
home page shows the dashboard's four.

**Waves around one thing.** `track:<id>` and `artist:<id>` are real stations —
verified live — but they appear in **no** listing, so there's no station object
to look up and `waveStation()` builds one (hence `icon` being optional on
`Station`; only tiles need it). `components/wave.ts` is the single place both
are named, because a track's wave is offered from three: the row's ⋯ menu, the
player bar and the full-screen player. The artist page's header button starts
that artist's wave — it used to open the similar-artists page, which is now
reached through the "Похожие исполнители" heading instead, `ContentSection`
taking an optional `to`.

The wave button carries **no lit state**, unlike the lyrics and queue buttons
beside it: a wave is an action, and the instant it starts the current track is a
different one, so "this track's wave is playing" would be true for a single song
and wrong after it. The full-screen player's header names the station instead,
which is the honest place to say which wave you're on.

Two knobs are **not** built: `GET /rotor/station/<id>/info` carries `settings2`
(`language | moodEnergy | diversity`) with every allowed value, its Russian
label and artwork, and `POST .../settings3` writes them back; and
`GET /rotor/account/status` answers `skipsPerHour: 6`, which a UI ought to
respect and this one doesn't.

## Deliberately absent

Podcasts, a queue *editor* (it can be read and jumped into, not reordered),
playlist editing, offline caching (the service worker precaches the **shell**
and nothing else — see "Installing it"), i18n. `available: false` tracks render
dimmed and unclickable rather than being hidden.

**Audiobooks**, and the API is not what's missing. `/non-music/catalogue` and
`/non-music/category/AUDIOBOOKS_MENU` both answer — the latter with 20 blocks —
and an audiobook is just an **album** with `type: 'audiobook'`, so `AlbumPage`
would render one today. What stops it is rights: without Plus the album and
every one of its tracks come back `available: false`, and `get-file-info`
answers `no-rights` outright. Building it on this account would ship a catalogue
you can browse and never play. Worth revisiting the moment there's a
subscription behind it.

**A quality switch.** `player.quality` still picks what `get-file-info` asks for
and still persists, but nothing in the UI sets it: one control for a choice
between 192 and 320 kbps wasn't earning its place in a menu. Change the default
in the store if it should be `lossless`.

Liking **albums and playlists** — the library reads all four, and tracks and
artists both write.
