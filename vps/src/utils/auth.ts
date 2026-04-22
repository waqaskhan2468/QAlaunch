import { Request, Response, NextFunction } from 'express';

export function verifyToken(req: Request, res: Response, next: NextFunction) {
	const token = req.headers.authorization?.split(' ')[1];

	if (!token || token !== process.env.SCAN_API_TOKEN) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	next();
}
