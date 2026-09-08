'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AdminLogoutButton() {
	const router = useRouter();
	const [busy, setBusy] = useState(false);

	async function logout() {
		if (busy) return;
		setBusy(true);
		try {
			await fetch('/api/admin/login', { method: 'DELETE' });
		} catch {
			// Ignore — the redirect below still moves the operator off the dashboard.
		}
		router.replace('/admin/login');
		router.refresh();
	}

	return (
		<button
			type="button"
			onClick={logout}
			disabled={busy}
			className="border-2 border-slate-deep bg-white px-3 py-1.5 text-[12.5px] font-bold text-ink hover:bg-surface-soft disabled:opacity-60">
			{busy ? 'Signing out…' : 'Sign out'}
		</button>
	);
}
