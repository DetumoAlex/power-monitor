const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { estimateDaysRemaining } = require('../services/aggregation');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /tokens
 * Manual entry for now (OCR-from-receipt is a later phase, not v1).
 * Body: { deviceId, unitsPurchased, amountPaid, purchaseDate }
 */
router.post('/tokens', async (req, res) => {
  const { deviceId, unitsPurchased, amountPaid, purchaseDate } = req.body;

  if (!deviceId || !unitsPurchased || !purchaseDate) {
    return res.status(400).json({
      error: 'deviceId, unitsPurchased, and purchaseDate are required',
    });
  }

  try {
    const entry = await prisma.tokenEntry.create({
      data: {
        deviceId,
        unitsPurchased: Number(unitsPurchased),
        amountPaid: Number(amountPaid) || 0,
        purchaseDate: new Date(purchaseDate),
      },
    });
    return res.status(201).json(entry);
  } catch (err) {
    console.error('Failed to save token entry:', err.message);
    return res.status(500).json({ error: 'Could not save token entry' });
  }
});

/**
 * GET /tokens/:deviceId/estimate
 * Returns the current days-remaining estimate based on purchase history.
 * See aggregation.js for the documented assumption behind this estimate —
 * it is explicitly a rough estimate, not a metered reading, and the
 * response says so rather than presenting it as more precise than it is.
 */
router.get('/tokens/:deviceId/estimate', async (req, res) => {
  const { deviceId } = req.params;

  try {
    const entries = await prisma.tokenEntry.findMany({
      where: { deviceId },
      orderBy: { purchaseDate: 'asc' },
    });

    const result = estimateDaysRemaining(entries);
    return res.json({ deviceId, ...result });
  } catch (err) {
    console.error('Failed to compute token estimate:', err.message);
    return res.status(500).json({ error: 'Could not compute estimate' });
  }
});

module.exports = router;
