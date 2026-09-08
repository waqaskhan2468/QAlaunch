import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { ADMIN_COOKIE_NAME, verifySessionToken } from '@/lib/admin/auth';
import { AdminLoginForm } from '@/components/admin/admin-login-form';

export const metadata: Metadata = {
	title: 'Admin sign in',
	robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
	const cookieStore = await cookies();
	if (verifySessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
		redirect('/admin');
	}

	return (
		<main className="flex min-h-screen items-center justify-center bg-slate-deep px-5 py-16">
			<div className="w-full max-w-sm">
				<div className="mb-6 text-center">
					<div className="font-heading text-2xl font-black tracking-tight text-white">
						QAlaunch
					</div>
					<p className="mt-1 text-sm text-white/50">Analytics dashboard</p>
				</div>
				<AdminLoginForm />
			</div>
		</main>
	);
}
