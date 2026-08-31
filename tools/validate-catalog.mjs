#!/usr/bin/env node
/**
 * Validates a demo catalog against contracts/demo-catalog.schema.json, plus the referential
 * and policy checks a plain schema cannot express.
 *
 * No dependencies on purpose: this must be runnable on a machine with nothing installed.
 *
 *   node tools/validate-catalog.mjs catalog/demo-catalog.json
 *   node tools/validate-catalog.mjs            # validates every catalog/*.json
 *
 * Exits 1 on errors. Warnings do not fail, but they are the list of work remaining.
 */

import fs from 'node:fs'
import path from 'node:path'

const ASSET_TYPES = ['video', 'walkthrough', 'diagram', 'comparison', 'document']
const DEPTHS = ['overview', 'functional', 'technical']
const PERSONAS = [
  'cx-leader',
  'contact-center-ops',
  'it-architect',
  'developer',
  'procurement',
  'agent-supervisor',
]
const REQUIRED_ASSET_FIELDS = [
  'id',
  'title',
  'summary',
  'type',
  'approved',
  'products',
  'useCases',
  'personas',
  'depth',
  'source',
]

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

function validate(file) {
  const errors = []
  const warnings = []
  const label = path.basename(file)

  let data
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    return { label, errors: [`not valid JSON: ${error.message}`], warnings }
  }

  if (typeof data.version !== 'string') errors.push('root: version is required and must be a string')
  if (!Array.isArray(data.assets)) {
    errors.push('root: assets is required and must be an array')
    return { label, errors, warnings }
  }

  const allowedRoot = new Set(['version', 'updated', 'notes', 'assets', 'tours'])
  for (const key of Object.keys(data)) {
    if (!allowedRoot.has(key)) errors.push(`root: unexpected property "${key}"`)
  }

  const ids = new Set()

  for (const [index, asset] of data.assets.entries()) {
    const where = `assets[${index}]${asset?.id ? ` (${asset.id})` : ''}`

    for (const field of REQUIRED_ASSET_FIELDS) {
      if (asset?.[field] === undefined) errors.push(`${where}: missing required field "${field}"`)
    }
    if (!asset?.id) continue

    if (!ID_PATTERN.test(asset.id)) errors.push(`${where}: id must be kebab-case`)
    if (ids.has(asset.id)) errors.push(`${where}: duplicate id`)
    ids.add(asset.id)

    if (asset.type && !ASSET_TYPES.includes(asset.type)) {
      errors.push(`${where}: type "${asset.type}" is not one of ${ASSET_TYPES.join(', ')}`)
    }
    if (asset.depth && !DEPTHS.includes(asset.depth)) {
      errors.push(`${where}: depth "${asset.depth}" is not one of ${DEPTHS.join(', ')}`)
    }
    if (typeof asset.approved !== 'boolean') {
      errors.push(`${where}: approved must be a boolean`)
    }
    for (const persona of asset.personas ?? []) {
      if (!PERSONAS.includes(persona)) errors.push(`${where}: unknown persona "${persona}"`)
    }
    if (asset.source && typeof asset.source.url !== 'string') {
      errors.push(`${where}: source.url is required`)
    }

    // Policy: approval is the only content gate in the system, so it must be attributable.
    if (asset.approved === true && (!asset.reviewedBy || !asset.reviewedOn)) {
      errors.push(`${where}: approved:true requires both reviewedBy and reviewedOn`)
    }
    if (asset.reviewedBy === 'PLACEHOLDER') {
      warnings.push(`${where}: reviewedBy is still PLACEHOLDER`)
    }

    if (asset.type === 'video') {
      if (!asset.chapters?.length) {
        warnings.push(`${where}: video has no chapters, so it cannot be guided`)
      } else {
        const withTalkTrack = asset.chapters.filter((c) => c.talkTrack).length
        if (withTalkTrack === 0) {
          warnings.push(`${where}: chapters have no talkTrack, the highest-value field`)
        }
        let previous = -1
        for (const [chapterIndex, chapter] of asset.chapters.entries()) {
          if (typeof chapter.t !== 'number') {
            errors.push(`${where}: chapters[${chapterIndex}].t must be a number`)
            continue
          }
          if (chapter.t <= previous) {
            errors.push(`${where}: chapters[${chapterIndex}].t is not in ascending order`)
          }
          if (asset.durationSeconds && chapter.t > asset.durationSeconds) {
            errors.push(`${where}: chapters[${chapterIndex}].t exceeds durationSeconds`)
          }
          previous = chapter.t
        }
      }
      if (!asset.durationSeconds) warnings.push(`${where}: video has no durationSeconds`)
    }

    if (asset.type === 'walkthrough' && !asset.steps?.length) {
      errors.push(`${where}: walkthrough has no steps`)
    }
    if (!asset.talkingPoints?.length) {
      warnings.push(`${where}: no talkingPoints, so the agent has no approved claims to make`)
    }
    if (typeof asset.source?.url === 'string' && asset.source.url.includes('REPLACE_ME')) {
      warnings.push(`${where}: source.url is still a placeholder`)
    }
  }

  // Referential integrity. A dangling id produces a confidently broken recommendation.
  for (const asset of data.assets) {
    for (const field of ['followUps', 'prerequisites']) {
      for (const ref of asset?.[field] ?? []) {
        if (!ids.has(ref)) errors.push(`assets (${asset.id}): ${field} references unknown asset "${ref}"`)
      }
    }
  }

  for (const [index, tour] of (data.tours ?? []).entries()) {
    const where = `tours[${index}]${tour?.id ? ` (${tour.id})` : ''}`
    for (const field of ['id', 'title', 'goal', 'approved', 'steps']) {
      if (tour?.[field] === undefined) errors.push(`${where}: missing required field "${field}"`)
    }
    for (const [stepIndex, step] of (tour?.steps ?? []).entries()) {
      if (!step?.assetId) {
        errors.push(`${where}: steps[${stepIndex}] missing assetId`)
        continue
      }
      if (!ids.has(step.assetId)) {
        errors.push(`${where}: steps[${stepIndex}] references unknown asset "${step.assetId}"`)
      }
      const target = data.assets.find((a) => a.id === step.assetId)
      // A tour is only as approved as its least-approved step.
      if (tour.approved === true && target && target.approved !== true) {
        errors.push(`${where}: approved tour includes unapproved asset "${step.assetId}"`)
      }
    }
  }

  return { label, errors, warnings }
}

const args = process.argv.slice(2)
const files = args.length
  ? args
  : fs
      .readdirSync('catalog')
      .filter((name) => name.endsWith('.json'))
      .map((name) => path.join('catalog', name))

let failed = false

for (const file of files) {
  const { label, errors, warnings } = validate(file)
  console.log(`\n${label}`)
  console.log('='.repeat(label.length))

  if (errors.length === 0) console.log('  errors:   none')
  for (const error of errors) console.log(`  ERROR    ${error}`)
  for (const warning of warnings) console.log(`  warning  ${warning}`)
  if (warnings.length === 0) console.log('  warnings: none')

  if (errors.length > 0) failed = true
}

console.log('')
process.exit(failed ? 1 : 0)
