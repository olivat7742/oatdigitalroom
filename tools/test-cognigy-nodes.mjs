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

const runProfile = (toolArgs, ctx = {}, data = undefined) => {
  const input = { aiAgent: { toolArgs }, ...(data ? { data } : {}) }
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
  // Observed live: a visitor asked for a demo mid-introduction, find_demo emitted three asset
  // titles AFTER this node's twelve industry options, and replaced them. The visitor was asked
  // which industry they were in and offered three videos to tap.
  check(
    'the turn that asks it is told not to show content as well',
    asked.result.guidance.includes('WHOLE turn') && asked.result.guidance.includes('find_demo'),
    asked.result.guidance,
  )

  const known = runProfile(base, { crm: { status: 'known', industry: 'Financial' } })
  check('with a CRM answer, it is NOT asked', known.result.askingIndustry === false, known.result.nextQuestion)
  check('the introduction completes instead', known.result.introductionComplete === true)
  check('and the vertical is carried', known.result.industry === 'Financial', known.result.industry)
  check('marked as looked up', known.result.industrySource === 'crm', known.result.industrySource)
  check('no buttons are offered', !known.outputs.some((o) => o.data && o.data._showroom))
  check(
    'and a turn that is NOT asking the vertical carries no content restriction',
    !known.result.guidance.includes('WHOLE turn'),
    known.result.guidance,
  )

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

// Live, the agent asked "Marc Delaunay" for his last name in the reply that thanked him by
// his full name. The plan step required firstName AND lastName, the model had put the whole
// string in firstName, so the step stayed outstanding and came round again.
console.log('\nstore_visitor_profile: the name')
{
  const full = runProfile({ firstName: 'Marc Delaunay' })
  check('a full name in one field is split', full.result.known.firstName === 'Marc', full.result.known)
  check('and the surname kept', full.result.known.lastName === 'Delaunay', full.result.known)
  check(
    'so the name is NOT asked again',
    !/name/i.test(full.result.nextQuestion ?? ''),
    full.result.nextQuestion,
  )

  // Given names of more than one word exist, and the first token is the part used to address
  // someone, so the split favours getting that right.
  const compound = runProfile({ firstName: 'Maria del Carmen Rodriguez' })
  check('a longer name keeps the first token as the given name', compound.result.known.firstName === 'Maria', compound.result.known)

  // Live, the model passed BOTH firstName "Camille DUBOIS" and lastName "DUBOIS", so a split
  // guarded on the empty lastName skipped and every reply addressed her by her full name.
  const both = runProfile({ firstName: 'Camille DUBOIS', lastName: 'DUBOIS' })
  check('a full name is trimmed even when the surname was also passed', both.result.known.firstName === 'Camille', both.result.known)
  check('and the surname is left alone', both.result.known.lastName === 'DUBOIS', both.result.known)

  const firstOnly = runProfile({ firstName: 'Marc' })
  check('a first name alone is accepted', firstOnly.result.known.firstName === 'Marc')
  check('with no surname invented', firstOnly.result.known.lastName === undefined, firstOnly.result.known.lastName)
  check(
    'and the plan moves on rather than demanding one',
    !/name/i.test(firstOnly.result.nextQuestion ?? ''),
    firstOnly.result.nextQuestion,
  )
  check(
    'a surname is never listed as missing',
    !firstOnly.result.missingCore.includes('lastName'),
    firstOnly.result.missingCore,
  )
}

// The room can be launched with ?c=<contact id>, and CognigyTransport sends the resolved
// contact as data._launch. Nothing from a URL is established until the person in the room
// accepts it, because people forward invitations.
console.log('\nstore_visitor_profile: a claimed identity from the launch URL')
{
  const LAUNCH = {
    _launch: {
      v: 1,
      contactId: '0033n00002Yams0AAB',
      firstName: 'Dana',
      lastName: 'Whitfield',
      jobTitle: 'Head of Service',
      email: 'dana@northwindlogistics.com',
      company: 'Northwind Logistics',
    },
  }

  const pending = runProfile({}, {}, LAUNCH)
  check('the claimed identity is seen', pending.result.launchSource === 'input.data', pending.result.launchSource)
  check('and is PENDING, not established', pending.result.identityState === 'pending', pending.result.identityState)
  check('the first question is the confirmation', pending.result.askingIdentity === true, pending.result.nextQuestion)
  check(
    'and the name is NOT asked',
    !/ask for their name/i.test(pending.result.nextQuestion ?? ''),
    pending.result.nextQuestion,
  )
  check(
    'the model is told not to read back the email or role',
    /never read their own email/i.test(pending.result.nextQuestion ?? ''),
    pending.result.nextQuestion,
  )
  const buttons = pending.outputs.find((o) => o.data && o.data._showroom)?.data._showroom
  check('two buttons are offered', buttons?.cta?.length === 2, buttons?.cta)
  check('as an offer', buttons?.action === 'offer')
  // Nothing is filed against a person who has not spoken yet.
  check('nothing is recorded yet', pending.result.known.firstName === undefined, pending.result.known)
  const payload = pending.outputs.find((o) => o.data && o.data._visitor)?.data._visitor
  check('and the payload names nobody', payload?.firstName === undefined, payload)
  check('no launch working field leaks into the payload', !Object.keys(payload ?? {}).some((k) => k.startsWith('launch')), Object.keys(payload ?? {}))

  // THE BUG THIS GATE EXISTS FOR. On the first tool call, with the confirmation not yet put to
  // anyone, the model passed identityConfirmed itself and the node accepted an identity nobody
  // in the room had agreed to. A forwarded invitation would have been silently accepted.
  const selfConfirmed = runProfile({ identityConfirmed: "Yes, that's me" }, {}, LAUNCH)
  check(
    'the model cannot confirm an identity that was never asked',
    selfConfirmed.result.identityState === 'pending',
    selfConfirmed.result.identityState,
  )
  check('so nothing is recorded', selfConfirmed.result.known.firstName === undefined, selfConfirmed.result.known)
  check('and the confirmation is still put', selfConfirmed.result.askingIdentity === true)

  // Once it HAS been asked, the visitor's answer counts. context carries the flag the node
  // persisted on the turn it asked.
  const ASKED = { digitalRoomVisitor: { identityAsked: 'true' } }
  const accepted = runProfile({ identityConfirmed: "Yes, that's me" }, ASKED, LAUNCH)
  check('accepting records the identity', accepted.result.known.firstName === 'Dana', accepted.result.known)
  check('with the company', accepted.result.known.company === 'Northwind Logistics', accepted.result.known.company)
  check('and the email', accepted.result.known.email === 'dana@northwindlogistics.com', accepted.result.known.email)
  check('state is accepted', accepted.result.identityState === 'accepted', accepted.result.identityState)
  check('the confirmation is not asked again', accepted.result.askingIdentity === false)
  check('and the department is next', /department or team/i.test(accepted.result.nextQuestion ?? ''), accepted.result.nextQuestion)

  const rejected = runProfile({ identityConfirmed: 'Not me' }, ASKED, LAUNCH)
  check('rejecting records nothing', rejected.result.known.firstName === undefined, rejected.result.known)
  check('state is rejected', rejected.result.identityState === 'rejected', rejected.result.identityState)
  check(
    'and the ordinary name question comes back',
    /ask for their name/i.test(rejected.result.nextQuestion ?? ''),
    rejected.result.nextQuestion,
  )

  // THE PATH THIS PRODUCT ACTUALLY USES. CognigyTransport puts the question itself and sets
  // confirmed once the visitor accepts, so the agent is handed a settled identity and never
  // has to be trusted with the consent decision.
  const PRE = { _launch: { ...LAUNCH._launch, confirmed: true } }
  const preConfirmed = runProfile({}, {}, PRE)
  check('a portal-confirmed identity is accepted without the model asking', preConfirmed.result.identityState === 'accepted', preConfirmed.result.identityState)
  check('and recorded', preConfirmed.result.known.firstName === 'Dana', preConfirmed.result.known)
  check('with the company and email', preConfirmed.result.known.company === 'Northwind Logistics' && preConfirmed.result.known.email === 'dana@northwindlogistics.com', preConfirmed.result.known)
  check('the confirmation is not asked again', preConfirmed.result.askingIdentity === false)
  check('and the department is next', /department or team/i.test(preConfirmed.result.nextQuestion ?? ''), preConfirmed.result.nextQuestion)
  // confirmed:false is the state while the question is still on screen, and must not be trusted.
  const notYet = runProfile({}, {}, { _launch: { ...LAUNCH._launch, confirmed: false } })
  check('confirmed:false is NOT acceptance', notYet.result.identityState === 'pending', notYet.result.identityState)

  const noLaunch = runProfile({})
  check('with no launch data there is no claimed identity', noLaunch.result.identityState === 'none')
  check('and no confirmation question', noLaunch.result.askingIdentity === false, noLaunch.result.nextQuestion)
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
