'use client';

import {
	motion,
	type HTMLMotionProps,
	type Variants,
	useReducedMotion,
} from 'motion/react';

import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Shared variants                                                   */
/* ------------------------------------------------------------------ */

export const fadeUp: Variants = {
	hidden: { opacity: 0, y: 40 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
	},
};

export const fadeUpSoft: Variants = {
	hidden: { opacity: 0, y: 20 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
	},
};

/**
 * Slides in from the left — used by the pricing grid for a clear
 * left-to-right cascade.
 */
export const slideInLeft: Variants = {
	hidden: { opacity: 0, x: -60 },
	visible: {
		opacity: 1,
		x: 0,
		transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
	},
};

/**
 * Alternates entry direction based on a `custom` index. Even indices slide
 * in from the left, odd from the right — creates a zig-zag wave on grids.
 */
export const slideAlternate: Variants = {
	hidden: (i: number = 0) => ({
		opacity: 0,
		x: i % 2 === 0 ? -80 : 80,
		y: 20,
	}),
	visible: {
		opacity: 1,
		x: 0,
		y: 0,
		transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
	},
};

/**
 * Fan-out: middle column rises straight up, edge columns sweep in from
 * their respective outer edges. Pass index relative to grid width.
 *
 *   custom = { i, total }
 */
export const fanOut: Variants = {
	hidden: ({ i, total }: { i: number; total: number }) => {
		const mid = (total - 1) / 2;
		const offset = (i - mid) * 80;
		return { opacity: 0, x: offset, y: 30, scale: 0.95 };
	},
	visible: {
		opacity: 1,
		x: 0,
		y: 0,
		scale: 1,
		transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] },
	},
};

/**
 * Subtle pop entrance — scale + rotate from a neutral resting state.
 */
export const popIn: Variants = {
	hidden: { opacity: 0, scale: 0.85, rotate: -2 },
	visible: {
		opacity: 1,
		scale: 1,
		rotate: 0,
		transition: {
			type: 'spring',
			bounce: 0.32,
			duration: 0.75,
		},
	},
};

export const stagger = (
	delayChildren = 0,
	staggerChildren = 0.12,
): Variants => ({
	hidden: {},
	visible: {
		transition: { delayChildren, staggerChildren },
	},
});

/* ------------------------------------------------------------------ */
/*  Reveal wrapper (scroll-triggered or immediate)                     */
/* ------------------------------------------------------------------ */

type RevealProps = HTMLMotionProps<'div'> & {
	variants?: Variants;
	delay?: number;
	onView?: boolean;
	as?: 'div' | 'section' | 'article' | 'header';
};

export function Reveal({
	variants = fadeUp,
	delay = 0,
	onView = true,
	className,
	children,
	...rest
}: RevealProps) {
	const reduceMotion = useReducedMotion();

	// When the user prefers reduced motion, render content immediately in its
	// "visible" state — no transform, no fade. We still use motion.div so the
	// caller's motion-specific props (e.g. layoutId, whileHover) keep working.
	const props =
		reduceMotion ?
			{ initial: 'visible', animate: 'visible' }
		: onView ?
			{
				initial: 'hidden',
				whileInView: 'visible',
				// Trigger when ~15% of the element is in the viewport so users
				// reliably *see* the entrance, even on fast scrolls.
				viewport: { once: true, amount: 0.15 },
			}
		:	{ initial: 'hidden', animate: 'visible' };

	return (
		<motion.div
			variants={variants}
			transition={reduceMotion ? { duration: 0 } : { delay }}
			className={cn(className)}
			{...props}
			{...rest}>
			{children}
		</motion.div>
	);
}
