// src/middleware/error.middleware.ts
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export function errorMiddleware(
	err: Error,
	_req: Request,
	res: Response,
	_next: NextFunction,
) {
	const statusCode = err instanceof AppError ? err.statusCode : 500;

	res.status(statusCode).json({
		error: err.message || 'Internal server error',
	});
}
