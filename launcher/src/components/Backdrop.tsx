import {useEffect, useRef, useState} from 'preact/hooks';

/** The room lighting behind everything.
 *
 *  Two identical layers sit on top of each other; when the accent changes, the hidden
 *  one is repainted in the new colour and the pair cross-fades. That is how the colour
 *  changes smoothly without animating a gradient (which Chrome 79 cannot do). */

interface Props {
	accent: string;
}

function rgba (hex: string, alpha: number): string {
	const match = /^#([0-9a-f]{6})$/i.exec(hex);
	if (!match) return 'rgba(60, 75, 110, ' + alpha + ')';
	const n = parseInt(match[1], 16);
	return 'rgba(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', ' + alpha + ')';
}

/** Two glows: a bright core just above the shelf, and a wide faint ambient behind it.
 *  One broad gradient reads as flat coloured fog; light needs a core. */
function wash (hex: string): string {
	return 'radial-gradient(ellipse 38% 36% at 50% 30%, '
			+ rgba(hex, 0.34) + ' 0%, ' + rgba(hex, 0) + ' 100%), '
		+ 'radial-gradient(ellipse 92% 84% at 50% 40%, '
			+ rgba(hex, 0.18) + ' 0%, ' + rgba(hex, 0.06) + ' 48%, ' + rgba(hex, 0) + ' 76%)';
}

export function Backdrop ({accent}: Props) {
	const [state, setState] = useState({a: accent, b: accent, showA: true});
	const applied = useRef(accent);

	useEffect(() => {
		if (accent === applied.current) return;
		applied.current = accent;
		setState((s) => (s.showA ? {a: s.a, b: accent, showA: false} : {a: accent, b: s.b, showA: true}));
	}, [accent]);

	return (
		<div class="backdrop" aria-hidden="true">
			<div class={'backdrop__wash' + (state.showA ? ' backdrop__wash--on' : '')} style={{background: wash(state.a)}} />
			<div class={'backdrop__wash' + (state.showA ? '' : ' backdrop__wash--on')} style={{background: wash(state.b)}} />
			<div class="backdrop__scrim" />
		</div>
	);
}
