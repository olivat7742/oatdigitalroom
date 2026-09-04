/**
 * A small DrawingML shape DSL for building PowerPoint slides.
 *
 * Exists because there is no python-pptx here (no Python at all) and pptxgenjs would be a new
 * dependency. Writing the XML directly costs more here but buys two things that matter for this
 * deck: it keeps NiCE's real slide master, layouts and theme rather than approximating them,
 * and it gives exact control over diagram geometry, which is most of what was asked for.
 *
 * Units are EMU. 914400 EMU = 1 inch. The deck is 16:9 at 12192000 x 6858000.
 */

export const EMU = 914400
export const W = 12192000
export const H = 6858000

/**
 * NiCE brand colours, read from the theme of the 2026 SKO corporate template and cross-checked
 * against the live CSS custom properties on nice.com. They agree, which is why this deck is
 * built on that template rather than an invented palette.
 */
export const C = {
  black: '22212B',
  white: 'FFFFFF',
  paper: 'F2EFEB',
  base: 'E8E6E0',
  blue: '3694FC',
  blueDeep: '025AFB',
  violet: '6100FF',
  pink: 'FF6AA7',
  teal: '36EBD1',
  green: '00E2A0',
  grey: '6D6D72',
}

let seq = 1
export function resetIds() {
  seq = 1
}
function nextId() {
  return ++seq
}

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** One run of text. `b` bold, `i` italic, `c` colour, `sz` size in points. */
function run(text, { b = 0, i = 0, c = C.black, sz = 14, font = 'Arial' } = {}) {
  return (
    `<a:r><a:rPr lang="en-GB" sz="${Math.round(sz * 100)}" b="${b}" i="${i}" dirty="0">` +
    `<a:solidFill><a:srgbClr val="${c}"/></a:solidFill>` +
    `<a:latin typeface="${font}"/></a:rPr><a:t>${esc(text)}</a:t></a:r>`
  )
}

/**
 * A paragraph. `parts` is a string, or an array of [text, opts] pairs so a single line can mix
 * weights, which is how the key number in a stat is emphasised without a second text box.
 */
function para(parts, { align = 'l', bullet = false, space = 0, indent = 0, ...runOpts } = {}) {
  const runs = Array.isArray(parts)
    ? parts.map((p) => (Array.isArray(p) ? run(p[0], { ...runOpts, ...p[1] }) : run(p, runOpts))).join('')
    : run(parts, runOpts)
  const buChar = bullet
    ? `<a:buClr><a:srgbClr val="${C.blue}"/></a:buClr><a:buFont typeface="Arial"/><a:buChar char="•"/>`
    : '<a:buNone/>'
  const marL = bullet ? 171450 + indent : indent
  return (
    `<a:p><a:pPr marL="${marL}" indent="${bullet ? -171450 : 0}" algn="${align}">` +
    `<a:lnSpc><a:spcPct val="100000"/></a:lnSpc><a:spcBef><a:spcPts val="${space}"/></a:spcBef>${buChar}</a:pPr>${runs}</a:p>`
  )
}

/** Text box with no fill or outline. */
export function text(x, y, w, h, paragraphs, { anchor = 't', wrap = true } = {}) {
  const id = nextId()
  const body = (Array.isArray(paragraphs) ? paragraphs : [paragraphs]).join('')
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="${wrap ? 'square' : 'none'}" anchor="${anchor}" lIns="0" tIns="0" rIns="0" bIns="0">` +
    `<a:normAutofit/></a:bodyPr><a:lstStyle/>${body}</p:txBody></p:sp>`
  )
}

/** Filled shape, optionally with centred text inside. */
export function box(
  x,
  y,
  w,
  h,
  {
    fill = C.white,
    line = C.base,
    lineW = 12700,
    prst = 'roundRect',
    adj = 0.06,
    paragraphs = [],
    anchor = 'ctr',
    noLine = false,
  } = {},
) {
  const id = nextId()
  const geom =
    prst === 'roundRect'
      ? `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${Math.round(adj * 100000)}"/></a:avLst></a:prstGeom>`
      : `<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>`
  const stroke = noLine
    ? '<a:ln><a:noFill/></a:ln>'
    : `<a:ln w="${lineW}"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln>`
  const body = (Array.isArray(paragraphs) ? paragraphs : [paragraphs]).join('') || '<a:p><a:endParaRPr lang="en-GB"/></a:p>'
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Box ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>${geom}` +
    `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>${stroke}</p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" anchor="${anchor}" lIns="91440" tIns="45720" rIns="91440" bIns="45720">` +
    `<a:normAutofit/></a:bodyPr><a:lstStyle/>${body}</p:txBody></p:sp>`
  )
}

/** Straight connector, optionally arrow-headed. Used for every diagram edge. */
export function line(x1, y1, x2, y2, { c = C.grey, w = 19050, arrow = true, dash = false } = {}) {
  const id = nextId()
  const flipH = x2 < x1 ? ' flipH="1"' : ''
  const flipV = y2 < y1 ? ' flipV="1"' : ''
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  const cx = Math.abs(x2 - x1)
  const cy = Math.abs(y2 - y1)
  return (
    `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="Line ${id}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>` +
    `<p:spPr><a:xfrm${flipH}${flipV}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom>` +
    `<a:ln w="${w}"><a:solidFill><a:srgbClr val="${c}"/></a:solidFill>` +
    `${dash ? '<a:prstDash val="dash"/>' : ''}${arrow ? '<a:tailEnd type="triangle"/>' : ''}</a:ln></p:spPr></p:cxnSp>`
  )
}

export { para, run }

/** Slide title plus the thin accent rule used on every content slide. */
export function heading(title, kicker) {
  const out = []
  if (kicker) {
    out.push(text(548640, 430000, 9000000, 250000, para(kicker.toUpperCase(), { sz: 11, b: 1, c: C.blue })))
  }
  out.push(text(548640, 700000, 10500000, 700000, para(title, { sz: 30, b: 1, c: C.black })))
  out.push(box(548640, 1330000, 640000, 45000, { fill: C.blue, noLine: true, prst: 'rect' }))
  return out.join('')
}

/** Wraps shapes into a complete slide part. */
export function slideXml(shapes) {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
    '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    shapes +
    '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
  )
}
