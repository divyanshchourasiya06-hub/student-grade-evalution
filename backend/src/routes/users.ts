import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import argon2 from 'argon2';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate, authorize, AuthenticatedRequest, auditLog } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate, authorize(Role.ADMIN));

// ── GET /api/users ────────────────────────────────────────────────────────────
router.get('/', async (_req, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/users ───────────────────────────────────────────────────────────
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      role: z.nativeEnum(Role),
    });
    const { email, password, role } = schema.parse(req.body);
    const hash = await argon2.hash(password);

    const user = await prisma.user.create({
      data: { email, passwordHash: hash, role },
      select: { id: true, email: true, role: true },
    });

    await auditLog(req.user!.id, 'CREATE_USER', 'User', user.id, { email, role }, req.ip);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/users/:id ──────────────────────────────────────────────────────
router.patch('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      role: z.nativeEnum(Role).optional(),
      isActive: z.boolean().optional(),
      password: z.string().min(8).optional(),
    });
    const { role, isActive, password } = schema.parse(req.body);
    const data: any = {};
    if (role !== undefined) data.role = role;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) data.passwordHash = await argon2.hash(password);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, role: true, isActive: true },
    });
    await auditLog(req.user!.id, 'UPDATE_USER', 'User', req.params.id, data, req.ip);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

export default router;
