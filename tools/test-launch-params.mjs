/**
 * Guards the two launch parameters: ?t= for the look and feel, ?c= for who the visitor is.
 *
 *   node tools/test-launch-params.mjs
 *
 * Both are attacker-controlled input, one of them drives the UI and the other drives identity,
 * so most of what is asserted here is what must NOT happen: a template slug must never become
 * a path, an unknown slug must fall back silently, and a claimed identity must never be treated
 * as established until the person in the room accepts it.
 *
 * The identity path is only safe today because catalog/crm-fixtures.json is invented. See the
 * gate in docs/solution-design.md before it points at real Salesforce.
 */

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

/** Drives a whole conversation, like tools/test-crm.mjs, but with launch parameters. */
async function converse(MockTransport, params, answers) {
  const transport = new MockTransport(params)
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
  transport.disconnect()

  const visitor = [...messages].reverse().find((m) => m.data?._visitor)?.data._visitor
  return { messages, visitor }
}

try {
  const { parseRoomParams } = await server.ssrLoadModule('/src/roomParams.ts')
  const { resolveTemplate, TEMPLATE_SLUGS } = await server.ssrLoadModule('/src/templates.ts')
  const { lookupContact } = await server.ssrLoadModule('/src/crm.ts')
  const mod = await server.ssrLoadModule('/src/transport/MockTransport.ts')
  const MockTransport = mod.MockTransport

  console.log('\nparsing, and refusing')
  {
    check('a good template slug survives', parseRoomParams('?t=niceworld').template === 'niceworld')
    check('a good contact id survives', parseRoomParams('?c=0033n00002Yams0AAB').contactId === '0033n00002Yams0AAB')
    check('both together', (() => {
      const p = parseRoomParams('?c=0033n00002Yams0AAB&t=niceworld')
      return p.contactId === '0033n00002Yams0AAB' && p.template === 'niceworld'
    })())

    // A slug is lowercase, short and boring so a path or a script cannot be smuggled in one.
    for (const hostile of ['../../etc/passwd', '<script>alert(1)</script>', 'http://evil.test/x', 'a'.repeat(64), 'NiCEWorld/../x']) {
      check(`refuses template ${JSON.stringify(hostile.slice(0, 24))}`, parseRoomParams(`?t=${encodeURIComponent(hostile)}`).template === null)
    }
    // Anything not shaped like a Contact id cannot be one.
    for (const bad of ['evil', '0033n00002Yams0AA', '001AAAAAAAAAAAAAAA', 'DROP TABLE', '0033n00002Yams0AAB extra']) {
      check(`refuses contact ${JSON.stringify(bad)}`, parseRoomParams(`?c=${encodeURIComponent(bad)}`).contactId === null)
    }
    check('a 15-character id is accepted too', parseRoomParams('?c=0033n00002Yams0').contactId === '0033n00002Yams0')
    check('no parameters is not an error', (() => {
      const p = parseRoomParams('')
      return p.template === null && p.contactId === null
    })())
  }

  console.log('\ntemplates resolve through an allowlist')
  {
    check('the registry has a default', TEMPLATE_SLUGS.includes('default'))
    check('and the event template', TEMPLATE_SLUGS.includes('niceworld'))

    const event = resolveTemplate('niceworld')
    check('the event template renames the wordmark', event.wordmark === 'NiCE World', event)
    check('and carries an accent gradient', /^linear-gradient\(/.test(event.palette.accentGradient ?? ''), event.palette)
    check('and its own welcome line', typeof event.welcome === 'string' && event.welcome.length > 0, event.welcome)
    // A darker primary cannot carry black text. Getting this wrong made a button unreadable
    // once already in this project.
    check('and states its own text colour on the primary', /^#/.test(event.palette.primaryContrast ?? ''), event.palette)

    check('an unknown slug falls back silently', resolveTemplate('summit2027').slug === 'default')
    check('so does null', resolveTemplate(null).slug === 'default')
    check('the default carries no gradient', resolveTemplate(null).palette.accentGradient === undefined)
  }

  console.log('\nthe claimed identity')
  {
    const dana = lookupContact('0033n00002Yams0AAB')
    check('a known id resolves to a person', dana?.firstName === 'Dana', dana)
    check('with the account NAME from the accounts table, not stored twice', dana?.accountName === 'Northwind Logistics', dana)
    check('an unknown id resolves to nothing', lookupContact('0033zzzzzzzzzzzAAB') === null)
    check('and so does nothing', lookupContact(null) === null)
  }

  console.log('\nlaunching with ?c=: three questions become one tap')
  {
    const { messages, visitor } = await converse(
      MockTransport,
      { template: null, contactId: '0033n00002Yams0AAB' },
      ["Yes, that's me", 'Customer service', 'AI agents for support', 'None of these, we are logistics'],
    )

    const opener = messages[0]
    check('the room opens by confirming, not asking a name', /Welcome back, Dana/.test(opener?.text ?? ''), opener?.text)
    check('naming the company it thinks they are at', /Northwind Logistics/.test(opener?.text ?? ''), opener?.text)
    // Reading someone's own email back at them proves nothing and makes the room feel like it
    // has been reading their file.
    check('but NOT their email address', !/dana@/.test(opener?.text ?? ''), opener?.text)
    check('with two buttons', (opener?.data?._showroom?.cta ?? []).length === 2, opener?.data?._showroom?.cta)

    check('the name is never asked', !messages.some((m) => /what is your name/i.test(m.text ?? '')), messages.map((m) => m.text))
    check('nor the employer', !messages.some((m) => /where do you work/i.test(m.text ?? '')))
    check('nor the email', !messages.some((m) => /business email/i.test(m.text ?? '')))
    check('but the department still is', messages.some((m) => /department or team/i.test(m.text ?? '')))
    check('and what they are looking for', messages.some((m) => /kind of solution/i.test(m.text ?? '')))

    check('the confirmed identity is recorded', visitor?.firstName === 'Dana', visitor)
    check('with the company', visitor?.company === 'Northwind Logistics', visitor?.company)
    check('and the email', visitor?.email === 'dana@northwindlogistics.com', visitor?.email)
    check('the introduction completes', visitor?.introductionComplete === true, visitor)
    // identityConfirmed steers the plan and is NOT a contract field.
    check('no working field leaks into the payload', visitor?.identityConfirmed === undefined, Object.keys(visitor ?? {}))
  }

  console.log('\nthe CRM lookup still runs for a pre-identified visitor')
  {
    // Vantage Bank's record says Finance and Insurance, so the vertical is known and the
    // question must be skipped. That only works if accepting the identity triggers the lookup.
    const { messages, visitor } = await converse(
      MockTransport,
      { template: null, contactId: '0033n00002Vbnk1AAB' },
      ["Yes, that's me", 'Workforce planning', 'AI for forecasting and scheduling'],
    )
    check('the vertical came from the account record', visitor?.industry === 'Financial', visitor?.industry)
    check('marked as looked up', visitor?.industrySource === 'crm', visitor?.industrySource)
    check('so the vertical is never asked', !messages.some((m) => /closest to your industry/i.test(m.text ?? '')))
    check('and the introduction completes', visitor?.introductionComplete === true, visitor)
  }

  console.log('\na forwarded link: "Not me" discards everything')
  {
    const { messages, visitor } = await converse(
      MockTransport,
      { template: null, contactId: '0033n00002Yams0AAB' },
      ['Not me'],
    )
    check('the name question comes back', messages.some((m) => /what is your name/i.test(m.text ?? '')), messages.map((m) => m.text))
    check('and nothing was filed against the wrong person', visitor?.firstName === undefined, visitor)
    check('nor their employer', visitor?.company === undefined, visitor)
    check('nor their email', visitor?.email === undefined, visitor)
  }

  console.log('\nno parameters is the ordinary room')
  {
    const { messages } = await converse(MockTransport, { template: null, contactId: null }, [])
    check('which opens by asking the name', /what is your name/i.test(messages[0]?.text ?? ''), messages[0]?.text)
    check('and offers no confirmation buttons', (messages[0]?.data?._showroom?.cta ?? []).length === 0)
  }
} finally {
  await server.close()
}

console.log(`\n${failed === 0 ? 'all checks passed' : `${failed} FAILED`}`)
process.exit(failed > 0 ? 1 : 0)
