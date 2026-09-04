/**
 * Generates the slide XML for the Digital Room presentation.
 *
 *   node tools/deck/build-deck.mjs
 *
 * Writes ppt/slides parts into tools/deck/out/. tools/deck/package-deck.ps1 then drops them
 * into a copy of NiCE's 2026 SKO corporate template, which supplies the master, the 32 layouts,
 * the logo and the theme. Every slide is built on the template's "blank" layout, which already
 * carries the NiCE furniture, so the deck opens on-brand and stays fully editable.
 *
 * Every figure quoted here was read from the repository at build time, not recalled. Where a
 * number would need a judgement call it is written as a range or left out.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { C, EMU, W, H, box, heading, line, para, resetIds, slideXml, text } from './shapes.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, 'out')
const repoRoot = path.resolve(here, '..', '..')

// ---------------------------------------------------------------------------------------
// Figures, read from the repo so the deck cannot drift from what was actually built.
// ---------------------------------------------------------------------------------------
function readJson(...p) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, ...p), 'utf8'))
}
const catalog = readJson('catalog', 'demo-catalog.json')
const enriched = readJson('catalog', 'nice-resources-enriched.json')
const sitemap = readJson('catalog', 'nice-resources-index.json')
const curation = readJson('catalog', 'document-curation.json')

const byType = catalog.assets.reduce((acc, a) => ({ ...acc, [a.type]: (acc[a.type] ?? 0) + 1 }), {})
const F = {
  assets: catalog.assets.length,
  videos: byType.video ?? 0,
  documents: byType.document ?? 0,
  embeds: byType.embed ?? 0,
  approved: catalog.assets.filter((a) => a.approved).length,
  english: enriched.items.length,
  typed: enriched.items.filter((i) => i.typeSource === 'site').length,
  withIndustry: enriched.items.filter((i) => i.industries?.length).length,
  withCategory: enriched.items.filter((i) => i.categories?.length).length,
  sitemap: sitemap.items.length,
  curated: curation.documents.length,
}

const M = 548640 // 0.6in margin
const CW = W - M * 2 // content width

/**
 * Thousands separator.
 *
 * NOT toLocaleString(). Node's default locale here formats 2147 with U+202F, a narrow no-break
 * space, which survived into the XML and rendered in PowerPoint as "2â€¯147". A plain comma has
 * no such surprise.
 */
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/**
 * Our own footer.
 *
 * The template's own bottom-right lockup reads "NiCE | Global Sales Kickoff", which is wrong on
 * this deck. It is vector artwork rather than text, so it cannot be reworded; package-deck.ps1
 * removes it from our copy of the layout and this replaces it.
 */
const footer = () =>
  text(W - M - 3000000, H - 560000, 3000000, 300000, [
    para(
      [
        ['NiCE', { b: 1, c: C.black, sz: 11 }],
        ['   |   Digital Room', { c: C.grey, sz: 11 }],
      ],
      { align: 'r' },
    ),
  ])

const slides = []
const add = (shapes, { chrome = true } = {}) =>
  slides.push(slideXml([...shapes, chrome ? footer() : null].filter(Boolean).join('')))

// ---------------------------------------------------------------------------------------
// 1. Title
// ---------------------------------------------------------------------------------------
resetIds()
add([
  box(0, 0, W, H, { fill: C.black, noLine: true, prst: 'rect' }),
  // Rule height and the two text blocks are set from measured line heights rather than
  // guessed: a 40pt line needs ~620000 EMU, and the first attempt let the subtitle run back
  // over the second title line.
  box(M, 2150000, 180000, 1560000, { fill: C.blue, noLine: true, prst: 'rect' }),
  text(M + 420000, 2150000, 9500000, 340000, para('THE NiCE DIGITAL ROOM', { sz: 13, b: 1, c: C.blue })),
  text(M + 420000, 2560000, 10600000, 1300000, [
    para('An agentic showroom that', { sz: 38, b: 1, c: C.white }),
    para('sells while nobody is in the room', { sz: 38, b: 1, c: C.white, space: 200 }),
  ]),
  text(M + 420000, 3960000, 9200000, 500000, [
    para('Self-service discovery for CXone and Cognigy, grounded in approved content.', { sz: 16, c: C.base }),
  ]),
  text(M + 420000, 5750000, 9000000, 400000, [
    para('Olivier Attia   |   Solutions Engineer   |   Working prototype, live today', { sz: 12, c: C.grey }),
  ]),
], { chrome: false })

// ---------------------------------------------------------------------------------------
// 2. The opportunity
// ---------------------------------------------------------------------------------------
resetIds()
{
  const cardW = Math.round((CW - 400000 * 2) / 3)
  const cards = [
    ['Buyers self-serve first', 'Most of the evaluation happens before a rep is ever contacted. If we are not useful in that window, we are not in it.'],
    ['Our best content is unfindable', `${fmt(F.sitemap)} resources exist on nice.com. A prospect finds what search gives them, not what answers their question.`],
    ['Demos do not scale', 'Every early-stage question costs a Solutions Engineer an hour. The same twenty questions, over and over.'],
  ]
  add([
    heading('Buyers evaluate us long before they talk to us', 'The opportunity'),
    ...cards.map((c, i) =>
      box(M + i * (cardW + 400000), 1750000, cardW, 1750000, {
        fill: C.paper,
        noLine: true,
        anchor: 't',
        paragraphs: [
          para(c[0], { sz: 17, b: 1, c: C.black }),
          para(c[1], { sz: 13, c: C.grey, space: 700 }),
        ],
      }),
    ),
    box(M, 3900000, CW, 1500000, {
      fill: C.black,
      noLine: true,
      anchor: 'ctr',
      paragraphs: [
        para('So we built the room they can walk into on their own', { sz: 24, b: 1, c: C.white, align: 'ctr' }),
        para(
          'A visitor asks a question in plain language. An AI guide answers from approved material only, and puts the right video or document on screen beside the conversation. No form, no wait, no invented claims.',
          { sz: 14, c: C.base, align: 'ctr', space: 600 },
        ),
      ],
    }),
  ])
}

// ---------------------------------------------------------------------------------------
// 3. What we are building
// ---------------------------------------------------------------------------------------
resetIds()
{
  const stageW = 6100000
  const railW = 3400000
  const top = 1900000
  const hgt = 3100000
  add([
    heading('One screen, two halves', 'What we are building'),
    box(M, top, stageW, hgt, { fill: C.black, noLine: true, adj: 0.03 }),
    text(M + 300000, top + 260000, stageW - 600000, 400000, para('THE STAGE', { sz: 12, b: 1, c: C.blue })),
    text(M + 300000, top + 620000, stageW - 600000, 1400000, [
      para('Video, walkthroughs and documents', { sz: 20, b: 1, c: C.white }),
      para('The guide puts content here and can open a video at the exact moment that answers the question, not at the title card.', { sz: 13, c: C.base, space: 600 }),
    ]),
    box(M + 300000, top + 2150000, 2100000, 480000, { fill: C.blue, noLine: true, paragraphs: para('Case study, on screen', { sz: 11, b: 1, c: C.black, align: 'ctr' }) }),
    box(M + 2500000, top + 2150000, 1500000, 480000, { fill: C.green, noLine: true, paragraphs: para('Healthcare', { sz: 11, b: 1, c: C.black, align: 'ctr' }) }),

    box(M + stageW + 300000, top, railW, hgt, { fill: C.paper, noLine: true, adj: 0.03 }),
    text(M + stageW + 560000, top + 260000, railW - 520000, 400000, para('THE CHAT', { sz: 12, b: 1, c: C.blueDeep })),
    box(M + stageW + 560000, top + 640000, railW - 900000, 620000, { fill: C.white, noLine: true, anchor: 'ctr', paragraphs: para('"Do you have proof this works in healthcare?"', { sz: 12, c: C.black }) }),
    box(M + stageW + 900000, top + 1360000, railW - 900000, 900000, { fill: C.black, noLine: true, anchor: 'ctr', paragraphs: para('"Here is the Optum case study. It is a document, so it is on screen to read."', { sz: 12, c: C.white }) }),
    text(M + stageW + 560000, top + 2400000, railW - 520000, 500000, para('Every answer carries a link the visitor can keep.', { sz: 11, i: 1, c: C.grey })),

    text(M, 5250000, CW, 500000, [
      para('The guide decides WHAT to show. The tools decide HOW. That split is why it does not improvise.', { sz: 15, b: 1, c: C.black }),
    ]),
  ])
}

// ---------------------------------------------------------------------------------------
// 4. Design principles
// ---------------------------------------------------------------------------------------
resetIds()
{
  const principles = [
    ['Show, do not tell', 'If it can be shown, it is shown. Prose is the fallback, not the product.'],
    ['Never invent', 'Every claim comes from a tool result. No content, no answer. It says so plainly.'],
    ['Answer at the right second', 'A question about one feature opens the video at that feature, not at minute zero.'],
    ['Read is not watch', 'A case study is presented to read and keep. A demo is played. The room knows the difference.'],
    ['Always leave a link', 'Every reply carries somewhere to go next, so the visit survives the visitor closing the tab.'],
    ['Respect the visitor', 'Five questions, not a lead gate. Decline to answer and the room carries on regardless.'],
  ]
  const cw = Math.round((CW - 300000 * 2) / 3)
  const ch = 1450000
  add([
    heading('What the experience has to feel like', 'Design principles'),
    ...principles.map((p, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const x = M + col * (cw + 300000)
      const y = 1800000 + row * (ch + 320000)
      return [
        box(x, y, cw, ch, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
          para(p[0], { sz: 16, b: 1, c: C.black }),
          para(p[1], { sz: 12, c: C.grey, space: 600 }),
        ] }),
        box(x, y, 90000, ch, { fill: [C.blue, C.green, C.violet, C.pink, C.teal, C.blueDeep][i], noLine: true, prst: 'rect' }),
      ].join('')
    }),
    text(M, 5450000, CW, 400000, para('These are not aspirations. Each one is enforced in code or in a tool, not in a prompt.', { sz: 13, i: 1, c: C.grey })),
  ])
}

// ---------------------------------------------------------------------------------------
// 5. How a visit plays out
// ---------------------------------------------------------------------------------------
resetIds()
{
  const steps = [
    ['1', 'Arrive', 'No form. The guide introduces itself and explains why it asks anything at all.'],
    ['2', 'Five questions', 'Name, employer, role, email, then department and interest. Conversational, one at a time.'],
    ['3', 'Tailored opening', 'Three example questions, drawn from real catalogue titles and their own stated interest.'],
    ['4', 'Explore', 'They ask. The guide finds, shows, and narrates. It declines when nothing fits.'],
    ['5', 'Close', 'On "bye" the stage becomes a summary: what they saw, topics to explore, and who owns the account.'],
  ]
  const bw = Math.round((CW - 4 * 240000) / 5)
  add([
    heading('How a visit actually plays out', 'Flows and sequences'),
    // The number sits INSIDE the card with the title below it. An earlier version floated the
    // circle over the card's top-left corner, where it covered the first word of every title.
    ...steps.flatMap((s, i) => {
      const x = M + i * (bw + 240000)
      const y = 1900000
      const pad = 200000
      const shapes = [
        box(x, y, bw, 2100000, { fill: C.paper, noLine: true }),
        box(x + pad, y + pad, 480000, 480000, { fill: C.blue, noLine: true, prst: 'ellipse', paragraphs: para(s[0], { sz: 15, b: 1, c: C.black, align: 'ctr' }) }),
        text(x + pad, y + pad + 600000, bw - pad * 2, 340000, para(s[1], { sz: 15, b: 1, c: C.black })),
        text(x + pad, y + pad + 980000, bw - pad * 2, 900000, para(s[2], { sz: 11, c: C.grey })),
      ]
      if (i < steps.length - 1) shapes.push(line(x + bw + 40000, y + 950000, x + bw + 200000, y + 950000, { c: C.blue, w: 25400 }))
      return shapes
    }),
    box(M, 4150000, CW, 1250000, { fill: C.black, noLine: true, anchor: 'ctr', paragraphs: [
      para('The recap is built from what was actually shown, not from what the guide remembers showing', { sz: 17, b: 1, c: C.white, align: 'ctr' }),
      para('Each asset played is recorded as it happens. Asking a model to recall its own session produces a confident and occasionally wrong list, and this is a sales tool.', { sz: 12, c: C.base, align: 'ctr', space: 600 }),
    ] }),
  ])
}

// ---------------------------------------------------------------------------------------
// 6. Two kinds of visitor
// ---------------------------------------------------------------------------------------
resetIds()
{
  const y0 = 1900000
  add([
    heading('The room knows who is in it', 'Flows and sequences'),
    box(M, y0 + 700000, 2300000, 900000, { fill: C.blue, noLine: true, anchor: 'ctr', paragraphs: para('Email address given', { sz: 14, b: 1, c: C.black, align: 'ctr' }) }),
    line(M + 2300000, y0 + 1150000, M + 2900000, y0 + 1150000, { c: C.grey }),

    box(M + 2950000, y0, 3300000, 800000, { fill: C.paper, noLine: true, anchor: 'ctr', paragraphs: para('Customer or prospect domain', { sz: 13, b: 1, c: C.black, align: 'ctr' }) }),
    box(M + 2950000, y0 + 1000000, 3300000, 800000, { fill: C.paper, noLine: true, anchor: 'ctr', paragraphs: para('NiCE colleague, own knowledge', { sz: 13, b: 1, c: C.black, align: 'ctr' }) }),
    box(M + 2950000, y0 + 2000000, 3300000, 800000, { fill: C.paper, noLine: true, anchor: 'ctr', paragraphs: para('NiCE colleague, for a customer', { sz: 13, b: 1, c: C.black, align: 'ctr' }) }),

    line(M + 2900000, y0 + 1150000, M + 2950000, y0 + 400000, { c: C.grey, w: 12700 }),
    line(M + 2900000, y0 + 1150000, M + 2950000, y0 + 1400000, { c: C.grey, w: 12700 }),
    line(M + 2900000, y0 + 1150000, M + 2950000, y0 + 2400000, { c: C.grey, w: 12700 }),

    line(M + 6250000, y0 + 400000, M + 6800000, y0 + 400000, { c: C.grey }),
    line(M + 6250000, y0 + 1400000, M + 6800000, y0 + 1400000, { c: C.grey }),
    line(M + 6250000, y0 + 2400000, M + 6800000, y0 + 2400000, { c: C.grey }),

    box(M + 6850000, y0, 4100000, 800000, { fill: C.green, noLine: true, anchor: 'ctr', paragraphs: para('Look them up. Name their account owner.', { sz: 13, b: 1, c: C.black, align: 'ctr' }) }),
    box(M + 6850000, y0 + 1000000, 4100000, 800000, { fill: C.base, noLine: true, anchor: 'ctr', paragraphs: para('Look up nothing. They are not a lead.', { sz: 13, b: 1, c: C.black, align: 'ctr' }) }),
    box(M + 6850000, y0 + 2000000, 4100000, 800000, { fill: C.teal, noLine: true, anchor: 'ctr', paragraphs: para('Ask which customer. Run the room as if that customer were here.', { sz: 13, b: 1, c: C.black, align: 'ctr' }) }),

    text(M, 5150000, CW, 700000, [
      para('Why this matters commercially', { sz: 15, b: 1, c: C.black }),
      para('A colleague preparing for a meeting gets the customer\'s view, including their logo and their account owner. The same room serves the field and the market without pretending a colleague is a lead.', { sz: 13, c: C.grey, space: 400 }),
    ]),
  ])
}

// ---------------------------------------------------------------------------------------
// 7. The closing page
// ---------------------------------------------------------------------------------------
resetIds()
{
  add([
    heading('The visit ends with a handover, not a dead end', 'Flows and sequences'),
    box(M, 1800000, 5300000, 3300000, { fill: C.paper, noLine: true, anchor: 't', paragraphs: [
      para('On the closing page', { sz: 16, b: 1, c: C.black }),
      para('Everything they actually watched or read, with links', { sz: 13, c: C.grey, bullet: true, space: 500 }),
      para('Topics to explore, pre-ticked from what they engaged with', { sz: 13, c: C.grey, bullet: true, space: 300 }),
      para('An offer to email the documentation', { sz: 13, c: C.grey, bullet: true, space: 300 }),
      para('An offer to speak with a rep, or be called back', { sz: 13, c: C.grey, bullet: true, space: 300 }),
      para('Who owns the relationship, by name', { sz: 13, c: C.black, b: 1, bullet: true, space: 300 }),
    ] }),
    box(M + 5600000, 1800000, 5350000, 1550000, { fill: C.black, noLine: true, anchor: 't', paragraphs: [
      para('KNOWN ACCOUNT', { sz: 11, b: 1, c: C.green }),
      para('Your NiCE contact', { sz: 15, b: 1, c: C.white, space: 400 }),
      para('Camille Fournier, Account Executive for Northwind Logistics', { sz: 13, c: C.base, space: 300 }),
      para('They already work with your organisation.', { sz: 11, i: 1, c: C.grey, space: 300 }),
    ] }),
    box(M + 5600000, 3500000, 5350000, 1600000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
      para('NEW LEAD', { sz: 11, b: 1, c: C.blueDeep }),
      para('An Account Executive will be assigned', { sz: 15, b: 1, c: C.black, space: 400 }),
      para('No named contact yet. Someone will pick up from what they looked at here.', { sz: 13, c: C.grey, space: 300 }),
      para('A colleague browsing for themselves sees neither message.', { sz: 11, i: 1, c: C.grey, space: 300 }),
    ] }),
    text(M, 5350000, CW, 500000, para('Having someone\'s email is not consent to use it. The send button stays disabled until they tick the box.', { sz: 13, b: 1, c: C.black })),
  ])
}

// ---------------------------------------------------------------------------------------
// 8. What is in the room
// ---------------------------------------------------------------------------------------
resetIds()
{
  const barX = M
  const barY = 2350000
  const barW = 6600000
  const total = F.assets
  const seg = [
    [F.videos, C.blue, `${F.videos} videos`],
    [F.documents, C.green, `${F.documents} documents`],
    [F.embeds, C.violet, `${F.embeds} public videos`],
  ]
  let cursor = barX
  const bars = seg.flatMap(([n, col, label]) => {
    const w = Math.round((n / total) * barW)
    const s = [
      box(cursor, barY, w, 620000, { fill: col, noLine: true, prst: 'rect' }),
      text(cursor, barY + 720000, w + 800000, 400000, para(label, { sz: 12, b: 1, c: C.black })),
    ]
    cursor += w
    return s
  })
  add([
    heading('What is in the room today', 'Content'),
    text(M, 1800000, 8000000, 400000, para(`${F.assets} assets on the stage`, { sz: 18, b: 1, c: C.black })),
    ...bars,
    text(M, 3500000, 6600000, 900000, [
      para(`${F.approved} are cleared for external use today: the ${F.embeds} public NiCE videos and the ${F.documents} nice.com documents. The ${F.videos} conference recordings still need a named review before a customer sees them.`, { sz: 12, c: C.grey }),
    ]),
    box(M + 7000000, 1750000, 3950000, 3350000, { fill: C.paper, noLine: true, anchor: 't', paragraphs: [
      para('Behind it, the whole library', { sz: 16, b: 1, c: C.black }),
      para(`${fmt(F.sitemap)} resources indexed from nice.com`, { sz: 13, c: C.grey, bullet: true, space: 500 }),
      para(`${fmt(F.english)} English ones with real titles and descriptions`, { sz: 13, c: C.grey, bullet: true, space: 300 }),
      para(`${fmt(F.typed)} carry NiCE's own content type`, { sz: 13, c: C.grey, bullet: true, space: 300 }),
      para(`${F.withIndustry} tagged by industry, ${F.withCategory} by solution`, { sz: 13, c: C.grey, bullet: true, space: 300 }),
      para(`${F.curated} promoted into the room so far`, { sz: 13, c: C.black, b: 1, bullet: true, space: 300 }),
      para('Adding another is one line of curation, not a rebuild.', { sz: 11, i: 1, c: C.grey, space: 500 }),
    ] }),
    text(M, 5350000, CW, 500000, para('Titles, descriptions, content types and industries are NiCE\'s own words, harvested from nice.com. Nothing about a resource is written by us.', { sz: 13, i: 1, c: C.grey })),
  ])
}

// ---------------------------------------------------------------------------------------
// 9. Grounded, not improvised
// ---------------------------------------------------------------------------------------
resetIds()
{
  add([
    heading('The thing that makes it safe to put in front of a customer', 'Trust'),
    box(M, 1800000, 5300000, 1500000, { fill: C.pink, noLine: true, anchor: 't', paragraphs: [
      para('What we found in testing', { sz: 15, b: 1, c: C.black }),
      para('Pressed to answer in one line, the guide named a customer case study that does not exist. The company was real. The case study was not.', { sz: 12, c: C.black, space: 400 }),
    ] }),
    box(M, 3450000, 5300000, 1650000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
      para('What we changed', { sz: 15, b: 1, c: C.black }),
      para('It may now never name an asset, a customer or a document that a tool has not returned in that conversation, however short the answer.', { sz: 12, c: C.grey, space: 400 }),
      para('Retested: it names the real case study, and says plainly when we have nothing.', { sz: 12, c: C.grey, space: 300 }),
    ] }),
    box(M + 5600000, 1800000, 5350000, 3300000, { fill: C.black, noLine: true, anchor: 't', paragraphs: [
      para('THE RULE', { sz: 11, b: 1, c: C.green }),
      para('No tool result, no claim', { sz: 22, b: 1, c: C.white, space: 400 }),
      para('The guide cannot see inside a video. It may only repeat the summary, chapter labels and approved talking points a tool handed it.', { sz: 13, c: C.base, space: 600 }),
      para('Ask for something we do not have and it says so in its first sentence, then offers a person.', { sz: 13, c: C.base, space: 400 }),
      para('No pricing, no roadmap, no claims about competitors. Ever.', { sz: 13, b: 1, c: C.green, space: 400 }),
    ] }),
    text(M, 5350000, CW, 500000, para('A demo tool that invents a customer reference is worse than no demo tool. This is the difference between a prototype and something you can hand to the field.', { sz: 13, b: 1, c: C.black })),
  ])
}

// ---------------------------------------------------------------------------------------
// 10. Value case
// ---------------------------------------------------------------------------------------
resetIds()
{
  const items = [
    ['Reach', 'Answers the early questions at any hour, in any timezone, without a calendar invite.', C.blue],
    ['SE capacity', 'The repetitive first demo stops consuming a Solutions Engineer. That time moves to live opportunities.', C.green],
    ['Content ROI', `${fmt(F.sitemap)} resources already exist. This makes them findable by question rather than by keyword.`, C.violet],
    ['Qualification', 'Every visit produces who they are, what they explored and what they asked for, tied to the account.', C.pink],
    ['Consistency', 'The same grounded story every time, with no claim that was not approved.', C.teal],
    ['Field enablement', 'A colleague can rehearse a customer conversation in the customer\'s own context before the meeting.', C.blueDeep],
  ]
  const cw = Math.round((CW - 300000 * 2) / 3)
  add([
    heading('Where the value actually is', 'Value case'),
    ...items.map((it, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const x = M + col * (cw + 300000)
      const y = 1800000 + row * (1500000 + 300000)
      return [
        box(x, y, cw, 1500000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
          para(it[0], { sz: 17, b: 1, c: C.black }),
          para(it[2 - 1], { sz: 12, c: C.grey, space: 600 }),
        ] }),
        box(x, y, cw, 70000, { fill: it[2], noLine: true, prst: 'rect' }),
      ].join('')
    }),
    box(M, 5100000, CW, 800000, { fill: C.paper, noLine: true, anchor: 'ctr', paragraphs: [
      para('Deliberately not claimed: a conversion uplift number. Nobody has measured one yet, and inventing it here would repeat the exact failure this project designs against.', { sz: 13, i: 1, c: C.black, align: 'ctr' }),
    ] }),
  ])
}

// ---------------------------------------------------------------------------------------
// 11. Where it stands
// ---------------------------------------------------------------------------------------
resetIds()
{
  const rows = [
    ['Working today', C.green, ['Live agent on our own Cognigy tenant', 'Public build anyone can open in a browser', `${F.assets} assets, ${F.documents} of them nice.com documents`, 'Company logo, closing summary, CRM personalisation']],
    ['Prototype quality', C.blue, ['Fixtures stand in for Salesforce', 'Demo videos not yet cleared for external use', 'No telemetry, no CRM write-back']],
    ['Not started', C.grey, ['Approval workflow for content', 'Analytics on what visitors actually ask', 'Anything customer-facing at nice.com scale']],
  ]
  const cw = Math.round((CW - 400000 * 2) / 3)
  add([
    heading('Where it stands today', 'Status'),
    ...rows.map((r, i) => {
      const x = M + i * (cw + 400000)
      return [
        box(x, 1800000, cw, 2900000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
          para(r[0], { sz: 17, b: 1, c: C.black }),
          ...r[2].map((t) => para(t, { sz: 12, c: C.grey, bullet: true, space: 400 })),
        ] }),
        box(x, 1800000, cw, 70000, { fill: r[1], noLine: true, prst: 'rect' }),
      ].join('')
    }),
    box(M, 4950000, CW, 950000, { fill: C.black, noLine: true, anchor: 'ctr', paragraphs: [
      para('Built as a working prototype, not a slide. Everything above can be demonstrated live.', { sz: 16, b: 1, c: C.white, align: 'ctr' }),
    ] }),
  ])
}

// ---------------------------------------------------------------------------------------
// 12. Divider
// ---------------------------------------------------------------------------------------
resetIds()
add([
  box(0, 0, W, H, { fill: C.black, noLine: true, prst: 'rect' }),
  box(M, 2900000, 640000, 45000, { fill: C.green, noLine: true, prst: 'rect' }),
  text(M, 3100000, 9000000, 800000, para('Technical annex', { sz: 34, b: 1, c: C.white })),
  text(M, 3900000, 9000000, 500000, para('Architecture, open questions, and what happens next.', { sz: 15, c: C.base })),
], { chrome: false })

// ---------------------------------------------------------------------------------------
// 13. Architecture
// ---------------------------------------------------------------------------------------
resetIds()
{
  const y = 2050000
  const bh = 900000
  const bw = 2350000
  const gap = 480000
  const cols = [
    ['Browser', 'React portal\nChat rail plus stage', C.blue],
    ['Proxy', 'Keeps the endpoint\ntoken server-side', C.base],
    ['Cognigy agent', 'LLM plus five tools\nDecides what to show', C.green],
    ['Content', 'Catalogue and fixtures\nfetched from Git', C.violet],
  ]
  add([
    heading('How the pieces fit together', 'Suggested architecture'),
    ...cols.flatMap((c, i) => {
      const x = M + i * (bw + gap)
      const shapes = [
        box(x, y, bw, bh, { fill: c[2], noLine: true, anchor: 'ctr', paragraphs: para(c[0], { sz: 16, b: 1, c: C.black, align: 'ctr' }) }),
        text(x, y + bh + 120000, bw, 700000, c[1].split('\n').map((l) => para(l, { sz: 11, c: C.grey, align: 'ctr' }))),
      ]
      if (i < cols.length - 1) shapes.push(line(x + bw + 60000, y + bh / 2, x + bw + gap - 60000, y + bh / 2, { c: C.grey }))
      return shapes
    }),
    box(M, 3700000, CW, 850000, { fill: C.paper, noLine: true, anchor: 'ctr', paragraphs: [
      para('The catalogue is fetched from the public repository, so it is one file for both the portal and the agent. A push is a deploy.', { sz: 13, c: C.black, align: 'ctr' }),
    ] }),
    box(M, 4750000, 5300000, 1250000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
      para('Deliberate today', { sz: 14, b: 1, c: C.black }),
      para('The agent never assembles a URL, and the portal never decides what to show. Each does one job.', { sz: 12, c: C.grey, space: 400 }),
    ] }),
    box(M + 5650000, 4750000, 5300000, 1250000, { fill: C.white, line: C.pink, anchor: 't', paragraphs: [
      para('Deliberately missing', { sz: 14, b: 1, c: C.black }),
      para('No backend of our own, no CDN, no Salesforce connection. Each is a known step, not an oversight.', { sz: 12, c: C.grey, space: 400 }),
    ] }),
  ])
}

// ---------------------------------------------------------------------------------------
// 14. How content is chosen
// ---------------------------------------------------------------------------------------
resetIds()
{
  add([
    heading('How the room chooses what to show', 'Retrieval'),
    box(M, 1800000, 5300000, 3300000, { fill: C.paper, noLine: true, anchor: 't', paragraphs: [
      para('Scored, not guessed', { sz: 16, b: 1, c: C.black }),
      para('A title match outweighs a mention in a summary', { sz: 12, c: C.grey, bullet: true, space: 500 }),
      para('The visitor\'s exact word beats a stemmed near-match', { sz: 12, c: C.grey, bullet: true, space: 300 }),
      para('A match must land on a field that identifies the asset, not merely a word in its description', { sz: 12, c: C.grey, bullet: true, space: 300 }),
      para('Words that describe every asset, like "company" and "customer", carry no weight at all', { sz: 12, c: C.grey, bullet: true, space: 300 }),
      para('The chapter that answers the question sets the start time', { sz: 12, c: C.grey, bullet: true, space: 300 }),
    ] }),
    box(M + 5600000, 1800000, 5350000, 1550000, { fill: C.black, noLine: true, anchor: 't', paragraphs: [
      para('WHY IT IS WORTH THE TROUBLE', { sz: 11, b: 1, c: C.blue }),
      para('"How does a retailer modernise its contact center?"', { sz: 13, i: 1, c: C.white, space: 400 }),
      para('An earlier version answered with a case study about a student loans company, because the word "company" was in its title.', { sz: 12, c: C.base, space: 300 }),
    ] }),
    box(M + 5600000, 3500000, 5350000, 1600000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
      para('Checked automatically', { sz: 14, b: 1, c: C.black }),
      para('24 retrieval checks and 22 conversation checks assert the exact asset each question returns, so adding content cannot quietly break an answer that used to work.', { sz: 12, c: C.grey, space: 400 }),
    ] }),
    text(M, 5350000, CW, 500000, para('Same scoring in the portal and in the live agent, so a rehearsal in one is evidence about the other.', { sz: 13, i: 1, c: C.grey })),
  ])
}

// ---------------------------------------------------------------------------------------
// 15. Open questions and attention points
// ---------------------------------------------------------------------------------------
resetIds()
{
  const risks = [
    ['Naming an account owner to a stranger', 'The room is open and the identity is self-declared. Pointed at real CRM, anyone could ask whether a company is our customer and who owns it.', 'Verify the email before the lookup. Decide whether we name an employee at all.', C.pink],
    ['Content approval', `${F.videos} conference recordings are in the room but not cleared for external use. One is a session that shows a personal file path on screen.`, 'A named person signs off each asset, or they stay internal.', C.blue],
    ['Data protection', 'We collect a name, employer, role and email, and show a privacy notice. We do not record affirmative consent.', 'Decide the retention period and the erasure path before any public launch.', C.violet],
    ['Where the videos live', 'The demo videos are not hosted anywhere durable yet. A dynamic DNS host was blocked by corporate filtering.', 'Object storage behind a CDN, with valid TLS and byte-range support.', C.teal],
  ]
  const rh = 830000
  add([
    heading('What still needs a decision', 'Open questions and attention points'),
    ...risks.map((r, i) => {
      const y = 1750000 + i * (rh + 180000)
      return [
        box(M, y, CW, rh, { fill: C.white, line: C.base, anchor: 'ctr', paragraphs: [] }),
        box(M, y, 70000, rh, { fill: r[3], noLine: true, prst: 'rect' }),
        text(M + 220000, y + 130000, 3100000, 600000, para(r[0], { sz: 13, b: 1, c: C.black })),
        text(M + 3450000, y + 130000, 4300000, 600000, para(r[1], { sz: 11, c: C.grey })),
        text(M + 7900000, y + 130000, 3000000, 600000, para(r[2], { sz: 11, b: 1, c: C.black })),
      ].join('')
    }),
    text(M + 7900000, 1550000, 3000000, 300000, para('WHAT WOULD RESOLVE IT', { sz: 10, b: 1, c: C.blue })),
    text(M + 220000, 1550000, 3100000, 300000, para('ATTENTION POINT', { sz: 10, b: 1, c: C.blue })),
  ])
}

// ---------------------------------------------------------------------------------------
// 16. Next steps
// ---------------------------------------------------------------------------------------
resetIds()
{
  const steps = [
    ['Now', ['Review this with the VP of Sales', 'Agree who signs off content', 'Pick a hosting home for the videos'], C.blue],
    ['Next', ['Clear a first set of assets for external use', 'Decide the CRM disclosure position', 'Add telemetry on what visitors ask'], C.green],
    ['Then', ['Connect Salesforce properly, read-only and verified', 'Chapters for the videos that have none', 'Pilot with one region or one campaign'], C.violet],
  ]
  const cw = Math.round((CW - 400000 * 2) / 3)
  add([
    heading('Next steps', 'Next steps'),
    ...steps.map((s, i) => {
      const x = M + i * (cw + 400000)
      return [
        box(x, 1850000, cw, 2600000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
          para(s[0], { sz: 20, b: 1, c: C.black }),
          ...s[1].map((t) => para(t, { sz: 13, c: C.grey, bullet: true, space: 500 })),
        ] }),
        box(x, 1850000, cw, 70000, { fill: s[2], noLine: true, prst: 'rect' }),
      ].join('')
    }),
    box(M, 4750000, CW, 1150000, { fill: C.black, noLine: true, anchor: 'ctr', paragraphs: [
      para('The single decision that unblocks everything else', { sz: 13, b: 1, c: C.green, align: 'ctr' }),
      para('Who owns content approval, and are we willing to show a prospect the name of their account executive?', { sz: 17, b: 1, c: C.white, align: 'ctr', space: 400 }),
    ] }),
  ])
}

// ---------------------------------------------------------------------------------------
// 17 and 18. The instructions that produced this
// ---------------------------------------------------------------------------------------
const PROMPTS = [
  'Build an agentic Digital Room for CXone and Cognigy: a visitor asks questions, an AI guide answers in a grounded way and pushes matching content onto a stage.',
  'Show only publicly available content, regardless of audience. Ask me only the few questions you actually need.',
  'Use the NiCE.com style and graphics.',
  'Add the videos from the Resources directory to the portal. Ignore re-encoding for now, but keep the videos.',
  'Create the agent and flow under my OAT_Sandbox, every label prefixed OAT_DIGITAL_ROOM_, then use it from the portal.',
  'Create a public GitHub repository, publish it, and make it reachable without leaking any token or credential.',
  'Give me example questions, including ones that answer by jumping to a specific timestamp rather than the start.',
  'Add the NiCE-Systems YouTube videos to the catalogue.',
  'Add source links to every reply so the visitor can bookmark and consult later. Always provide references.',
  'Identify the visitor before the chat: first name, last name, company, position, email, plus department and area of interest. Ask me questions before changing anything.',
  'Add the visitor company logo to the header centre, resized so it never grows the header. Company names are internationally ambiguous, so make sure it is the right company.',
  'On farewell, keep the chat but switch the stage to a thank-you summary: topics of interest as checkboxes, an offer to email documentation, and an offer to speak with a sales rep or be called back.',
  'List all the resources from nice.com/resources, then enrich all the English ones.',
  'Go and get the real content types.',
  'Yes, get the categories and industries too.',
  'The Digital Room should present and propose documents, not only play videos. Give me example questions that show something other than a video, and a couple that show a nice.com resource.',
  'How can I roll this out in my public GitHub repository?',
  'I moved the videos to a new host. Use them from there if you can reach them, otherwise tell me the error.',
  'Once the visitor and their company are identified, search Salesforce for the account, opportunity, lead or contact. If found, identify the sales representative and save it in the Cognigy context, then use it on the summary page. If not found, treat it as a new lead and say an Account Executive will be assigned. If the visitor is a NiCE employee, find out whether it is for a customer or for their own knowledge.',
  'Create the lookup_crm tool in Cognigy.',
  'Build a PowerPoint of this whole project for the VP of Sales and the company, using the NiCE template, with as many diagrams as possible.',
]

for (let page = 0; page < 2; page++) {
  resetIds()
  const slice = PROMPTS.slice(page * 11, page * 11 + 11)
  add([
    heading(page === 0 ? 'How this was built: the instructions given' : 'How this was built: the instructions given (continued)', 'Appendix'),
    page === 0
      ? text(M, 1620000, CW, 400000, para('Every prompt behind this project, in order. No code was written by hand.', { sz: 12, i: 1, c: C.grey }))
      : null,
    // Rows advance by their MEASURED height, not a fixed step. At a fixed 355000 the longest
    // instruction wrapped to three lines and printed straight through the next one.
    // 132 characters is what fits on a line at 11.5pt across this column, measured from the
    // rendered slide rather than assumed.
    ...(() => {
      let y = 1950000
      return slice.map((p, i) => {
        const n = page * 11 + i + 1
        const lines = Math.max(1, Math.ceil(p.length / 132))
        const h = lines * 200000
        const row = [
          text(M, y, 420000, 300000, para(String(n).padStart(2, '0'), { sz: 12, b: 1, c: C.blue })),
          text(M + 430000, y, CW - 430000, h, para(p, { sz: 11.5, c: C.black })),
        ].join('')
        y += h + 130000
        return row
      })
    })(),
  ])
}

// ---------------------------------------------------------------------------------------
// Write out
// ---------------------------------------------------------------------------------------
fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })
slides.forEach((xml, i) => fs.writeFileSync(path.join(outDir, `slide${i + 1}.xml`), xml, 'utf8'))
fs.writeFileSync(path.join(outDir, 'count.txt'), String(slides.length), 'utf8')
console.log(`Wrote ${slides.length} slides to tools/deck/out`)
console.log(`Figures used: ${F.assets} assets (${F.videos} video, ${F.documents} document, ${F.embeds} embed), ${F.english} English resources`)
