import type { ConnectionState, InboundMessage, Transport } from './types'
import {
  FALLBACK,
  GREETING,
  IDENTITY_CONFIRMATION,
  INDUSTRY_BRANCH,
  NICE_EMPLOYEE_BRANCH,
  NICE_ON_BEHALF_BRANCH,
  ONBOARDING,
  SCRIPT,
  type OnboardingStep,
  type ScriptedStep,
} from '@/fixtures/conversation'
import { findAsset, formatRuntime, searchCatalog, toStageAsset } from '@/catalog'
import {
  isNiceEmployee,
  lookupContact,
  lookupCrm,
  type CrmContact,
  type CrmLookupResult,
} from '@/crm'
import { identityQuestion, isIdentityRejection } from '@/identity'
import { industryByLabel } from '@/industries'
import { exampleInterests } from '@/interestExamples'
import { roomParams, type RoomParams } from '@/roomParams'
import { activeTemplate } from '@/templates'
import type { Cta, StageSummary, SummaryTopic, ViewedAsset } from '@/types/stageDirective'

/**
 * The three actions the summary panel can submit.
 *
 * Matched before everything else, because they read like topic queries: "Please email me
 * documentation links about supervisor experience, coaching..." was being matched as a demo
 * request and played a video over the summary the visitor had just filled in.
 */
const FOLLOWUP = /^(please email me documentation links|i would like to speak with a nice sales representative|please arrange a callback)/i

/**
 * Whether a string actually looks like an address, used instead of "the field is not empty".
 *
 * A visitor can answer the email question with "I'd rather not say", and the panel then told
 * them their links had been "sent to the address you gave earlier". Deliberately loose: this
 * decides whether to ASK again, not whether to trust the address.
 */
const EMAIL_SHAPED = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i

/** Farewells that should close with the summary rather than be searched for in the catalog. */
const FAREWELL = /^\s*(bye|goodbye|good bye|see you|see ya|thanks,? that'?s all|that'?s all|that is all|i'?m done|im done|we'?re done|no thanks,? bye|ciao|au revoir|merci,? au revoir|end|finish|wrap up|that will be all)\b/i

/**
 * Turns catalog assets into quick-reply buttons.
 *
 * The LABEL is shortened and the VALUE is the full title. Those are different jobs: a chip has
 * to be scannable in a narrow rail, while the value is fed straight back into retrieval, where
 * the full title is what the checks in tools/test-retrieval.mjs assert works.
 *
 * Shortened at a natural break first, so "Supervisor Workspace, managing human and AI agents"
 * becomes "Supervisor Workspace" rather than "Supervisor Workspace, managi...". Truncation is
 * the fallback, not the method.
 *
 * The same rule is implemented in the Cognigy search_catalog node, so the live agent and the
 * portal offer the same buttons. See cognigy/code-nodes/search-catalog.js.
 */
export function ctaLabel(title: string, max = 30): string {
  const atBreak = title.split(/[,:(]/)[0]?.trim() ?? title
  const base = atBreak.length >= 12 && atBreak.length <= max ? atBreak : title.trim()
  return base.length > max ? `${base.slice(0, max - 1).trimEnd()}…` : base
}

/**
 * `id` carries through as `assetId` so a mock chip is as deterministic as a live one. Mock
 * mode is only evidence about the real thing while the two behave the same way, and this is
 * the surface the published Pages build demonstrates, so it cannot be the weaker one.
 */
export function ctaFromAssets(
  assets: { id: string; title: string }[],
  kind: Cta['kind'] = 'quick_reply',
): Cta[] {
  return assets.map((asset) => ({
    label: ctaLabel(asset.title),
    value: asset.title,
    kind,
    assetId: asset.id,
  }))
}

/**
 * Builds a turn from a catalog search, or null when nothing matches.
 *
 * This is the closest mock mode gets to the real agent: it finds the best asset and plays it
 * with an honest one-line introduction. It deliberately makes no claims about the content
 * beyond the catalog summary, since almost none of these assets have approved talking points.
 */
function catalogSearchTurn(query: string): ScriptedStep[] | null {
  const matches = searchCatalog(query, 3)
  const best = matches[0]
  if (!best) return null

  const asset = toStageAsset(best.id)
  if (!asset) return null

  const runtime = formatRuntime(best.durationSeconds)
  const alternatives = matches.slice(1, 3)

  return [
    {
      delayMs: 650,
      message: {
        text: `${best.title}, ${runtime}.\n\n${best.summary}`,
        data: {
          _showroom: {
            v: 1,
            action: 'play',
            asset,
            cta: [
              ...ctaFromAssets(alternatives, 'next_asset'),
              { label: 'Something else', value: 'What else can you show me?', kind: 'quick_reply' as const },
            ].slice(0, 3),
          },
        },
      },
    },
  ]
}

/**
 * The question plan for a visitor the launch URL already identified.
 *
 * Name, employer and email are all known, so those three questions collapse into one
 * confirmation. Department and interest are still asked, because a contact record does not know
 * which team the project is for or what they came to see, and those are the two answers that
 * actually steer what gets shown.
 */
function buildPlan(claimed: CrmContact | null): OnboardingStep[] {
  if (!claimed) return [...ONBOARDING]
  return [
    IDENTITY_CONFIRMATION,
    ...ONBOARDING.filter((step) => !step.fields.some((f) => IDENTIFIED_BY_URL.includes(f))),
  ]
}

/** The fields a contact record supplies, and so the questions the confirmation replaces. */
const IDENTIFIED_BY_URL = ['firstName', 'lastName', 'company', 'jobTitle', 'email']

/**
 * Fixture-driven transport. No network, no backend, no model.
 *
 * Replaced by CognigyTransport (@cognigy/socket-client) once the agent is live. The point
 * of this class is that the swap should be the only change required: everything else in the
 * app talks to the Transport interface.
 */
export class MockTransport implements Transport {
  readonly name = 'mock'

  private messageHandler: ((m: InboundMessage) => void) | null = null
  private typingHandler: ((t: boolean) => void) | null = null
  private connectionHandler: ((s: ConnectionState) => void) | null = null
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private disposed = false

  /**
   * Where the visitor is in the five-question introduction, and what they have said.
   *
   * The real agent does this with a tool that decides the next question. Mock mode reproduces
   * the same sequence so the public build opens the way the live one does. It stores answers
   * verbatim rather than parsing them: there is no model here, and pretending to extract
   * structured fields from free text would only produce confident nonsense.
   *
   * Nothing leaves the browser. This build has no backend to send it to, which is exactly why
   * the public link can run the flow without collecting anything.
   */
  private onboardingStep = 0
  private readonly visitor: Record<string, string> = {}

  /**
   * The question plan for THIS visitor, which grows as answers open branches.
   *
   * A copy rather than the imported constant: splicing the shared array would leak one
   * visitor's branch into the next session, and in mock mode that array outlives the transport.
   */
  private readonly plan: OnboardingStep[]

  /**
   * The visitor the launch URL claimed this is, before they have confirmed it.
   *
   * Held separately from `visitor` on purpose: nothing from a URL parameter is treated as
   * established until the person in the room says it is theirs. People forward invitations.
   */
  private readonly claimed: CrmContact | null

  /**
   * Takes the launch parameters rather than reading the URL itself, so the identified-visitor
   * path is testable without a browser. Defaults to this page's parameters, so the app is
   * unchanged.
   */
  constructor(params: RoomParams = roomParams) {
    this.claimed = lookupContact(params.contactId)
    this.plan = buildPlan(this.claimed)
  }

  /**
   * Whether NiCE already knows this company. Resolved once, when the introduction closes,
   * rather than at wrap-up: the answer cannot change mid-session, and doing it here means the
   * closing page has it ready instead of computing it at the moment it is displayed.
   */
  private crm: CrmLookupResult = { status: 'skipped' }

  /**
   * Whether the lookup has already run. Not inferable from this.crm, because "skipped" is a
   * legitimate resolved answer for a NiCE employee browsing for their own knowledge, and is
   * also the starting value.
   */
  private crmResolved = false

  /**
   * A follow-up the visitor asked for that cannot be actioned until we have an address.
   *
   * The summary panel's buttons stay enabled without one, on purpose: a gate blocks and a
   * prompt converts, and the moment someone asks for a callback is the moment they will hand
   * over an email. This holds what they asked for while the guide asks for it.
   */
  private pendingFollowUp: string | null = null

  /**
   * Assets actually put on the stage, in order, deduplicated.
   *
   * Recorded from the outgoing directives rather than from the matcher, so every path that
   * shows something is captured without each one having to remember to log it. The closing
   * summary is built from this, so it reflects what the visitor really saw rather than what
   * the script intended.
   */
  private readonly viewed: ViewedAsset[] = []

  onMessage(handler: (m: InboundMessage) => void): void {
    this.messageHandler = handler
  }

  onTyping(handler: (t: boolean) => void): void {
    this.typingHandler = handler
  }

  onConnectionChange(handler: (s: ConnectionState) => void): void {
    this.connectionHandler = handler
  }

  async connect(): Promise<void> {
    this.disposed = false
    this.connectionHandler?.('connecting')
    await this.wait(250)
    if (this.disposed) return
    this.connectionHandler?.('open')
    this.replay(this.greeting())
  }

  /**
   * The opening turn, which differs when the launch URL identified the visitor.
   *
   * The claimed identity is NOT written into the profile here. It is offered back for
   * confirmation and only recorded once they accept it, so a forwarded link cannot file a
   * session against the wrong person.
   */
  private greeting(): ScriptedStep[] {
    if (!this.claimed) return GREETING

    const template = activeTemplate.welcome
    const opener = template ? `${template}\n\n` : ''
    return [
      {
        delayMs: 400,
        message: {
          text: `${opener}${identityQuestion(this.claimed.firstName, this.claimed.accountName)}`,
          data: {
            _showroom: { v: 1, action: 'clear', cta: IDENTITY_CONFIRMATION.cta ?? [] },
          },
        },
      },
    ]
  }

  disconnect(): void {
    this.disposed = true
    for (const timer of this.timers) clearTimeout(timer)
    this.timers.clear()
    this.typingHandler?.(false)
    this.connectionHandler?.('closed')
  }

  send(text: string): void {
    // A farewell is understood at ANY point, including mid-introduction, and is checked before
    // the introduction gate for that reason.
    //
    // The takeaways tray offers its wrap-up button as soon as it has something in it, which can
    // be before the introduction has finished. Behind the gate, that click was recorded as the
    // answer to whichever question was on screen and the visitor got nothing. It is also just
    // right on its own: someone who says goodbye during the introduction should be said goodbye
    // to, not have "bye" filed as their department.
    if (FAREWELL.test(text)) {
      this.replay(this.wrapUp())
      return
    }

    // An address we are waiting on, before the topic matchers, or "olivier@nice.com" would be
    // run through catalog search and answered with a video.
    if (this.pendingFollowUp && EMAIL_SHAPED.test(text)) {
      this.replay(this.captureFollowUpEmail(text))
      return
    }

    // The introduction comes next, and takes precedence over the topic matchers so an answer
    // like "retail" is treated as an answer rather than a demo request.
    //
    // Gated on the LIVE plan length, not on ONBOARDING.length. The plan grows when a branch
    // opens, and gating on the constant meant a NiCE employee's extra questions pushed the last
    // two answers past the gate: "Customer service" was answered with a demo instead of being
    // recorded, and the introduction never completed, so no CRM lookup ever ran.
    if (this.onboardingStep < this.plan.length) {
      this.replay(this.advanceOnboarding(text))
      return
    }

    // Checked before the catalog search, or these would be matched as topics.
    if (FOLLOWUP.test(text)) {
      this.replay(this.acknowledgeFollowUp(text))
      return
    }

    const turn = SCRIPT.find((candidate) => candidate.match.test(text))
    if (turn) {
      this.replay(turn.steps)
      return
    }
    // Scripted turns handle the chapter jumps and the guardrail cases, which need exact
    // wording. Everything else falls through to a catalog search, so all thirty assets are
    // reachable here rather than only the handful with hand-written turns.
    this.replay(catalogSearchTurn(text) ?? FALLBACK)
  }

  /**
   * Records the answer, then either asks the next question or closes the introduction with
   * three suggestions built from what they said.
   */
  private advanceOnboarding(answer: string): ScriptedStep[] {
    const step = this.plan[this.onboardingStep]
    if (step) {
      const value = answer.trim()
      if (step.fields.length === 2) {
        // Split on the first comma, or on whitespace for a name. Crude on purpose: there is no
        // model here. It exists only so the header shows "Banque Lyonnaise" rather than
        // "Banque Lyonnaise, Head of Service Delivery". The live agent does this properly.
        const separator = value.includes(',') ? ',' : ' '
        const cut = value.indexOf(separator)
        const first = cut === -1 ? value : value.slice(0, cut).trim()
        const rest = cut === -1 ? '' : value.slice(cut + 1).trim()
        this.visitor[step.fields[0] as string] = first
        if (rest) this.visitor[step.fields[1] as string] = rest
      } else {
        for (const field of step.fields) this.visitor[field] = value
      }
      // The one answer that is not stored verbatim. It has to land on the canonical vocabulary
      // or not at all, because everything downstream keys on the label.
      if (step.fields.includes('industry')) this.recordAskedIndustry(value)
      if (step.fields.includes('identityConfirmed')) this.resolveClaimedIdentity(value)
    }
    // Branches are inserted AFTER the answer is recorded and BEFORE the index advances, so the
    // new questions land immediately after the one that triggered them rather than at the end.
    if (step) this.branchAfter(step)
    this.onboardingStep += 1

    const next = this.plan[this.onboardingStep]
    if (next) {
      const cta = next.cta ?? this.ctaForQuestion(next)
      return [
        {
          delayMs: 550,
          message: {
            text: next.question,
            data: {
              ...this.visitorPayload(false),
              // 'offer' rather than 'clear': a question with buttons must not blank whatever
              // the visitor is looking at just to offer them a choice.
              ...(cta ? { _showroom: { v: 1, action: 'offer', cta } } : {}),
            },
          },
        },
      ]
    }

    return this.introductionComplete()
  }

  /**
   * Buttons for a question whose choices depend on what the visitor has already said.
   *
   * Only the interest question needs this. Its options are chosen from the department and role,
   * so they cannot be fixed on the step the way the twelve industries are, and they are filtered
   * against the real catalog first: an example that no longer matches anything is not offered.
   */
  private ctaForQuestion(step: OnboardingStep): Cta[] | null {
    if (!step.fields.includes('interest')) return null

    const examples = exampleInterests(this.visitor['department'], this.visitor['jobTitle'])
    if (examples.length === 0) return null

    return examples.map((example) => ({
      label: example.label,
      value: example.value,
      kind: 'quick_reply' as const,
    }))
  }

  /**
   * Grows the question plan when an answer opens a branch.
   *
   * The plan is instance state rather than the imported constant precisely so this can happen:
   * a NiCE employee is asked more questions than a customer, and which ones depends on what
   * they say. Splicing keeps the ordering intuitive, so "who is it for" follows the email
   * question that revealed they are internal.
   */
  private branchAfter(step: OnboardingStep): void {
    const insert = (steps: OnboardingStep[]) => {
      this.plan.splice(this.onboardingStep + 1, 0, ...steps)
    }

    if (step.fields.includes('email') && isNiceEmployee(this.visitor['email'])) {
      this.visitor['audience'] = 'nice-internal'
      insert(NICE_EMPLOYEE_BRANCH)
      return
    }

    if (step.fields.includes('niceIntent')) {
      // Anything that is not clearly "for myself" is treated as being for a customer. Erring
      // this way costs one extra question when wrong; erring the other way silently skips the
      // CRM lookup the colleague actually wanted.
      const ownKnowledge = /\b(own|myself|me|my knowledge|personal|learn|curio|general|no one|nobody)\b/i.test(
        this.visitor['niceIntent'] ?? '',
      )
      if (!ownKnowledge) {
        this.visitor['audience'] = 'nice-on-behalf'
        insert(NICE_ON_BEHALF_BRANCH)
      }
      return
    }

    // The company is identified as of this answer: the email for a visitor, the website for a
    // colleague preparing on someone else's behalf. This is the earliest the lookup can run,
    // and running it here rather than at wrap-up is the whole point: it lets the vertical
    // question be skipped entirely when the account record already answers it.
    //
    // A NiCE employee never reaches this line at the email step, because that branch returns
    // above. Nothing is searched for them and nothing is asked, which is correct: a colleague
    // browsing for their own knowledge has no vertical relevant to what we show.
    // identityConfirmed counts, because accepting the claimed identity is what supplies the
    // email. Without it a pre-identified visitor would always be asked their vertical, since
    // the lookup that could have answered it never ran.
    if (
      step.fields.includes('email') ||
      step.fields.includes('onBehalfOfWebsite') ||
      step.fields.includes('identityConfirmed')
    ) {
      this.resolveCrm()
      // Appended to the END of the introduction rather than spliced in here, even though this
      // is where the decision is made. The live agent's lookup is a separate tool call the
      // model has to make, so putting the question last gives that call two questions' worth of
      // room to land before the answer is needed. The two implementations have to ask the same
      // questions in the same order or the public build misrepresents how the real thing opens.
      if (!this.visitor['industry']) this.plan.push(...INDUSTRY_BRANCH)
    }
  }

  /**
   * Runs the CRM lookup once and keeps what it says about the vertical.
   *
   * Idempotent because two paths reach it: the identifying answer during the introduction, and
   * the close of the introduction for the visitors that path never fires for.
   */
  private resolveCrm(): void {
    if (this.crmResolved) return

    // Nothing identifying yet, so there is nothing to look up. Reachable now that the tray can
    // wrap up mid-introduction: resolving here would mark the lookup done and tell someone who
    // has given only their name that they are new to us, which is not a finding, it is an
    // absence of one.
    const audience = this.visitor['audience']
    const hasSubject =
      audience === 'nice-internal' ||
      EMAIL_SHAPED.test(this.visitor['email'] ?? '') ||
      Boolean(this.visitor['website'] || this.visitor['onBehalfOfWebsite'])
    if (!hasSubject) return

    this.crmResolved = true
    this.crm = this.runCrmLookup()

    // Recorded as the canonical label, never the raw CRM string. Marked 'crm' so a reader can
    // tell a looked-up vertical from one the visitor chose themselves, which deserve different
    // trust: one came from an account record, the other from a stranger picking a button.
    // Only when we do not already have one. Reachable because the lookup can now run a second
    // time, after a late email: the visitor's own answer must not be overwritten by a CRM
    // record that disagrees with them. Mirrors the same guard in the Cognigy node.
    if (this.crm.industry && !this.visitor['industry']) {
      this.visitor['industry'] = this.crm.industry.label
      this.visitor['industrySource'] = 'crm'
    }
  }

  /**
   * Records the vertical the visitor picked, or records nothing.
   *
   * Passed through the same normaliser as a CRM value, so a typed "we're a bank" lands on
   * Financial and an unmapped answer such as "manufacturing" is left absent rather than forced
   * into the nearest-looking box. Absent is a normal outcome here: the question invites the
   * visitor to say none of them fit.
   */
  /**
   * Accepts or discards the identity the launch URL claimed.
   *
   * Anything that is not clearly a rejection counts as confirmation, because the buttons are
   * "Yes, that's me" and "Not me" and the cost of the two mistakes is not equal: a wrongly
   * discarded identity costs three questions, a wrongly accepted one files the session against
   * a stranger and addresses them by someone else's name all the way to the closing page.
   *
   * On rejection the plan grows back the questions the confirmation had replaced, so a
   * forwarded link lands in the ordinary introduction with nothing filled in.
   */
  private resolveClaimedIdentity(answer: string): void {
    if (isIdentityRejection(answer) || !this.claimed) {
      const restored = ONBOARDING.filter((step) =>
        step.fields.some((f) => IDENTIFIED_BY_URL.includes(f)),
      )
      this.plan.splice(this.onboardingStep + 1, 0, ...restored)
      return
    }

    this.visitor['firstName'] = this.claimed.firstName
    if (this.claimed.lastName) this.visitor['lastName'] = this.claimed.lastName
    if (this.claimed.jobTitle) this.visitor['jobTitle'] = this.claimed.jobTitle
    if (this.claimed.email) this.visitor['email'] = this.claimed.email
    // The account NAME, not the domain. Display only, exactly like a typed company answer.
    if (this.claimed.accountName) this.visitor['company'] = this.claimed.accountName
  }

  private recordAskedIndustry(answer: string): void {
    const industry = industryByLabel(answer)
    if (industry) {
      this.visitor['industry'] = industry.label
      this.visitor['industrySource'] = 'asked'
      return
    }
    delete this.visitor['industry']
    delete this.visitor['industrySource']
  }

  /**
   * Decides WHO the CRM lookup is about, then runs it.
   *
   * Three cases, and the distinction matters more than the lookup itself:
   *
   * A NiCE employee browsing for their own knowledge is not a lead and is not a customer, so
   * nothing is searched. Searching would find NiCE's own account, or mark a colleague as a new
   * lead, and the closing page would then tell them an Account Executive will be assigned to
   * them, which is nonsense.
   *
   * A NiCE employee preparing for a named company is searched against THAT company, not their
   * own employer, which is the whole point of asking.
   *
   * Everyone else is searched on their own email domain.
   */
  private runCrmLookup(): CrmLookupResult {
    const audience = this.visitor['audience']

    if (audience === 'nice-internal') return { status: 'skipped' }

    if (audience === 'nice-on-behalf') {
      const website = this.visitor['onBehalfOfWebsite'] ?? this.visitor['onBehalfOfCompany'] ?? ''
      // No email for the subject company: a colleague knows who they are preparing for, not
      // that person's address. So the website is the only identifier, and if it is unusable
      // the honest answer is that nothing was found.
      return lookupCrm({ website })
    }

    return lookupCrm({
      email: this.visitor['email'] ?? '',
      website: this.visitor['website'] ?? '',
    })
  }

  /** The CRM result in the shape the closing summary contract expects, or undefined. */
  private summaryCrm(): StageSummary['crm'] {
    if (this.crm.status === 'skipped') return undefined
    return {
      status: this.crm.status,
      ...(this.crm.salesRep?.name ? { salesRepName: this.crm.salesRep.name } : {}),
      ...(this.crm.salesRep?.role ? { salesRepRole: this.crm.salesRep.role } : {}),
      ...(this.crm.accountName ? { accountName: this.crm.accountName } : {}),
      ...(this.crm.matchType ? { matchType: this.crm.matchType } : {}),
    }
  }

  /**
   * Mirrors what the Cognigy save_visitor_profile tool emits, so the header personalises the
   * same way here as it does against the live agent.
   *
   * Contract: contracts/visitor-payload.schema.json
   */
  private visitorPayload(introductionComplete: boolean): Record<string, unknown> {
    // Mapped field by field rather than spread. The internal bag now holds working values that
    // are not part of the contract (niceIntent, and the two onBehalfOf answers before they are
    // nested), and the schema sets additionalProperties:false, so a spread would emit a payload
    // that fails its own contract.
    const {
      onBehalfOfCompany,
      onBehalfOfWebsite,
      niceIntent: _intent,
      identityConfirmed: _confirmed,
      ...rest
    } = this.visitor
    void _intent
    void _confirmed

    const onBehalfOf =
      onBehalfOfCompany || onBehalfOfWebsite
        ? {
            ...(onBehalfOfCompany ? { company: onBehalfOfCompany } : {}),
            ...(onBehalfOfWebsite ? { website: onBehalfOfWebsite } : {}),
          }
        : undefined

    return {
      _visitor: {
        v: 1,
        ...rest,
        ...(onBehalfOf ? { onBehalfOf } : {}),
        introductionComplete,
      },
    }
  }

  /** Closes the introduction with suggestions drawn from the catalog, using their own words. */
  private introductionComplete(): ScriptedStep[] {
    const interest = this.visitor['interest'] ?? ''
    const department = this.visitor['department'] ?? ''
    const name = (this.visitor['firstName'] ?? '').split(/\s+/)[0] ?? ''

    // Normally already resolved, at the answer that identified the company. Called again for
    // the paths that answer never fires for, notably a NiCE employee browsing for themselves.
    this.resolveCrm()

    // The vertical is part of the query, not a filter. Industries are an identifying field in
    // the scoring, so a known vertical lifts same-industry assets without excluding a strong
    // match from another one, which a filter would. It is also the promise the question made:
    // that saying which industry you are in changes what you get shown.
    const industry = this.visitor['industry'] ?? ''
    const matches = searchCatalog(`${interest} ${department} ${industry}`.trim(), 3)
    const suggestions = matches.length > 0 ? matches : searchCatalog('agent supervisor outbound', 3)

    const lead = name ? `Thanks, ${name}.` : 'Thanks.'

    // The options are BUTTONS, not a list in the prose.
    //
    // The agent used to print the same three titles as bullets AND send them as chips, so
    // the visitor read a paragraph and then found the identical choices underneath it. One
    // short line plus the buttons is less to read and quicker to act on, which is the whole
    // point of offering a choice.
    return [
      {
        delayMs: 650,
        message: {
          text: `${lead} Based on that, here is where I would start. Tap one, or ask me anything else.`,
          data: {
            ...this.visitorPayload(true),
            _showroom: {
              v: 1,
              action: 'clear',
              cta: ctaFromAssets(suggestions.slice(0, 3)),
            },
          },
        },
      },
    ]
  }

  /**
   * Plays a scripted sequence with a typing indicator in between, so the pacing of the real
   * thing is visible during review. Latency here is cosmetic and intentionally generous.
   */
  /** Records an asset the moment a directive puts it on the stage. */
  private recordViewed(step: ScriptedStep): void {
    const data = step.message.data as { _showroom?: { action?: string; asset?: { id?: string } } } | undefined
    const directive = data?._showroom
    if (!directive || (directive.action !== 'play' && directive.action !== 'show')) return

    const id = directive.asset?.id
    if (!id || this.viewed.some((v) => v.assetId === id)) return

    const entry = findAsset(id)
    if (!entry) return

    this.viewed.push({
      assetId: entry.id,
      title: entry.title,
      ...(entry.durationSeconds !== undefined ? { durationSeconds: entry.durationSeconds } : {}),
      ...(entry.source.watchUrl ? { watchUrl: entry.source.watchUrl } : {}),
      ...(entry.references?.length ? { references: entry.references } : {}),
    })
  }

  /**
   * Builds the closing summary from what was actually viewed, plus a couple of adjacent
   * suggestions drawn from what they said they were interested in.
   */
  private wrapUp(): ScriptedStep[] {
    // Normally already done. Called again because wrap-up is now reachable mid-introduction, so
    // an early exit still gets the relationship line if we know enough to look it up.
    this.resolveCrm()

    const name = (this.visitor['firstName'] ?? '').split(/\s+/)[0] ?? ''
    const topics: SummaryTopic[] = []
    const seen = new Set<string>()

    // Topics they demonstrably engaged with, pre-ticked.
    for (const item of this.viewed) {
      for (const useCase of findAsset(item.assetId)?.useCases ?? []) {
        const id = useCase.toLowerCase()
        if (seen.has(id)) continue
        seen.add(id)
        topics.push({ id, label: useCase, preselected: true })
      }
    }

    // Adjacent suggestions, unticked, so the list is not limited to what they already saw.
    for (const asset of searchCatalog(this.visitor['interest'] ?? '', 3)) {
      for (const useCase of asset.useCases) {
        const id = useCase.toLowerCase()
        if (seen.has(id) || topics.length >= 8) continue
        seen.add(id)
        topics.push({ id, label: useCase })
      }
    }

    const crm = this.summaryCrm()

    const summary: StageSummary = {
      headline: name ? `Thanks, ${name}.` : 'Thanks for visiting.',
      viewed: this.viewed,
      topics: topics.slice(0, 8),
      // Shape-checked, not merely present. Answering the email question "I'd rather not say"
      // filled the field, and the panel then told the visitor their links had been sent to the
      // address they gave earlier.
      emailKnown: EMAIL_SHAPED.test(this.visitor['email'] ?? ''),
      ...(crm ? { crm } : {}),
    }

    return [
      {
        delayMs: 600,
        message: {
          text:
            this.viewed.length > 0
              ? 'Your takeaways are open now. Tick whatever you would like to go further on, and tell me how you would like to follow up.'
              : 'Thanks for stopping by. Your takeaways are open if you would like documentation or to speak with someone.',
          data: { _showroom: { v: 1, action: 'wrapup', summary, cta: [] } },
        },
      },
    ]
  }

  /**
   * Confirms a follow-up request. Emits NO stage directive on purpose: the summary the visitor
   * just filled in must stay where it is, rather than being replaced by the acknowledgement.
   */
  private acknowledgeFollowUp(text: string): ScriptedStep[] {
    const lower = text.toLowerCase()
    const kind = lower.startsWith('please email me')
      ? 'email'
      : lower.startsWith('please arrange a callback')
        ? 'callback'
        : 'rep'

    // No address, so ask for one instead of confirming something nobody can do. The request is
    // remembered rather than discarded: they asked once and should not have to ask again.
    if (!EMAIL_SHAPED.test(this.visitor['email'] ?? '')) {
      this.pendingFollowUp = kind
      const what =
        kind === 'email'
          ? 'send those links'
          : kind === 'callback'
            ? 'arrange that callback'
            : 'put you in touch with someone'
      return [
        {
          delayMs: 550,
          message: {
            text: `Happy to. I do not have an address for you yet, so I cannot ${what}. What is the best email to use?`,
          },
        },
      ]
    }

    const reply =
      kind === 'email'
        ? 'Noted. In the live version that sends the documentation links to your email. This build does not send mail, so nothing has actually gone out.'
        : kind === 'callback'
          ? 'Noted. In the live version this creates a callback request for a Solutions Engineer. This build does not route anything yet.'
          : 'Noted. In the live version this hands you to a Solutions Engineer in CXone Digital, carrying everything you looked at. This build does not route anything yet.'

    return [{ delayMs: 550, message: { text: reply } }]
  }

  /**
   * Records the address the guide just asked for, and confirms the request it was blocking.
   *
   * The CRM lookup is re-run, because the domain is the one thing that identifies the company
   * and we did not have it before. Someone who skipped the introduction entirely can therefore
   * still end up correctly matched to their account.
   */
  private captureFollowUpEmail(text: string): ScriptedStep[] {
    const address = EMAIL_SHAPED.exec(text)?.[0] ?? ''
    const kind = this.pendingFollowUp
    this.pendingFollowUp = null
    this.visitor['email'] = address

    this.crmResolved = false
    this.resolveCrm()

    const what =
      kind === 'email'
        ? 'the documentation links go to that address'
        : kind === 'callback'
          ? 'a Solutions Engineer requests the callback on that address'
          : 'a Solutions Engineer picks this up on that address'

    return [
      {
        delayMs: 550,
        message: {
          text: `Thank you, noted against ${address}. In the live version ${what}, carrying everything you looked at. This build does not send or route anything yet.`,
          data: this.visitorPayload(true),
        },
      },
    ]
  }

  private replay(steps: ScriptedStep[]): void {
    let elapsed = 0
    this.typingHandler?.(true)
    for (const step of steps) this.recordViewed(step)

    steps.forEach((step, index) => {
      elapsed += step.delayMs
      const isLast = index === steps.length - 1
      this.schedule(() => {
        if (isLast) this.typingHandler?.(false)
        this.messageHandler?.(step.message)
      }, elapsed)
    })
  }

  private schedule(fn: () => void, delay: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer)
      if (!this.disposed) fn()
    }, delay)
    this.timers.add(timer)
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.schedule(resolve, ms))
  }
}
