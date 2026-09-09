'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export type FollowUpTarget = {
	id: string;
	host: string;
	email: string | null;
	totalIssues: number;
	highSeverityCount: number;
	draftSubject: string;
	draftBody: string;
};

/**
 * Compose + send a follow-up for one free scan. The draft arrives pre-filled
 * from the server (personalised with that scan's real findings); everything
 * stays editable because the operator often knows something the data does not.
 */
export function FollowUpComposer({ target }: { target: FollowUpTarget }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [to, setTo] = useState(target.email ?? '');
	const [subject, setSubject] = useState(target.draftSubject);
	const [body, setBody] = useState(target.draftBody);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [sent, setSent] = useState(false);

	async function send() {
		if (sending) return;
		setSending(true);
		setError(null);
		try {
			const res = await fetch('/api/admin/followup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ scanId: target.id, to, subject, body }),
			});
			const data = (await res.json()) as { ok?: boolean; error?: string };
			if (!res.ok || !data.ok) {
				setError(data.error ?? 'Could not send. Try again.');
				setSending(false);
				return;
			}
			setSent(true);
			setSending(false);
			// Refresh so this scan drops out of the pending list.
			router.refresh();
			setTimeout(() => setOpen(false), 1200);
		} catch {
			setError('Network error. Try again.');
			setSending(false);
		}
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="border-2 border-slate-deep bg-white px-2.5 py-1 text-[12px] font-bold text-ink hover:bg-surface-soft">
				Follow up
			</button>

			{open &&
				typeof document !== 'undefined' &&
				createPortal(
					<div
						role="dialog"
						aria-modal="true"
						aria-label={`Follow up with ${target.host}`}
						className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 sm:p-8"
						onClick={() => !sending && setOpen(false)}>
						<div
							onClick={(e) => e.stopPropagation()}
							className="w-full max-w-2xl border-2 border-slate-deep bg-white">
							<div className="flex items-center justify-between border-b-2 border-slate-deep bg-surface-soft px-5 py-3">
								<div>
									<div className="font-heading text-[15px] font-extrabold text-ink">
										Follow up — {target.host}
									</div>
									<div className="text-[12px] text-body">
										{target.totalIssues} issues found · {target.highSeverityCount}{' '}
										critical or high
									</div>
								</div>
								<button
									type="button"
									onClick={() => setOpen(false)}
									aria-label="Close"
									className="text-muted-ink hover:text-ink">
									<X className="size-5" />
								</button>
							</div>

							<div className="p-5">
								<label
									htmlFor={`to-${target.id}`}
									className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-body">
									To {!target.email && '(not captured — add it manually)'}
								</label>
								<input
									id={`to-${target.id}`}
									type="email"
									value={to}
									onChange={(e) => setTo(e.target.value)}
									placeholder="name@theirsite.com"
									className="mb-4 h-10 w-full rounded-none border-2 border-slate-deep bg-white px-3 text-sm text-ink outline-none focus:border-accent-bright"
								/>

								<label
									htmlFor={`subject-${target.id}`}
									className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-body">
									Subject
								</label>
								<input
									id={`subject-${target.id}`}
									value={subject}
									onChange={(e) => setSubject(e.target.value)}
									className="mb-4 h-10 w-full rounded-none border-2 border-slate-deep bg-white px-3 text-sm text-ink outline-none focus:border-accent-bright"
								/>

								<label
									htmlFor={`body-${target.id}`}
									className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-body">
									Message
								</label>
								<textarea
									id={`body-${target.id}`}
									value={body}
									onChange={(e) => setBody(e.target.value)}
									rows={18}
									className="mb-4 w-full rounded-none border-2 border-slate-deep bg-white p-3 font-mono text-[12.5px] leading-relaxed text-ink outline-none focus:border-accent-bright"
								/>

								{error && (
									<p
										role="alert"
										className="mb-3 border-l-4 border-danger bg-danger-pale px-3 py-2 text-[13px] font-semibold text-danger">
										{error}
									</p>
								)}
								{sent && (
									<p className="mb-3 border-l-4 border-accent-emerald bg-accent-pale px-3 py-2 text-[13px] font-semibold text-accent-emerald">
										Sent. Replies go to contact@getqalaunch.com.
									</p>
								)}

								<div className="flex items-center gap-3">
									<button
										type="button"
										onClick={send}
										disabled={sending || sent || !to.trim()}
										className="h-10 rounded-none bg-accent-bright px-5 text-sm font-extrabold text-white transition-colors hover:bg-accent-emerald disabled:opacity-50">
										{sending ? 'Sending…' : sent ? 'Sent' : 'Send email'}
									</button>
									<button
										type="button"
										onClick={() => setOpen(false)}
										disabled={sending}
										className="h-10 border-2 border-slate-deep bg-white px-4 text-sm font-bold text-ink hover:bg-surface-soft disabled:opacity-50">
										Cancel
									</button>
									<span className="text-[12px] text-muted-ink">
										From contact@getqalaunch.com · one send per scan
									</span>
								</div>
							</div>
						</div>
					</div>,
					document.body,
				)}
		</>
	);
}
