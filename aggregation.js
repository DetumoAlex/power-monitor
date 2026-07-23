/**
 * aggregation.js
 *
 * Pure functions that turn a list of power transition events into
 * uptime statistics. Deliberately has zero dependency on Prisma or
 * MongoDB so it can be unit tested with plain arrays, and so the same
 * logic can run against real DB data or simulator data unchanged.
 *
 * Core idea: events are transitions (ON at time T, OFF at time T),
 * not periodic samples. To get "hours of power in a window", we walk
 * the events, find ON->OFF (or ON->window end) spans, and sum them.
 */

/**
 * @param {Array<{status: 'ON'|'OFF', timestamp: Date}>} events
 *        Must be for a single device. Order does not matter, will be sorted.
 * @param {Date} windowStart
 * @param {Date} windowEnd
 * @returns {{
 *   onMs: number,
 *   offMs: number,
 *   onHours: number,
 *   offHours: number,
 *   uptimePercent: number,
 *   spans: Array<{start: Date, end: Date}>
 * }}
 */
function computeUptime(events, windowStart, windowEnd) {
  if (windowEnd <= windowStart) {
    throw new Error('windowEnd must be after windowStart');
  }

  const sorted = [...events]
    .filter((e) => e.timestamp < windowEnd) // ignore events after the window
    .sort((a, b) => a.timestamp - b.timestamp);

  // Determine the status at windowStart: the status carried by the
  // last event before windowStart, or assume ON if we have no prior
  // history at all (can't know, but ON is the safer default for a
  // freshly-installed device that just started reporting).
  let carryStatus = 'ON';
  for (const e of sorted) {
    if (e.timestamp <= windowStart) {
      carryStatus = e.status;
    } else {
      break;
    }
  }

  // Build a clean timeline clipped to the window.
  const timeline = [{ status: carryStatus, timestamp: windowStart }];
  for (const e of sorted) {
    if (e.timestamp > windowStart && e.timestamp < windowEnd) {
      // Skip consecutive duplicate statuses (defensive — device might
      // send heartbeats with the same status).
      if (timeline[timeline.length - 1].status !== e.status) {
        timeline.push({ status: e.status, timestamp: e.timestamp });
      }
    }
  }
  timeline.push({ status: null, timestamp: windowEnd }); // closing marker

  let onMs = 0;
  const spans = [];
  for (let i = 0; i < timeline.length - 1; i++) {
    const cur = timeline[i];
    const next = timeline[i + 1];
    const durationMs = next.timestamp - cur.timestamp;
    if (cur.status === 'ON') {
      onMs += durationMs;
      spans.push({ start: cur.timestamp, end: next.timestamp });
    }
  }

  const totalMs = windowEnd - windowStart;
  const offMs = totalMs - onMs;

  return {
    onMs,
    offMs,
    onHours: +(onMs / 3_600_000).toFixed(2),
    offHours: +(offMs / 3_600_000).toFixed(2),
    uptimePercent: +((onMs / totalMs) * 100).toFixed(1),
    spans,
  };
}

/** Convenience wrapper: today / this week / this month, all ending "now". */
function computeStandardWindows(events, now = new Date()) {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(dayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday start

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    today: computeUptime(events, dayStart, now),
    thisWeek: computeUptime(events, weekStart, now),
    thisMonth: computeUptime(events, monthStart, now),
  };
}

/**
 * Estimate days until prepaid units run out, from purchase history.
 *
 * v1 approach (documented assumption, not hidden): assumes a household
 * roughly exhausts units between purchases — i.e. the gap in days
 * between consecutive purchases approximates how long that many units
 * lasted. Averages the last few purchases' (units / days-until-next)
 * rate, then applies it to the most recent purchase's units and the
 * days elapsed since. This is a rough estimate, not a metered reading —
 * it gets meaningfully better once/if real consumption (kWh) data is
 * available from a proper energy meter rather than a presence sensor.
 *
 * @param {Array<{unitsPurchased: number, purchaseDate: Date}>} tokenEntries
 * @param {Date} now
 * @returns {{ dailyRateEstimate: number, daysRemaining: number|null, note: string }}
 */
function estimateDaysRemaining(tokenEntries, now = new Date()) {
  const sorted = [...tokenEntries].sort((a, b) => a.purchaseDate - b.purchaseDate);

  if (sorted.length < 2) {
    return {
      dailyRateEstimate: null,
      daysRemaining: null,
      note: 'Need at least 2 token purchases to estimate a consumption rate.',
    };
  }

  const rates = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapDays = (sorted[i + 1].purchaseDate - sorted[i].purchaseDate) / 86_400_000;
    if (gapDays > 0) {
      rates.push(sorted[i].unitsPurchased / gapDays);
    }
  }
  const avgDailyRate = rates.reduce((a, b) => a + b, 0) / rates.length;

  const latest = sorted[sorted.length - 1];
  const daysSinceLatest = (now - latest.purchaseDate) / 86_400_000;
  const unitsConsumedEstimate = avgDailyRate * daysSinceLatest;
  const unitsRemainingEstimate = Math.max(latest.unitsPurchased - unitsConsumedEstimate, 0);
  const daysRemaining = avgDailyRate > 0 ? +(unitsRemainingEstimate / avgDailyRate).toFixed(1) : null;

  return {
    dailyRateEstimate: +avgDailyRate.toFixed(2),
    daysRemaining,
    note: 'Estimate assumes prior purchases were roughly exhausted before the next one — not a metered reading.',
  };
}

module.exports = { computeUptime, computeStandardWindows, estimateDaysRemaining };
