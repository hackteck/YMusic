import { ref } from 'vue'

/** What the full-screen player puts on its stage. */
export type PlayerView = 'cover' | 'lyrics' | 'queue'

const open = ref(false)
const view = ref<PlayerView>('cover')

/**
 * The full-screen player's own state, module-level rather than threaded through
 * `App.vue` — the bar's queue button has to open the screen *and* say what it
 * should be showing, and those are one action, not two props.
 */
export function usePlayerScreen() {
  const show = (next: PlayerView = 'cover') => {
    view.value = next
    open.value = true
  }

  /** From the bar, where the same button means "open on this" and "go back". */
  const toggleView = (next: PlayerView) => {
    if (open.value && view.value === next) view.value = 'cover'
    else show(next)
  }

  const close = () => {
    open.value = false
  }

  return { open, view, show, toggleView, close }
}
