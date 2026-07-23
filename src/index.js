require('dotenv').config();
const express = require('express');
const eventsRouter = require('./routes/events');
const tokensRouter = require('./routes/tokens');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'power-monitor' });
});

app.use(eventsRouter);
app.use(tokensRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`power-monitor API listening on port ${PORT}`);
});
