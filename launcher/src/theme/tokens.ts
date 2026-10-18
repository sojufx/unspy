// Design tokens: the single source of truth for colour, spacing, type and motion.
// `applyTokens()` exposes them as CSS custom properties so the stylesheet and the
// components read the same values.

export const COLOR = {
	bg: '#05050A',
	textPrimary: '#F4F4F6',
	textSecondary: '#A8A8B3',
	textMuted: '#63636F',
	tileBg: 'rgba(255, 255, 255, 0.06)',
	tileBgFocus: 'rgba(255, 255, 255, 0.12)',
	tileBorder: 'rgba(255, 255, 255, 0.10)',
	tileBorderFocus: 'rgba(255, 255, 255, 0.88)',
	badge: '#F4F4F6',
	badgeText: '#05050A',
	liftShadow: 'rgba(0, 0, 0, 0.85)',
	buttonBorder: 'rgba(255, 255, 255, 0.22)',
	buttonActiveBg: '#F4F4F6',
	buttonActiveText: '#05050A',
	switchTrack: 'rgba(255, 255, 255, 0.18)',
	switchTrackOn: '#F4F4F6',
	switchKnob: '#8E8E99',
	switchKnobOn: '#05050A',
	danger: '#FF6B63'
} as const;

export const FONT = {
	family: '"Inter Variable", "LG Smart UI", "Helvetica Neue", Arial, sans-serif',
	greeting: 30,
	clock: 21,
	clockTime: 52,
	clockPeriod: 22,
	rowLabel: 16,
	tileLabel: 18,
	settingsTitle: 44,
	settingsTab: 24,
	settingsButton: 20,
	optionLabel: 24,
	optionDescription: 19,
	toast: 22
} as const;

export const LAYOUT = {
	screenWidth: 1920,
	screenHeight: 1080,
	edgePadding: 110,       // side margin for the header and every row
	headerTop: 58,
	rowsTop: 194,           // rows start here, below the greeting and clock
	tileSize: 168,          // app / source tiles are square
	tileGap: 28,
	tileRadius: 38,
	rowLabelGap: 22,        // gap between a row's subheader and its tiles
	rowGap: 26,             // vertical space between rows
	gridColumns: 8          // settings picker grid
} as const;

export const MOTION = {
	focusMs: 180,
	scrollMs: 320,
	focusScale: 1.14,
	liftScale: 1.2,         // a tile picked up in re-order mode
	unfocusedRowOpacity: 0.88
} as const;

/** Writes every token onto :root as --color-*, --font-*, --layout-*, --motion-*. */
export function applyTokens (root: HTMLElement = document.documentElement): void {
	const groups: Record<string, Record<string, string | number>> = {color: COLOR, font: FONT, layout: LAYOUT, motion: MOTION};
	for (const group in groups) {
		const values = groups[group];
		for (const key in values) {
			const value = values[key];
			const unit = typeof value === 'number' && !/scale|opacity|columns/i.test(key) ? (key.endsWith('Ms') ? 'ms' : 'px') : '';
			root.style.setProperty(`--${group}-${kebab(key)}`, `${value}${unit}`);
		}
	}
}

function kebab (s: string): string {
	return s.replace(/([A-Z])/g, '-$1').toLowerCase();
}
