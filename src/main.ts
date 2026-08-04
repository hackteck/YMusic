import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@surstromming/design/font-list.scss'
import '@surstromming/design/reset.scss'
import { initTheme } from './composables/useTheme'
import { router } from './router'
import App from './App.vue'

// Stamp the theme on <html> before the first paint.
initTheme()

createApp(App).use(createPinia()).use(router).mount('#app')
