/**
 * simulate.js
 *
 * Stands in for the real device. Generates a plausible pattern of
 * power ON/OFF transitions over a period and POSTs them to the API,
 * exactly as the real ESP32 + GSM firmware will once it exists.
 *
 * This is what lets you build and demo the entire dashboard/bot layer
 * before a single wire is soldered — and later, if the real device's
 * behavior looks wrong, you can compare it against this known-good
 * simulated pattern to tell whether the bug is in the firmware or the
 * backend.
 *
 * Usage:
 *   node src/simulator/simulate.js --deviceId=<id> --days=7 [--post]
 *
 * Without --post, it just prints the generated events (dry run).
 * With --post, it sends them to http://localhost:3000/events in order.
 */

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  acc[key] = value ?? true;
  return acc;
}, {});

const deviceId = args.deviceId || 'demo-device-001';
const days = Number(args.days) || 7;
const shouldPost = Boolean(args.post);
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

/**
 * Generates a realistic-ish Lagos power pattern: power mostly ON,
 * with 1-3 outage windows per day of varying length, biased toward
 * evening hours (a common real-world pattern, not guaranteed).
 */
function generateEvents(startDate, numDays) {
  const events = [];
  let cursor = new Date(startDate);
  let currentStatus = 'ON';
  events.push({ status: currentStatus, timestamp: new Date(cursor) });

  for (let day = 0; day < numDays; day++) {
    const outagesToday = 1 + Math.floor(Math.random() * 3); // 1-3 outages
    for (let i = 0; i < outagesToday; i++) {
      // Random hour, biased toward evening (17:00-23:00)
      const biasedHour = Math.random() < 0.6
        ? 17 + Math.floor(Math.random() * 6)
        : Math.floor(Math.random() * 24);
      const outageStart = new Date(startDate);
      outageStart.setDate(outageStart.getDate() + day);
      outageStart.setHours(biasedHour, Math.floor(Math.random() * 60), 0, 0);

      if (outageStart <= cursor) continue; // keep timeline monotonic

      const outageDurationHours = 1 + Math.random() * 4; // 1-5 hours
      const outageEnd = new Date(outageStart.getTime() + outageDurationHours * 3_600_000);

      events.push({ status: 'OFF', timestamp: outageStart });
      events.push({ status: 'ON', timestamp: outageEnd });
      cursor = outageEnd;
    }
  }

  return events;
}

async function main() {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const events = generateEvents(startDate, days);

  console.log(`Generated ${events.length} events for device "${deviceId}" over ${days} days.\n`);

  if (!shouldPost) {
    events.forEach((e) => console.log(`${e.timestamp.toISOString()}  ${e.status}`));
    console.log('\nDry run only. Re-run with --post to send these to the API.');
    return;
  }

  console.log(`Posting to ${API_BASE}/events ...\n`);
  for (const e of events) {
    try {
      const res = await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, status: e.status, timestamp: e.timestamp.toISOString() }),
      });
      if (!res.ok) {
        console.error(`Failed to post event at ${e.timestamp.toISOString()}: ${res.status}`);
      }
    } catch (err) {
      console.error(`Request failed (is the server running?): ${err.message}`);
      process.exit(1);
    }
  }
  console.log('Done. All simulated events posted.');
}

main();
