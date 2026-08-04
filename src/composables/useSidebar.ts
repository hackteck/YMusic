import { readonly, ref } from 'vue'
import { isMobile } from '@surstromming/util'

const storageKey = 'ym-sidebar'

/**
 * Desktop: the rail is narrowed to its icons. Read once at import — unlike the
 * theme, nothing has to be stamped on the document before the first paint.
 */
const collapsed = ref(localStorage.getItem(storageKey) === 'collapsed')

/**
 * Phone: the rail is a drawer over the page. Deliberately *not* restored — a
 * panel covering the content is a thing you opened, not a preference, and the
 * stored desktop state would otherwise open it on every load.
 */
const open = ref(false)

export function useSidebar() {
  /** One button, and which state it means depends on where the nav is. */
  const toggle = () => {
    if (isMobile.value) {
      open.value = !open.value
      return
    }
    collapsed.value = !collapsed.value
    localStorage.setItem(storageKey, collapsed.value ? 'collapsed' : 'expanded')
  }

  const close = () => {
    open.value = false
  }

  return { collapsed: readonly(collapsed), open: readonly(open), toggle, close }
}
