// OAT_DIGITAL_ROOM_search_catalog
//
// MIRROR of what is deployed in Cognigy. See README.md in this directory.
//
// Runs inside the find_demo tool branch, after OAT_DIGITAL_ROOM_fetch_catalog -> input.catalogFetch.
//
// Searches the LIVE catalog fetched by the previous node from the public GitHub repo.
// catalog/demo-catalog.json is the single source of truth for both the portal and this agent.
//
// SCORING IS A PORT OF searchCatalog IN app/src/catalog.ts. The two are supposed to rank
// identically, so that a demo in the portal is evidence about the live agent. They had drifted:
// the portal gained a title tier, word-boundary stemming, an exact-beats-stem factor and extra
// domain stopwords, and this node did not. Live then answered "how does a retailer modernise
// its contact center?" with the Student Loans COMPANY case study while the portal correctly
// returned Lands' End. Change one, change the other.
const PREVIEW_MODE = true;

// Generic words that must never carry a match on their own.
//
// The last group is domain noise rather than English filler: in a catalog of B2B customer
// stories every asset is about a company, a customer and a business, so those words rank by
// length rather than relevance. "Company" was the specific culprit above.
const STOPWORDS = ['the','and','for','you','can','with','how','what','does','did','have','has','demo','demos','show','shows','video','videos','about','anything','something','your','our','are','from','they','them','this','that','there','more','into','any','get','see','look','want','need','like','tell','give','handling','handle','experience','experiences','solution','solutions','platform','thing','things','work','works','using','use','actually','really','just','its','when','where','which','would','could','should','will','who','why','been','being','made','make','know','find','read',
  'company','companies','organisation','organisations','organization','organizations','business','businesses','customer','customers','client','clients'];

// A TIEBREAK, not an override. Where scores are close, prefer the asset that can be navigated,
// because the visitor lands on the relevant 40 seconds instead of minute zero.
//
// This was 3, which is not a tiebreak: it decided outcomes. "Show me a utilities customer using
// agentic AI" returned the outbound compliance video, because 'agentic' stems to 'agent' and
// matched its chapter "Building the AI agent that makes the calls", earning +3 and beating the
// utilities case study that the question was actually about. 0.5 matches the portal.
//
// Lowering it costs nothing in navigation: recommendedStartSeconds is computed from
// bestChapter regardless of this bonus, so jumping to a moment still works exactly as before.
const CHAPTER_MATCH_BONUS = 0.5;

// Field tiers. The title says what a thing IS; a summary merely mentions things. Without the
// title tier, two videos that list Insurance among their industries outranked the case study
// that IS an insurance customer story.
const TITLE_WEIGHT = 3;
const IDENTIFYING_WEIGHT = 2;
const DESCRIPTIVE_WEIGHT = 1;

// A stem match is real evidence but weaker than the visitor's actual word. Without this,
// 'agentic' and 'agent' were worth the same and a telecom video tied with the utilities case
// study the question was actually about.
const STEM_FACTOR = 0.85;

function unwrap(raw) {
  let value = raw;
  if (value && typeof value === 'object' && value.result !== undefined) { value = value.result; }
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch (e) { return null; }
  }
  return value && typeof value === 'object' ? value : null;
}

const payload = unwrap(input.catalogFetch);

if (!payload || !Array.isArray(payload.assets)) {
  input.result = {
    ok: false,
    error: 'Could not load the demo catalog. Tell the visitor you cannot look up demos right now rather than guessing at what exists.'
  };
} else {
  const args = (input.aiAgent && input.aiAgent.toolArgs) || {};
  const query = String(args.intent || '').toLowerCase();
  const wantedDepth = args.depth ? String(args.depth) : null;
  const maxResults = typeof args.maxResults === 'number' ? args.maxResults : 3;

  const rawTerms = query.split(/[^a-z0-9]+/).filter(function (t) {
    return t.length > 2 && STOPWORDS.indexOf(t) === -1;
  });

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Stems are matched at the START of a word, never mid-word. Plain substring containment made
  // stemming unsafe in a way that is easy to miss: "do you sell tractors?" matched a keynote,
  // because the stem "tract" is inside "attract".
  //
  // BOTH rules are needed. Explicit English endings strip three-letter suffixes that truncation
  // cannot: without the -ing rule "reskilling" never reaches the chapter labelled Reskill, and
  // "jump straight to the reskilling recommendations" returns nothing at all. Generic truncation
  // then catches the cases endings miss: retailer to retail, modernise to moderni.
  function stemsOf(term) {
    const out = [];
    if (term.length > 5 && term.slice(-3) === 'ing') { out.push(term.slice(0, -3)); }
    if (term.length > 4 && term.slice(-2) === 'ed') { out.push(term.slice(0, -2)); }
    if (term.length > 4 && term.slice(-3) === 'ies') { out.push(term.slice(0, -3) + 'y'); }
    if (term.length > 4 && term.slice(-2) === 'es') { out.push(term.slice(0, -2)); }
    if (term.length > 3 && term.slice(-1) === 's') { out.push(term.slice(0, -1)); }
    for (let end = term.length - 1; end >= 5 && end >= term.length - 2; end--) {
      out.push(term.slice(0, end));
    }
    return out.filter(function (s, i) { return s.length >= 3 && out.indexOf(s) === i; });
  }

  const matchers = rawTerms.map(function (term) {
    return {
      exact: new RegExp('\\b' + escapeRe(term) + '\\b'),
      stems: stemsOf(term).map(function (s) { return new RegExp('\\b' + escapeRe(s)); })
    };
  });

  const pool = payload.assets.filter(function (a) { return PREVIEW_MODE || a.approved === true; });

  function joinLower(parts) { return parts.join(' ').toLowerCase(); }

  // Weighted hit for one field: exact word first, then a stem at a discount, else nothing.
  function fieldScore(m, hay, weight) {
    if (m.exact.test(hay)) { return weight; }
    for (let i = 0; i < m.stems.length; i++) {
      if (m.stems[i].test(hay)) { return weight * STEM_FACTOR; }
    }
    return 0;
  }

  function countHits(hay) {
    let n = 0;
    for (let i = 0; i < matchers.length; i++) {
      if (fieldScore(matchers[i], hay, 1) > 0) { n = n + 1; }
    }
    return n;
  }

  // Computing the target chapter HERE rather than asking the model to reason about timestamps
  // is what makes jumping reliable. The model was sending a position only sometimes, so the
  // same question opened mid-video or from the start depending on the run.
  function bestChapter(a) {
    const chapters = a.chapters || [];
    let best = null;
    for (let i = 0; i < chapters.length; i++) {
      const score = countHits(String(chapters[i].label || '').toLowerCase());
      if (score > 0 && (best === null || score > best.score)) {
        best = { score: score, startSeconds: chapters[i].t, label: chapters[i].label, index: i };
      }
    }
    return best;
  }

  function scoreAsset(a) {
    const titleHay = String(a.title || '').toLowerCase();
    // documentType is identifying: "do you have a case study for..." should match case studies,
    // not everything that happens to discuss one.
    const identifyingHay = joinLower([(a.products || []).join(' '), (a.keywords || []).join(' '), (a.industries || []).join(' '), a.documentType || '']);
    const descriptiveHay = joinLower([a.summary, (a.useCases || []).join(' ')]);

    let total = 0;
    let strong = 0;
    let weak = 0;

    for (let i = 0; i < matchers.length; i++) {
      const m = matchers[i];
      const t = fieldScore(m, titleHay, TITLE_WEIGHT);
      const idf = fieldScore(m, identifyingHay, IDENTIFYING_WEIGHT);
      const d = fieldScore(m, descriptiveHay, DESCRIPTIVE_WEIGHT);
      const best = Math.max(t, idf, d);
      if (best === 0) { continue; }
      total = total + best;
      // Identifying if the winning field was the title or an identifying field.
      if (best === t || best === idf) { strong = strong + 1; } else { weak = weak + 1; }
    }

    const chapter = bestChapter(a);
    // Only for an asset that is ALREADY on topic, or whose chapter match is itself strong.
    // Applied unconditionally, a single stemmed word inside one chapter label of an otherwise
    // unrelated video was enough to outrank a precise match.
    if (chapter && (strong >= 1 || chapter.score >= 2)) { total = total + CHAPTER_MATCH_BONUS; }
    if (wantedDepth && a.depth === wantedDepth && total > 0) { total = total + 1; }
    return { total: total, strong: strong, weak: weak, chapter: chapter };
  }

  const ranked = pool.map(function (a) {
    const s = scoreAsset(a);
    return { asset: a, total: s.total, strong: s.strong, weak: s.weak, chapter: s.chapter };
  }).sort(function (x, y) {
    if (y.total !== x.total) return y.total - x.total;
    // Explicit tiebreak: navigable beats non-navigable, then shorter beats longer.
    const xc = x.chapter ? 1 : 0;
    const yc = y.chapter ? 1 : 0;
    if (yc !== xc) return yc - xc;
    return (x.asset.durationSeconds || 0) - (y.asset.durationSeconds || 0);
  });

  // A real match needs at least one identifying hit, or a chapter label that matched more than
  // one term. Without this, "billing dispute handling" matched an asset whose summary said
  // "application handling".
  const strongMatches = ranked.filter(function (r) {
    return r.strong >= 1 || (r.chapter && r.chapter.score >= 2);
  });
  const weakMatches = ranked.filter(function (r) { return r.strong === 0 && !r.chapter && r.total > 0; });

  const LONG_SECONDS = 600;

  function project(r) {
    const a = r.asset;
    const isDocument = a.type === 'document';
    const out = {
      assetId: a.id,
      title: a.title,
      summary: a.summary,
      // assetType and documentType are returned so the agent never has to INFER whether a thing
      // is watched or read. It was inferring, and describing case studies as "this video will
      // play from the start" about twice in ten replies.
      assetType: a.type,
      isDocument: isDocument,
      documentType: a.documentType || null,
      depth: a.depth,
      durationSeconds: a.durationSeconds,
      products: a.products,
      useCases: a.useCases,
      industries: a.industries || [],
      hasChapters: (a.chapters || []).length > 0,
      chapters: (a.chapters || []).map(function (c) { return { startSeconds: c.t, label: c.label }; }),
      talkingPoints: a.talkingPoints || [],
      relevance: r.strong >= 1 || (r.chapter && r.chapter.score >= 2) ? 'strong' : 'adjacent'
    };

    if (isDocument) {
      out.readingInstruction = 'This is a DOCUMENT, not a video. It is read, not watched. Never say video, play, watch, chapters or "from the start" about it. Say it is on screen, name what kind of document it is, and offer that they can open it on nice.com to read in full or keep for later. Never pass a position argument for it.';
      if (a.source && a.source.watchUrl) { out.publicUrl = a.source.watchUrl; }
    }

    if (!isDocument && r.chapter && r.chapter.startSeconds > 0) {
      out.recommendedStartSeconds = r.chapter.startSeconds;
      out.recommendedChapterLabel = r.chapter.label;
    }
    if (!isDocument && !out.hasChapters && a.durationSeconds && a.durationSeconds > LONG_SECONDS) {
      out.lengthWarning = 'This asset is long and has no chapters, so it can only be played from the start. Tell the visitor how long it runs so they know what they are committing to.';
    }
    return out;
  }

  // Offer the matches as CLICKABLE BUTTONS, not only as a list the agent types out.
  //
  // The agent was answering "here are three ways you might explore X" with a prose list, and
  // the visitor then had to retype one of them. The buttons are emitted here rather than left
  // to the model for the usual reason: the model chooses WHAT, the tool decides HOW.
  //
  // Mirrors ctaLabel in app/src/transport/MockTransport.ts. The label is shortened at a natural
  // break so "Supervisor Workspace, managing human and AI agents" reads "Supervisor Workspace",
  // while the VALUE stays the full title, which is what retrieval matches on.
  //
  // action 'offer' touches nothing on the stage, so this cannot interrupt a playing video.
  function ctaLabel(title, max) {
    max = max || 30;
    const atBreak = String(title || '').split(/[,:(]/)[0].trim();
    const base = atBreak.length >= 12 && atBreak.length <= max ? atBreak : String(title || '').trim();
    return base.length > max ? base.slice(0, max - 1).replace(/\s+$/, '') + '…' : base;
  }

  if (strongMatches.length > 0) {
    const projected = strongMatches.slice(0, maxResults).map(project);

    const buttons = projected.slice(0, 3).map(function (m) {
      return { label: ctaLabel(m.title), value: m.title, kind: 'quick_reply' };
    });
    if (buttons.length > 0) {
      try {
        actions.output(null, { _showroom: { v: 1, action: 'offer', cta: buttons } });
      } catch (e) { /* buttons are an enhancement; never fail the tool over them */ }
    }

    input.result = {
      ok: true,
      catalogSize: pool.length,
      relevance: 'strong',
      matchCount: projected.length,
      contentNotice: PREVIEW_MODE
        ? 'Preview build. Some assets are not yet approved for external use. Do not describe an asset beyond the summary, chapters and talkingPoints given here.'
        : 'Approved content only.',
      startInstruction: 'matches[0] is the recommended choice. If it has recommendedStartSeconds, you MUST pass that exact number as the position argument to OAT_DIGITAL_ROOM_show_demo, and say roughly where you are taking them. Opening at the start when a recommended start was given wastes the visitor time. Only omit position if the visitor explicitly asked to watch from the beginning.',
      documentNotice: 'An asset with isDocument true is READ, not watched. Follow its readingInstruction exactly and never pass position for it.',
      buttonNotice: 'The visitor can already SEE these choices as buttons under the chat, added for you. Do NOT list them again in your reply, and do not number or bullet them. Say one short line about where you would start and let them tap.',
      chapterNavigation: 'An asset with hasChapters false can only be played from the start. If the visitor asks for a specific moment inside one of those, say you cannot navigate inside it rather than inventing a timestamp.',
      matches: projected
    };
  } else {
    input.result = {
      ok: true,
      catalogSize: pool.length,
      relevance: 'none',
      matchCount: 0,
      noMatchGuidance: 'THERE IS NO DEMO OF WHAT THE VISITOR ASKED FOR. Say that plainly and in your first sentence. Do NOT present an adjacent asset as though it covers their topic, and do not claim any asset is relevant to it. You may then offer the nearest adjacent asset if you name it honestly as a different topic, or offer OAT_DIGITAL_ROOM_request_handoff to reach a specialist. Never assert that content exists when it does not.',
      adjacentOnly: weakMatches.slice(0, 2).map(project)
    };
  }
}
