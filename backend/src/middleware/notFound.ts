import { Request, Response, NextFunction } from 'express';

export function notFound(req: Request, res: Response, _next: NextFunction) {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found.`,
    code: 'NOT_FOUND',
  });
}
