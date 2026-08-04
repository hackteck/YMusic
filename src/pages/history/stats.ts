import type { Listen } from '@/api/history'

/**
 * The history drawn as a line. It counts what `/contexts` gives back — the last
 * hundred plays, one per context — so it is the same data the tabs below list,
 * bucketed by when it happened. Nothing is tallied locally: the account's own
 * history is the record, and a browser that has never played anything here
 * still draws the months it played elsewhere.
 */
export interface ListenPoint {
  /** "25.07" — an axis label, not a date. */
  label: string
  plays: number
  /** An index signature because that is what `Chart`'s `ChartRow` asks for. */
  [key: string]: string | number
}

export interface ListenChart {
  points: ListenPoint[]
  /** What one point covers; the series has to say which. */
  step: 'day' | 'week'
}

const DAY = 86_400_000

/**
 * Past a month of history a per-day line is a field of zeros with a spike in
 * it — a hundred plays over four months average less than one a day — so the
 * buckets become weeks and the shape comes back.
 */
const DAILY_SPAN = 31

const short = new Intl.DateTimeFormat('ru', { day: '2-digit', month: '2-digit' })

/** Local midnight, not `toISOString` — that is UTC, and would file a play at
 *  01:00 in Moscow under yesterday. */
function startOfDay(date: Date) {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day
}

/** Whole days between two moments. Rounded, because a clock change makes one
 *  of those days 23 or 25 hours long. */
const daysBetween = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY)

/** Shifted by date rather than by milliseconds, for the same reason. */
function shiftDays(date: Date, count: number) {
  const shifted = new Date(date)
  shifted.setDate(shifted.getDate() + count)
  return shifted
}

/**
 * Buckets run backwards from today, so the newest plays always land on the
 * right-hand edge and the last point is the one being lived in. Empty buckets
 * are still emitted — a line that skips its quiet days draws a week of silence
 * as a straight climb.
 */
export function listenChart(listens: Listen[]): ListenChart {
  const today = startOfDay(new Date())
  const oldest = listens.at(-1)?.playedAt

  if (!oldest) return { points: [], step: 'day' }

  const span = daysBetween(oldest, today) + 1
  const step = span > DAILY_SPAN ? 'week' : 'day'
  const size = step === 'week' ? 7 : 1
  const count = Math.ceil(span / size)

  // The label is the bucket's *newest* day: with today at the right-hand edge
  // that is the day the week runs up to, which is the one it's named by.
  const points: ListenPoint[] = Array.from({ length: count }, (_, index) => ({
    label: short.format(shiftDays(today, -(count - 1 - index) * size)),
    plays: 0,
  }))

  for (const listen of listens) {
    const index = count - 1 - Math.floor(daysBetween(listen.playedAt, today) / size)
    // A play stamped in the future would land past the end; it isn't charted.
    if (points[index]) points[index].plays++
  }

  return { points, step }
}
