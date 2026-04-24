// web/lib/api/error.ts
import { NextResponse } from 'next/server';

export class AppError extends Error {
	status: number;
	code: string;
	details?: unknown;

	constructor(
		status: number,
		code: string,
		message: string,
		details?: unknown,
	) {
		super(message);
		this.name = 'AppError';
		this.status = status;
		this.code = code;
		this.details = details;
	}
}



export function asyncHandler(handler: (req: Request) => Promise<NextResponse>) {
	return async (req: Request): Promise<NextResponse> => {
		try {
			return await handler(req);
		} catch (error) {
			if (error instanceof AppError) {
				return NextResponse.json(
					{
						ok: false,
						code: error.code,
						message: error.message,
						details: error.details,
					},
					{ status: error.status },
				);
			}

			return NextResponse.json(
				{ ok: false, code: 'internal_error', message: 'Something went wrong.' },
				{ status: 500 },
			);
		}
	};
}