import { readonly, ref } from 'vue'

/**
 * The viewport's height, reactively. `isMobile` from the util package answers
 * about *width*, and the full-screen player's problem is the other axis: on a
 * short window its title, scrubber and transport crowd the stage down to a few
 * rows, which is a laptop in landscape rather than a phone.
 *
 * Module level, like the theme — one listener for the whole app rather than one
 * per component that asks.
 */
const height = ref(window.innerHeight)

window.addEventListener('resize', () => (height.value = window.innerHeight))

export const viewportHeight = readonly(height)
