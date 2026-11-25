import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthenticatedRequest, auditLog } from '../middleware/auth';

const router = Router();

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    });
    const { email, password } = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRY || '8h' }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await auditLog(user.id, 'LOGIN', 'User', user.id, undefined, req.ip);

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, role: true, lastLoginAt: true, createdAt: true },
    });
    if (!user) throw new AppError(404, 'User not found.', 'NOT_FOUND');
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/change-password ───────────────────────────────────────────
router.post('/change-password', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
    });
    const { currentPassword, newPassword } = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new AppError(404, 'User not found.', 'NOT_FOUND');

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) throw new AppError(400, 'Current password is incorrect.', 'WRONG_PASSWORD');

    const hash = await argon2.hash(newPassword);
    await prisma.user.update({ where: { id: req.user!.id }, data: { passwordHash: hash } });

    await auditLog(req.user!.id, 'CHANGE_PASSWORD', 'User', req.user!.id, undefined, req.ip);
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
