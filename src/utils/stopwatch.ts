/**
 * Aufgabe: simple stopwatch utilities.
 * now(): number in ms; since(t0): elapsed in ms.
 * formatMs(ms): string runden.
 */

/**
 * Get current timestamp in milliseconds
 * @returns Current time in milliseconds since Unix epoch
 */
export function now(): number {
  return Date.now();
}

/**
 * Calculate elapsed time since a given timestamp
 * @param t0 Start timestamp in milliseconds
 * @returns Elapsed time in milliseconds
 */
export function since(t0: number): number {
  return Date.now() - t0;
}

/**
 * Format milliseconds to a human-readable string
 * @param ms Milliseconds to format
 * @returns Formatted string with appropriate precision
 */
export function formatMs(ms: number): string {
  if (ms < 1000) {
    // Less than 1 second - show in milliseconds
    return `${Math.round(ms)}ms`;
  } else if (ms < 60000) {
    // Less than 1 minute - show in seconds with 1 decimal
    return `${(ms / 1000).toFixed(1)}s`;
  } else if (ms < 3600000) {
    // Less than 1 hour - show in minutes with 1 decimal
    return `${(ms / 60000).toFixed(1)}min`;
  } else {
    // 1 hour or more - show in hours with 1 decimal
    return `${(ms / 3600000).toFixed(1)}h`;
  }
}

/**
 * Simple stopwatch class for convenience
 */
export class Stopwatch {
  private startTime: number;

  constructor() {
    this.startTime = now();
  }

  /**
   * Get elapsed time since stopwatch was created or reset
   * @returns Elapsed time in milliseconds
   */
  elapsed(): number {
    return since(this.startTime);
  }

  /**
   * Get elapsed time as formatted string
   * @returns Formatted elapsed time string
   */
  elapsedFormatted(): string {
    return formatMs(this.elapsed());
  }

  /**
   * Reset the stopwatch to current time
   */
  reset(): void {
    this.startTime = now();
  }

  /**
   * Get elapsed time and reset in one operation
   * @returns Elapsed time in milliseconds before reset
   */
  lap(): number {
    const elapsed = this.elapsed();
    this.reset();
    return elapsed;
  }
}
