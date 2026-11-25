import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }

  // Prisma unique constraint
  if ((err as any).code === 'P2002') {
    const field = (err as any).meta?.target?.[0] ?? 'field';
    return res.status(409).json({
      success: false,
      error: `A record with this ${field} already exists.`,
      code: 'DUPLICATE',
    });
  }

  // Prisma record not found
  if ((err as any).code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: 'Record not found.',
      code: 'NOT_FOUND',
    });
  }

  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'An unexpected error occurred. Please try again.',
    code: 'INTERNAL',
  });
}
