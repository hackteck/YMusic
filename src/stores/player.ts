import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { loadTrackAudio, prefetchTrackAudio, type Quality } from '@/api/audio'
import { coverUrl, type CoverSize } from '@/api/cover'
import { reportPlay } from '@/api/history'
import { getStationTracks, sendFeedback, type FeedbackType, type Station } from '@/api/rotor'
import { historyEnabled } from '@/composables/useSettings'
import { useAuth } from '@/stores/auth'
import type { Track } from '@/api/types'

export type RepeatMode = 'off' | 'all' | 'one'

/** Lock-screen artwork. Only sizes Yandex actually renders — 512 is a 404. */
const ARTWORK_SIZES: CoverSize[] = [400, 200]

const stored = <T extends string>(key: string, fallback: T) =>
  (localStorage.getItem(key) as T | null) ?? fallback

export const usePlayer = defineStore('player', () => {
  const audio = new Audio()
  audio.preload = 'auto'

  /** The tracks as the user sees them; `order` is the sequence they play in. */
  const queue = ref<Track[]>([])
  const order = ref<number[]>([])
  const position = ref(-1)
  /** Set when the queue came from a playlist; only the play report reads it. */
  const playlistId = ref<string>()

  /**
   * Set while a radio station is playing. A wave has no end and no list behind
   * it — the queue is a window that Yandex extends five tracks at a time — so
   * everything that treats the queue as a finished list asks this first.
   *
   * **`shallowRef`, and it has to be.** A plain `ref` hands back a reactive
   * proxy of whatever was assigned to it, so `station.value === next` is false
   * for the very object just stored — and the "did the station change while
   * this request was in flight?" guards below would abandon every load. The
   * station is replaced and never mutated, so there's nothing to make deep.
   */
  const station = shallowRef<Station>()
  /** Identifies the current five to the feedback endpoint. */
  let batchId = ''
  /** One in-flight extension at a time, so a fast skip can't ask twice. */
  let extending: Promise<void> | undefined

  const playing = ref(false)
  const loading = ref(false)
  const error = ref('')
  const currentTime = ref(0)
  const duration = ref(0)

  const shuffle = ref(false)
  const repeat = ref<RepeatMode>(stored('ym-repeat', 'off'))
  const quality = ref<Quality>(stored('ym-quality', 'nq'))
  const volume = ref(Number(localStorage.getItem('ym-volume') ?? 1))
  const muted = ref(false)

  const current = computed<Track | undefined>(() => queue.value[order.value[position.value]])

  /**
   * The track the player *shows*, which is not always `current`.
   *
   * A track is fetched and decrypted whole before it can start — usually
   * instant off the prefetch cache, seconds when it isn't — and the one before
   * it keeps sounding the entire time, because `audio.src` isn't replaced until
   * the bytes are there. `current` moves the moment a row is pressed; this
   * moves when audio actually comes out, so the bar, the full-screen player and
   * the lock screen never name a song you can't hear yet. What the press does
   * show is a spinner on the cover that was pressed.
   *
   * `shallowRef` for the reason `station` is one: it's replaced, never mutated,
   * and the `=== ` guards in `load` compare it against the object they were
   * handed.
   */
  const nowPlaying = shallowRef<Track>()
  const progress = computed(() => (duration.value ? currentTime.value / duration.value : 0))

  /**
   * Whether there is anywhere to step to — repeat turns the queue into a loop,
   * so at either end it always is. Purely a question about the queue and not
   * about the song playing: `previous` also restarts a track that's more than
   * three seconds in, but a button that enables itself three seconds into every
   * first track reads as a glitch.
   */
  const looping = computed(() => repeat.value !== 'off' && order.value.length > 0)
  const canPrevious = computed(() => position.value > 0 || looping.value)
  // A station always has a next track: reaching the end of the window is what
  // fetches the one after it.
  const canNext = computed(
    () => position.value < order.value.length - 1 || looping.value || !!station.value,
  )

  const shuffled = (length: number, first: number) => {
    const rest = [...Array(length).keys()].filter((index) => index !== first)
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[rest[i], rest[j]] = [rest[j], rest[i]]
    }
    return [first, ...rest]
  }

  /**
   * The play sequence and where in it `index` sits — the two always have to be
   * chosen together. Sequential play keeps the list's own order and moves the
   * position, so `previous` walks back through the album; shuffle instead
   * builds a fresh order with the chosen track first.
   */
  const startAt = (length: number, index: number) =>
    shuffle.value
      ? { order: shuffled(length, index), position: 0 }
      : { order: [...Array(length).keys()], position: index }

  /** Plays `tracks` from `startIndex`; unavailable tracks are dropped first. */
  function play(tracks: Track[], startIndex = 0, from?: string) {
    const playable = tracks.filter((track) => track.available)
    if (!playable.length) return

    // Dropping tracks shifts the index, so re-find the one that was clicked.
    const start = Math.max(0, playable.indexOf(tracks[startIndex]))
    const started = startAt(playable.length, start)

    station.value = undefined
    queue.value = playable
    order.value = started.order
    position.value = started.position
    playlistId.value = from
  }

  /**
   * Starts a station. The first batch is five tracks; from there the window
   * extends itself as the end comes into view, so the queue only ever grows.
   * Shuffle is turned off rather than disabled — a stream Yandex has already
   * sequenced has nothing to shuffle, and leaving it on would scramble the one
   * ordering the station is choosing for you.
   */
  async function playStation(next: Station) {
    station.value = next
    queue.value = []
    order.value = []
    position.value = -1
    playlistId.value = undefined
    shuffle.value = false
    loading.value = true
    error.value = ''

    try {
      const batch = await getStationTracks(next.id)
      if (station.value !== next) return
      batchId = batch.batchId
      feedback('radioStarted')
      appendBatch(batch.tracks)
      position.value = 0
    } catch (cause) {
      if (station.value === next) error.value = 'Не удалось включить станцию'
      console.error(cause)
    } finally {
      if (station.value === next) loading.value = false
    }
  }

  /** Adds a station's batch to the end of both the queue and the play order. */
  function appendBatch(tracks: Track[]) {
    const playable = tracks.filter((track) => track.available)
    const first = queue.value.length
    queue.value = [...queue.value, ...playable]
    order.value = [...order.value, ...playable.map((_, index) => first + index)]
  }

  /**
   * Asks the station for the next five, keyed by the last track it handed out.
   * Called as the end of the window comes into view rather than when it's
   * reached, so `next` is never waiting on a request.
   */
  function extend(): Promise<void> {
    const current = station.value
    const last = queue.value[queue.value.length - 1]
    if (!current || !last) return Promise.resolve()
    if (extending) return extending

    extending = getStationTracks(current.id, last.id)
      .then((batch) => {
        // A station change while this was in flight already moved on.
        if (station.value !== current) return
        batchId = batch.batchId
        appendBatch(batch.tracks)
      })
      .catch((cause) => console.error(cause))
      .finally(() => (extending = undefined))

    return extending
  }

  function skip(step: number) {
    if (!queue.value.length) return
    const next = position.value + step

    if (next >= order.value.length) {
      // A station's window always has more behind it, so the end of what's
      // loaded is a wait rather than a stop. Re-checked when the batch lands:
      // a `previous` in the meantime already moved the position.
      if (station.value) {
        extend().then(() => {
          if (next < order.value.length) position.value = next
        })
        return
      }
      // End of the queue: pause on the last track rather than clearing it —
      // the player shouldn't vanish out from under what just finished.
      if (repeat.value === 'off') return audio.pause()
      position.value = 0
    } else if (next < 0) {
      // The same rule going the other way: only a looping queue wraps.
      if (repeat.value === 'off') return
      position.value = order.value.length - 1
    } else {
      position.value = next
    }
  }

  /** Straight to a place in the play order — what the queue list is for. */
  function jumpTo(index: number) {
    if (index >= 0 && index < order.value.length) position.value = index
  }

  /** Restarts the track when pressed mid-song, like every other player. */
  function previous() {
    if (currentTime.value > 3) return seek(0)
    skip(-1)
  }

  function toggle() {
    if (!current.value) return
    if (playing.value) audio.pause()
    else audio.play().catch(() => {})
  }

  function seek(seconds: number) {
    audio.currentTime = seconds
    currentTime.value = seconds
  }

  function toggleShuffle() {
    // A station sequences its own stream; there is no list to shuffle, and the
    // five tracks that happen to be loaded are not one.
    if (station.value) return
    shuffle.value = !shuffle.value
    if (position.value < 0) return

    // Rebuild around the track that's playing so it stays put — going either
    // way, only what comes after it changes.
    const started = startAt(queue.value.length, order.value[position.value])
    order.value = started.order
    position.value = started.position
  }

  const cycleRepeat = () => {
    const modes: RepeatMode[] = ['off', 'all', 'one']
    repeat.value = modes[(modes.indexOf(repeat.value) + 1) % modes.length]
  }

  /** Hands the track to everything that shows one — see `nowPlaying`. */
  function present(track: Track) {
    nowPlaying.value = track
    updateMediaSession(track)
  }

  async function load(track: Track) {
    loading.value = true
    error.value = ''
    const requested = track.id
    try {
      const url = await loadTrackAudio(track.id, quality.value)
      // A fast next/prev while this was in flight already moved on.
      if (current.value?.id !== requested) return
      audio.src = url
      // `play()` resolves once the audio is really running, which is the moment
      // this track is the one being heard.
      await audio.play()
      if (current.value?.id === requested) present(track)
    } catch (cause) {
      if (current.value?.id === requested) {
        error.value = 'Не удалось загрузить трек'
        // A failure belongs on the track it happened to, so this one is shown
        // even though it never played — otherwise the message lands under the
        // title of whatever was playing before it.
        present(track)
      }
      console.error(cause)
    } finally {
      if (current.value?.id === requested) loading.value = false
    }
  }

  /**
   * Yandex is told about a play, and only ever once per pass through a track.
   * `heard` is not `currentTime`: it's the audio that actually went past, which
   * is what the report is asking about and what seeking makes different.
   */
  let heard = 0
  let lastTime = 0
  let reported = false
  /** Whether the audio element saw the track out — a station is told which. */
  let ended = false

  function resetPlayCount() {
    heard = 0
    lastTime = 0
    reported = false
    ended = false
  }

  /**
   * Tells the station what happened. This is what "Моя волна" learns from —
   * without it the wave keeps answering the same kind of thing forever, which
   * is a sharper failure than the one `/play-audio` has: the stream still
   * plays, it just never adapts.
   */
  function feedback(type: FeedbackType, track?: Track, totalPlayedSeconds?: number) {
    const current = station.value
    if (!current) return
    sendFeedback({ station: current.id, type, batchId, trackId: track?.id, totalPlayedSeconds })
      .catch((cause) => console.error(cause))
  }

  function reportListen(track: Track | undefined) {
    // Under five seconds is a track being skipped past, not one being listened
    // to; the history is more useful without those in it.
    if (!track || reported || heard < 5) return
    reported = true

    // Off means off — and with it the history page's chart, which counts what
    // Yandex was told. Checked here rather than inside `reportPlay`, so the one
    // decision about what counts as a play stays in one place.
    if (!historyEnabled.value) return

    const uid = useAuth().account?.uid
    if (!uid) return

    reportPlay({
      trackId: track.id,
      albumId: track.albums[0]?.id,
      playlistId: playlistId.value,
      uid,
      played: heard,
      position: lastTime,
      length: track.durationMs / 1000,
    }).catch((cause) => console.error(cause))
  }

  watch(current, (track, previous) => {
    reportListen(previous)
    // Before `resetPlayCount`, which is what the event's played-seconds is read
    // from. A track the audio element saw out is finished; anything else is the
    // user leaving early, and a station is told which.
    if (previous) feedback(ended ? 'trackFinished' : 'skip', previous, Number(heard.toFixed(2)))
    resetPlayCount()
    if (!track) return
    // Neither the clock nor the artwork is touched here: the track before this
    // one is still sounding until `load` swaps `audio.src`, and its scrubber
    // should keep running for as long as it is. The audio element's own
    // `loadedmetadata` sets the new length, `present` the rest.
    load(track)
    feedback('trackStarted', track)

    const upcoming = queue.value[order.value[position.value + 1]]
    if (upcoming) prefetchTrackAudio(upcoming.id, quality.value)
    // One track from the end of the window, so `next` never waits on a fetch.
    if (position.value >= order.value.length - 2) extend()
  })

  audio.addEventListener('play', () => (playing.value = true))
  audio.addEventListener('pause', () => (playing.value = false))
  audio.addEventListener('timeupdate', () => {
    // A jump of a second or more is a seek, not a second of listening.
    const step = audio.currentTime - lastTime
    if (step > 0 && step < 1) heard += step
    lastTime = audio.currentTime
    currentTime.value = audio.currentTime
  })
  audio.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(audio.duration)) duration.value = audio.duration
  })
  audio.addEventListener('ended', () => {
    // Reported here as well as on a track change: the last track of a queue
    // with repeat off ends without the position ever moving.
    ended = true
    reportListen(current.value)
    if (repeat.value !== 'one') return skip(1)
    resetPlayCount()
    seek(0)
    audio.play()
  })

  watch([volume, muted], () => {
    audio.volume = volume.value
    audio.muted = muted.value
    localStorage.setItem('ym-volume', String(volume.value))
  }, { immediate: true })

  watch(repeat, (mode) => localStorage.setItem('ym-repeat', mode))
  watch(quality, (value) => {
    localStorage.setItem('ym-quality', value)
    if (current.value) load(current.value)
  })

  /** Lock-screen and headset controls — the reason this app feels native on a phone. */
  function updateMediaSession(track: Track) {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artists.map((artist) => artist.name).join(', '),
      album: track.albums[0]?.title,
      artwork: ARTWORK_SIZES.map((size) => ({
        src: coverUrl(track.coverUri, size),
        sizes: `${size}x${size}`,
        type: 'image/jpeg',
      })),
    })
    navigator.mediaSession.setActionHandler('play', () => audio.play())
    navigator.mediaSession.setActionHandler('pause', () => audio.pause())
    navigator.mediaSession.setActionHandler('previoustrack', previous)
    navigator.mediaSession.setActionHandler('nexttrack', () => skip(1))
  }

  return {
    queue,
    order,
    position,
    station,
    current,
    nowPlaying,
    playing,
    loading,
    error,
    currentTime,
    duration,
    progress,
    canPrevious,
    canNext,
    shuffle,
    repeat,
    quality,
    volume,
    muted,
    play,
    playStation,
    jumpTo,
    toggle,
    next: () => skip(1),
    previous,
    seek,
    toggleShuffle,
    cycleRepeat,
  }
})
