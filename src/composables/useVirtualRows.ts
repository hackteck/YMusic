import { computed, onBeforeUnmount, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

/**
 * Which rows of a long, uniform list are worth mounting — derived from where
 * the scroller *is*, not from how far the reader has walked.
 *
 * The difference matters because the list reserves its full height up front (so
 * the scrollbar holds still while it fills). That also means the thumb can be
 * dragged straight to the bottom, and a "reveal the next slice when you reach
 * the end" scheme has nothing to show there: the sentinel it was waiting for is
 * fifty thousand pixels above, so it never fires and the page stays blank.
 *
 * Every row being exactly `rowHeight` tall is what makes the arithmetic exact,
 * and it's the only reason this is worth doing instead of measuring anything.
 * A row of a grid is that too — `StationGrid` just has to measure the height
 * rather than name it, which is why `rowHeight` may be a getter.
 */

/**
 * The nearest ancestor that actually scrolls. Found by behaviour rather than by
 * class, because it's `ScrollArea`'s private inner viewport and reaching for
 * that by name would be reaching into the package's DOM.
 */
function scrollParent(element: HTMLElement) {
  let node = element.parentElement
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll') return node
    node = node.parentElement
  }
  return undefined
}

/**
 * Kept mounted beyond each edge, so a flick doesn't paint blank. In pixels
 * rather than in rows because the callers' rows are 60px and ~200px tall: ten
 * rows of slack for a track list is two thousand pixels of unseen artwork for
 * a grid of station tiles.
 */
const OVERSCAN = 600

/** Enough to fill any first paint before the scroller has been measured. */
const INITIAL = 40

export function useVirtualRows(
  list: Ref<HTMLElement | null>,
  total: Ref<number>,
  rowHeight: MaybeRefOrGetter<number>,
) {
  const first = ref(0)
  const count = ref(INITIAL)

  let scroller: HTMLElement | undefined
  let observer: ResizeObserver | undefined
  /**
   * Where the list starts inside the scroller's content. Read once per resize
   * and never per scroll — `update` then touches only `scrollTop`, so scrolling
   * costs no layout.
   */
  let offset = 0

  const update = () => {
    const height = toValue(rowHeight)
    // A height of zero is a grid that hasn't laid itself out yet; INITIAL rows
    // are mounted meanwhile, which is what gives it something to measure.
    if (!scroller || !height) return
    const slack = Math.ceil(OVERSCAN / height)
    first.value = Math.max(0, Math.floor((scroller.scrollTop - offset) / height) - slack)
  }

  function remeasure() {
    const height = toValue(rowHeight)
    if (!list.value || !scroller || !height) return
    const listTop = list.value.getBoundingClientRect().top
    const scrollerTop = scroller.getBoundingClientRect().top
    offset = listTop - scrollerTop + scroller.scrollTop
    count.value = Math.ceil(scroller.clientHeight / height) + Math.ceil(OVERSCAN / height) * 2
    update()
  }

  function detach() {
    scroller?.removeEventListener('scroll', update)
    observer?.disconnect()
    scroller = undefined
    observer = undefined
  }

  watch(
    list,
    (element) => {
      detach()
      if (!element) return

      scroller = scrollParent(element)
      // Nothing scrolls above us: render the lot rather than a window of it.
      if (!scroller) return (count.value = total.value)

      scroller.addEventListener('scroll', update, { passive: true })
      // The viewport resizing changes how many rows fit; the list growing moves
      // where it starts. Both land here.
      observer = new ResizeObserver(remeasure)
      observer.observe(scroller)
      remeasure()
    },
    { flush: 'post' },
  )

  watch(total, remeasure, { flush: 'post' })
  watch(() => toValue(rowHeight), remeasure, { flush: 'post' })

  onBeforeUnmount(detach)

  /**
   * Pinned to the end when the list shrinks under a scrolled window — a radio
   * tab replaces 75 rows of micro-genres with 27 of genres. Left past the new
   * end, the window reserves a height nothing fills and the scroller, still
   * exactly as tall as it was, has no reason to fire a scroll event that would
   * put it right.
   */
  const start = computed(() => Math.max(0, Math.min(first.value, total.value - count.value)))
  const last = computed(() => Math.min(total.value, start.value + count.value))

  return { first: start, last }
}
