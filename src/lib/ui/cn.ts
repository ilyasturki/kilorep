import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Compose class strings so a caller-supplied `class` actually wins.
 *
 * Tailwind resolves conflicts by stylesheet order, not by order in the class
 * attribute — so appending `px-6` to a component's own `px-4` is a coin flip.
 * `twMerge` drops the loser instead of leaving both in.
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
