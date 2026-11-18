import { useEffect, useMemo, useState } from 'react'
import {
  fileUrl,
  imagePaths,
  isImagePath,
  isTextPath,
  itemKey,
  label,
  parseCsv,
  sortItems,
  type Agent,
  type Item,
  type Project,
} from './items'

// ---------- routing: #/  ·  #/<folder>  ·  #/<folder>/<itemKey> ----------

type Route = { folder?: string; item?: string }

function parseHash(): Route {
  const [folder, item] = window.location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  return { folder: folder || undefined, item: item || undefined }
}

const href = (folder?: string, item?: string) =>
  '#/' + [folder, item].filter((s): s is string => !!s).map(encodeURIComponent).join('/')

function useRoute() {
  const [route, setRoute] = useState(parseHash)
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

function useJson<T>(url: string | null) {
  const [state, setState] = useState<{ url: string | null; data: T | null; error: string | null }>({
    url: null,
    data: null,
    error: null,
  })
  useEffect(() => {
    if (!url) return
    let cancelled = false
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url}`)
        return r.json()
      })
      .then((data: T) => !cancelled && setState({ url, data, error: null }))
      .catch((e) => !cancelled && setState({ url, data: null, error: String(e) }))
    return () => {
      cancelled = true
    }
  }, [url])
  return state.url === url ? state : { data: null, error: null }
}

// ---------- small pieces ----------

const ROLE_STYLES: Record<string, string> = {
  measure: 'bg-sky-100 text-sky-800',
  manipulation_check: 'bg-violet-100 text-violet-800',
  survey: 'bg-stone-200 text-stone-700',
  demographic: 'bg-amber-100 text-amber-800',
  practice: 'bg-emerald-100 text-emerald-800',
  attention_check: 'bg-rose-100 text-rose-800',
}

function Badge({ children, className = 'bg-stone-100 text-stone-700' }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>
}

function Breadcrumbs({ folder, item }: Route) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-stone-500">
      <a href={href()} className="hover:text-stone-900 hover:underline">
        Projects
      </a>
      {folder && (
        <>
          <span>/</span>
          <a href={href(folder)} className="break-all font-mono hover:text-stone-900 hover:underline">
            {folder}
          </a>
        </>
      )}
      {item && (
        <>
          <span>/</span>
          <span className="font-mono text-stone-900">item {item}</span>
        </>
      )}
    </nav>
  )
}

function Message({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <p
      className={
        error
          ? 'rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800'
          : 'py-12 text-center text-stone-400'
      }
    >
      {children}
    </p>
  )
}

function Thumbnail({ folder, path }: { folder: string; path?: string | string[] | null }) {
  const paths = imagePaths(path)
  if (!paths.length)
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded border border-dashed border-stone-300 text-sm text-stone-400">
        No image
      </div>
    )
  return (
    <div
      className={`grid aspect-[4/3] gap-1 overflow-hidden rounded border border-stone-200 bg-white ${paths.length > 1 ? 'grid-cols-2 p-1' : ''}`}
    >
      {paths.map((p) => (
        <img key={p} src={fileUrl(folder, p)} alt={p} loading="lazy" className="h-full w-full min-h-0 object-contain" />
      ))}
    </div>
  )
}

function Select({
  value,
  onChange,
  options,
  all,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  all: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-stone-300 bg-white px-2 py-1.5 text-sm"
    >
      <option value="">{all}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {label(o)}
        </option>
      ))}
    </select>
  )
}

const uniq = (values: (string | undefined)[]) => [...new Set(values.filter((v): v is string => !!v))].sort()

// ---------- page 1: project cards ----------

function ProjectsPage() {
  const { data: projects, error } = useJson<Project[]>('/papers/index.json')
  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-stone-500">Paper folders that contain an items/ folder.</p>
      </header>
      {error && <Message error>{error}</Message>}
      {projects && projects.length === 0 && <Message>No project folders with an items/ folder found.</Message>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((p) => {
          const m = p.metadata
          return (
            <a
              key={p.folder}
              href={href(p.folder)}
              className="flex flex-col rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition hover:border-stone-400 hover:shadow"
            >
              <h2 className="font-semibold leading-snug">{m?.paper_title || p.folder}</h2>
              {m && (
                <p className="mt-1 text-sm text-stone-600">
                  {[m.first_author, m.last_author].filter(Boolean).join(' … ')}
                  {m.year && ` · ${m.year}`}
                </p>
              )}
              <p className="mt-2 break-all font-mono text-[11px] text-stone-400">{p.folder}</p>
              <div className="mt-auto pt-3">
                <Badge className="bg-sky-100 text-sky-800">{p.itemCount} items</Badge>
              </div>
            </a>
          )
        })}
      </div>
    </>
  )
}

// ---------- page 2: item cards for one project ----------

function ItemCard({ folder, item }: { folder: string; item: Item }) {
  const key = itemKey(item)
  return (
    <a
      href={href(folder, key)}
      className="flex flex-col rounded-lg border border-stone-200 bg-white p-3 shadow-sm transition hover:border-stone-400 hover:shadow"
    >
      <Thumbnail folder={folder} path={item.image_path} />
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-mono text-stone-500">#{key}</span>
        {item.item_role && <Badge className={ROLE_STYLES[item.item_role]}>{label(item.item_role)}</Badge>}
        {item.condition_id && <Badge>{item.condition_id}</Badge>}
      </div>
      <p className="mt-2 line-clamp-4 text-sm">
        {item.parse_error ? <span className="text-rose-700">Could not parse {item.file}</span> : item.question_text}
      </p>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
        {item.response_type && <Badge className="bg-stone-800 text-white">{label(item.response_type)}</Badge>}
        {item.response_subtype && item.response_subtype !== 'other' && <Badge>{label(item.response_subtype)}</Badge>}
      </div>
    </a>
  )
}

function ProjectPage({ folder }: { folder: string }) {
  const { data: raw, error } = useJson<Item[]>(`/papers/${encodeURIComponent(folder)}/items/index.json`)
  const items = useMemo(() => (raw ? sortItems(raw) : null), [raw])
  const [query, setQuery] = useState('')
  const [experiment, setExperiment] = useState('')
  const [role, setRole] = useState('')
  const [responseType, setResponseType] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return (items ?? []).filter(
      (i) =>
        (!experiment || i.experiment_id === experiment) &&
        (!role || i.item_role === role) &&
        (!responseType || i.response_type === responseType) &&
        (!q || JSON.stringify(i).toLowerCase().includes(q)),
    )
  }, [items, query, experiment, role, responseType])

  return (
    <>
      <Breadcrumbs folder={folder} />
      {error && <Message error>{error}</Message>}
      {items && (
        <>
          <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center gap-2 bg-stone-50/95 px-4 py-2 backdrop-blur">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search question, options, image path…"
              className="min-w-48 flex-1 rounded border border-stone-300 bg-white px-2 py-1.5 text-sm"
            />
            <Select value={experiment} onChange={setExperiment} options={uniq(items.map((i) => i.experiment_id))} all="All experiments" />
            <Select value={role} onChange={setRole} options={uniq(items.map((i) => i.item_role))} all="All roles" />
            <Select
              value={responseType}
              onChange={setResponseType}
              options={uniq(items.map((i) => i.response_type))}
              all="All response types"
            />
            <span className="text-sm text-stone-500">
              {filtered.length} / {items.length}
            </span>
          </div>
          {filtered.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((item) => (
                <ItemCard key={item.file} folder={folder} item={item} />
              ))}
            </div>
          ) : (
            <Message>No matching items.</Message>
          )}
        </>
      )}
    </>
  )
}

// ---------- page 3: everything in one item JSON ----------

function TextFile({ folder, path }: { folder: string; path: string }) {
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setText(null)
    setError(null)
    fetch(fileUrl(folder, path))
      .then((r) => (r.ok ? r.text() : Promise.reject(`${r.status} ${r.statusText}`)))
      .then(setText)
      .catch((e) => setError(String(e)))
  }, [folder, path])
  return (
    <div>
      <a href={fileUrl(folder, path)} target="_blank" rel="noreferrer" className="font-mono text-xs text-sky-700 hover:underline">
        {path}
      </a>
      {error && <p className="mt-1 text-sm text-rose-700">Could not load: {error}</p>}
      {text != null && (
        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded border border-stone-200 bg-stone-50 p-3 font-sans text-sm text-stone-800">
          {/* <stimuli/foo.jpg> tags render as inline images */}
          {text.split(/<([^<>\n]+)>/).map((part, i) =>
            i % 2 && isImagePath(part) ? (
              <img key={i} src={fileUrl(folder, part)} alt={part} className="my-1 mr-1 inline-block h-32 rounded border border-stone-200 bg-white" />
            ) : (
              part
            ),
          )}
        </pre>
      )}
    </div>
  )
}

/** Parse a responses CSV (one row per participant x item) into responses grouped by item_id. */
const groupByItem = (text: string) => {
  const m = new Map<string, string[]>()
  for (const row of parseCsv(text)) {
    if (!m.has(row.item_id)) m.set(row.item_id, [])
    m.get(row.item_id)!.push(row.response)
  }
  return m
}

const fetchCsv = (folder: string, path: string) =>
  fetch(fileUrl(folder, path)).then((r) => (r.ok && r.headers.get('content-type')?.includes('csv') ? r.text() : null))

/** <folder>/responses.csv grouped by item_id; null when the paper has none. */
function useResponses(folder: string) {
  const [byItem, setByItem] = useState<Map<string, string[]> | null>(null)
  useEffect(() => {
    setByItem(null)
    let cancelled = false
    fetchCsv(folder, 'responses.csv')
      .then((text) => !cancelled && text != null && setByItem(groupByItem(text)))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [folder])
  return byItem
}

/**
 * <folder>/agents.json (optional): one entry per agent (e.g. humans, then each model), each with its own
 * responses CSV. Returns the agents in file order with their responses grouped by item_id.
 */
function useAgents(folder: string) {
  const [agents, setAgents] = useState<{ agent: Agent; byItem: Map<string, string[]> }[] | null>(null)
  useEffect(() => {
    setAgents(null)
    let cancelled = false
    fetch(fileUrl(folder, 'agents.json'))
      .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : null))
      .then((list: Agent[] | null) =>
        Array.isArray(list)
          ? Promise.all(
              list.map((agent) =>
                fetchCsv(folder, agent.responses ?? 'responses.csv').then((text) => ({
                  agent,
                  byItem: text == null ? new Map<string, string[]>() : groupByItem(text),
                })),
              ),
            )
          : null,
      )
      .then((a) => !cancelled && a && setAgents(a))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [folder])
  return agents
}

/** Response plot panel colors: human responses get a thick green outline so they stand apart from the model plots. */
const panel = (agent?: Agent) => (agent?.kind === 'human' ? 'border-2 border-emerald-500 bg-white' : 'border-stone-200 bg-white')

/** Heading of a response plot: "Responses" for the whole sample, or an agent with its hyperparameters. */
function PlotTitle({ agent, n, extra }: { agent?: Agent; n: number; extra?: string }) {
  if (!agent)
    return (
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500">
        Responses{' '}
        <span className="font-normal normal-case tracking-normal text-stone-400">
          · n = {n}
          {extra && ` · ${extra}`}
        </span>
      </h2>
    )
  const settings = Object.entries(agent.hyperparameters ?? agent.details ?? {}).filter(([k]) => k !== 'prompt')
  return (
    <div className="mb-2">
      <h2 className="text-sm font-semibold text-stone-800">
        {agent.label ?? agent.id}{' '}
        {agent.kind !== 'human' && agent.label && agent.label !== agent.id && <span className="font-mono text-xs font-normal text-stone-400">{agent.id}</span>}
        <span className="font-normal text-stone-400">
          {' '}
          · n = {n}
          {extra && ` · ${extra}`}
        </span>
      </h2>
      {settings.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1">
          {settings.map(([k, v]) => (
            <li key={k} className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-600" title={k}>
              <span className="text-stone-400">{k}</span> <span className="tabular-nums">{String(v)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ResponseHistogram({
  folder,
  item,
  responses,
  agent,
  showProcessing = true,
}: {
  folder: string
  item: Item
  responses: string[]
  agent?: Agent
  showProcessing?: boolean
}) {
  const counts = new Map<string, number>()
  for (const o of item.response_options ?? []) counts.set(String(o), 0) // options in their own order, zeros included
  for (const r of responses) counts.set(r, (counts.get(r) ?? 0) + 1)
  const max = Math.max(...counts.values(), 1)
  const correct = new Set((Array.isArray(item.correct_answer) ? item.correct_answer : [item.correct_answer]).map(String))
  // per-agent plots are stacked, so keep model bars shorter than the human one
  const barRem = agent && agent.kind !== 'human' ? 5 : 10
  return (
    <section className={`mt-4 rounded-lg border p-4 shadow-sm ${panel(agent)}`}>
      <div className="mb-2">
        <PlotTitle agent={agent} n={responses.length} />
      </div>
      <div className="flex items-end gap-2 border-b border-stone-300">
        {[...counts].map(([value, n]) => {
          const pct = Math.round((100 * n) / responses.length)
          return (
            <div key={value} className="group flex min-w-0 flex-1 flex-col items-center" title={`${value}: ${n} (${pct}%)`}>
              <span className="mb-1 text-xs tabular-nums text-stone-600">
                {n} <span className="text-stone-400">({pct}%)</span>
              </span>
              <div
                className="w-full max-w-12 rounded-t bg-sky-600 group-hover:bg-sky-700"
                style={{ height: `${(n / max) * barRem}rem`, minHeight: n ? 2 : 0 }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {[...counts.keys()].map((value) => (
          <div key={value} className="min-w-0 flex-1 text-center text-xs text-stone-600">
            {isImagePath(value) ? (
              <img src={fileUrl(folder, value)} alt={value} className="mx-auto h-12 rounded border border-stone-200 bg-white object-contain" />
            ) : value === '' ? (
              <span className="italic text-stone-400">no valid answer</span>
            ) : (
              <span className="break-words">{value}</span>
            )}
            {correct.has(value) && <span className="font-medium text-stone-800"> ✓</span>}
          </div>
        ))}
      </div>
      {showProcessing && <Processing item={item} n={responses.length} />}
    </section>
  )
}

function Processing({ item, n }: { item: Item; n: number }) {
  return item.response_processing?.length ? (
    <div className="mt-4 border-t border-stone-200 pt-3 text-xs text-stone-600">
      <h3 className="mb-1.5 font-semibold text-stone-500">
        Processing applied to raw data
        {item.n_raw_responses != null && (
          <span className="font-normal text-stone-400">
            {' '}
            · {item.n_raw_responses} raw → {n} shown
          </span>
        )}
      </h3>
      <ul className="space-y-1">
        {item.response_processing.map((p, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-12 shrink-0 text-right tabular-nums text-stone-800">{p.n_affected}</span>
            <span className={`min-w-0 break-words ${p.n_affected ? '' : 'text-stone-400'}`}>{p.rule}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : null
}

/** Free numeric answers (no fixed options, every response a number) get a density plot instead of one bar per value. */
const isContinuous = (item: Item, responses: string[]) =>
  !item.response_options?.length && responses.length > 1 && responses.every((r) => r.trim() !== '' && Number.isFinite(Number(r)))

/** Round, evenly spaced axis ticks covering [lo, hi]. */
function niceTicks(lo: number, hi: number, count = 6) {
  const raw = (hi - lo) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!
  const ticks = []
  for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) ticks.push(+t.toFixed(10))
  return ticks
}

const fmt = (v: number) => String(+v.toPrecision(3))

/** x-axis span for a density plot: the item's response scale (min -> max) when it declares one, widened to the responses. */
function densityDomain(item: Item, responses: number[]): [number, number] {
  const range = item.response_range
  const lo = Math.min(...responses, ...(range ? [range.min] : []))
  const hi = Math.max(...responses, ...(range ? [range.max] : []))
  return [lo, hi]
}

function ResponseDensity({
  item,
  responses,
  agent,
  domain,
  invalid = 0,
  showProcessing = false,
}: {
  item: Item
  responses: number[]
  agent?: Agent
  /** Shared x-axis across stacked plots; responses outside it are counted, not drawn. */
  domain?: [number, number]
  /** Responses without a valid number (blank), reported next to n. */
  invalid?: number
  showProcessing?: boolean
}) {
  const [hoverX, setHoverX] = useState<number | null>(null)
  const sorted = [...responses].sort((a, b) => a - b)
  const n = sorted.length
  const q = (p: number) => sorted[Math.min(n - 1, Math.floor(p * n))]
  const range = item.response_range
  const [lo, hi] = domain ?? densityDomain(item, sorted)
  const span = hi - lo || 1
  const offAxis = sorted.filter((v) => v < lo || v > hi).length
  const notes = [invalid ? `${invalid} without a valid answer` : '', offAxis ? `${offAxis} off-axis` : ''].filter(Boolean).join(' · ')
  if (!n)
    return (
      <section className={`mt-4 rounded-lg border p-4 shadow-sm ${panel(agent)}`}>
        <PlotTitle agent={agent} n={invalid} />
        <p className="text-xs text-stone-500">No valid numeric answers.</p>
      </section>
    )
  // Gaussian KDE, Silverman's bandwidth
  const mean = sorted.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1))
  const spread = Math.min(sd, (q(0.75) - q(0.25)) / 1.34) || sd || span / 50
  const bw = 0.9 * spread * n ** -0.2
  const density = (x: number) => sorted.reduce((a, v) => a + Math.exp(-0.5 * ((x - v) / bw) ** 2), 0) / (n * bw * Math.sqrt(2 * Math.PI))
  const STEPS = 240
  const curve = Array.from({ length: STEPS + 1 }, (_, i) => {
    const x = lo + (span * i) / STEPS
    return [x, density(x)] as const
  })
  // y-axis: round density ticks, topped by the first tick at or above the curve's peak
  const peak = Math.max(...curve.map(([, d]) => d)) || 1
  const yTicks = niceTicks(0, peak, 4)
  if (yTicks[yTicks.length - 1] < peak) yTicks.push(+(2 * yTicks[yTicks.length - 1] - yTicks[yTicks.length - 2]).toFixed(10))
  const yMax = yTicks[yTicks.length - 1]

  const [W, H, L, R, T, B] = [600, 230, 64, 16, 30, 46]
  const sx = (x: number) => L + ((x - lo) / span) * (W - L - R)
  const sy = (d: number) => H - B - (d / yMax) * (H - T - B)
  const base = H - B
  const line = curve.map(([x, d], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(d).toFixed(1)}`).join('')
  const area = `${line}L${sx(hi).toFixed(1)},${base}L${sx(lo).toFixed(1)},${base}Z`

  const correct = item.correct_answer != null && item.correct_answer !== '' ? Number(item.correct_answer) : Number.NaN
  const near = hoverX == null ? 0 : sorted.filter((v) => Math.abs(v - hoverX) <= bw).length

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    setHoverX(px < L || px > W - R ? null : lo + ((px - L) / (W - L - R)) * span)
  }

  return (
    <section className={`mt-4 rounded-lg border p-4 shadow-sm ${panel(agent)}`}>
      <PlotTitle agent={agent} n={n + invalid} extra={notes || undefined} />
      <p className="mb-2 text-xs text-stone-500">
        median {fmt(q(0.5))} · middle 50% {fmt(q(0.25))} to {fmt(q(0.75))}
        {Number.isFinite(correct) && <> · correct {fmt(correct)}</>}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseMove={onMove} onMouseLeave={() => setHoverX(null)} role="img"
        aria-label={`Density of ${n} responses from ${fmt(lo)} to ${fmt(hi)}, median ${fmt(q(0.5))}`}>
        {niceTicks(lo, hi, 8).map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={T} y2={base} className="stroke-stone-100" />
            {/* skip labels that would crowd the min/max end labels */}
            {!(range && Math.min(t - lo, hi - t) < span * 0.06) && (
              <text x={sx(t)} y={base + 30} textAnchor="middle" className="fill-stone-500 text-[11px] tabular-nums">{fmt(t)}</text>
            )}
          </g>
        ))}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} className="stroke-stone-100" />
            <text x={L - 6} y={sy(t)} dy="0.32em" textAnchor="end" className="fill-stone-500 text-[11px] tabular-nums">{fmt(t)}</text>
          </g>
        ))}
        <line x1={L} x2={L} y1={T} y2={base} className="stroke-stone-300" />
        <text transform={`translate(14 ${(T + base) / 2}) rotate(-90)`} textAnchor="middle" className="fill-stone-500 text-[11px]">density</text>
        <path d={area} className="fill-sky-600/15" />
        <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-sky-600" />
        <line x1={L} x2={W - R} y1={base} y2={base} className="stroke-stone-300" />
        {/* rug: one tick per response */}
        {sorted.filter((v) => v >= lo && v <= hi).map((v, i) => (
          <line key={i} x1={sx(v)} x2={sx(v)} y1={base + 3} y2={base + 13} strokeWidth={1} className="stroke-sky-700/40" />
        ))}
        {/* the response scale's ends */}
        {range &&
          ([['min', range.min, 'start'], ['max', range.max, 'end']] as const).map(([name, v, anchor]) => (
            <g key={name}>
              <line x1={sx(v)} x2={sx(v)} y1={base} y2={base + 18} className="stroke-stone-500" />
              <text x={sx(v)} y={base + 30} textAnchor={anchor} className="fill-stone-700 text-[11px] font-medium tabular-nums">
                {name} {fmt(v)}
              </text>
            </g>
          ))}
        {Number.isFinite(correct) && correct >= lo && correct <= hi && (
          <g>
            <line x1={sx(correct)} x2={sx(correct)} y1={T - 4} y2={base} strokeDasharray="4 3" strokeWidth={1.5} className="stroke-stone-800" />
            <text x={sx(correct)} y={T - 8} textAnchor="middle" className="fill-stone-800 text-[11px]">correct {fmt(correct)} ✓</text>
          </g>
        )}
        {hoverX != null && (
          <g pointerEvents="none">
            <line x1={sx(hoverX)} x2={sx(hoverX)} y1={T} y2={base} className="stroke-stone-400" />
            <circle cx={sx(hoverX)} cy={sy(density(hoverX))} r={4} strokeWidth={2} className="fill-sky-600 stroke-white" />
            <text x={sx(hoverX) + (hoverX > lo + span / 2 ? -6 : 6)} y={T + 12} textAnchor={hoverX > lo + span / 2 ? 'end' : 'start'}
              className="fill-stone-700 text-[11px] tabular-nums">
              {fmt(hoverX)} · {near} response{near === 1 ? '' : 's'} within ±{fmt(bw)}
            </text>
          </g>
        )}
      </svg>
      {item.units && <p className="mt-1 text-center text-xs text-stone-500">{item.units}</p>}
      {showProcessing && <Processing item={item} n={n + invalid} />}
    </section>
  )
}

function ResponseOptions({ folder, item }: { folder: string; item: Item }) {
  const opts = item.response_options
  if (!opts?.length) return <span className="text-stone-400">none</span>
  const correct = new Set((Array.isArray(item.correct_answer) ? item.correct_answer : [item.correct_answer]).map(String))
  return (
    <ul className="flex flex-wrap gap-1.5">
      {opts.map((o, i) => {
        const isCorrect = correct.has(String(o))
        return (
          <li
            key={i}
            className={`rounded border px-2 py-0.5 text-sm ${
              isCorrect ? 'border-emerald-300 bg-emerald-50 font-medium text-emerald-800' : 'border-stone-200 bg-white'
            }`}
          >
            {isImagePath(o) ? <img src={fileUrl(folder, String(o))} alt={String(o)} className="h-24" /> : String(o)}
            {isCorrect && ' ✓'}
          </li>
        )
      })}
    </ul>
  )
}

function FieldValue({ folder, item, field }: { folder: string; item: Item; field: string }) {
  const v = item[field]
  if (field === 'response_options') return <ResponseOptions folder={folder} item={item} />
  if (v === null || v === undefined || v === '') return <span className="text-stone-400">{v === '' ? '""' : 'null'}</span>
  if (typeof v === 'boolean') return <span className="font-mono">{String(v)}</span>
  if (isTextPath(v)) return <TextFile folder={folder} path={v} />
  if (isImagePath(v))
    return (
      <a href={fileUrl(folder, v)} target="_blank" rel="noreferrer" className="font-mono text-xs text-sky-700 hover:underline">
        {v}
      </a>
    )
  if (typeof v === 'object')
    return <pre className="overflow-auto rounded bg-stone-50 p-2 font-mono text-xs">{JSON.stringify(v, null, 2)}</pre>
  return <span className="whitespace-pre-wrap">{String(v)}</span>
}

// Fields shown in this order first; any other fields in the JSON follow in file order.
const FIELD_GROUPS: [string, string[]][] = [
  ['Item', ['item_id', 'experiment_id', 'condition_id', 'item_role']],
  ['Question', ['question_text', 'question_text_source']],
  ['Instructions', ['global_instruction', 'local_instruction']],
  [
    'Response',
    ['response_type', 'response_subtype', 'response_options', 'correct_answer', 'scoring_rule', 'response_range', 'scale_anchors', 'units', 'question_answer_paired', 'required', 'feedback_shown'],
  ],
  ['Timing (ms)', ['exposure_ms', 'fixation_ms', 'mask_ms', 'time_limit_ms']],
  ['Stimulus', ['image_path']],
]

/** One plot per agent (agents.json order, so humans first), sharing a density x-axis with the human responses. */
function AgentResponses({ folder, item, agents }: { folder: string; item: Item; agents: { agent: Agent; byItem: Map<string, string[]> }[] }) {
  const per = agents.map(({ agent, byItem }) => ({ agent, responses: byItem.get(itemKey(item)) ?? [] })).filter((a) => a.responses.length)
  if (!per.length) return null
  const all = per.flatMap((a) => a.responses)
  const answered = all.filter((r) => r.trim() !== '')
  const continuous = isContinuous(item, answered)
  const nums = (rs: string[]) => rs.filter((r) => r.trim() !== '').map(Number)
  // axis from the first agent (humans) so a model's wild guesses don't squash everyone else's plot
  const anchor = nums(per[0].responses)
  const correct = typeof item.correct_answer === 'number' ? [item.correct_answer] : []
  const domain = continuous ? densityDomain(item, [...(anchor.length ? anchor : nums(all)), ...correct]) : undefined
  return (
    <>
      {per.map(({ agent, responses }) =>
        continuous ? (
          <ResponseDensity key={agent.id} item={item} agent={agent} domain={domain} responses={nums(responses)}
            invalid={responses.length - nums(responses).length} />
        ) : (
          <ResponseHistogram key={agent.id} folder={folder} item={item} agent={agent} responses={responses} showProcessing={false} />
        ),
      )}
      <section className="mt-4 rounded-lg border border-stone-200 bg-white p-4 shadow-sm [&>div]:mt-0 [&>div]:border-t-0 [&>div]:pt-0">
        <Processing item={item} n={all.length} />
      </section>
    </>
  )
}

function ItemPage({ folder, itemId }: { folder: string; itemId: string }) {
  const { data: raw, error } = useJson<Item[]>(`/papers/${encodeURIComponent(folder)}/items/index.json`)
  const items = useMemo(() => (raw ? sortItems(raw) : null), [raw])
  const index = items?.findIndex((i) => itemKey(i) === itemId) ?? -1
  const item = items?.[index]
  const prev = items && index > 0 ? itemKey(items[index - 1]) : null
  const next = items && index >= 0 && index < items.length - 1 ? itemKey(items[index + 1]) : null
  const responses = useResponses(folder)
  const agents = useAgents(folder)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft' && prev) window.location.hash = href(folder, prev)
      if (e.key === 'ArrowRight' && next) window.location.hash = href(folder, next)
      if (e.key === 'Escape') window.location.hash = href(folder)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [folder, prev, next])

  // response_processing / n_raw_responses are shown under the histogram instead
  const known = new Set(FIELD_GROUPS.flatMap(([, f]) => f).concat('file', 'response_processing', 'n_raw_responses'))
  const groups: [string, string[]][] = item
    ? [
        ...FIELD_GROUPS.map(([name, fields]) => [name, fields.filter((f) => f in item)] as [string, string[]]),
        ['Other fields', Object.keys(item).filter((k) => !known.has(k))] as [string, string[]],
      ].filter(([, fields]) => fields.length > 0)
    : []

  return (
    <>
      <Breadcrumbs folder={folder} item={itemId} />
      {error && <Message error>{error}</Message>}
      {items && !item && <Message error>No item “{itemId}” in this project.</Message>}
      {item && (
        <>
          <div className="mb-4 flex items-center justify-between gap-2">
            <a
              href={prev ? href(folder, prev) : undefined}
              className={`rounded border px-3 py-1 text-sm ${prev ? 'border-stone-300 bg-white hover:bg-stone-100' : 'pointer-events-none border-stone-200 text-stone-300'}`}
            >
              ← Prev
            </a>
            <span className="text-sm text-stone-500">
              {index + 1} of {items!.length} · <span className="font-mono">items/{item.file}</span>
            </span>
            <a
              href={next ? href(folder, next) : undefined}
              className={`rounded border px-3 py-1 text-sm ${next ? 'border-stone-300 bg-white hover:bg-stone-100' : 'pointer-events-none border-stone-200 text-stone-300'}`}
            >
              Next →
            </a>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* own scroll so a tall stimulus can't push the histogram off-screen */}
            <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
              {imagePaths(item.image_path).length ? (
                <div className={`grid gap-2 ${imagePaths(item.image_path).length > 1 ? 'grid-cols-2' : ''}`}>
                  {imagePaths(item.image_path).map((p) => (
                    <a key={p} href={fileUrl(folder, p)} target="_blank" rel="noreferrer">
                      <img src={fileUrl(folder, p)} alt={p} className="w-full rounded border border-stone-200 bg-white object-contain" />
                    </a>
                  ))}
                </div>
              ) : (
                <Thumbnail folder={folder} path={null} />
              )}
              <p className="mt-3 text-lg leading-snug">{item.question_text}</p>
              {agents ? (
                <AgentResponses folder={folder} item={item} agents={agents} />
              ) : responses?.has(itemKey(item)) ? (
                isContinuous(item, responses.get(itemKey(item))!) ? (
                  <ResponseDensity item={item} responses={responses.get(itemKey(item))!.map(Number)} />
                ) : (
                  <ResponseHistogram folder={folder} item={item} responses={responses.get(itemKey(item))!} />
                )
              ) : (
                responses &&
                (item.item_role === 'practice' || item.item_role === 'example') && (
                  <p className="mt-4 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-500">
                    No response distribution: this is a {label(item.item_role)} item, so its responses are not in the
                    results data.
                  </p>
                )
              )}
            </div>

            <div className="space-y-4">
              {groups.map(([name, fields]) => (
                <section key={name} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">{name}</h2>
                  <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                    {fields.map((f) => (
                      <div key={f} className="contents">
                        <dt className="font-mono text-xs text-stone-500 sm:pt-0.5">{f}</dt>
                        <dd className="min-w-0 text-sm">
                          <FieldValue folder={folder} item={item} field={f} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
              <details className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-stone-500">Raw JSON</summary>
                <pre className="mt-3 overflow-auto font-mono text-xs">
                  {JSON.stringify(Object.fromEntries(Object.entries(item).filter(([k]) => k !== 'file')), null, 2)}
                </pre>
              </details>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default function App() {
  const route = useRoute()
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {route.folder && route.item ? (
        <ItemPage key={route.folder} folder={route.folder} itemId={route.item} />
      ) : route.folder ? (
        <ProjectPage key={route.folder} folder={route.folder} />
      ) : (
        <ProjectsPage />
      )}
    </div>
  )
}
