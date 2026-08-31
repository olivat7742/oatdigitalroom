function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Generates a watermarked placeholder image as a data URI.
 *
 * No network and no files on disk, which is what makes it usable in a static build where the
 * real media is deliberately absent. Uses the NiCE palette so placeholders sit inside the
 * brand rather than fighting it, and carries a MOCK ASSET mark so nothing here can be
 * mistaken for approved NiCE content.
 */
export function placeholderImage(label: string, caption = ''): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
  <defs>
    <pattern id="d" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.5" fill="#f2f0eb" opacity="0.16"/>
    </pattern>
  </defs>
  <rect width="1280" height="720" fill="#22212b"/>
  <rect width="1280" height="720" fill="url(#d)"/>
  <circle cx="640" cy="212" r="34" fill="none" stroke="#3694fd" stroke-width="2"/>
  <path d="M630 200 L654 212 L630 224 Z" fill="#3694fd"/>
  <text x="640" y="340" font-family="Be Vietnam Pro, Segoe UI, Helvetica, Arial, sans-serif" font-size="46" font-weight="500" letter-spacing="-1.4" fill="#f2f0eb" text-anchor="middle">${escapeXml(label)}</text>
  <text x="640" y="392" font-family="Be Vietnam Pro, Segoe UI, Helvetica, Arial, sans-serif" font-size="23" font-weight="300" fill="#6d6d72" text-anchor="middle">${escapeXml(caption)}</text>
  <g>
    <rect x="546" y="456" width="188" height="40" rx="20" fill="none" stroke="#ff5b8a" stroke-width="1.5"/>
    <text x="640" y="482" font-family="Be Vietnam Pro, Segoe UI, Helvetica, Arial, sans-serif" font-size="16" font-weight="500" letter-spacing="2" fill="#ff5b8a" text-anchor="middle">MOCK ASSET</text>
  </g>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
