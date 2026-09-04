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

  // Choices must arrive as BUTTONS, not only as a list in the prose. The screenshot that
  // prompted this showed three options typed into the message with nothing to click.
  console.log('\nquick-reply buttons')
  {
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
    const { summary, visitor } = await converse(MockTransport, [
      'Dana Whitfield',
      'Northwind Logistics, Head of Service',
      'dana@northwindlogistics.com',
      'Customer service',
      'AI agents for support',
    ])
    introDone(visitor, 'known account')
    check('summary carries a crm block', Boolean(summary?.crm), summary?.crm)
    check('status is known', summary?.crm?.status === 'known', summary?.crm)
    check('the right rep is named', summary?.crm?.salesRepName === 'Camille Fournier', summary?.crm)
    check('match type is carried', summary?.crm?.matchType === 'opportunity', summary?.crm)
  }

  console.log('\nconversation: external visitor at an UNKNOWN company')
  {
    const { summary, visitor } = await converse(MockTransport, [
      'Sam Reyes',
      'Quietfield Insurance, Operations Lead',
      'sam@quietfield-insurance-example.com',
      'Operations',
      'Workforce management',
    ])
    introDone(visitor, 'new lead')
    check('status is new-lead', summary?.crm?.status === 'new-lead', summary?.crm)
    check('NO rep is named', summary?.crm?.salesRepName === undefined, summary?.crm)
  }

  console.log('\nconversation: NiCE employee, own knowledge')
  {
    const { summary, visitor } = await converse(MockTransport, [
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
  }

  console.log('\nconversation: NiCE employee preparing for a customer')
  {
    const { summary, visitor } = await converse(MockTransport, [
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
  }
} finally {
  await server.close()
}

console.log(`\n${failed === 0 ? 'all checks passed' : `${failed} FAILED`}`)
process.exit(failed > 0 ? 1 : 0)
