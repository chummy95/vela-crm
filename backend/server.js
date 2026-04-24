require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB, getDB } = require('./config/database');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const projectRoutes = require('./routes/projects');
const invoiceRoutes = require('./routes/invoices');
const proposalRoutes = require('./routes/proposals');
const contractRoutes = require('./routes/contracts');
const eventRoutes = require('./routes/events');
const formRoutes = require('./routes/forms');
const analyticsRoutes = require('./routes/analytics');
const messageRoutes = require('./routes/messages');

const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

function attachPublicStudio(req, res, next) {
  try {
    const user = getDB().prepare('SELECT id FROM users WHERE id = ?').get(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Studio not found' });
    req.publicUserId = user.id;
    next();
  } catch (error) {
    next(error);
  }
}

// Middleware
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.use(express.json());

// Public routes
app.use('/api/auth', authRoutes);
app.get('/api/forms/public/:userId/fields', attachPublicStudio, (req, res, next) => {
  req.url = '/fields';
  formRoutes(req, res, next);
});
app.post('/api/forms/public/:userId/submit', attachPublicStudio, (req, res, next) => {
  req.url = '/submit';
  formRoutes(req, res, next);
});

// Protected routes
app.use('/api/clients', authMiddleware, clientRoutes);
app.use('/api/projects', authMiddleware, projectRoutes);
app.use('/api/invoices', authMiddleware, invoiceRoutes);
app.use('/api/proposals', authMiddleware, proposalRoutes);
app.use('/api/contracts', authMiddleware, contractRoutes);
app.use('/api/events', authMiddleware, eventRoutes);
app.use('/api/forms', authMiddleware, formRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

app.use(errorHandler);

initDB();
app.listen(PORT, () => console.log(`Vela API running on http://localhost:${PORT}`));
