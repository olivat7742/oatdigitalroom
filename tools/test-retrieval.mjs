/**
 * Regression check for catalog retrieval.
 *
 *   node tools/test-retrieval.mjs
 *
 * Locks in the example questions in docs/example-questions.md. Retrieval is the part of this
 * project most likely to regress silently: adding assets changes the ranking of questions that
 * used to work, and nothing complains. Documents landing in the catalog moved several answers
 * on the first run, which is what prompted this file.
 *
 * WHY IT LOADS THE REAL MODULE
 * It imports searchCatalog from app/src/catalog.ts through Vite's SSR loader rather than
 * reimplementing the scoring. An earlier throwaway version of this check reimplemented it, and
 * that copy is worthless the moment the real one changes: it would keep passing while the app
 * broke. Vite is already a dependency, so this costs nothing and adds no test runner.
 *
 * Asserts the exact asset id, not just the type. Asserting only the type let "any proof from an
 * insurance company?" pass while returning a case study about student loans.
 */

import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(here, '..', 'app')

// Vite is a dependency of app/, not of the repo root where this script lives, so a bare
// `import ... from 'vite'` here fails with ERR_MODULE_NOT_FOUND. Resolving from app/package.json
// finds it wherever npm actually put it, rather than hardcoding a path into node_modules.
const requireFromApp = createRequire(path.join(appRoot, 'package.json'))
const { createServer } = await import(pathToFileURL(requireFromApp.resolve('vite')).href)

/** [question, expected top asset id] */
const CASES = [
  // Documents: the site's own resources, proposed rather than played.
  ['Do you have a case study for a healthcare organisation?', 'optum-case-study'],
  ['Any proof from an insurance company?', 'from-tech-trailblazer-to-cx-leader-bamboo-insurance-accelerates-growth'],
  ['How does a retailer modernise its contact center?', 'lands-end-refreshes-operations-with-long-awaited-contact-center-modernization'],
  ['Any case study from a bank or mortgage lender?', 'freedom-mortgage-case-study'],
  ['Show me a telecom workforce management case study', 'ee-expands-workforce-flexibility-and-engagement-with-nice-workforce-management'],
  ['Is there a case study from the railways or transport sector?', 'dutch-railways-gets-omnichannel-on-track-with-nice-cxone'],
  ['Which BPO improved quality management?', 'hgs-creates-a-new-chapter-of-quality-management-from-the-ground-up-with-nice-quality-central'],
  ['Show me a utilities customer using agentic AI', 'helen-case-study'],
  ['Is CXone FedRAMP authorised for government use?', 'cxone-fedramp-for-government'],
  ['Do you have an IVR datasheet?', 'cxone-interactive-voice-response'],
  ['Do you have a datasheet on employee engagement and shift flexibility?', 'nice-employee-engagement-manager-eem'],
  ['What do analysts say about NiCE for CCaaS?', 'everest-group-global-ccaas-peak-matrix-2026'],
  ['Is there research on CX technology trends for 2026?', 'state-of-cx-tech-2026-the-technologies-shaping-cx'],
  ['Do you have a white paper on outbound compliance?', 'rapid-results-with-compliance-first-scalable-outbound-engagement'],
  ['Do you have an infographic about agent copilot?', 'give-your-employees-the-cx-ai-copilot-they-deserve'],
  ['Show me an analytics infographic', 'ai-guided-analytics-a-smart-approach-to-transform-cx-results-maximize-success'],
  ['Can I read an ebook on CX AI maturity?', 'cx-ai-maturity-assessment-and-guidebook'],
  ['Do you have anything for higher education enrollment?', 'from-enrollment-cliff-to-lifelong-loyalty-orchestrating-the-student-journey-with-ai'],

  // Videos must keep working now that documents compete with them. The ids are the real ones:
  // asserting 'agent-copilot' and 'supervisor-workspace' from memory failed here, because
  // neither exists. Exact-id assertions are what caught that.
  ['How do you help agents during a conversation?', 'nice-copilot-for-agents'],
  ['What does the supervisor experience look like?', 'supervisor-control-clarity-coaching'],
]

/** Questions that must return NOTHING, so the agent says it cannot help rather than improvising. */
const MUST_NOT_MATCH = ['What is your pricing for 500 seats?', 'Do you sell tractors?']

const server = await createServer({
  root: appRoot,
  configFile: path.join(appRoot, 'vite.config.ts'),
  logLevel: 'error',
  server: { middlewareMode: true },
})

let failed = 0

try {
  const { searchCatalog, catalog } = await server.ssrLoadModule('/src/catalog.ts')
  console.log(`Catalog: ${catalog.assets.length} assets\n`)

  for (const [question, expected] of CASES) {
    const top = searchCatalog(question, 1)[0]
    const got = top?.id ?? '(no match)'
    if (got === expected) {
      console.log(`  PASS  ${question}`)
    } else {
      failed += 1
      console.log(`  FAIL  ${question}`)
      console.log(`          expected ${expected}`)
      console.log(`          got      ${got}`)
    }
  }

  for (const question of MUST_NOT_MATCH) {
    const results = searchCatalog(question, 1)
    if (results.length === 0) {
      console.log(`  PASS  (no match, as intended)  ${question}`)
    } else {
      failed += 1
      console.log(`  FAIL  ${question} should not match, got ${results[0].id}`)
    }
  }
} finally {
  await server.close()
}

console.log(`\n${CASES.length + MUST_NOT_MATCH.length - failed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
