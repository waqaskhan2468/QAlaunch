'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function AdminLoginForm() {
	const router = useRouter();
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (submitting) return;

		setSubmitting(true);
		setError(null);

		try {
			const res = await fetch('/api/admin/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password }),
			});
			const data = (await res.json()) as { ok?: boolean; error?: string };

			if (!res.ok || !data.ok) {
				setError(data.error ?? 'Sign in failed. Please try again.');
				setSubmitting(false);
				return;
			}

			// Full refresh so the server component re-reads the new session cookie.
			router.replace('/admin');
			router.refresh();
		} catch {
			setError('Network error. Please try again.');
			setSubmitting(false);
		}
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="rounded-none border-2 border-white/15 bg-white p-6">
			<label
				htmlFor="admin-username"
				className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-body">
				Username
			</label>
			<input
				id="admin-username"
				name="username"
				autoComplete="username"
				value={username}
				onChange={(e) => setUsername(e.target.value)}
				required
				className="mb-4 h-11 w-full rounded-none border-2 border-slate-deep bg-white px-3 text-sm text-ink outline-none focus:border-accent-bright"
			/>

			<label
				htmlFor="admin-password"
				className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-body">
				Password
			</label>
			<input
				id="admin-password"
				name="password"
				type="password"
				autoComplete="current-password"
				value={password}
				onChange={(e) => setPassword(e.target.value)}
				required
				className="mb-5 h-11 w-full rounded-none border-2 border-slate-deep bg-white px-3 text-sm text-ink outline-none focus:border-accent-bright"
			/>

			{error && (
				<p
					role="alert"
					className="mb-4 border-l-4 border-danger bg-danger-pale px-3 py-2 text-[13px] font-semibold text-danger">
					{error}
				</p>
			)}

			<button
				type="submit"
				disabled={submitting}
				className="h-11 w-full rounded-none bg-accent-bright text-sm font-extrabold text-white transition-colors hover:bg-accent-emerald disabled:opacity-60">
				{submitting ? 'Signing in…' : 'Sign in'}
			</button>
		</form>
	);
}
