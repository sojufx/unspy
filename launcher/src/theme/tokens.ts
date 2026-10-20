// Design tokens: the single source of truth for colour, spacing, type and motion.
// `applyTokens()` exposes them as CSS custom properties so the stylesheet and the
// components read the same values.

export const COLOR = {
	bg: '#0B0B16',
	textPrimary: '#FFFFFF',
	textSecondary: 'rgba(255, 255, 255, 0.72)',
	textMuted: 'rgba(255, 255, 255, 0.52)',

	// Cards: a neutral dark plate with the app's own artwork centred on it. The
	// reference (LG's own 2024 home) uses full-bleed brand art, which we do not
	// have - a sideloaded web app only gets square icons - so the plate stays
	// neutral and the icon carries the brand.
	cardBg: 'rgba(255, 255, 255, 0.05)',
	cardBgFocus: 'rgba(255, 255, 255, 0.085)',
	cardEdge: 'rgba(255, 255, 255, 0.07)',
	ring: 'rgba(255, 255, 255, 0.96)',

	chipBg: 'rgba(255, 255, 255, 0.07)',
	chipBgFocus: 'rgba(255, 255, 255, 0.15)',

	// kept for the settings screen
	tileBg: 'rgba(255, 255, 255, 0.06)',
	tileBgFocus: 'rgba(255, 255, 255, 0.12)',
	tileBorder: 'rgba(255, 255, 255, 0.10)',
	tileBorderFocus: 'rgba(255, 255, 255, 0.88)',
	badge: '#FFFFFF',
	badgeText: '#0B0B16',
	liftShadow: 'rgba(0, 0, 0, 0.85)',
	buttonBorder: 'rgba(255, 255, 255, 0.22)',
	buttonActiveBg: '#FFFFFF',
	buttonActiveText: '#0B0B16',
	switchTrack: 'rgba(255, 255, 255, 0.18)',
	switchTrackOn: '#FFFFFF',
	switchKnob: '#8E8E99',
	switchKnobOn: '#0B0B16',
	danger: '#FF6B63'
} as const;

export const FONT = {
	family: '"Inter Variable", "LG Smart UI", "Helvetica Neue", Arial, sans-serif',
	greeting: 26,
	clock: 21,
	clockTime: 58,
	clockDate: 22,
	clockPeriod: 30,
	rowLabel: 16,
	/** "Inputs & controls" */
	stripLabel: 23,
	/** the label under a home-screen card */
	cardLabel: 24,
	/** the settings picker's square tiles */
	tileLabel: 18,
	chipLabel: 23,
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
	edgePadding: 110,       // side margin for the clock, grid and strip

	clockTop: 52,

	/** The app grid: 5 columns of 16:10-ish cards, two rows on screen at once. */
	gridTop: 200,
	cardWidth: 308,
	cardHeight: 190,
	cardGapX: 40,
	cardGapY: 34,
	cardRadius: 20,
	cardLabelGap: 14,
	gridVisibleRows: 2,

	/** "Inputs & controls" strip along the bottom. */
	stripBottom: 165,
	stripLabelGap: 24,
	chipHeight: 92,
	chipGap: 26,

	// kept: the settings picker still draws square tiles
	headerTop: 58,
	rowsTop: 194,
	tileSize: 168,
	tileGap: 28,
	tileRadius: 38,
	rowLabelGap: 22,
	rowGap: 26,
	gridColumns: 8
} as const;

export const MOTION = {
	focusMs: 160,
	scrollMs: 280,
	focusScale: 1.14,       // settings picker only; home cards do not scale
	liftScale: 1.2,
	unfocusedRowOpacity: 0.88
} as const;

/** Writes every token onto :root as --color-*, --font-*, --layout-*, --motion-*. */
export function applyTokens (root: HTMLElement = document.documentElement): void {
	const groups: Record<string, Record<string, string | number>> = {color: COLOR, font: FONT, layout: LAYOUT, motion: MOTION};
	for (const group in groups) {
		const values = groups[group];
		for (const key in values) {
			const value = values[key];
			const unit = typeof value === 'number' && !/scale|opacity|columns|rows/i.test(key) ? (key.endsWith('Ms') ? 'ms' : 'px') : '';
			root.style.setProperty(`--${group}-${kebab(key)}`, `${value}${unit}`);
		}
	}
}

function kebab (s: string): string {
	return s.replace(/([A-Z])/g, '-$1').toLowerCase();
}
