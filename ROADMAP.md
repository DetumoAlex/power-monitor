# Roadmap — Power/Light Monitor + Token Depletion Predictor

Last updated: 2026-07-22

This is a living status document, not a fixed spec. Update it as decisions
change — a roadmap nobody edits again is worse than no roadmap.

## The actual problem being solved

Two related but distinct household pains:
1. Not knowing whether there's grid power at home right now, or how much
   power you've actually had over a day/week/month, unless you're physically
   there.
2. Not knowing how many prepaid electricity units are left, or when they'll
   run out, until the lights actually cut.

Existing partial solutions and why they're not enough:
- **NEPAWatch Nigeria** — crowd-sourced outage reporting. Good for area-level
  estimates, not precise for one specific household (accuracy depends on
  how many nearby users report).
- **Local power-outage alarm devices (e.g. sold on Jumia)** — accurate for
  one household, but local-only. No remote visibility, no history, no
  analytics.

The gap: **precise, per-household, remote status + historical analytics +
token depletion prediction, combined in one product.** Nobody found doing
all three together.

## Status

| Component                         | Status       |
|------------------------------------|--------------|
| Data model (Prisma/MongoDB schema) | Done         |
| Aggregation logic (uptime calc)    | Done, tested (6/6 tests passing) |
| Token depletion estimate logic     | Done, tested |
| API — events ingestion             | Done         |
| API — stats/current endpoints      | Done         |
| API — token logging/estimate       | Done         |
| Device simulator                   | Done         |
| Prisma client generated & DB tested end-to-end | **Not done** — needs real MongoDB connection string + local/full-internet environment (blocked in sandbox, not a code issue) |
| Dashboard / WhatsApp bot output    | **Not started** |
| Firmware (ESP32 + sensor + GSM)    | **Not started** — hardware phase, see below |
| Physical hardware ordered          | **Not started** |

## Key assumptions made (revisit if wrong)

- **Events are transitions, not periodic samples.** Chosen to conserve
  device battery/data once hardware exists. If real-world testing shows
  the device missing transitions (e.g. it's asleep when power flips), we
  may need to add periodic heartbeats as a supplement — the aggregation
  logic already tolerates duplicate/heartbeat events safely, so this is a
  low-cost addition later, not a redesign.
- **Token depletion estimate assumes prior purchases were roughly
  exhausted before the next purchase.** This is a rough proxy, not a
  metered reading. If it proves inaccurate against real usage, the fix is
  a proper energy meter (measuring actual kWh draw) rather than inferring
  from purchase timing — that's a hardware upgrade, not a software fix,
  so don't over-invest in refining the estimate math until real data says
  it's worth it.
- **"ON" is the default assumed status before any events exist.** Chosen
  because a freshly-installed device with no history is more likely
  mid-uptime than mid-outage. Arbitrary — fine for a v1, revisit if it
  produces confusing first-day stats for users.

## Next steps, in order

### Immediate (software, no hardware needed)
1. Get a free MongoDB Atlas cluster, set `DATABASE_URL`, run
   `npx prisma generate` + `npx prisma db push` on a machine with full
   internet access (not the sandbox this was built in).
2. Run the simulator against the live API end-to-end, confirm stats and
   token estimate endpoints return sane numbers against seeded fake data.
3. Build the dashboard or WhatsApp bot output layer (reuse Amanda's
   existing WhatsApp delivery mechanism rather than building new
   infrastructure).

### Hardware — only after the above is solid and only via the safe path
Do not wire directly into raw mains as a first hardware project (real
electrocution/fire risk for a first-timer). Sequence:

4. **Phase 0** — ESP32 dev board basics, no mains involved: blink LED,
   read a basic sensor, send data to this backend's `/events` endpoint
   over WiFi. Goal: prove device-to-backend flow works.
5. **Phase 1** — Add GSM module (SIM800L) + battery/charging circuit to
   the same board. Goal: prove the device can report independently of
   home WiFi/power.
6. **Phase 2** — Power-presence sensing via a pre-certified smart
   relay/plug (not a self-built raw-mains circuit). Goal: real presence
   signal, safely.
7. **Phase 3** — Full firmware: sensor + GSM + battery working together,
   posting real transition events to `/events`.
8. **Phase 4** — Field test on one real household (yours) for at least
   2-4 weeks before considering a second unit or any sale.

### Explicitly deferred (don't start these yet)
- OCR-based token entry (manual entry is fine for v1)
- Multi-device-per-user support (schema allows it, but no UI/logic needed until it's actually asked for)
- Any consumer-facing payment/subscription system — premature before one working field unit exists

## Open questions to resolve before Phase 4
- Real BOM cost once battery + charging circuit + GSM module + enclosure
  are all priced together (last estimate was rough: ~$8-15, needs
  re-verification with actual Nigerian supplier prices, not global averages)
- Recurring SIM data cost per device, and who pays it (built into pricing?)
- Whether GSM data coverage is reliable enough at the actual test
  location — not assumed, needs to be checked before relying on it
