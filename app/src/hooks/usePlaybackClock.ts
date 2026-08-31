import { useEffect, useRef, useState, type RefObject } from 'react'

interface Options {
  playing: boolean
  durationSeconds: number
  /** False when the catalog entry has no resolved media, which is the normal case in mock mode. */
  hasSource: boolean
  mediaRef: RefObject<HTMLVideoElement | null>
  seek: { position: number; nonce: number } | null
  onEnded: () => void
}

const TICK_MS = 250

/**
 * Single source of playback position, whether or not real media is present.
 *
 * With a real source it mirrors the video element. Without one it runs a synthetic clock, so
 * chapter navigation and talk-track timing are fully reviewable before any video file
 * exists. That matters because the assets are the last thing to arrive, and the chapter
 * experience is the part most worth getting right early.
 */
export function usePlaybackClock({
  playing,
  durationSeconds,
  hasSource,
  mediaRef,
  seek,
  onEnded,
}: Options): number {
  const [currentTime, setCurrentTime] = useState(0)
  const endedRef = useRef(false)

  // Apply seeks from the agent.
  useEffect(() => {
    if (!seek) return
    const clamped = Math.min(Math.max(0, seek.position), durationSeconds)
    endedRef.current = false
    setCurrentTime(clamped)
    if (hasSource && mediaRef.current) {
      mediaRef.current.currentTime = clamped
    }
  }, [seek, durationSeconds, hasSource, mediaRef])

  // Reset when the asset changes length underneath us.
  useEffect(() => {
    endedRef.current = false
    setCurrentTime(0)
  }, [durationSeconds])

  // Real media: mirror the element.
  useEffect(() => {
    if (!hasSource) return
    const element = mediaRef.current
    if (!element) return

    const onTimeUpdate = () => setCurrentTime(element.currentTime)
    element.addEventListener('timeupdate', onTimeUpdate)
    return () => element.removeEventListener('timeupdate', onTimeUpdate)
  }, [hasSource, mediaRef])

  useEffect(() => {
    if (!hasSource) return
    const element = mediaRef.current
    if (!element) return
    if (playing) {
      void element.play().catch(() => {
        // Autoplay refusal is expected without a user gesture. The transport controls remain
        // usable, so this is not surfaced as an error.
      })
    } else {
      element.pause()
    }
  }, [playing, hasSource, mediaRef])

  // No media: synthetic clock.
  useEffect(() => {
    if (hasSource || !playing) return

    const interval = setInterval(() => {
      setCurrentTime((previous) => {
        const next = previous + TICK_MS / 1000
        if (next >= durationSeconds) {
          if (!endedRef.current) {
            endedRef.current = true
            onEnded()
          }
          return durationSeconds
        }
        return next
      })
    }, TICK_MS)

    return () => clearInterval(interval)
  }, [playing, hasSource, durationSeconds, onEnded])

  return currentTime
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safe / 60)
  const remainder = safe % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}
