import { get } from './client'
import type { Album, Artist, ChartPosition, Playlist, Track } from './types'

/**
 * A playlist, album or artist carrying which of the three it is. Yandex's feed
 * mixes all of them into single shelves — "Собираем для вас" and "Вы недавно
 * слушали" both do — so the tag travels with the entity instead of the shelf.
 */
export type MixedEntity =
  | { type: 'playlist'; entity: Playlist }
  | { type: 'album'; entity: Album }
  | { type: 'artist'; entity: Artist }

interface LandingBlock {
  type: string
  title: string
  entities: { data: unknown }[]
}

/**
 * The two feed blocks that are *collections* rather than picks — each is a
 * standing list with a page of its own, and the key doubles as that page's URL
 * segment. `personalplaylists` is deliberately not one: its entries are four
 * unrelated playlists, and each has to be its own card.
 */
export const COLLECTIONS = {
  'new-releases': { block: 'new-releases', type: 'album' },
  'new-playlists': { block: 'new-playlists', type: 'playlist' },
} as const

export type CollectionKey = keyof typeof COLLECTIONS

const FEED_BLOCKS = 'personalplaylists,new-releases,new-playlists'

const landing = async (blocks: string) =>
  (await get<{ blocks: LandingBlock[] }>('/landing3', { blocks })).blocks

const tagged = (type: MixedEntity['type'], entity: unknown) => ({ type, entity }) as MixedEntity

/** A whole feed block kept together, with the title Yandex gave it. */
export interface Collection {
  key: CollectionKey
  title: string
  items: MixedEntity[]
}

/**
 * A personal playlist as the feed hands it over: the real playlist a level
 * deeper, beside the "why we picked this" copy the app doesn't show, and
 * Yandex's own name for which of the four this is.
 */
interface PersonalPlaylist {
  type: string
  data: Playlist
}

/** The one people open this shelf for, so it leads the other three. */
const DAILY = 'playlistOfTheDay'

export interface Feed {
  /** "Плейлист дня" first, then its three siblings, a card each. */
  personal: Playlist[]
  /** "Новые релизы" and "Популярные плейлисты", a card each — see below. */
  collections: Collection[]
}

const entitiesOf = (block: LandingBlock, type: MixedEntity['type']) =>
  block.entities.map((entity) => tagged(type, entity.data))

/**
 * "Собираем для вас" in one call. The personal playlists arrive as four
 * unrelated things and each earns a card; the other two blocks are *lists* —
 * ten new albums, ten popular playlists — and spilling twenty more cards into
 * the same row buried the four that were actually picked for you. So each of
 * those becomes **one** card, like "Плейлист дня" is one card, opening a page
 * of its own.
 */
export async function getFeed(): Promise<Feed> {
  const blocks = await landing(FEED_BLOCKS)

  const personal = (blocks.find((block) => block.type === 'personal-playlists')?.entities ?? [])
    .map((entity) => entity.data as PersonalPlaylist)
    // The feed's own order puts "Плейлист дня" wherever it likes. `sort` is
    // stable, so pulling it to the front leaves the other three as they came.
    .sort((a, b) => Number(b.type === DAILY) - Number(a.type === DAILY))
    .map((entry) => entry.data)

  const collections = Object.values(COLLECTIONS).flatMap(({ block: key, type }) => {
    const block = blocks.find((candidate) => candidate.type === key)
    if (!block?.entities.length) return []
    return [{ key, title: block.title, items: entitiesOf(block, type) }]
  })

  return { personal, collections }
}

/** The same block on its own, for the page a collection card opens. */
export async function getCollection(key: CollectionKey): Promise<Collection> {
  const { block, type } = COLLECTIONS[key]
  const [found] = await landing(block)
  return { key, title: found?.title ?? '', items: found ? entitiesOf(found, type) : [] }
}

/**
 * A chart is a list of tracks plus, running parallel to it, where each one
 * stands. The standing belongs to the list and not to the song — the same
 * track in the library has no place in one.
 */
export interface Chart {
  title: string
  tracks: Track[]
  positions: ChartPosition[]
}

/**
 * The endpoint's own two halves, named by the `menu` it carries — "Россия" and
 * "Глобальный чарт".
 *
 * **They are not actually two charts on a CIS account.** `world` answers with
 * `selected: true` on its own menu entry and then hands back the same published
 * playlist (`414787002/1076`), 98 of whose 100 tracks are the Russian chart's.
 * The call is kept because it is the region switch Yandex documents and an
 * account outside CIS may well get something else; the tab is not hiding a bug
 * of ours.
 */
export type ChartRegion = 'russia' | 'world'

interface ChartEntry {
  track: Track
  chart: ChartPosition
}

/**
 * Not the `chart` landing block: that one carries **ten** tracks and this
 * carries all **hundred**, in the same `{ track, chart }` shape. It comes back
 * wrapped in the real playlist Yandex publishes the chart as.
 */
export async function getChart(region: ChartRegion): Promise<Chart> {
  const { chart } = await get<{ chart: { tracks: ChartEntry[] } }>(`/landing3/chart/${region}`)
  return {
    title: region === 'russia' ? 'Россия' : 'Мир',
    tracks: chart.tracks.map((entry) => entry.track),
    positions: chart.tracks.map((entry) => entry.chart),
  }
}
