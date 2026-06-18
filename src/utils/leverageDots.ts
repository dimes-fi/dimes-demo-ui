// The leverage slider snaps at the API's `step_bps` (whatever it is — change it
// to 1000bps or 10000bps server-side and the slider follows). Snapping always
// honours the full step. The only concession is visual: when the step would
// paint too many dots on the track, we thin the *rendered* dots down to a
// readable number. The thumb can still land on every underlying step.

/** Most dots that read cleanly on the track before they crowd (~8x at 0.5x). */
export const MAX_DOTS = 14

/** Every selectable leverage value (bps) from `min` to `max` at `step`. */
export function leverageSteps(min: number, max: number, step: number): number[] {
  if (!(step > 0)) return [min]
  const maxSteps = Math.max(0, Math.floor((max - min) / step))
  const steps: number[] = []
  for (let i = 0; i <= maxSteps; i++) steps.push(min + i * step)
  return steps
}

/**
 * Thin a dense step list down to at most `maxDots` evenly spaced marks, always
 * keeping the first and last. Returns the input untouched when it already fits.
 */
export function thinDots(steps: number[], maxDots = MAX_DOTS): number[] {
  if (steps.length <= maxDots) return steps
  const last = steps.length - 1
  const stride = Math.ceil(last / (maxDots - 1))
  const out: number[] = []
  for (let i = 0; i <= last; i += stride) out.push(steps[i])
  if (out[out.length - 1] !== steps[last]) out.push(steps[last])
  return out
}
