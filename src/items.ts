export interface ProjectMetadata {
  year?: string
  first_author?: string
  last_author?: string
  paper_title?: string
  paper_url?: string
  data_url?: string
  doi?: string
  abstract?: string
  [key: string]: unknown
}

/** A paper folder that has an items/ folder. */
export interface Project {
  folder: string
  itemCount: number
  metadata: ProjectMetadata | null
}

/** One file from <folder>/items/. Only the fields the cards rely on are typed; the detail view shows every field. */
export interface Item {
  /** Source file name inside items/ (added by the dev server). */
  file: string
  item_id?: string
  experiment_id?: string
  condition_id?: string
  item_role?: string
  /** One stimulus image, or several (e.g. a set of charts shown together). */
  image_path?: string | string[] | null
  question_text?: string
  local_instruction?: string | null
  global_instruction?: string | null
  response_type?: string
  response_subtype?: string
  response_options?: (string | number)[] | null
  scale_anchors?: string | null
  units?: string | null
  correct_answer?: string | number | (string | number)[] | null
  scoring_rule?: string
  /** Span of a continuous response scale (slider, adjustment); the density plot's x-axis runs min -> max. */
  response_range?: { min: number; max: number; [key: string]: unknown } | null
  /** Responses in the raw data before any of response_processing was applied. */
  n_raw_responses?: number
  /** Filters/rules applied to the raw responses to get responses.csv, with how many responses each touched. */
  response_processing?: { rule: string; n_affected: number }[]
  parse_error?: boolean
  [key: string]: unknown
}

/** One entry of <folder>/agents.json: an agent (humans, or one model) whose responses are in their own CSV. */
export interface Agent {
  id: string
  label?: string
  kind?: string
  /** Path of this agent's responses CSV inside the paper folder (default responses.csv). */
  responses?: string
  /** Model settings shown above that agent's plot (temperature, top_p, ...). */
  hyperparameters?: Record<string, unknown>
  details?: Record<string, unknown>
  [key: string]: unknown
}

export const itemKey =(item: Item) => String(item.item_id ?? item.file.replace(/\.json$/, ''))

/** Natural sort so item2 comes before item10. */
export const naturalCompare = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })

export const sortItems = (items: Item[]) => [...items].sort((a, b) => naturalCompare(itemKey(a), itemKey(b)))

export const label = (s: string) => s.replace(/_/g, ' ')

/** URL for a file inside a paper folder, e.g. stimuli/foo.png. */
export const fileUrl = (folder: string, relPath: string) =>
  `/papers/${encodeURIComponent(folder)}/${relPath.split('/').map(encodeURIComponent).join('/')}`

/** True when a string field looks like a path to a file in the paper folder. */
export const isFilePath = (v: unknown): v is string => typeof v === 'string' && /^[\w./-]+\.\w{2,4}$/.test(v) && v.includes('/')

export const isImagePath = (v: unknown): v is string => isFilePath(v) && /\.(png|jpe?g|gif|svg|webp)$/i.test(v)

export const imagePaths = (p: string | string[] | null | undefined) => (p == null ? [] : Array.isArray(p) ? p : [p])

export const isTextPath = (v: unknown): v is string => isFilePath(v) && /\.(txt|md)$/i.test(v)

/** Minimal RFC 4180 CSV parser (quoted fields, "" escapes, CRLF) -> rows of header-keyed objects. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [[]]
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') field += text[i++]
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') rows[rows.length - 1].push(field), (field = '')
    else if (c === '\n') rows[rows.length - 1].push(field.replace(/\r$/, '')), rows.push([]), (field = '')
    else field += c
  }
  if (field || rows[rows.length - 1].length) rows[rows.length - 1].push(field)
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0])
  return (body ?? []).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}
