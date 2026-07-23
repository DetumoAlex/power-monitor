# Power/Light Monitor — Setup

## What this is
Backend for a household power-presence monitor: tracks when there is/isn't
grid power ("light"), computes uptime stats (today/week/month), and
separately tracks prepaid token purchases to estimate days-until-depletion.

Built software-first, hardware-second — see `ROADMAP.md` for why and what's
next. Everything in this repo runs and is testable with **zero hardware**.

## Stack
Node.js, Express, Prisma (MongoDB provider) — matches the Amanda project stack.

## Prerequisites
- Node.js 18+
- A MongoDB connection string (local MongoDB, or a free MongoDB Atlas cluster)

## Setup

```bash
npm install
```

Edit `.env` and set your real connection string:
```
DATABASE_URL="mongodb+srv://<user>:<password>@<cluster>/power-monitor"
```

Generate the Prisma client (requires internet access to download the
Prisma engine binary — this step failed in the sandboxed build
environment but will work locally):
```bash
npx prisma generate
```

Push the schema to your database (MongoDB doesn't use traditional migrations):
```bash
npx prisma db push
```

Start the server:
```bash
node src/index.js
```

## Testing without hardware

Run the aggregation logic unit tests (no server, no DB needed):
```bash
node test/aggregation.test.js
```

Generate fake device events and inspect them (no server needed):
```bash
node src/simulator/simulate.js --deviceId=demo-device-001 --days=7
```

With the server running (`node src/index.js` in another terminal), send
those fake events to the real API:
```bash
node src/simulator/simulate.js --deviceId=demo-device-001 --days=7 --post
```

Then query the stats:
```bash
curl http://localhost:3000/events/demo-device-001/stats
curl http://localhost:3000/events/demo-device-001/current
```

Log a token purchase and get a depletion estimate:
```bash
curl -X POST http://localhost:3000/tokens \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"demo-device-001","unitsPurchased":20,"amountPaid":8000,"purchaseDate":"2026-07-01"}'

curl -X POST http://localhost:3000/tokens \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"demo-device-001","unitsPurchased":20,"amountPaid":8000,"purchaseDate":"2026-07-11"}'

curl http://localhost:3000/tokens/demo-device-001/estimate
```

## API summary

| Method | Route                          | Purpose                                   |
|--------|---------------------------------|--------------------------------------------|
| POST   | `/events`                       | Device reports an ON/OFF transition        |
| GET    | `/events/:deviceId/stats`       | Today / week / month uptime breakdown      |
| GET    | `/events/:deviceId/current`     | Is there light right now                   |
| POST   | `/tokens`                       | Log a prepaid unit purchase                |
| GET    | `/tokens/:deviceId/estimate`    | Days-remaining estimate                    |
