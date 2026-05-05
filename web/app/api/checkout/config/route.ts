import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ALLOWED_PACKAGES = ['basic', 'standard', 'premium', 'enterprise'] as const;
type PaidPackage = (typeof ALLOWED_PACKAGES)[number];

const PRICE_ENV_BY_PACKAGE: Record<PaidPackage, string> = {
	basic: 'PADDLE_BASIC_PRICE_ID',
	standard: 'PADDLE_STANDARD_PRICE_ID',
	premium: 'PADDLE_PREMIUM_PRICE_ID',
	enterprise: 'PADDLE_ENTERPRISE_PRICE_ID',
};

export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const pkg = (searchParams.get('package') ?? '').toLowerCase();

	if (!ALLOWED_PACKAGES.includes(pkg as PaidPackage)) {
		return NextResponse.json({ error: 'invalid_package' }, { status: 400 });
	}

	const envKey = PRICE_ENV_BY_PACKAGE[pkg as PaidPackage];
	const priceId = process.env[envKey];
	const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;

	if (!clientToken) {
		return NextResponse.json(
			{ error: 'missing_client_token', message: 'NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is missing.' },
			{ status: 500 },
		);
	}

	if (!priceId) {
		return NextResponse.json(
			{ error: 'missing_price_id', message: `${envKey} is missing.` },
			{ status: 500 },
		);
	}

	return NextResponse.json({
		ok: true,
		clientToken,
		priceId,
		package: pkg,
	});
}
