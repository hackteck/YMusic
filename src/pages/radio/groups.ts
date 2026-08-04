import type { Station } from '@/api/rotor'

/**
 * Yandex hands out ~700 stations tagged with fifteen internal `id.type`s, and
 * several of those are the same idea twice — `mood` and `mix-by-mood` are both
 * moods, `tempo` and `mix-by-tempo` are both running paces. A wall of 700 tiles
 * is unusable, so they're folded into the seven groups a person would actually
 * browse by, and the page puts a tab on each.
 *
 * `micro-genre` is kept apart from `genre` deliberately: 447 of the 700 are
 * micro-genres, and mixing them in would bury the 159 genres anyone starts from.
 */
const GROUPS = [
  { label: 'Жанры', types: ['genre'] },
  { label: 'Настроение', types: ['mood', 'mix-by-mood'] },
  { label: 'Занятие', types: ['activity', 'mix-by-activity', 'tempo', 'mix-by-tempo'] },
  { label: 'Эпохи', types: ['epoch'] },
  { label: 'Языки', types: ['local-language'] },
  { label: 'Подборки', types: ['editorial', 'author', 'personal'] },
  { label: 'Микрожанры', types: ['micro-genre', 'mix-by-micro-genre', 'mix-by-genre'] },
] as const

export interface StationGroup {
  label: string
  /** The tab's `value`; Tabs names its panel slot after it. */
  value: string
  stations: Station[]
}

const collator = new Intl.Collator('ru')

/**
 * Genres come back flat with a `parentId` on the 131 that have one, so a
 * sub-genre can land pages away from the genre it belongs to. Sorting each
 * parent's children in right behind it is the whole of the hierarchy the UI
 * needs — one ordered grid reads better here than a nested one, because what
 * you're doing is scanning for a name.
 */
function byParent(stations: Station[]) {
  const roots = stations.filter((station) => !station.parentId)
  const children = stations.filter((station) => station.parentId)

  const ordered = roots
    .sort((a, b) => collator.compare(a.name, b.name))
    .flatMap((root) => [
      root,
      ...children
        .filter((child) => child.parentId?.tag === root.id.tag)
        .sort((a, b) => collator.compare(a.name, b.name)),
    ])

  // Anything whose parent isn't itself a station — `genre:other` is one — would
  // be dropped by the flatMap above, so it's put back at the end.
  const placed = new Set(ordered)
  return [...ordered, ...children.filter((child) => !placed.has(child))]
}

export function groupStations(stations: Station[]): StationGroup[] {
  return GROUPS.map(({ label, types }) => {
    const mine = stations.filter((station) => (types as readonly string[]).includes(station.id.type))
    return {
      label,
      value: label,
      stations:
        label === 'Жанры' ? byParent(mine) : mine.sort((a, b) => collator.compare(a.name, b.name)),
    }
  }).filter((group) => group.stations.length)
}
