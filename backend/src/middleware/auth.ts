import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import { prisma } from '../utils/prisma';
import { Role } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
  };
}

export function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, 'No token provided.', 'UNAUTHORIZED');
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      sub: string;
      email: string;
      role: Role;
    };
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    throw new AppError(401, 'Invalid or expired token.', 'UNAUTHORIZED');
  }
}

export function authorize(...roles: Role[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError(401, 'Not authenticated.', 'UNAUTHORIZED');
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, 'You do not have permission to perform this action.', 'FORBIDDEN');
    }
    next();
  };
}

export async function auditLog(
  userId: string | undefined,
  action: string,
  entity: string,
  entityId?: string,
  meta?: object,
  ip?: string
) {
  await prisma.auditLog.create({
    data: { userId, action, entity, entityId, meta, ip },
  });
}
