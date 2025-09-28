/**
 * timer.ts
 *
 * Unified timer utilities for tracking processing performance.
 * Provides consistent timing functionality for overall and stage-based tracking.
 */

/**
 * Single timer instance for tracking start/end/duration
 */
export type Timer = {
  /** Start time in milliseconds */
  startTime: number;
  /** End time in milliseconds (undefined if still running) */
  endTime?: number;
  /** Duration in milliseconds (calculated when timer stops) */
  durationMs?: number;
};

/**
 * Start a new timer
 */
export function startTimer(): Timer {
  return {
    startTime: performance.now()
  };
}

/**
 * Stop a running timer and calculate duration
 */
export function stopTimer(timer: Timer): Timer {
  const endTime = performance.now();
  return {
    ...timer,
    endTime,
    durationMs: endTime - timer.startTime
  };
}

/**
 * Get elapsed time for a running timer (without stopping it)
 */
export function getElapsed(timer: Timer): number {
  return performance.now() - timer.startTime;
}

/**
 * Check if timer is running (not stopped)
 */
export function isRunning(timer: Timer): boolean {
  return timer.endTime === undefined;
}

/**
 * Get duration from a timer (uses durationMs if stopped, calculates if running)
 */
export function getDuration(timer: Timer): number {
  return timer.durationMs ?? getElapsed(timer);
}