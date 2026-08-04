import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // Installable, and offline as far as the *shell* — see "Installing it" in
    // CLAUDE.md for why that's where it stops.
    VitePWA({
      // Not `autoUpdate`: that reloads the tab the moment a new build lands,
      // which stops whatever is playing. The waiting worker takes over the next
      // time the app is launched with nothing open — the normal SW lifecycle —
      // and nothing here ever calls the prompt, because a "new version" bar is
      // UI this app hasn't earned.
      registerType: 'prompt',
      injectRegister: 'auto',
      // No `includeAssets`: everything in public/ is copied to dist unrevved,
      // and `globPatterns` below already sweeps the icons and the favicon up
      // out of there.
      manifest: {
        id: '/',
        name: 'YMusic',
        short_name: 'YMusic',
        description: 'Яндекс Музыка в браузере',
        lang: 'ru',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // The splash and the task-switcher chrome can't follow the theme
        // toggle, so they commit to dark — the side a music player sits on.
        // The <meta name="theme-color"> useTheme keeps in step overrides this
        // on the running page.
        background_color: '#080808',
        theme_color: '#080808',
        categories: ['music', 'entertainment'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Поиск', url: '/search' },
          { name: 'Радио', url: '/radio' },
          { name: 'Моя музыка', url: '/library' },
        ],
      },
      workbox: {
        // The shell and nothing else. `woff2` is named because the kit's Geist
        // ships as one and a shell without its font is a flash of nothing.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // 19 MB of ffmpeg, loaded lazily on the first download and cached by
        // the browser from then on. Precaching it would make every install pay
        // for a feature most sessions never touch.
        globIgnores: ['**/ffmpeg/**'],
        // The history router: any path the network can't answer is index.html.
        navigateFallback: '/index.html',
        // Old builds' precaches go when a new worker activates.
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // @surstromming/* ship raw .vue/.scss — esbuild's dep pre-bundler can't read
  // them, so they have to travel the normal plugin pipeline like app source.
  optimizeDeps: {
    exclude: ['@surstromming/design'],
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
})
