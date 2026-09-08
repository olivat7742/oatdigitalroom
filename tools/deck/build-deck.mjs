/**
 * Generates the slide XML for the Digital Room presentation.
 *
 *   node tools/deck/build-deck.mjs
 *
 * Writes ppt/slides parts into tools/deck/out/. tools/deck/package-deck.ps1 then drops them
 * into a copy of NiCE's 2026 corporate template, which supplies the master, the 36 layouts,
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
const industries = readJson('catalog', 'industries.json')

const byType = catalog.assets.reduce((acc, a) => ({ ...acc, [a.type]: (acc[a.type] ?? 0) + 1 }), {})
const F = {
  assets: catalog.assets.length,
  videos: byType.video ?? 0,
  documents: byType.document ?? 0,
  embeds: byType.embed ?? 0,
  approved: catalog.assets.filter((a) => a.approved).length,
  // Split by HOW a thing was cleared, because the deck makes a point of it. Embeds and
  // documents clear by already being public; a local video needs a named person and a date.
  // Kept as derived figures rather than prose so the sentence on the content slide cannot go
  // out of sync with the catalog, which it did the moment the first local files were approved.
  approvedLocal: catalog.assets.filter((a) => a.approved && a.source?.provider === 'local').length,
  unapprovedLocal: catalog.assets.filter((a) => !a.approved && a.source?.provider === 'local').length,
  english: enriched.items.length,
  typed: enriched.items.filter((i) => i.typeSource === 'site').length,
  withIndustry: enriched.items.filter((i) => i.industries?.length).length,
  withCategory: enriched.items.filter((i) => i.categories?.length).length,
  sitemap: sitemap.items.length,
  curated: curation.documents.length,
  // Chapters are what turn a video library into a guided tour, so the deck quotes how many
  // actually exist rather than implying every asset has them. Most do not, yet.
  chapters: catalog.assets.reduce((n, a) => n + (a.chapters?.length ?? 0), 0),
  chaptered: catalog.assets.filter((a) => a.chapters?.length).length,
  talkTracks: catalog.assets.reduce((n, a) => n + (a.chapters ?? []).filter((c) => c.talkTrack).length, 0),
  verticals: Object.keys(industries.verticals ?? industries).length,
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
 * Our own footer, bottom LEFT.
 *
 * The 2026 template's blank layout carries the NiCE logo lockup hard against the bottom-right
 * corner (x=11170372, y=6499810). A right-aligned footer collided with it, so this sits on the
 * opposite side and carries the slide number, which the blank layout does not render.
 */
const footer = (n) =>
  text(M, H - 520000, 5000000, 300000, [
    para(
      [
        ['NiCE', { b: 1, c: C.black, sz: 11 }],
        ['   |   Digital Room   |   ', { c: C.grey, sz: 11 }],
        [String(n), { c: C.grey, sz: 11 }],
      ],
      { align: 'l' },
    ),
  ])

const slides = []
const add = (shapes, { chrome = true } = {}) =>
  slides.push(slideXml([...shapes, chrome ? footer(slides.length + 1) : null].filter(Boolean).join('')))

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
// 2. What this deck covers
// ---------------------------------------------------------------------------------------
resetIds()
{
  const cols = [
    ['The business case', C.blue, ['The opportunity', 'What we built, and what it feels like', 'How a visit plays out', 'What is in the room', 'Where the value is', 'How it stays alive', 'Where this could go']],
    ['The technical annex', C.violet, ['Architecture', 'How content is chosen', 'What stops it saying the wrong thing', 'Security, compliance, confidentiality', 'Open questions', 'Next steps']],
  ]
  add([
    heading('What is in this deck', 'Contents'),
    ...cols.flatMap((c, i) => {
      const x = M + i * (5450000 + 200000)
      return [
        box(x, 1750000, 5450000, 2500000, { fill: i === 0 ? C.paper : C.white, line: C.base, noLine: i === 0, anchor: 't', paragraphs: [
          para(c[0], { sz: 19, b: 1, c: C.black }),
          ...c[2].map((t) => para(t, { sz: 13, c: C.grey, bullet: true, space: 420 })),
        ] }),
        box(x, 1750000, 5450000, 70000, { fill: c[1], noLine: true, prst: 'rect' }),
      ]
    }),
    box(M, 4650000, CW, 750000, { fill: C.black, noLine: true, anchor: 'ctr', paragraphs: [
      para('Everything in this deck exists and can be demonstrated live. Nothing here is a concept slide.', { sz: 14, b: 1, c: C.white, align: 'ctr' }),
    ] }),
  ])
}

// ---------------------------------------------------------------------------------------
// 3. The opportunity
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
      box(M + i * (cardW + 400000), 1750000, cardW, 1400000, {
        fill: C.paper,
        noLine: true,
        anchor: 't',
        paragraphs: [
          para(c[0], { sz: 17, b: 1, c: C.black }),
          para(c[1], { sz: 13, c: C.grey, space: 700 }),
        ],
      }),
    ),
    box(M, 3550000, CW, 1500000, {
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
// 4. What we are building
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
// 5. Design principles
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
  const ch = 1150000
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
    text(M, 4750000, CW, 400000, para('These are not aspirations. Each one is enforced in code or in a tool, not in a prompt.', { sz: 13, i: 1, c: C.grey })),
  ])
}

// ---------------------------------------------------------------------------------------
// 6. How a visit plays out
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
// 7. Two kinds of visitor
// ---------------------------------------------------------------------------------------
resetIds()
{
  const y0 = 1900000
  add([
    heading('The room knows who is in it', 'Flows and sequences'),
    box(M, y0 + 700000, 2300000, 900000, { fill: C.blue, noLine: true, anchor: 'ctr', paragraphs: para('Email address given', { sz: 14, b: 1, c: C.black, align: 'ctr' }) }),

    box(M + 2950000, y0, 3300000, 800000, { fill: C.paper, noLine: true, anchor: 'ctr', paragraphs: para('Customer or prospect domain', { sz: 13, b: 1, c: C.black, align: 'ctr' }) }),
    box(M + 2950000, y0 + 1000000, 3300000, 800000, { fill: C.paper, noLine: true, anchor: 'ctr', paragraphs: para('NiCE colleague, own knowledge', { sz: 13, b: 1, c: C.black, align: 'ctr' }) }),
    box(M + 2950000, y0 + 2000000, 3300000, 800000, { fill: C.paper, noLine: true, anchor: 'ctr', paragraphs: para('NiCE colleague, for a customer', { sz: 13, b: 1, c: C.black, align: 'ctr' }) }),

    // A proper elbow: feed into a vertical spine, then three horizontals off it. Drawing each
    // branch as one straight connector from the blue box to a row put a 50000 x 750000 line on
    // the slide, which renders as a near-vertical stroke with an arrowhead pointing sideways.
    // Three of those together read as a bracket, not as a branch.
    line(M + 2300000, y0 + 1150000, M + 2700000, y0 + 1150000, { c: C.grey, arrow: false }),
    line(M + 2700000, y0 + 400000, M + 2700000, y0 + 2400000, { c: C.grey, arrow: false, w: 12700 }),
    line(M + 2700000, y0 + 400000, M + 2900000, y0 + 400000, { c: C.grey, w: 12700 }),
    line(M + 2700000, y0 + 1400000, M + 2900000, y0 + 1400000, { c: C.grey, w: 12700 }),
    line(M + 2700000, y0 + 2400000, M + 2900000, y0 + 2400000, { c: C.grey, w: 12700 }),

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
// 8. The closing page
// ---------------------------------------------------------------------------------------
resetIds()
{
  add([
    heading('The visit ends with a handover, not a dead end', 'Flows and sequences'),
    box(M, 1800000, 5300000, 2800000, { fill: C.paper, noLine: true, anchor: 't', paragraphs: [
      para('On the closing page', { sz: 16, b: 1, c: C.black }),
      para('Everything they actually watched or read, with links', { sz: 13, c: C.grey, bullet: true, space: 500 }),
      para('Topics to explore, pre-ticked from what they engaged with', { sz: 13, c: C.grey, bullet: true, space: 300 }),
      para('An offer to email the documentation', { sz: 13, c: C.grey, bullet: true, space: 300 }),
      para('An offer to speak with a rep, or be called back', { sz: 13, c: C.grey, bullet: true, space: 300 }),
      para('Who owns the relationship, by name', { sz: 13, c: C.black, b: 1, bullet: true, space: 300 }),
    ] }),
    box(M + 5600000, 1800000, 5350000, 1250000, { fill: C.black, noLine: true, anchor: 't', paragraphs: [
      para('KNOWN ACCOUNT', { sz: 11, b: 1, c: C.green }),
      para('Your NiCE contact', { sz: 15, b: 1, c: C.white, space: 400 }),
      para('Camille Fournier, Account Executive for Northwind Logistics', { sz: 13, c: C.base, space: 300 }),
      para('They already work with your organisation.', { sz: 11, i: 1, c: C.grey, space: 300 }),
    ] }),
    box(M + 5600000, 3250000, 5350000, 1350000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
      para('NEW LEAD', { sz: 11, b: 1, c: C.blueDeep }),
      para('An Account Executive will be assigned', { sz: 15, b: 1, c: C.black, space: 400 }),
      para('No named contact yet. Someone will pick up from what they looked at here.', { sz: 13, c: C.grey, space: 300 }),
      para('A colleague browsing for themselves sees neither message.', { sz: 11, i: 1, c: C.grey, space: 300 }),
    ] }),
    text(M, 4850000, CW, 500000, para('Having someone\'s email is not consent to use it. The send button stays disabled until they tick the box.', { sz: 13, b: 1, c: C.black })),
  ])
}

// ---------------------------------------------------------------------------------------
// 9. What is in the room
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
      para(`${F.approved} are cleared for external use today: the ${F.embeds} public NiCE videos, the ${F.documents} nice.com documents, and ${F.approvedLocal} vertical demos signed off by a named reviewer. The other ${F.unapprovedLocal} recordings still need that review before a customer sees them.`, { sz: 12, c: C.grey }),
    ]),
    box(M + 7000000, 1750000, 3950000, 2250000, { fill: C.paper, noLine: true, anchor: 't', paragraphs: [
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
// 10. Anatomy of an asset. Why the catalogue is the product.
// ---------------------------------------------------------------------------------------
resetIds()
{
  const cardW = 4600000
  const y0 = 1780000
  const groups = [
    ['WHAT IT IS', C.blue, 'title  ·  summary  ·  type  ·  products  ·  industries  ·  personas'],
    ['HOW IT IS FOUND', C.green, 'keywords  ·  useCases  ·  depth  ·  documentType'],
    ['HOW IT IS NARRATED', C.violet, 'chapters [ time, label, talkTrack ]  ·  talkingPoints  ·  followUps'],
    ['WHETHER IT MAY BE SHOWN', C.pink, 'approved  ·  source  ·  references'],
  ]
  const consequences = [
    ['Found', 'The room can match a real question to it, instead of matching a keyword.', C.green],
    ['Narrated', 'The guide knows what to say while each chapter plays, in words a person approved.', C.violet],
    ['Safe to show', 'A named reviewer cleared it. Nothing without that flag reaches a customer.', C.pink],
  ]
  add([
    heading('One catalogue record is the whole product', 'Content details'),
    box(M, y0, cardW, 3350000, { fill: C.paper, noLine: true, anchor: 't', paragraphs: [] }),
    ...groups.flatMap((g, i) => {
      const y = y0 + 200000 + i * 790000
      return [
        box(M + 200000, y, 70000, 620000, { fill: g[1], noLine: true, prst: 'rect' }),
        text(M + 380000, y, cardW - 600000, 250000, para(g[0], { sz: 10, b: 1, c: C.black })),
        text(M + 380000, y + 280000, cardW - 600000, 500000, para(g[2], { sz: 11, c: C.grey })),
      ]
    }),
    ...consequences.flatMap((c, i) => {
      const y = y0 + i * 1150000
      return [
        line(M + cardW + 80000, y + 480000, M + cardW + 620000, y + 480000, { c: C.grey }),
        box(M + cardW + 700000, y, 5250000, 960000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
          para(c[0], { sz: 16, b: 1, c: C.black }),
          para(c[1], { sz: 12, c: C.grey, space: 380 }),
        ] }),
        box(M + cardW + 700000, y, 5250000, 60000, { fill: c[2], noLine: true, prst: 'rect' }),
      ]
    }),
    box(M, 5300000, CW, 780000, { fill: C.black, noLine: true, anchor: 'ctr', paragraphs: [
      para(`The catalogue is the product. The model is the commodity part.`, { sz: 16, b: 1, c: C.white, align: 'ctr' }),
      para(`${F.talkTracks} chapter talk tracks are written today, across ${F.chaptered} of ${F.assets} assets. That gap is the single highest-return piece of work left.`, { sz: 12, c: C.base, align: 'ctr', space: 380 }),
    ] }),
  ])
}

// ---------------------------------------------------------------------------------------
// 11. Grounded, not improvised
// ---------------------------------------------------------------------------------------
resetIds()
{
  add([
    heading('The thing that makes it safe to put in front of a customer', 'Trust'),
    box(M, 1800000, 5300000, 1100000, { fill: C.pink, noLine: true, anchor: 't', paragraphs: [
      para('What we found in testing', { sz: 15, b: 1, c: C.black }),
      para('Pressed to answer in one line, the guide named a customer case study that does not exist. The company was real. The case study was not.', { sz: 12, c: C.black, space: 400 }),
    ] }),
    box(M, 3100000, 5300000, 1300000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
      para('What we changed', { sz: 15, b: 1, c: C.black }),
      para('It may now never name an asset, a customer or a document that a tool has not returned in that conversation, however short the answer.', { sz: 12, c: C.grey, space: 400 }),
      para('Retested: it names the real case study, and says plainly when we have nothing.', { sz: 12, c: C.grey, space: 300 }),
    ] }),
    box(M + 5600000, 1800000, 5350000, 2600000, { fill: C.black, noLine: true, anchor: 't', paragraphs: [
      para('THE RULE', { sz: 11, b: 1, c: C.green }),
      para('No tool result, no claim', { sz: 22, b: 1, c: C.white, space: 400 }),
      para('The guide cannot see inside a video. It may only repeat the summary, chapter labels and approved talking points a tool handed it.', { sz: 13, c: C.base, space: 600 }),
      para('Ask for something we do not have and it says so in its first sentence, then offers a person.', { sz: 13, c: C.base, space: 400 }),
      para('No pricing, no roadmap, no claims about competitors. Ever.', { sz: 13, b: 1, c: C.green, space: 400 }),
    ] }),
    text(M, 4650000, CW, 500000, para('A demo tool that invents a customer reference is worse than no demo tool. This is the difference between a prototype and something you can hand to the field.', { sz: 13, b: 1, c: C.black })),
  ])
}

// ---------------------------------------------------------------------------------------
// 12. Value case
// ---------------------------------------------------------------------------------------
resetIds()
{
  const items = [
    ['Reach', 'Answers the early questions at any hour, in any timezone, without a calendar invite.', C.blue],
    ['SE capacity', 'The repetitive first demo stops consuming a Solutions Engineer. That time moves to live opportunities.', C.green],
    ['More leads', 'Every visit produces who they are, what they explored and what they asked for, tied to the account.', C.pink],
    ['Product discovery', `A resource finder that answers a question instead of matching a keyword, across the ${fmt(F.sitemap)} resources we already publish.`, C.violet],
    ['Proof by using it', 'It runs on our own Cognigy. A visitor asking how good our AI agent is gets the answer by using one.', C.teal],
    ['Field enablement', 'A colleague can rehearse a customer conversation in the customer\'s own context before the meeting.', C.blueDeep],
  ]
  const cw = Math.round((CW - 300000 * 2) / 3)
  add([
    heading('Where the value actually is', 'Value case'),
    ...items.map((it, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const x = M + col * (cw + 300000)
      const y = 1800000 + row * (1300000 + 300000)
      return [
        box(x, y, cw, 1300000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
          para(it[0], { sz: 17, b: 1, c: C.black }),
          para(it[1], { sz: 12, c: C.grey, space: 600 }),
        ] }),
        box(x, y, cw, 70000, { fill: it[2], noLine: true, prst: 'rect' }),
      ].join('')
    }),
    box(M, 4900000, CW, 800000, { fill: C.paper, noLine: true, anchor: 'ctr', paragraphs: [
      para('Deliberately not claimed: a conversion uplift number. Nobody has measured one yet, and inventing it here would repeat the exact failure this project designs against.', { sz: 13, i: 1, c: C.black, align: 'ctr' }),
    ] }),
  ])
}

// ---------------------------------------------------------------------------------------
// 13. Feeding the room
// ---------------------------------------------------------------------------------------
resetIds()
{
  const sources = [
    ['nice.com, harvested', C.blue, 'Automated', [
      `${fmt(F.sitemap)} resources indexed, ${fmt(F.english)} enriched`,
      'Their own titles, types and industries',
      'Re-runnable whenever the site changes',
    ]],
    ['A PSE video challenge', C.green, 'To launch', [
      'An internal competition in the Portfolio SE group',
      'Short, creative product videos',
      'The group votes, the best ones get published',
    ]],
    ['The Product teams', C.violet, 'To arrange', [
      'What is worth showcasing next quarter',
      'Material that is already cleared',
      'Correcting anything the room gets wrong',
    ]],
  ]
  const cw = Math.round((CW - 400000 * 2) / 3)
  add([
    heading('Where the content comes from', 'Content pipeline'),
    ...sources.flatMap((s, i) => {
      const x = M + i * (cw + 400000)
      return [
        box(x, 1780000, cw, 1900000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
          para(s[0], { sz: 17, b: 1, c: C.black }),
          para(s[2].toUpperCase(), { sz: 10, b: 1, c: C.grey, space: 250 }),
          ...s[3].map((t) => para(t, { sz: 12, c: C.grey, bullet: true, space: 420 })),
        ] }),
        box(x, 1780000, cw, 70000, { fill: s[1], noLine: true, prst: 'rect' }),
      ]
    }),
    // No connectors between these three. They are parallel sources feeding the same gate, not a
    // sequence, and the first attempt's linking dashes read as an order that does not exist.
    box(M, 4200000, CW, 1250000, { fill: C.black, noLine: true, anchor: 'ctr', paragraphs: [
      para('Every route ends at the same gate', { sz: 13, b: 1, c: C.green, align: 'ctr' }),
      para(`A named person marks an asset approved, with a date. ${F.approved} of ${F.assets} carry that today. Nothing without it reaches a customer, whoever produced it.`, { sz: 15, b: 1, c: C.white, align: 'ctr', space: 380 }),
    ] }),
  ])
}

// ---------------------------------------------------------------------------------------
// 14. The improvement loop
// ---------------------------------------------------------------------------------------
resetIds()
{
  const y0 = 2000000
  const bw = 2400000
  const bh = 1000000
  const gap = 480000
  const nodes = [
    ['A visitor asks', 'In their own words, not ours.', C.blue],
    ['The room answers, or says it cannot', 'Declining honestly is a designed outcome.', C.green],
    ['The gap is logged', 'The exact question, verbatim, with what it tried.', C.pink],
    ['Content or keywords fixed', 'Usually one line of curation, not a rebuild.', C.violet],
  ]
  const totalW = nodes.length * bw + (nodes.length - 1) * gap
  const x0 = M + Math.round((CW - totalW) / 2)
  const returnY = y0 + bh + 700000
  add([
    heading('Every unanswered question is a work item', 'Telemetry'),
    ...nodes.flatMap((n, i) => {
      const x = x0 + i * (bw + gap)
      const shapes = [
        box(x, y0, bw, bh, { fill: n[2], noLine: true, anchor: 'ctr', paragraphs: para(n[0], { sz: 14, b: 1, c: C.black, align: 'ctr' }) }),
        text(x, y0 + bh + 110000, bw, 500000, para(n[1], { sz: 11, c: C.grey, align: 'ctr' })),
      ]
      if (i < nodes.length - 1) shapes.push(line(x + bw + 60000, y0 + bh / 2, x + bw + gap - 60000, y0 + bh / 2, { c: C.grey }))
      return shapes
    }),
    // The return leg, drawn as three segments so it reads as a loop rather than a stray arrow.
    line(x0 + totalW - Math.round(bw / 2), returnY, x0 + totalW - Math.round(bw / 2), returnY + 320000, { c: C.blue, arrow: false, w: 12700 }),
    line(x0 + Math.round(bw / 2), returnY + 320000, x0 + totalW - Math.round(bw / 2), returnY + 320000, { c: C.blue, arrow: false, w: 12700 }),
    line(x0 + Math.round(bw / 2), returnY + 320000, x0 + Math.round(bw / 2), returnY, { c: C.blue, w: 12700 }),
    text(x0, returnY + 380000, totalW, 300000, para('The next visitor gets an answer', { sz: 11, b: 1, c: C.blue, align: 'ctr' })),

    box(M, 4550000, 5300000, 1300000, { fill: C.paper, noLine: true, anchor: 't', paragraphs: [
      para('What each session should record', { sz: 14, b: 1, c: C.black }),
      para('Questions asked, assets shown, chapters actually watched, where they dropped off, whether they asked for a person.', { sz: 12, c: C.grey, space: 380 }),
    ] }),
    box(M + 5600000, 4550000, 5350000, 1300000, { fill: C.white, line: C.pink, anchor: 't', paragraphs: [
      para('Honest status: none of this is built', { sz: 14, b: 1, c: C.black }),
      para('There is no telemetry in the prototype today. It is the first thing to add, because it is what makes the agent in the middle of the room get better instead of merely staying up.', { sz: 12, c: C.grey, space: 380 }),
    ] }),
  ])
}

// ---------------------------------------------------------------------------------------
// 15. Who owns it
// ---------------------------------------------------------------------------------------
resetIds()
{
  const jobs = [
    ['Weekly', C.blue, 'Read the unanswered questions. Fix the cheap ones with a line of curation.'],
    ['Monthly', C.green, 'Refresh the library. New resources on nice.com, new videos, retire the stale.'],
    ['Quarterly', C.violet, 'Review approvals and the guardrails. Re-read what the room says about us.'],
    ['Always', C.pink, 'Watch the insights. Which questions rise tells product marketing what is landing.'],
  ]
  const cw = Math.round((CW - 3 * 300000) / 4)
  add([
    heading('A room nobody owns becomes a room nobody trusts', 'Operating model'),
    box(M, 1750000, CW, 900000, { fill: C.black, noLine: true, anchor: 'ctr', paragraphs: [
      para('This is not a project that ships and ends. It is a living thing, and it needs a named owner.', { sz: 17, b: 1, c: C.white, align: 'ctr' }),
      para('Recommendation: Marketing owns it, with a Solutions Engineer attached for the content and the agent. The decision matters more than the choice.', { sz: 12, c: C.base, align: 'ctr', space: 380 }),
    ] }),
    ...jobs.flatMap((j, i) => {
      const x = M + i * (cw + 300000)
      return [
        box(x, 2900000, cw, 1300000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
          para(j[0], { sz: 17, b: 1, c: C.black }),
          para(j[2], { sz: 12, c: C.grey, space: 550 }),
        ] }),
        box(x, 2900000, cw, 70000, { fill: j[1], noLine: true, prst: 'rect' }),
      ]
    }),
    box(M, 4450000, CW, 1100000, { fill: C.paper, noLine: true, anchor: 't', paragraphs: [
      para('What happens if nobody owns it', { sz: 14, b: 1, c: C.black }),
      para('The library goes stale, the room starts recommending retired material, and the first person to notice is a prospect. An unmaintained sales tool does not go quiet. It goes wrong, in public, with our name on it.', { sz: 12, c: C.grey, space: 380 }),
    ] }),
  ])
}

// ---------------------------------------------------------------------------------------
// 16. Ideas, where this could go
// ---------------------------------------------------------------------------------------
resetIds()
{
  const ideas = [
    ['A room per event', 'CAMPAIGN', 'A dedicated agent for Interactions and the other events, loaded with that event\'s content and its own follow-up.', C.blue],
    ['Linked from every campaign', 'QUICK WIN', 'Put the room at the end of the mailing campaigns. A destination that answers beats a landing page that asserts.', C.green],
    ['Live escalation into CXone', 'PLATFORM', 'Hand a hot visitor to a real SE through CXone Digital. The escalation itself demonstrates the product.', C.violet],
    ['Connect the knowledge base', 'PLATFORM', 'Wire in CXone Expert so the room can answer beyond the catalogue instead of declining.', C.teal],
    ['Rooms in more languages', 'REACH', 'The content is the constraint, not the agent. A translated catalogue opens the room to a region.', C.pink],
    ['A room per account', 'FIELD', 'Pre-load a named opportunity\'s context so a rep can send a prospect somewhere already about them.', C.blueDeep],
  ]
  const cw = Math.round((CW - 300000 * 2) / 3)
  add([
    heading('Where this could go next', 'Ideas'),
    ...ideas.flatMap((it, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const x = M + col * (cw + 300000)
      const y = 1780000 + row * (1450000 + 300000)
      return [
        box(x, y, cw, 1450000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
          para(it[1], { sz: 9.5, b: 1, c: it[3] }),
          para(it[0], { sz: 16, b: 1, c: C.black, space: 260 }),
          para(it[2], { sz: 12, c: C.grey, space: 420 }),
        ] }),
        box(x, y, 80000, 1450000, { fill: it[3], noLine: true, prst: 'rect' }),
      ]
    }),
    text(M, 5150000, CW, 500000, para('Ordered by how little has to be true before we can start. The first two need a decision and a link. The rest need engineering.', { sz: 13, i: 1, c: C.grey })),
  ])
}

// ---------------------------------------------------------------------------------------
// 17. Where it stands
// ---------------------------------------------------------------------------------------
resetIds()
{
  const rows = [
    ['Working today', C.green, ['Live agent on our own Cognigy tenant', 'Public build anyone can open in a browser', `${F.assets} assets, ${F.documents} of them nice.com documents`, 'Company logo, closing summary, CRM personalisation', '114 automated checks across three suites']],
    ['Prototype quality', C.blue, ['Fixtures stand in for Salesforce', 'Demo videos not yet cleared for external use', `Chapters on ${F.chaptered} assets, not all ${F.assets}`, 'Eight to fifteen seconds per answer']],
    ['Not started', C.grey, ['Approval workflow for content', 'Telemetry on what visitors actually ask', 'A named owner and an operating cadence', 'Anything at nice.com scale']],
  ]
  const cw = Math.round((CW - 400000 * 2) / 3)
  add([
    heading('Where it stands today', 'Status'),
    ...rows.map((r, i) => {
      const x = M + i * (cw + 400000)
      return [
        box(x, 1800000, cw, 2250000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
          para(r[0], { sz: 17, b: 1, c: C.black }),
          ...r[2].map((t) => para(t, { sz: 12, c: C.grey, bullet: true, space: 400 })),
        ] }),
        box(x, 1800000, cw, 70000, { fill: r[1], noLine: true, prst: 'rect' }),
      ].join('')
    }),
    box(M, 4400000, CW, 950000, { fill: C.black, noLine: true, anchor: 'ctr', paragraphs: [
      para('Built as a working prototype, not a slide. Everything above can be demonstrated live.', { sz: 16, b: 1, c: C.white, align: 'ctr' }),
    ] }),
  ])
}

// ---------------------------------------------------------------------------------------
// 18. The ask
// ---------------------------------------------------------------------------------------
resetIds()
{
  const asks = [
    ['1', 'Name an owner', 'Who runs this after today. My recommendation is Marketing, with an SE attached. Without it, it stays a prototype.'],
    ['2', 'Name a content approver', 'One person who can mark an asset cleared for external use, and is willing to. This is the only content gate we have.'],
    ['3', 'Settle the disclosure question', 'Are we willing to tell an unverified visitor the name of their account executive? That is a commercial call, not an engineering one.'],
  ]
  const cw = Math.round((CW - 400000 * 2) / 3)
  add([
    heading('What I need from you', 'The ask'),
    ...asks.flatMap((a, i) => {
      const x = M + i * (cw + 400000)
      return [
        box(x, 1800000, cw, 2550000, { fill: C.paper, noLine: true, anchor: 't', paragraphs: [] }),
        box(x + 300000, 2000000, 560000, 560000, { fill: C.blue, noLine: true, prst: 'ellipse', paragraphs: para(a[0], { sz: 17, b: 1, c: C.black, align: 'ctr' }) }),
        // 620000, not 400000. "Settle the disclosure question" wraps to two lines at 17pt in
        // this column, and at the old height the body text below started on top of it.
        text(x + 300000, 2680000, cw - 600000, 620000, para(a[1], { sz: 17, b: 1, c: C.black })),
        text(x + 300000, 3360000, cw - 600000, 900000, para(a[2], { sz: 12, c: C.grey })),
      ]
    }),
    box(M, 4700000, CW, 1150000, { fill: C.black, noLine: true, anchor: 'ctr', paragraphs: [
      para('None of the three costs money or engineering time', { sz: 13, b: 1, c: C.green, align: 'ctr' }),
      para('They are the three decisions that turn a working prototype into something the field can use.', { sz: 19, b: 1, c: C.white, align: 'ctr', space: 400 }),
    ] }),
  ])
}

// ---------------------------------------------------------------------------------------
// 19. Divider
// ---------------------------------------------------------------------------------------
resetIds()
add([
  box(0, 0, W, H, { fill: C.black, noLine: true, prst: 'rect' }),
  box(M, 2900000, 640000, 45000, { fill: C.green, noLine: true, prst: 'rect' }),
  text(M, 3100000, 9000000, 800000, para('Technical annex', { sz: 34, b: 1, c: C.white })),
  text(M, 3900000, 9000000, 500000, para('Architecture, guardrails, open questions, and what happens next.', { sz: 15, c: C.base })),
], { chrome: false })

// ---------------------------------------------------------------------------------------
// 20. Architecture
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
    ['Cognigy agent', 'LLM plus six tools\nDecides what to show', C.green],
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
      para('The catalogue is fetched from the public repository, so it is one file for both the portal and the agent. A push is a deploy, roughly ten minutes behind the CDN.', { sz: 13, c: C.black, align: 'ctr' }),
    ] }),
    box(M, 4750000, 5300000, 950000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
      para('Deliberate today', { sz: 14, b: 1, c: C.black }),
      para('The agent never assembles a URL, and the portal never decides what to show. Each does one job.', { sz: 12, c: C.grey, space: 400 }),
    ] }),
    box(M + 5650000, 4750000, 5300000, 950000, { fill: C.white, line: C.pink, anchor: 't', paragraphs: [
      para('Deliberately missing', { sz: 14, b: 1, c: C.black }),
      para('No backend of our own, no CDN, no Salesforce connection. Each is a known step, not an oversight.', { sz: 12, c: C.grey, space: 400 }),
    ] }),
  ])
}

// ---------------------------------------------------------------------------------------
// 21. How content is chosen
// ---------------------------------------------------------------------------------------
resetIds()
{
  add([
    heading('How the room chooses what to show', 'Retrieval'),
    box(M, 1800000, 5300000, 2600000, { fill: C.paper, noLine: true, anchor: 't', paragraphs: [
      para('Scored, not guessed', { sz: 16, b: 1, c: C.black }),
      para('A title match outweighs a mention in a summary', { sz: 12, c: C.grey, bullet: true, space: 500 }),
      para('The visitor\'s exact word beats a stemmed near-match', { sz: 12, c: C.grey, bullet: true, space: 300 }),
      para('A match must land on a field that identifies the asset, not merely a word in its description', { sz: 12, c: C.grey, bullet: true, space: 300 }),
      para('Words that describe every asset, like "company" and "customer", carry no weight at all', { sz: 12, c: C.grey, bullet: true, space: 300 }),
      para('The chapter that answers the question sets the start time', { sz: 12, c: C.grey, bullet: true, space: 300 }),
    ] }),
    box(M + 5600000, 1800000, 5350000, 1300000, { fill: C.black, noLine: true, anchor: 't', paragraphs: [
      para('WHY IT IS WORTH THE TROUBLE', { sz: 11, b: 1, c: C.blue }),
      para('"How does a retailer modernise its contact center?"', { sz: 13, i: 1, c: C.white, space: 400 }),
      para('An earlier version answered with a case study about a student loans company, because the word "company" was in its title.', { sz: 12, c: C.base, space: 300 }),
    ] }),
    box(M + 5600000, 3300000, 5350000, 1100000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
      para('Checked automatically', { sz: 14, b: 1, c: C.black }),
      para('114 checks across three suites assert the exact asset each question returns and the exact payload each Cognigy node emits, so adding content cannot quietly break an answer that used to work.', { sz: 12, c: C.grey, space: 400 }),
    ] }),
    text(M, 4650000, CW, 500000, para('One caveat worth knowing: the portal\'s ranking is currently ahead of the live agent\'s, so the portal is the optimistic case until the two are reconciled.', { sz: 13, i: 1, c: C.grey })),
  ])
}

// ---------------------------------------------------------------------------------------
// 22. Guardrails: what is enforced where
// ---------------------------------------------------------------------------------------
resetIds()
{
  const hard = [
    'Consent is checked in code before contact details are stored',
    'The asset id is validated against the live catalogue, so an invented one fails loudly',
    'The closing recap is built from recorded events, not from the model\'s memory',
    'The CRM lookup is repeated by the summary rather than trusted to have happened',
    'A NiCE email with no customer named skips the lookup entirely',
  ]
  const soft = [
    'Never name an asset, customer or document a tool has not returned',
    'No pricing, no roadmap, no claims about competitors',
    'Say plainly when we have nothing, then offer a person',
    'Replies capped at sixty words',
  ]
  add([
    heading('What actually stops it saying the wrong thing', 'Guardrails'),
    box(M, 1780000, 5300000, 2500000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
      para('ENFORCED IN CODE', { sz: 10, b: 1, c: C.green }),
      para('Cannot be talked out of', { sz: 17, b: 1, c: C.black, space: 260 }),
      ...hard.map((t) => para(t, { sz: 12, c: C.grey, bullet: true, space: 400 })),
    ] }),
    box(M, 1780000, 5300000, 70000, { fill: C.green, noLine: true, prst: 'rect' }),
    box(M + 5600000, 1780000, 5350000, 2500000, { fill: C.white, line: C.base, anchor: 't', paragraphs: [
      para('STATED IN INSTRUCTIONS', { sz: 10, b: 1, c: C.pink }),
      para('Strong, but a prompt is not a control', { sz: 17, b: 1, c: C.black, space: 260 }),
      ...soft.map((t) => para(t, { sz: 12, c: C.grey, bullet: true, space: 400 })),
      para('Document-versus-video wording is about eighty per cent reliable. The fix is to have the tool state the type rather than let the model deduce it.', { sz: 11, i: 1, c: C.grey, space: 500 }),
    ] }),
    box(M + 5600000, 1780000, 5350000, 70000, { fill: C.pink, noLine: true, prst: 'rect' }),
    box(M, 4600000, CW, 850000, { fill: C.black, noLine: true, anchor: 'ctr', paragraphs: [
      para('The lesson from testing: a request for brevity was enough to bypass a grounding rule that lived only in the prompt. Anything that must hold moves into code.', { sz: 14, b: 1, c: C.white, align: 'ctr' }),
    ] }),
  ])
}

// ---------------------------------------------------------------------------------------
// 23. Security, compliance and confidentiality
// ---------------------------------------------------------------------------------------
resetIds()
{
  const rows = [
    ['Anyone can walk in', 'The room is public and unauthenticated, and the visitor\'s identity is self-declared. Competitors, journalists and analysts will use it, and everything it says is screenshottable.', 'This is why there is no pricing, roadmap or competitor answer, and why nothing non-public is loaded at all.', C.pink],
    ['EU AI Act', 'The room is an AI system interacting directly with people in the EU, so the transparency duty applies: a visitor must know they are talking to an AI. It says so, but no one has formally classified it.', 'Legal confirms the classification and the wording before any public launch. Believed low risk, not assessed.', C.violet],
    ['Personal data', 'We collect a name, employer, role and email before giving value, and show a privacy notice. We do not record affirmative consent, and there is no retention or erasure path.', 'Decide whether to ask for consent explicitly, and set a retention period.', C.blue],
    ['Confidentiality of the CRM', 'Pointed at real Salesforce, the room would truthfully tell any visitor whether a company is our customer and who owns it. Both answers are enumerable by working through a list of domains.', 'Verify the email before the lookup. Keep it server-side. Return the minimum. Rate-limit and log.', C.teal],
  ]
  const rh = 830000
  add([
    heading('Security, compliance and confidentiality', 'Attention points'),
    text(M + 220000, 1560000, 3100000, 300000, para('THE EXPOSURE', { sz: 10, b: 1, c: C.blue })),
    text(M + 7900000, 1560000, 3000000, 300000, para('WHAT WOULD RESOLVE IT', { sz: 10, b: 1, c: C.blue })),
    ...rows.flatMap((r, i) => {
      const y = 1760000 + i * (rh + 180000)
      return [
        box(M, y, CW, rh, { fill: C.white, line: C.base, anchor: 'ctr', paragraphs: [] }),
        box(M, y, 70000, rh, { fill: r[3], noLine: true, prst: 'rect' }),
        text(M + 220000, y + 130000, 3100000, 600000, para(r[0], { sz: 13, b: 1, c: C.black })),
        text(M + 3450000, y + 130000, 4300000, 620000, para(r[1], { sz: 10.5, c: C.grey })),
        text(M + 7900000, y + 130000, 3000000, 620000, para(r[2], { sz: 10.5, b: 1, c: C.black })),
      ]
    }),
    text(M, 5720000, CW, 400000, para('None of these is a reason not to proceed. Each is a decision with a named owner, and three of the four are cheap if taken early.', { sz: 12, i: 1, c: C.grey })),
  ])
}

// ---------------------------------------------------------------------------------------
// 24. Open questions
// ---------------------------------------------------------------------------------------
resetIds()
{
  const risks = [
    ['Content approval', `${F.videos} conference recordings are in the room but not cleared for external use. One is a session that shows a personal file path on screen.`, 'A named person signs off each asset, or they stay internal.', C.blue],
    ['Where the videos live', 'The demo videos are not hosted anywhere durable yet. A dynamic DNS host was blocked by corporate filtering.', 'Object storage behind a CDN, with valid TLS and byte-range support.', C.teal],
    ['Cost of an open endpoint', 'An unauthenticated public agent spends LLM budget on every visitor, including automated ones.', 'Rate limiting, a per-session token ceiling and a tool-loop cap before it leaves localhost.', C.violet],
    ['Two matchers, one behaviour', 'The portal\'s ranking was improved and the live agent\'s was not, because the connector cannot read a deployed code node.', 'Recover the node source from the Cognigy UI, then hold both to the same test suite.', C.green],
  ]
  const rh = 830000
  add([
    heading('What still needs a decision', 'Open questions'),
    text(M + 220000, 1550000, 3100000, 300000, para('OPEN QUESTION', { sz: 10, b: 1, c: C.blue })),
    text(M + 7900000, 1550000, 3000000, 300000, para('WHAT WOULD RESOLVE IT', { sz: 10, b: 1, c: C.blue })),
    ...risks.flatMap((r, i) => {
      const y = 1750000 + i * (rh + 180000)
      return [
        box(M, y, CW, rh, { fill: C.white, line: C.base, anchor: 'ctr', paragraphs: [] }),
        box(M, y, 70000, rh, { fill: r[3], noLine: true, prst: 'rect' }),
        text(M + 220000, y + 130000, 3100000, 600000, para(r[0], { sz: 13, b: 1, c: C.black })),
        text(M + 3450000, y + 130000, 4300000, 620000, para(r[1], { sz: 10.5, c: C.grey })),
        text(M + 7900000, y + 130000, 3000000, 620000, para(r[2], { sz: 10.5, b: 1, c: C.black })),
      ]
    }),
  ])
}

// ---------------------------------------------------------------------------------------
// 25. Next steps
// ---------------------------------------------------------------------------------------
resetIds()
{
  const steps = [
    ['Now', ['Review this with the VP of Sales', 'Name the owner and the content approver', 'Pick a hosting home for the videos'], C.blue],
    ['Next', ['Clear a first set of assets for external use', 'Add telemetry on what visitors ask', 'Launch the PSE video challenge', 'Settle the CRM disclosure position'], C.green],
    ['Then', ['Connect Salesforce, read-only and verified', 'Chapters for the videos that have none', 'Pilot with one region or one campaign', 'A room for the next event'], C.violet],
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
// 26 onward. The instructions that produced this
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
  'Offer the choices as buttons the visitor can tap rather than a list they have to retype, and learn their vertical.',
  'Now build a PowerPoint of this whole project for the VP of Sales and for the rest of the company, on the NiCE template, with as many diagrams as possible and using the NiCE graphical chart.',
  'It must cover the opportunity, the design principles, the flows and sequences, the Digital Room content in detail, the value case, and the ideas we could pursue in the future.',
  'Add a few slides I would use only with a technical audience: the suggested architecture, the open questions and attention points including any security concerns, and the next steps.',
  'Use my own material for content: an internal challenge in the PSE group for short creative videos with the best ones published, and checking with the Product teams.',
  'And for telemetry: the list of questions that got no answer or a fallback, used to improve the agent at the heart of the room.',
  'Future ideas: a custom AI agent for events such as Interactions, and the room linked from our mailing campaigns.',
  'The benefits I care about: a modern, dynamic resource finder compared with the resources section of our corporate site, dogfooding our own Cognigy, more leads, and a better product discovery experience.',
  'The attention points: security, the EU AI Act, confidentiality, guardrails, and competitive intelligence reaching competitors, journalists or evaluation agencies.',
  'The Digital Room is a living thing and needs attention, so it should be handled by an identified team, Marketing or otherwise, who update the libraries and check usage and insights.',
  'Finish with a slide carrying all the final instructions I gave you to create this project.',
]

/**
 * Paged by MEASURED height rather than a fixed count per page.
 *
 * An earlier version put a fixed eleven per page. Two of the instructions are long enough to
 * wrap to three lines, which pushed the last row off the bottom of the slide with no warning.
 *
 * 150 characters is what fits on a line at 11.5pt across this column, read off the rendered
 * slide: a 151-character instruction sits on one line and a 154-character one takes two. The
 * first attempt guessed 132, which over-counted every long row and spread 31 instructions
 * across three sparse pages instead of two full ones.
 */
{
  const TOP = 1950000
  const BOTTOM = 5900000
  const pages = [[]]
  let y = TOP + 330000 // the first page also carries the standfirst
  for (const p of PROMPTS) {
    const h = Math.max(1, Math.ceil(p.length / 150)) * 200000
    if (y + h > BOTTOM) {
      pages.push([])
      y = TOP
    }
    pages[pages.length - 1].push([p, h])
    y += h + 130000
  }

  let n = 0
  pages.forEach((rows, page) => {
    resetIds()
    let cursor = page === 0 ? TOP + 330000 : TOP
    add([
      heading(
        page === 0 ? 'How this was built: the instructions given' : 'How this was built: the instructions given (continued)',
        'Appendix',
      ),
      page === 0
        ? text(M, 1620000, CW, 400000, para('Every instruction behind this project, in order, lightly condensed. No code was written by hand.', { sz: 12, i: 1, c: C.grey }))
        : null,
      ...rows.map(([p, h]) => {
        n += 1
        const row = [
          text(M, cursor, 420000, 300000, para(String(n).padStart(2, '0'), { sz: 12, b: 1, c: C.blue })),
          text(M + 430000, cursor, CW - 430000, h, para(p, { sz: 11.5, c: C.black })),
        ].join('')
        cursor += h + 130000
        return row
      }),
    ])
  })
}

// ---------------------------------------------------------------------------------------
// Write out
// ---------------------------------------------------------------------------------------
fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })
slides.forEach((xml, i) => fs.writeFileSync(path.join(outDir, `slide${i + 1}.xml`), xml, 'utf8'))
fs.writeFileSync(path.join(outDir, 'count.txt'), String(slides.length), 'utf8')
console.log(`Wrote ${slides.length} slides to tools/deck/out`)
console.log(
  `Figures used: ${F.assets} assets (${F.videos} video, ${F.documents} document, ${F.embeds} embed), ` +
    `${F.approved} approved, ${F.talkTracks} talk tracks on ${F.chaptered} assets, ${F.english} English resources`,
)
