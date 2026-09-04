import { useEffect, useRef } from 'react'

/**
 * Watches for the signs that a visitor is about to leave, and calls back once.
 *
 * WHY THIS EXISTS
 * The closing summary used to be reachable only by saying goodbye. Almost nobody says goodbye
 * to a web page: they read what they wanted and close the tab, and everything the room learned
 * about them went nowhere. This notices the leaving and gives them the chance to take the
 * takeaways with them.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * It sends nothing, submits nothing and opens no modal. The callback only raises a line in the
 * takeaways strip. Acting on someone's behalf because they moved their mouse towards the tab
 * bar would be putting words in their mouth, and a dialogue box in front of someone who is
 * trying to leave is the pattern this product should be the opposite of.
 *
 * It also stays quiet while a video is playing, which is the caller's job to signal through
 * `active`. Sitting still for two minutes is what watching looks like, so an idle timer that
 * ignored playback would interrupt every single video in the catalog.
 */

/**
 * Long enough that reading a document or thinking about a question does not trip it, short
 * enough to still be there when someone has drifted off. Only ever consulted while nothing is
 * playing, so it is not competing with the length of any asset.
 */
const IDLE_MS = 90_000

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const

export function useLeaveIntent(onIntent: () => void, active: boolean): void {
  // Held in a ref so a new callback identity does not tear down and rebuild the listeners,
  // which would restart the idle timer on every render.
  const callback = useRef(onIntent)
  callback.current = onIntent

  useEffect(() => {
    if (!active) return

    let idleTimer: ReturnType<typeof setTimeout> | undefined
    let fired = false

    // Guarded here as well as in the store. The store's own guard is the one that matters for
    // correctness; this one stops a torn-down-and-remounted effect from re-arming.
    const fire = () => {
      if (fired) return
      fired = true
      callback.current()
    }

    const restartIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(fire, IDLE_MS)
    }

    // Fired on hidden rather than on return. The strip is then already waiting when they look
    // back at the tab, instead of appearing under their eyes a moment after they do.
    const onVisibility = () => {
      if (document.hidden) fire()
    }

    // The reliable exit-intent signal: the pointer leaves the document through the TOP edge,
    // heading for the tab strip or the address bar. relatedTarget is null only when the cursor
    // has left the window entirely, which is what separates this from crossing between elements.
    const onMouseOut = (event: MouseEvent) => {
      if (event.relatedTarget === null && event.clientY <= 0) fire()
    }

    restartIdleTimer()
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, restartIdleTimer, { passive: true })
    }
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('mouseout', onMouseOut)

    return () => {
      if (idleTimer) clearTimeout(idleTimer)
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, restartIdleTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('mouseout', onMouseOut)
    }
  }, [active])
}
