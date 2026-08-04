import { ref } from 'vue'
import { loadTrackAudio } from '@/api/audio'
import { tagTrack } from '@/api/tags'
import { artistNames } from '@/components/media'
import { usePlayer } from '@/stores/player'
import type { Track } from '@/api/types'

/** Characters Windows and macOS refuse in a file name. */
const sanitize = (name: string) => name.replace(/[\\/:*?"<>|]/g, '-').trim()

/**
 * Saves a track to disk. The audio is already fetched and decrypted for
 * playback, so this reads the cached blob back rather than asking the CDN
 * again, then hands it to ffmpeg to have the cover and the tags written in.
 */
export function useTrackDownload() {
  const player = usePlayer()
  const downloading = ref(false)

  async function download(track: Track) {
    downloading.value = true
    try {
      const source = await loadTrackAudio(track.id, player.quality)
      const bytes = new Uint8Array(await (await fetch(source)).arrayBuffer())

      // An untagged file is worth more than no file: if ffmpeg can't load or
      // can't remux, the track still saves, just bare.
      let file: Blob
      try {
        file = await tagTrack(bytes, track)
      } catch (cause) {
        console.error(cause)
        file = new Blob([bytes], { type: 'audio/mpeg' })
      }

      save(file, `${sanitize(artistNames(track.artists))} - ${sanitize(track.title)}.mp3`)
    } finally {
      downloading.value = false
    }
  }

  return { download, downloading }
}

function save(file: Blob, name: string) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  // Not revoked in the same tick: the browser reads the blob asynchronously
  // after the click, and pulling it out from under the download cancels it.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
