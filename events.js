const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { computeStandardWindows } = require('../services/aggregation');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /events
 * Called by the device (or the simulator standing in for it) whenever
 * a transition is detected. Body: { deviceId, status: 'ON'|'OFF', timestamp }
 *
 * Deliberately trusts the device's own timestamp rather than server
 * receipt time — GSM devices can queue events during connectivity gaps
 * and flush them late, and the actual moment of the transition matters
 * more than when the server happened to hear about it.
 */
router.post('/events', async (req, res) => {
  const { deviceId, status, timestamp } = req.body;

  if (!deviceId || !['ON', 'OFF'].includes(status) || !timestamp) {
    return res.status(400).json({
      error: 'deviceId, status ("ON" or "OFF"), and timestamp are required',
    });
  }

  try {
    const event = await prisma.powerEvent.create({
      data: { deviceId, status, timestamp: new Date(timestamp) },
    });
    return res.status(201).json(event);
  } catch (err) {
    console.error('Failed to save power event:', err.message);
    return res.status(500).json({ error: 'Could not save event' });
  }
});

/**
 * GET /events/:deviceId/stats
 * Returns today / this week / this month uptime, derived from the raw
 * event log. No pre-computed aggregates stored — always derived fresh,
 * so there's a single source of truth (the event log) to reason about.
 */
router.get('/events/:deviceId/stats', async (req, res) => {
  const { deviceId } = req.params;

  try {
    const events = await prisma.powerEvent.findMany({
      where: { deviceId },
      orderBy: { timestamp: 'asc' },
    });

    if (events.length === 0) {
      return res.status(404).json({ error: 'No events found for this device yet' });
    }

    const stats = computeStandardWindows(events);
    return res.json({ deviceId, ...stats });
  } catch (err) {
    console.error('Failed to compute stats:', err.message);
    return res.status(500).json({ error: 'Could not compute stats' });
  }
});

/**
 * GET /events/:deviceId/current
 * Quick "is there light right now" check — just the latest event's status.
 */
router.get('/events/:deviceId/current', async (req, res) => {
  const { deviceId } = req.params;

  try {
    const latest = await prisma.powerEvent.findFirst({
      where: { deviceId },
      orderBy: { timestamp: 'desc' },
    });

    if (!latest) {
      return res.status(404).json({ error: 'No events found for this device yet' });
    }

    return res.json({ deviceId, status: latest.status, asOf: latest.timestamp });
  } catch (err) {
    console.error('Failed to fetch current status:', err.message);
    return res.status(500).json({ error: 'Could not fetch current status' });
  }
});

module.exports = router;
