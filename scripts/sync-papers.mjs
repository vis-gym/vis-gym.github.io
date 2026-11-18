// Copies the dashboard's paper data from ../standardized-papers (or the path given as the first argument)
// into public/papers, building the index files the app fetches:
//   public/papers/index.json                 folders with items/, plus their metadata
//   public/papers/<folder>/items/index.json  all item JSONs of that folder, as one array
// and copying the files it loads: metadata.json, responses.csv, agents.json, responses/, stimuli/.
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(process.argv[2] ?? '../standardized-papers')
const OUT = path.resolve('public/papers')
const HIDDEN = new Set(['015_2014_demiralp_learning-perceptual-kernels-for-visualiz'])
const COPY = ['metadata.json', 'responses.csv', 'agents.json', 'responses', 'stimuli']

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

if (!fs.existsSync(SRC)) throw new Error(`No papers folder at ${SRC}`)
fs.rmSync(OUT, { recursive: true, force: true })

const projects = fs
  .readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !HIDDEN.has(d.name) && fs.existsSync(path.join(SRC, d.name, 'items')))
  .map((d) => d.name)
  .sort()
  .map((folder) => {
    const src = path.join(SRC, folder)
    const out = path.join(OUT, folder)
    const files = fs.readdirSync(path.join(src, 'items')).filter((f) => f.endsWith('.json'))
    const items = files.map((f) => ({ file: f, ...(readJson(path.join(src, 'items', f)) ?? { parse_error: true }) }))
    fs.mkdirSync(path.join(out, 'items'), { recursive: true })
    fs.writeFileSync(path.join(out, 'items', 'index.json'), JSON.stringify(items))
    for (const name of COPY) {
      if (fs.existsSync(path.join(src, name))) fs.cpSync(path.join(src, name), path.join(out, name), { recursive: true })
    }
    return { folder, itemCount: files.length, metadata: readJson(path.join(src, 'metadata.json')) }
  })

fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(projects))
console.log(`Synced ${projects.length} papers from ${SRC} into ${OUT}`)
