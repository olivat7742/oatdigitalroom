/**
 * Regression check for the two Cognigy Code nodes that decide the visitor's vertical.
 *
 *   node tools/test-cognigy-nodes.mjs
 *
 * WHY THIS EXISTS
 * The MCP connector cannot READ a Code node's JavaScript, only write it. So cognigy/code-nodes/
 * is the only copy of that source, and a mistake in it is invisible until a visitor hits it in
 * a live conversation eight to fifteen seconds per turn away. This runs both mirrors against
 * fake Cognigy globals, so the branches are checked in milliseconds before anything is
 * deployed.
 *
 * It tests the MIRRORS. That is only meaningful because the mirrors are what gets written to
 * Cognigy: edit the node in the Cognigy UI instead and this proves nothing about what is live.
 *
 * One bug it already caught, which no typecheck could: a visitor who declined the vertical
 * question was asked it again forever, because nothing was recorded so nothing was known so
 * the question went back on the plan. Anyone in an industry NiCE does not list could never
 * finish the introduction.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// fileURLToPath, not a hand-rolled equivalent: this repo lives under a path containing a
// space, so the URL is percent-encoded and parsing it by hand yields %20.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(repo, p), 'utf8')

const profileSrc = read('cognigy/code-nodes/store-visitor-profile.js')
const lookupSrc = read('cognigy/code-nodes/lookup-crm-postprocess.js')
const fixtures = JSON.parse(read('catalog/crm-fixtures.json'))
const industries = JSON.parse(read('catalog/industries.json'))

let failed = 0
const check = (label, ok, detail) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) { failed += 1; if (detail !== undefined) console.log('        ', JSON.stringify(detail)) }
}

const runProfile = (toolArgs, ctx = {}) => {
  const input = { aiAgent: { toolArgs } }
  const context = { ...ctx }
  const outputs = []
  const actions = {
    output: (text, data) => outputs.push({ text, data }),
    setContext: (k, v) => { context[k] = v },
    updateProfile: () => {},
    addContactMemory: () => {},
  }
  new Function('input', 'context', 'actions', 'profile', profileSrc)(input, context, actions, {})
  return { result: input.result, outputs, context }
}

const runLookup = (toolArgs) => {
  const input = {
    aiAgent: { toolArgs },
    httprequest: { result: fixtures },
    industryRules: industries,
  }
  const actions = { setContext: () => {} }
  new Function('input', 'context', 'actions', 'profile', lookupSrc)(input, {}, actions, {})
  return input.crmResult
}

console.log('\nlookup_crm post-process: industry normalisation')
{
  const known = runLookup({ email: 'x@vantagebank.com' })
  check('Finance and Insurance overrides to Financial', known.industry === 'Financial', known)
  check('source is crm', known.industrySource === 'crm', known)
  check('the vocabulary actually loaded', known.industryRulesLoaded === 12, known.industryRulesLoaded)

  const retail = runLookup({ email: 'x@helioretail.com' })
  check('Retail Trade overrides to Retail', retail.industry === 'Retail', retail)

  const zeroWidth = runLookup({ email: 'x@brightpathcare.com' })
  check('a zero-width character does not break the match', zeroWidth.industry === 'Healthcare', zeroWidth)

  const unmapped = runLookup({ email: 'x@northwindlogistics.com' })
  check('Transportation and Warehousing maps to NOTHING', unmapped.industry === undefined, unmapped)
  check('and still returns the account', unmapped.status === 'known', unmapped.status)

  const newLead = runLookup({ email: 'x@nobody-knows-this.com' })
  check('a new lead carries no industry', newLead.industry === undefined, newLead)

  const colleague = runLookup({ email: 'o@nice.com' })
  check('a colleague is still skipped', colleague.status === 'skipped', colleague)

  const rulesMissing = (() => {
    const input = { aiAgent: { toolArgs: { email: 'x@vantagebank.com' } }, httprequest: { result: fixtures } }
    new Function('input', 'context', 'actions', 'profile', lookupSrc)(input, {}, { setContext: () => {} }, {})
    return input.crmResult
  })()
  check('a failed vocabulary fetch degrades to no industry, not a crash', rulesMissing.industry === undefined && rulesMissing.status === 'known', rulesMissing)
  check('and says so', rulesMissing.industryRulesLoaded === 0, rulesMissing.industryRulesLoaded)
}

console.log('\nstore_visitor_profile: when the vertical is asked')
{
  const base = { firstName: 'Sam', lastName: 'Reyes', company: 'Quietfield', jobTitle: 'Ops Lead', email: 'sam@quietfield.com', department: 'Ops', interest: 'WFM' }

  // PASS ONE: the whole introduction arrives in one message, so everything is decided before
  // anything has been looked up. The question is queued but must NOT be put yet.
  const pending = runProfile(base)
  check('the vertical is what remains', pending.result.nextQuestion.includes('industry'), pending.result.nextQuestion)
  check('so the introduction is NOT complete yet', pending.result.introductionComplete === false)
  check('but it is not being asked yet', pending.result.askingIndustry === false)
  check(
    'and NO buttons are emitted, so twelve chips do not flash and vanish',
    !pending.outputs.some((o) => o.data && o.data._showroom),
    pending.outputs.map((o) => Object.keys(o.data ?? {})),
  )

  // PASS TWO: the lookup has now run and found nothing useful. A new lead resolves with no
  // industry at all, and treating that as "not looked up yet" would suppress the question
  // forever, leaving the visitor a prompt with no buttons.
  const asked = runProfile(base, { crm: { status: 'new-lead', domain: 'quietfield.com' } })
  check('once the lookup has run and found nothing, the question IS put', asked.result.askingIndustry === true, asked.result.nextQuestion)
  const offer = asked.outputs.find((o) => o.data && o.data._showroom)
  check('twelve buttons are offered', offer?.data._showroom.cta.length === 12, offer?.data._showroom.cta.length)
  check('as an offer, which leaves the stage alone', offer?.data._showroom.action === 'offer')
  check('every button is label, value and kind', offer?.data._showroom.cta.every((c) => c.label && c.value && c.kind === 'quick_reply'))
  check(
    'and the lookup instruction is gone, so it is not ordered twice',
    !asked.result.guidance.includes('Do NOT ask this question yet'),
    asked.result.guidance,
  )

  const known = runProfile(base, { crm: { status: 'known', industry: 'Financial' } })
  check('with a CRM answer, it is NOT asked', known.result.askingIndustry === false, known.result.nextQuestion)
  check('the introduction completes instead', known.result.introductionComplete === true)
  check('and the vertical is carried', known.result.industry === 'Financial', known.result.industry)
  check('marked as looked up', known.result.industrySource === 'crm', known.result.industrySource)
  check('no buttons are offered', !known.outputs.some((o) => o.data && o.data._showroom))

  const colleague = runProfile({ ...base, email: 'o@nice.com', niceIntent: 'for my own knowledge' })
  check('a colleague browsing for themselves is never asked', colleague.result.askingIndustry === false, colleague.result.nextQuestion)
  check('and their introduction completes', colleague.result.introductionComplete === true)

  // A whole introduction in one message decides everything in a single tool call, before
  // anything has been looked up. Observed live: the agent asked helioretail.com its industry
  // when the account record already said Retail Trade. The guidance now spells out the order.
  check(
    'when nothing has been looked up yet, the guidance orders the lookup FIRST',
    pending.result.guidance.includes('Do NOT ask this question yet') &&
      pending.result.guidance.includes('lookup_crm') &&
      pending.result.guidance.includes('save_visitor_profile again'),
    pending.result.guidance,
  )
  check(
    'and still returns the question, so a model that ignores it asks rather than stalls',
    typeof pending.result.nextQuestion === 'string' && pending.result.nextQuestion.length > 0,
    pending.result.nextQuestion,
  )
  check(
    'once CRM HAS answered there is no lookup instruction left',
    !known.result.guidance.includes('Do NOT ask this question yet'),
    known.result.guidance,
  )
}

console.log('\nstore_visitor_profile: recording the answer')
{
  const base = { firstName: 'Sam', lastName: 'Reyes', company: 'Quietfield', jobTitle: 'Ops Lead', email: 'sam@quietfield.com', department: 'Ops', interest: 'WFM' }

  const tapped = runProfile({ ...base, industry: 'Insurance' })
  check('a tapped button is recorded', tapped.result.industry === 'Insurance', tapped.result.industry)
  check('marked as self-reported', tapped.result.industrySource === 'asked', tapped.result.industrySource)
  check('and the introduction completes', tapped.result.introductionComplete === true)

  const typed = runProfile({ ...base, industry: 'we are a retail bank' })
  check('typed free text still lands on a canonical label', typed.result.industry === 'Retail', typed.result.industry)

  const declined = runProfile({ ...base, industry: 'none of these, we are logistics' })
  check('a decline records NOTHING', declined.result.industry === null, declined.result.industry)
  check('and no source either', declined.result.industrySource === null, declined.result.industrySource)
  check('but the introduction still completes', declined.result.introductionComplete === true, declined.result.nextQuestion)

  const spoofed = runProfile({ ...base, industry: 'Insurance', industrySource: 'crm' })
  check('the model CANNOT claim a vertical was looked up', spoofed.result.industrySource === 'asked', spoofed.result.industrySource)

  const payload = tapped.outputs.find((o) => o.data && o.data._visitor)?.data._visitor
  check('the visitor payload carries the vertical', payload?.industry === 'Insurance', payload)
  check('and its source', payload?.industrySource === 'asked', payload?.industrySource)
  const CONTRACT = ['v','firstName','lastName','company','jobTitle','email','website','department','interest','industry','industrySource','audience','onBehalfOf','introductionComplete']
  check('and emits no field the contract forbids', Object.keys(payload ?? {}).every((k) => CONTRACT.includes(k)), Object.keys(payload ?? {}))
}

console.log(`\n${failed === 0 ? 'all checks passed' : `${failed} FAILED`}`)
process.exit(failed > 0 ? 1 : 0)
