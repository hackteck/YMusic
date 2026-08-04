import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getLikedTrackIds, likeTrack, unlikeTrack } from '@/api/library'
import { useAuth } from './auth'

/**
 * The numeric half. A track can arrive with a composite id (`"123:456"`,
 * track:album) but `/likes/tracks` only ever answers in bare ones, so a
 * composite would never match what's in the set.
 */
const likeId = (id: string) => id.split(':')[0]

/**
 * Which tracks are liked — one list for the whole app, so a heart is right
 * wherever the same track shows up. Loaded once per session; the library page
 * fetches the entities separately.
 */
export const useLikes = defineStore('likes', () => {
  const ids = ref(new Set<string>())

  const has = (id: string) => ids.value.has(likeId(id))

  async function load() {
    const uid = useAuth().account?.uid
    if (!uid) return
    ids.value = new Set(await getLikedTrackIds(uid))
  }

  /**
   * Optimistic, and rolled back if the write fails: the heart is its own
   * feedback, and waiting ~300 ms for Yandex to agree makes it feel broken.
   */
  async function toggle(id: string) {
    const uid = useAuth().account?.uid
    if (!uid) return

    const key = likeId(id)
    const liked = ids.value.has(key)

    if (liked) ids.value.delete(key)
    else ids.value.add(key)

    try {
      await (liked ? unlikeTrack(uid, key) : likeTrack(uid, key))
    } catch {
      if (liked) ids.value.add(key)
      else ids.value.delete(key)
    }
  }

  return { ids, has, load, toggle }
})
