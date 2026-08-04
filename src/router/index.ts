import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { useLikes } from '@/stores/likes'

declare module 'vue-router' {
  interface RouteMeta {
    /** Routes outside the app shell — no nav, no player. */
    public?: boolean
  }
}

const routes = [
  { path: '/', name: 'home', component: () => import('@/pages/home/HomePage.vue') },
  { path: '/search', name: 'search', component: () => import('@/pages/search/SearchPage.vue') },
  { path: '/library', name: 'library', component: () => import('@/pages/library/LibraryPage.vue') },
  { path: '/radio', name: 'radio', component: () => import('@/pages/radio/RadioPage.vue') },
  { path: '/history', name: 'history', component: () => import('@/pages/history/HistoryPage.vue') },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/pages/settings/SettingsPage.vue'),
  },
  {
    path: '/collection/:key',
    name: 'collection',
    component: () => import('@/pages/collection/CollectionPage.vue'),
  },
  { path: '/album/:id', name: 'album', component: () => import('@/pages/album/AlbumPage.vue') },
  { path: '/artist/:id', name: 'artist', component: () => import('@/pages/artist/ArtistPage.vue') },
  {
    path: '/artist/:id/tracks',
    name: 'artist-tracks',
    component: () => import('@/pages/artist/ArtistTracksPage.vue'),
  },
  {
    path: '/artist/:id/similar',
    name: 'artist-similar',
    component: () => import('@/pages/artist/SimilarArtistsPage.vue'),
  },
  {
    path: '/playlist/:uid/:kind',
    name: 'playlist',
    component: () => import('@/pages/playlist/PlaylistPage.vue'),
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/login/LoginPage.vue'),
    meta: { public: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'notfound',
    component: () => import('@/pages/notfound/NotFoundPage.vue'),
  },
]

// No scrollBehavior: the document doesn't scroll — each page is its own
// ScrollArea, keyed by path in App.vue so a new page mounts at the top.
export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuth()
  // The stored token is only proven good once, on the first navigation.
  if (!auth.isAuthenticated) await auth.restore()

  // Not awaited: a heart filling in a moment late is fine, a first paint that
  // waits on 979 ids is not.
  if (auth.isAuthenticated && !useLikes().ids.size) useLikes().load()

  if (to.meta.public) return auth.isAuthenticated ? '/' : true
  return auth.isAuthenticated ? true : '/login'
})
