import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { logger } from './utils/logger';
import authRouter from './routes/auth';
import studentsRouter from './routes/students';
import teachersRouter from './routes/teachers';
import subjectsRouter from './routes/subjects';
import semestersRouter from './routes/semesters';
import enrollmentsRouter from './routes/enrollments';
import marksRouter from './routes/marks';
import resultsRouter from './routes/results';
import analyticsRouter from './routes/analytics';
import reportsRouter from './routes/reports';
import gradingScalesRouter from './routes/gradingScales';
import settingsRouter from './routes/settings';
import usersRouter from './routes/users';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 4000;

// ── Security & parsing ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ── Global rate limiter ─────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ── Stricter limiter for auth ───────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
});

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/users', usersRouter);
app.use('/api/students', studentsRouter);
app.use('/api/teachers', teachersRouter);
app.use('/api/subjects', subjectsRouter);
app.use('/api/semesters', semestersRouter);
app.use('/api/enrollments', enrollmentsRouter);
app.use('/api/marks', marksRouter);
app.use('/api/results', resultsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/grading-scales', gradingScalesRouter);
app.use('/api/settings', settingsRouter);

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 & Error handlers ────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`SGES2 API running on http://localhost:${PORT}`);
});

export default app;
