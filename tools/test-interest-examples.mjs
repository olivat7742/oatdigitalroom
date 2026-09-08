/**
 * Guards the example buttons offered on the last introduction question.
 *
 *   node tools/test-interest-examples.mjs
 *
 * TWO GUARANTEES, and the first is the reason this file exists.
 *
 * 1. EVERY example must retrieve something. An example button that leads nowhere is worse than
 *    no button: the visitor taps a suggestion the room made and the room says it has nothing.
 *    The portal filters at runtime, so it can never offer a dud, but the Cognigy node has no
 *    catalog fetch in front of it and cannot. This test is what protects the live agent, and it
 *    fails the moment a curated example stops matching, which is exactly when someone has
 *    edited the catalog.
 *
 * 2. The node's copy of the table must match catalog/interest-examples.json. The node cannot
 *    read that file, so the table is duplicated, and duplication without an alarm is just drift
 *    waiting to happen.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appRoot = path.join(repo, 'app')

const requireFromApp = createRequire(path.join(appRoot, 'package.json'))
const { createServer } = await import(pathToFileURL(requireFromApp.resolve('vite')).href)

const server = await createServer({
  root: appRoot,
  configFile: path.join(appRoot, 'vite.config.ts'),
  logLevel: 'error',
  server: { middlewareMode: true },
})

let failed = 0
function check(label, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${label}`)
    if (detail !== undefined) console.log(`          ${JSON.stringify(detail)}`)
  }
}

const table = JSON.parse(fs.readFileSync(path.join(repo, 'catalog', 'interest-examples.json'), 'utf8'))
const nodeSource = fs.readFileSync(
  path.join(repo, 'cognigy', 'code-nodes', 'store-visitor-profile.js'),
  'utf8',
)

try {
  const { searchCatalog } = await server.ssrLoadModule('/src/catalog.ts')
  const { exampleInterests } = await server.ssrLoadModule('/src/interestExamples.ts')

  console.log('\nevery example retrieves something')
  {
    const all = [
      ...table.groups.flatMap((g) => g.examples.map((e) => ({ group: g.key, ...e }))),
      ...table.fallback.examples.map((e) => ({ group: 'fallback', ...e })),
    ]
    for (const example of all) {
      const hits = searchCatalog(example.value, 1)
      check(
        `${example.group}: ${example.value}`,
        hits.length > 0,
        hits.length > 0 ? undefined : 'returns NOTHING, so this button must not be offered',
      )
    }
    check('labels are short enough for a chip', all.every((e) => e.label.length <= 30), all.filter((e) => e.label.length > 30))
    check(
      'no label is longer than its value, which would mean the chip says more than it sends',
      all.every((e) => e.label.length <= e.value.length),
      all.filter((e) => e.label.length > e.value.length),
    )
  }

  console.log('\nthe department decides, the role is the fallback')
  {
    // The exact case from the screenshot that prompted this.
    const wfm = exampleInterests('Workforce management / HR', 'head of Workforce Planning')
    check('a workforce department gets workforce examples', wfm.some((e) => /forecasting/i.test(e.value)), wfm)
    check('and three of them', wfm.length === 3, wfm)

    // Department beats seniority: the question is which department the project is for.
    const vp = exampleInterests('Customer service', 'VP Sales')
    check('the department wins over the job title', vp.some((e) => /agents during a conversation/i.test(e.value)), vp)

    const roleOnly = exampleInterests('', 'Chief Technology Officer')
    check('with no department, the role decides', roleOnly.length === 3, roleOnly)

    const unknown = exampleInterests('Innovation', 'Head of Innovation')
    check('an unmatched department still gets the fallback', unknown.length === 3, unknown)
    check('which is the three pillars', unknown.some((e) => /supervisor/i.test(e.value)), unknown)

    const nothing = exampleInterests(undefined, undefined)
    check('nothing known still yields usable examples', nothing.length === 3, nothing)

    // "it" is a keyword and appears inside "quality", "digital" and half the language.
    const quality = exampleInterests('Quality and compliance', 'QA Lead')
    check('whole-word matching keeps quality out of the IT group', quality.some((e) => /quality scoring/i.test(e.value)), quality)
  }

  console.log('\nthe Cognigy node copy matches the file it cannot read')
  {
    for (const group of table.groups) {
      for (const example of group.examples) {
        check(
          `node carries ${group.key}: ${example.label}`,
          nodeSource.includes(example.value) && nodeSource.includes(example.label),
          example,
        )
      }
    }
    for (const example of table.fallback.examples) {
      check(
        `node carries fallback: ${example.label}`,
        nodeSource.includes(example.value) && nodeSource.includes(example.label),
        example,
      )
    }
    for (const group of table.groups) {
      check(
        `node carries the ${group.key} keywords`,
        group.match.every((keyword) => nodeSource.includes(`'${keyword}'`)),
        group.match.filter((keyword) => !nodeSource.includes(`'${keyword}'`)),
      )
    }
  }
} finally {
  await server.close()
}

console.log(`\n${failed === 0 ? 'all checks passed' : `${failed} FAILED`}`)
process.exit(failed > 0 ? 1 : 0)
