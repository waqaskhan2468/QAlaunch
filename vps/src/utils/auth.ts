import { Request, Response, NextFunction } from 'express';

export function requireBearerToken(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const authHeader = req.headers.authorization;

	// 1) Header required
	if (!authHeader) {
		return res.status(401).json({ error: 'Missing Authorization header' });
	}

	// 2) Must be Bearer token
	// Accepts: "Bearer token", "bearer token", with extra spaces
	const match = authHeader.match(/^Bearer\s+(.+)$/i);
	if (!match) {
		return res.status(401).json({ error: 'Invalid Authorization format' });
	}

	// 3) Load expected token from env
	const expectedToken = (process.env.SCAN_API_TOKEN || '').trim();
	if (!expectedToken) {
		return res.status(500).json({ error: 'SCAN_API_TOKEN not configured' });
	}

	// 4) Normalize incoming token
	const incomingToken = match[1].trim();

	// 5) Compare
	if (incomingToken !== expectedToken) {
		return res.status(403).json({ error: 'Invalid token' });
	}

	next();
}
