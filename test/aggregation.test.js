const assert = require('assert');
const { computeUptime, estimateDaysRemaining } = require('../src/services/aggregation');

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err.message);
    process.exitCode = 1;
  }
}

test('12 hours ON out of a 24h window = 50% uptime', () => {
  const dayStart = new Date('2026-07-22T00:00:00Z');
  const dayEnd = new Date('2026-07-23T00:00:00Z');
  const events = [
    { status: 'ON', timestamp: new Date('2026-07-22T00:00:00Z') },
    { status: 'OFF', timestamp: new Date('2026-07-22T06:00:00Z') }, // 6h ON
    { status: 'ON', timestamp: new Date('2026-07-22T12:00:00Z') },
    { status: 'OFF', timestamp: new Date('2026-07-22T18:00:00Z') }, // 6h ON
  ];
  const result = computeUptime(events, dayStart, dayEnd);
  assert.strictEqual(result.onHours, 12);
  assert.strictEqual(result.uptimePercent, 50);
});

test('no events in window carries forward last known status (OFF all day)', () => {
  const dayStart = new Date('2026-07-22T00:00:00Z');
  const dayEnd = new Date('2026-07-23T00:00:00Z');
  const events = [
    { status: 'OFF', timestamp: new Date('2026-07-20T00:00:00Z') }, // before window
  ];
  const result = computeUptime(events, dayStart, dayEnd);
  assert.strictEqual(result.onHours, 0);
  assert.strictEqual(result.uptimePercent, 0);
});

test('currently ON with no OFF event yet counts ON until window end', () => {
  const dayStart = new Date('2026-07-22T00:00:00Z');
  const dayEnd = new Date('2026-07-22T06:00:00Z');
  const events = [{ status: 'ON', timestamp: new Date('2026-07-22T00:00:00Z') }];
  const result = computeUptime(events, dayStart, dayEnd);
  assert.strictEqual(result.onHours, 6);
  assert.strictEqual(result.uptimePercent, 100);
});

test('duplicate consecutive statuses (heartbeats) do not distort duration', () => {
  const dayStart = new Date('2026-07-22T00:00:00Z');
  const dayEnd = new Date('2026-07-22T10:00:00Z');
  const events = [
    { status: 'ON', timestamp: new Date('2026-07-22T00:00:00Z') },
    { status: 'ON', timestamp: new Date('2026-07-22T02:00:00Z') }, // heartbeat, same status
    { status: 'ON', timestamp: new Date('2026-07-22T04:00:00Z') }, // heartbeat, same status
    { status: 'OFF', timestamp: new Date('2026-07-22T10:00:00Z') },
  ];
  const result = computeUptime(events, dayStart, dayEnd);
  assert.strictEqual(result.onHours, 10);
});

test('token depletion estimate: consistent usage produces sane days-remaining', () => {
  // Bought 20 units, then 20 units again 10 days later => ~2 units/day.
  // Bought a 3rd time (30 units) 5 days after that.
  const entries = [
    { unitsPurchased: 20, purchaseDate: new Date('2026-07-01T00:00:00Z') },
    { unitsPurchased: 20, purchaseDate: new Date('2026-07-11T00:00:00Z') }, // 10 days later
    { unitsPurchased: 30, purchaseDate: new Date('2026-07-16T00:00:00Z') }, // 5 days later
  ];
  const now = new Date('2026-07-18T00:00:00Z'); // 2 days after latest purchase
  const result = estimateDaysRemaining(entries, now);
  // avg rate ~= average of (20/10=2) and (20/5=4) = 3 units/day
  assert.strictEqual(result.dailyRateEstimate, 3);
  // 30 units - (3 * 2 days consumed) = 24 remaining -> 24/3 = 8 days
  assert.strictEqual(result.daysRemaining, 8);
});

test('token estimate with <2 purchases returns null gracefully', () => {
  const result = estimateDaysRemaining([{ unitsPurchased: 20, purchaseDate: new Date() }]);
  assert.strictEqual(result.daysRemaining, null);
});

console.log('\nAll aggregation tests complete.');
