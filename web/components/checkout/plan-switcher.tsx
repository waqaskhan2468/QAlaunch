'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';
import { plans, type CheckoutPackageSlug } from '@/components/pricing/pricing-plans';

/**
 * Lets someone see and change what they are buying, on the checkout page.
 *
 * The one customer who did pay wrote afterwards: "I didn't pay much attention
 * to the plans. I suppose I was expecting a full website report." He arrived
 * from a link that preselected the cheapest tier, and the checkout showed that
 * single plan under the heading "Your plan" with no indication the others
 * existed. He paid for a homepage report expecting a whole-site one.
 *
 * That is a disclosure problem, not a pricing one. Three options, visible,
 * with the current one clearly marked, means nobody buys the wrong thing by
 * not scrolling. It also puts the larger tiers in front of a buyer at the one
 * moment they have their card out.
 *
 * Rendered as links rather than radio inputs so the package stays in the URL:
 * a refresh, a back button or a shared link all keep working.
 */
export function PlanSwitcher({
	current,
	prefillUrl,
}: {
	current: CheckoutPackageSlug | undefined;
	prefillUrl: string;
}) {
	const options = plans.filter(
		(p): p is typeof p & { checkoutPackage: CheckoutPackageSlug } =>
			p.checkoutPackage != null,
	);

	const hrefFor = (slug: CheckoutPackageSlug) =>
		`/checkout?package=${slug}${prefillUrl ? `&url=${encodeURIComponent(prefillUrl)}` : ''}`;

	return (
		<div className='mb-6'>
			<div className='mb-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-ink'>
				What would you like tested?
			</div>

			<div className='flex flex-col gap-2' role='radiogroup' aria-label='Choose what to test'>
				{options.map((p) => {
					const selected = p.checkoutPackage === current;
					return (
						<Link
							key={p.checkoutPackage}
							href={hrefFor(p.checkoutPackage)}
							role='radio'
							aria-checked={selected}
							scroll={false}
							className={cn(
								'flex items-center gap-3 rounded-xl border-2 bg-white px-4 py-3 transition',
								'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
								selected ?
									'border-brand shadow-sm'
								:	'border-border-soft hover:border-brand/40',
							)}>
							<span
								aria-hidden='true'
								className={cn(
									'flex size-[18px] shrink-0 items-center justify-center rounded-full border-2',
									selected ? 'border-brand' : 'border-border-soft',
								)}>
								{selected ? <span className='size-2.5 rounded-full bg-brand' /> : null}
							</span>

							<span className='min-w-0 flex-1'>
								<span className='block text-[14.5px] font-bold text-ink'>{p.tier}</span>
								<span className='block text-[12.5px] text-muted-ink'>{p.pages}</span>
							</span>

							{p.popular ? (
								<span className='hidden shrink-0 rounded-full bg-brand-pale px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-brand sm:inline'>
									Most popular
								</span>
							) : null}

							<span className='shrink-0 font-heading text-lg font-black text-ink'>
								{p.priceSymbol}
								{p.price}
							</span>
						</Link>
					);
				})}
			</div>

			<p className='mt-2.5 text-[12px] leading-relaxed text-muted-ink'>
				One-time payment, no subscription. Testing more than 10 pages?{' '}
				<Link href='/contact' className='font-semibold text-brand hover:underline'>
					Ask for a quote
				</Link>
				.
			</p>
		</div>
	);
}
