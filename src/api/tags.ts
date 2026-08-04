import { coverUrl } from './cover'
import { getLyrics } from './lyrics'
import type { Track } from './types'

/**
 * A downloaded track carries its cover and its tags, which the CDN's bytes do
 * not: they arrive as a bare mp3. ffmpeg remuxes them in (`-c copy` — nothing
 * is re-encoded), the same way the browser extension in `D:\Dev\yandex-music`
 * does, from the same single-thread FFmpeg 4.3 build in `public/ffmpeg`.
 *
 * Single-thread matters: no SharedArrayBuffer, so the page needs none of the
 * cross-origin isolation headers a threaded build would.
 */

interface FFmpegModule {
  FS: {
    writeFile(path: string, data: Uint8Array): void
    readFile(path: string): Uint8Array<ArrayBuffer>
  }
  /** Returns ffmpeg's exit code; 0 is success. */
  callMain(args: string[]): number
}

type CreateFFmpeg = (config: Record<string, unknown>) => Promise<FFmpegModule>

declare global {
  interface Window {
    _createFFmpeg?: CreateFFmpeg
  }
}

const SCRIPT = '/ffmpeg/ffmpeg.js'
const WASM = '/ffmpeg/ffmpeg.wasm'

let loading: Promise<CreateFFmpeg> | undefined

/**
 * `ffmpeg.js` is a classic script that leaves its factory on `window`, so it is
 * loaded with a tag rather than imported — and lazily, since the wasm beside it
 * is 19 MB and only a download ever needs it.
 */
function loadFFmpeg() {
  if (!loading) {
    loading = new Promise<CreateFFmpeg>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT
      script.onload = () =>
        window._createFFmpeg
          ? resolve(window._createFFmpeg)
          : reject(new Error('ffmpeg.js loaded without _createFFmpeg'))
      script.onerror = () => reject(new Error('не удалось загрузить ffmpeg'))
      document.head.appendChild(script)
    })
    // A failed load shouldn't poison every download after it.
    loading.catch(() => (loading = undefined))
  }
  return loading
}

/**
 * ffmpeg 4.3 has no PNG or WebP decoder, so the cover goes in as a JPEG the
 * browser's own codecs produced and `-c copy` can pass straight through.
 */
async function toJpeg(bytes: ArrayBuffer) {
  const bitmap = await createImageBitmap(new Blob([bytes]))
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('no 2d context for the cover')
    context.drawImage(bitmap, 0, 0)
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    bitmap.close()
  }
}

async function fetchCover(track: Track) {
  if (!track.coverUri) return null
  try {
    const response = await fetch(coverUrl(track.coverUri, 1000))
    if (!response.ok) return null
    return await toJpeg(await response.arrayBuffer())
  } catch {
    return null
  }
}

/** Plain text for the `lyrics` tag; the synced form belongs in an .lrc file. */
async function fetchLyrics(track: Track) {
  if (!track.lyricsInfo?.hasAvailableTextLyrics) return ''
  const lines = await getLyrics(track.id, false)
  return lines.map((line) => line.text).join('\n')
}

/** Multi-valued tags join with `; `, which is what taggers read back apart. */
const names = (artists: { name: string }[] | undefined) =>
  (artists ?? []).map((artist) => artist.name).join('; ')

function metadata(track: Track, lyrics: string) {
  const album = track.albums[0]
  return {
    title: track.version ? `${track.title} (${track.version})` : track.title,
    artist: names(track.artists),
    album: album?.title ?? '',
    album_artist: names(album?.artists),
    date: album?.year ? String(album.year) : '',
    genre: album?.genre ?? '',
    track: album?.trackPosition ? String(album.trackPosition.index) : '',
    disc: album?.trackPosition ? String(album.trackPosition.volume) : '',
    comment: album ? `https://music.yandex.ru/album/${album.id}/track/${track.id}` : '',
    lyrics,
  }
}

/**
 * The track's bytes with its cover and tags written in. Rejects rather than
 * returning the input on failure — the caller decides what an untagged file is
 * worth.
 */
export async function tagTrack(audio: Uint8Array, track: Track): Promise<Blob> {
  const [createFFmpeg, cover, lyrics] = await Promise.all([
    loadFFmpeg(),
    fetchCover(track),
    fetchLyrics(track),
  ])

  // One fresh Module per track: the build is EXIT_RUNTIME=1, so the runtime
  // tears itself down after callMain and can't be reused. The wasm is cached by
  // the browser, so this costs a compile, not a download.
  const logs: string[] = []
  const ffmpeg = await createFFmpeg({
    locateFile: (path: string) => (path.endsWith('.wasm') ? WASM : path),
    print: (line: string) => logs.push(line),
    printErr: (line: string) => logs.push(line),
  })

  ffmpeg.FS.writeFile('in.mp3', audio)
  if (cover) ffmpeg.FS.writeFile('cover.jpg', cover)

  // `-nostdin` must be there or callMain hangs forever on ffmpeg's interactive
  // stdin reader. It is the one flag this whole thing turns on.
  const args = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', 'in.mp3']
  if (cover) {
    args.push(
      '-i', 'cover.jpg',
      '-map', '0:a', '-map', '1:v',
      '-c', 'copy',
      '-disposition:v:0', 'attached_pic',
      '-metadata:s:v', 'title=Album cover',
      '-metadata:s:v', 'comment=Cover (front)',
    )
  } else {
    args.push('-map', '0:a', '-c', 'copy')
  }
  for (const [name, value] of Object.entries(metadata(track, lyrics))) {
    if (value) args.push('-metadata', `${name}=${value}`)
  }
  // ID3v2.3 rather than the default v2.4: more players read it.
  args.push('-id3v2_version', '3', 'out.mp3')

  const code = ffmpeg.callMain(args)
  if (code) throw new Error(`ffmpeg exited ${code}: ${logs.join(' | ')}`)

  return new Blob([ffmpeg.FS.readFile('out.mp3')], { type: 'audio/mpeg' })
}
