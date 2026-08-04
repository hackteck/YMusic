import { onScopeDispose, ref, watch, type ShallowRef } from 'vue'

/**
 * Whether `text-overflow` is actually clipping an element's content — the
 * question "does this fit?", asked of the layout rather than guessed at from a
 * character count, which no proportional font makes answerable.
 *
 * The caller renders something else when the answer is yes, so **both
 * renderings have to lay out to the same width**: the measurement is of the
 * element that is showing, and two boxes of different widths would each report
 * the other one's state and swap forever.
 */
export function useTruncated(element: Readonly<ShallowRef<HTMLElement | null>>) {
  const truncated = ref(false)

  // `scrollWidth` is a rounded integer and rounds up, so a line that fits
  // exactly can read a pixel over. A pixel is not an ellipsis.
  const measure = () => {
    const node = element.value
    if (node) truncated.value = node.scrollWidth > node.clientWidth + 1
  }

  // Observing fires once, which is the first measurement, and again whenever
  // the column it sits in changes width. A change of *content* is the caller's
  // to report: the box doesn't move when the text inside it does.
  const observer = new ResizeObserver(measure)

  watch(
    element,
    (node) => {
      observer.disconnect()
      if (node) observer.observe(node)
    },
    { immediate: true },
  )

  onScopeDispose(() => observer.disconnect())

  return { truncated, measure }
}
