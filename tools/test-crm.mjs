/**
 * Regression check for the CRM lookup and the NiCE-employee branch.
 *
 *   node tools/test-crm.mjs
 *
 * Drives the REAL MockTransport through a whole conversation, from the first greeting to
 * "bye", and asserts what lands in the closing summary. Loaded through Vite's SSR pipeline,
 * like tools/test-retrieval.mjs, so it exercises the shipped code rather than a copy of the
 * logic that would keep passing after the real thing broke.
 *
 * The four paths are the point of the feature and each is easy to get wrong in a way no
 * typecheck would catch:
 *
 *   known account     a rep is named, and it is the right rep for that domain
 *   new lead          NO rep is named, and the panel says an AE will be assigned
 *   NiCE, own use     NO crm block at all, because a colleague is neither customer nor lead
 *   NiCE, for a customer   the lookup follows the CUSTOMER's domain, not nice.com
 */

import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

// fileURLToPath, not a hand-rolled equivalent. This repo lives under "OneDrive - NiCE Ltd", so
// the URL is percent-encoded; parsing it by hand produced a path containing %20 and Node could
// not resolve anything from it.
const here = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(here, '..', 'app')

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

/**
 * Runs a whole conversation and returns the last wrapup summary plus the last visitor payload.
 *
 * Waits on message delivery rather than sleeping a fixed time: MockTransport replays each turn
 * with deliberate latency to make pacing reviewable, and a fixed sleep would either be slow or
 * flaky.
 */
async function converse(MockTransport, answers) {
  const transport = new MockTransport()
  const messages = []
  let settleTimer = null
  let settle = null

  transport.onMessage((message) => {
    messages.push(message)
    if (settleTimer) clearTimeout(settleTimer)
    settleTimer = setTimeout(() => settle?.(), 400)
  })

  const quiet = () =>
    new Promise((resolve) => {
      settle = resolve
      if (settleTimer) clearTimeout(settleTimer)
      settleTimer = setTimeout(resolve, 2500)
    })

  await transport.connect()
  await quiet()

  for (const answer of answers) {
    transport.send(answer)
    await quiet()
  }

  transport.send('bye')
  await quiet()
  transport.disconnect()

  let summary
  let visitor
  for (const message of messages) {
    const showroom = message.data?._showroom
    if (showroom?.action === 'wrapup' && showroom.summary) summary = showroom.summary
    if (message.data?._visitor) visitor = message.data._visitor
  }
  return { summary, visitor, messages }
}

try {
  const mod = await server.ssrLoadModule('/src/transport/MockTransport.ts')
  const MockTransport = mod.MockTransport ?? mod.default
  const crm = await server.ssrLoadModule('/src/crm.ts')

  console.log('\nisNiceEmployee')
  check('nice.com is internal', crm.isNiceEmployee('a@nice.com') === true)
  check('niceincontact.com is internal', crm.isNiceEmployee('a@niceincontact.com') === true)
  check('cognigy.com is internal', crm.isNiceEmployee('a@cognigy.com') === true)
  check('subdomain eu.nice.com is internal', crm.isNiceEmployee('a@eu.nice.com') === true)
  check('a customer domain is not internal', crm.isNiceEmployee('a@vantagebank.com') === false)
  check(
    'a lookalike domain is NOT internal',
    crm.isNiceEmployee('a@nice.com.attacker.io') === false,
  )

  console.log('\nlookupCrm')
  check(
    'known domain returns its rep',
    crm.lookupCrm({ email: 'x@northwindlogistics.com' }).salesRep?.name === 'Camille Fournier',
  )
  check(
    'unknown domain is a new lead with no rep',
    (() => {
      const r = crm.lookupCrm({ email: 'x@some-company-nobody-knows.com' })
      return r.status === 'new-lead' && !r.salesRep
    })(),
  )
  check(
    'a personal address identifies no company',
    crm.lookupCrm({ email: 'someone@gmail.com' }).status === 'new-lead',
  )

  // Asserted in every conversation below.
  //
  // "No crm block" is the correct outcome for a colleague browsing for themselves, but it is
  // ALSO what you get when the introduction silently never finishes. That is not hypothetical:
  // send() gated on ONBOARDING.length rather than the branched plan, so a NiCE employee's last
  // two answers fell through to the topic matcher, no lookup ran, and the assertion passed for
  // entirely the wrong reason. Checking the introduction actually completed separates them.
  const introDone = (visitor, label) =>
    check(`${label}: introduction completed`, visitor?.introductionComplete === true, visitor)

  /**
   * Whether the vertical question was asked.
   *
   * It must be asked ONLY when the CRM record could not answer it, so both the presence and
   * the absence are assertions. Matched on the question text rather than on a field count,
   * because the whole point of the branch is which question the visitor is shown.
   */
  const askedIndustry = (messages) =>
    messages.some((m) => (m.text ?? '').includes('closest to your industry'))

  // Choices must arrive as BUTTONS, not only as a list in the prose. The screenshot that
  // prompted this showed three options typed into the message with nothing to click.
  console.log('\nquick-reply buttons')
  {
    // Vantage Bank's CRM industry is "Finance and Insurance", which normalises, so this
    // visitor is NOT asked the vertical question and answers the five original questions.
    const { messages } = await converse(MockTransport, [
      'Camille Dubois',
      'Vantage Bank, Head of Workforce Planning',
      'camille@vantagebank.com',
      'Workforce planning',
      'AI for WFM forecasting and scheduling',
    ])
    const intro = messages.find((m) => m.data?._visitor?.introductionComplete === true)
    const cta = intro?.data?._showroom?.cta ?? []
    check('the introduction offers buttons', cta.length === 3, cta)
    check(
      'every button has a label and a value',
      cta.every((c) => c.label && c.value),
      cta,
    )
    check(
      'labels are short enough for a chip',
      cta.every((c) => c.label.length <= 30),
      cta.map((c) => `${c.label.length}: ${c.label}`),
    )
    check(
      'values are full titles, so retrieval still matches them',
      cta.every((c) => c.value.length >= c.label.length),
      cta,
    )
    // A shortened label is only acceptable because the full text is recoverable on hover, and
    // the tooltip is driven off label !== value. If a shortened label ever equalled its value,
    // the chip would show "…" with no way to read the rest.
    check(
      'anything shortened still carries its full text in the value',
      cta.every((c) => (c.label.endsWith('…') ? c.value !== c.label : true)),
      cta,
    )
    // The prose must not repeat what the buttons already say.
    const text = intro?.text ?? ''
    check('the reply does not bullet the options', !text.includes('\n·') && !text.includes('\n-'), text)
    check(
      'the reply does not restate a button label',
      !cta.some((c) => text.includes(c.value)),
      text,
    )
  }

  console.log('\nconversation: external visitor at a KNOWN account')
  {
    // Northwind's CRM industry is "Transportation and Warehousing", which has no NiCE vertical
    // and deliberately maps to nothing, so this visitor IS asked. They decline, which is the
    // honest answer for a logistics company, and the vertical must then stay absent rather
    // than being forced into the nearest-looking box.
    const { summary, visitor, messages } = await converse(MockTransport, [
      'Dana Whitfield',
      'Northwind Logistics, Head of Service',
      'dana@northwindlogistics.com',
      'Customer service',
      'AI agents for support',
      'None of these, we are logistics',
    ])
    introDone(visitor, 'known account')
    check('summary carries a crm block', Boolean(summary?.crm), summary?.crm)
    check('status is known', summary?.crm?.status === 'known', summary?.crm)
    check('the right rep is named', summary?.crm?.salesRepName === 'Camille Fournier', summary?.crm)
    check('match type is carried', summary?.crm?.matchType === 'opportunity', summary?.crm)
    check('an unmapped CRM industry still asks the visitor', askedIndustry(messages) === true)
    check('a declined answer leaves NO vertical', visitor?.industry === undefined, visitor?.industry)
    check(
      'and records no source either, so nothing reads as looked up',
      visitor?.industrySource === undefined,
      visitor?.industrySource,
    )
  }

  console.log('\nconversation: external visitor at an UNKNOWN company')
  {
    // No CRM record at all, so nothing can answer the vertical and the question is asked. This
    // visitor taps one of the twelve buttons, which is the ordinary path for a new lead.
    const { summary, visitor, messages } = await converse(MockTransport, [
      'Sam Reyes',
      'Quietfield Insurance, Operations Lead',
      'sam@quietfield-insurance-example.com',
      'Operations',
      'Workforce management',
      'Insurance',
    ])
    introDone(visitor, 'new lead')
    check('status is new-lead', summary?.crm?.status === 'new-lead', summary?.crm)
    check('NO rep is named', summary?.crm?.salesRepName === undefined, summary?.crm)
    check('a new lead is asked the vertical', askedIndustry(messages) === true)
    check('the tapped vertical is recorded', visitor?.industry === 'Insurance', visitor?.industry)
    check(
      'marked as self-reported, not looked up',
      visitor?.industrySource === 'asked',
      visitor?.industrySource,
    )
  }

  console.log('\nconversation: the vertical came from CRM, so it is not asked')
  {
    const { visitor, messages } = await converse(MockTransport, [
      'Priya Raman',
      'Helio Retail Group, Head of Care',
      'priya@helioretail.com',
      'Customer care',
      'Self service',
    ])
    introDone(visitor, 'crm vertical')
    // "Retail Trade" in the fixture, which is an exact override rather than an alias hit.
    check('normalised to the canonical label', visitor?.industry === 'Retail', visitor?.industry)
    check('marked as looked up', visitor?.industrySource === 'crm', visitor?.industrySource)
    check(
      'and the question is NOT asked',
      askedIndustry(messages) === false,
      messages.map((m) => m.text),
    )
  }

  console.log('\nconversation: NiCE employee, own knowledge')
  {
    const { summary, visitor, messages } = await converse(MockTransport, [
      'Olivier Attia',
      'NiCE, Solutions Engineer',
      'olivier.attia@nice.com',
      'for my own knowledge',
      'Support',
      'AI agents',
    ])
    introDone(visitor, 'nice internal')
    check('audience is nice-internal', visitor?.audience === 'nice-internal', visitor?.audience)
    check('NO crm block at all', summary?.crm === undefined, summary?.crm)
    // Nothing is searched for a colleague, so nothing can be found, and yet they must still not
    // be asked: a NiCE employee browsing for their own knowledge has no vertical that changes
    // what is worth showing them. This is the one case where absent must not trigger the ask.
    check('a colleague is NOT asked the vertical', askedIndustry(messages) === false)
    check('and carries no vertical', visitor?.industry === undefined, visitor?.industry)
  }

  console.log('\nconversation: NiCE employee preparing for a customer')
  {
    const { summary, visitor, messages } = await converse(MockTransport, [
      'Olivier Attia',
      'NiCE, Solutions Engineer',
      'olivier.attia@nice.com',
      'for a prospect',
      'Vantage Bank, vantagebank.com',
      'Customer service',
      'AI agents',
    ])
    introDone(visitor, 'nice on behalf')
    check('audience is nice-on-behalf', visitor?.audience === 'nice-on-behalf', visitor?.audience)
    check('onBehalfOf is carried', Boolean(visitor?.onBehalfOf), visitor?.onBehalfOf)
    check(
      'lookup followed the CUSTOMER, not nice.com',
      summary?.crm?.salesRepName === 'Daniel Okafor',
      summary?.crm,
    )
    check('account name is the customer', summary?.crm?.accountName === 'Vantage Bank', summary?.crm)
    // The vertical must follow the CUSTOMER's record too, not the colleague's own employer.
    check('vertical came from the customer record', visitor?.industry === 'Financial', visitor?.industry)
    check('marked as looked up', visitor?.industrySource === 'crm', visitor?.industrySource)
    check('so the question is not asked', askedIndustry(messages) === false)
  }
} finally {
  await server.close()
}

console.log(`\n${failed === 0 ? 'all checks passed' : `${failed} FAILED`}`)
process.exit(failed > 0 ? 1 : 0)
