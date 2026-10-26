import { Check, Minus } from 'lucide-react';

import { formatPackagePrice } from '@/components/pricing/pricing-plans';

/**
 * Free preview vs full report, side by side.
 *
 * Every row states something the report really does. "Screenshot evidence"
 * is qualified because the scanner cannot pinpoint every issue (a missing
 * security header has nothing to photograph), and "pages" reflects the tier
 * actually being compared. Shared by the result page and /pricing.
 */
export function FreeVsPaidTable({
	lockedCount,
	totalCount,
	className,
}: {
	/** When known, the real locked count for this scan is written into the rows. */
	lockedCount?: number;
	totalCount?: number;
	className?: string;
}) {
	const issuesFree = totalCount != null ? `3 of ${totalCount}` : '3 issues';
	const issuesPaid =
		totalCount != null ? `All ${totalCount}` : 'Every issue found';
	const rows: Array<{ label: string; free: string | boolean; paid: string | boolean }> = [
		{ label: 'Issues shown', free: issuesFree, paid: issuesPaid },
		{ label: 'What is wrong and why it matters', free: true, paid: true },
		{ label: 'Where on the page it is', free: false, paid: true },
		{
			label: 'Screenshot evidence',
			free: 'On the 3 shown',
			paid: 'Wherever the scanner could pinpoint the element',
		},
		{ label: 'How to fix it, written for your developer', free: false, paid: true },
		{ label: 'Google PageSpeed performance results', free: false, paid: true },
		{ label: 'PDF to send to your developer, plus a web link', free: false, paid: true },
		{
			label: 'Pages tested',
			free: 'Homepage, above the fold',
			paid: 'Homepage in full · up to 5 or 10 pages on larger plans',
		},
	];

	const cell = (value: string | boolean, paid: boolean) =>
		typeof value === 'boolean' ?
			value ?
				<Check className='mx-auto size-4 text-accent-emerald' strokeWidth={3} aria-label='Included' />
			:	<Minus className='mx-auto size-4 text-muted-ink/60' strokeWidth={2.5} aria-label='Not included' />
		:	<span className={paid ? 'font-semibold text-ink' : 'text-body'}>{value}</span>;

	return (
		<div className={className}>
			<div className='mb-3 font-mono text-[10.5px] font-bold uppercase tracking-[1.5px] text-muted-ink'>
				Free preview vs full report
			</div>
			<div className='overflow-hidden rounded-xl border border-border-soft bg-white'>
				<table className='w-full text-[12.5px]'>
					<thead className='bg-surface-soft text-[10.5px] font-bold uppercase tracking-wide text-muted-ink'>
						<tr>
							<th className='px-4 py-2.5 text-left font-bold'>What you get</th>
							<th className='px-3 py-2.5 text-center font-bold'>Free preview</th>
							<th className='px-3 py-2.5 text-center font-bold text-brand'>
								Full report · from {formatPackagePrice('basic')}
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.label} className='border-t border-border-soft'>
								<td className='px-4 py-2.5 text-ink'>{row.label}</td>
								<td className='px-3 py-2.5 text-center'>{cell(row.free, false)}</td>
								<td className='px-3 py-2.5 text-center'>{cell(row.paid, true)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{lockedCount != null && lockedCount > 0 ? (
				<p className='mt-2 text-[12px] text-muted-ink'>
					{lockedCount} of your issues are locked above; all of them are in the full report.
				</p>
			) : null}
		</div>
	);
}
