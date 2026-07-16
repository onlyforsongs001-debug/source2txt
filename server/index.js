require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const transcribeRoute = require('./routes/transcribe');
const extractZipRoute = require('./routes/extract-zip');
const creditsRoute = require('./routes/credits');
const supportRoute = require('./routes/support');
const summarizeRoute = require('./routes/summarize');
const saveTextRoute = require('./routes/save-text');
const exportTextRoute = require('./routes/export-text');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'https://source2txt.vercel.app'],
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.use('/api/transcribe', transcribeRoute);
app.use('/api/extract-zip', extractZipRoute);
app.use('/api/credits', creditsRoute);
app.use('/api/support', supportRoute);
app.use('/api/summarize', summarizeRoute);
app.use('/api/save-text', saveTextRoute);
app.use('/api/export', exportTextRoute);

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});
