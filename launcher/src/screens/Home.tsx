import {useCallback, useEffect, useState} from 'preact/hooks';
import {AppGrid} from '../components/AppGrid';
import {InputStrip} from '../components/InputStrip';
import {Clock} from '../components/Clock';
import {Header} from '../components/Header';
import type {TileModel} from '../components/Tile';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useClock} from '../hooks/useClock';
import {useTimeFormat} from '../hooks/useTimeFormat';

interface Props {
	apps: TileModel[];
	controls: TileModel[];
	active: boolean;
	onActivateApp: (item: TileModel) => void;
	onActivateControl: (item: TileModel) => void;
}

const COLUMNS = 5;

type Zone = 'grid' | 'strip';

/** The home screen: five cards across, the clock in the corner, and the input strip
 *  along the bottom. Up/Down walk the grid (which scrolls by row), Down from the last
 *  row drops into the strip, Left/Right move within whichever zone has focus. */
export function Home ({apps, controls, active, onActivateApp, onActivateControl}: Props) {
	const now = useClock();
	const timeFormat = useTimeFormat();
	const [zone, setZone] = useState<Zone>('grid');
	const [row, setRow] = useState(0);
	const [col, setCol] = useState(0);
	const [stripIndex, setStripIndex] = useState(0);

	const rows = Math.max(1, Math.ceil(apps.length / COLUMNS));
	const itemsInRow = (r: number) => {
		const remaining = apps.length - r * COLUMNS;
		return Math.max(1, Math.min(COLUMNS, remaining));
	};

	// Keep the cursor inside the grid when the app list changes underneath it.
	useEffect(() => {
		setRow((r) => clamp(r, 0, rows - 1));
		setCol((c) => clamp(c, 0, itemsInRow(clamp(row, 0, rows - 1)) - 1));
	}, [apps.length, rows, row]);

	useEffect(() => {
		setStripIndex((i) => clamp(i, 0, Math.max(0, controls.length - 1)));
	}, [controls.length]);

	const handleKey = useCallback((key: NavKey): boolean => {
		switch (key) {
			case 'up':
				if (zone === 'strip') { setZone('grid'); setRow(rows - 1); return true; }
				if (row > 0) setRow(row - 1);
				return true;
			case 'down':
				if (zone === 'grid') {
					if (row < rows - 1) setRow(row + 1);
					else { setZone('strip'); setStripIndex(clamp(col, 0, Math.max(0, controls.length - 1))); }
				}
				return true;
			case 'left':
				if (zone === 'strip') setStripIndex((i) => clamp(i - 1, 0, controls.length - 1));
				else setCol((c) => clamp(c - 1, 0, itemsInRow(row) - 1));
				return true;
			case 'right':
				if (zone === 'strip') setStripIndex((i) => clamp(i + 1, 0, controls.length - 1));
				else setCol((c) => clamp(c + 1, 0, itemsInRow(row) - 1));
				return true;
			case 'enter': {
				const item = zone === 'grid' ? apps[row * COLUMNS + col] : controls[stripIndex];
				if (!item) return true;
				if (zone === 'grid') onActivateApp(item);
				else onActivateControl(item);
				return true;
			}
			case 'back':
				// Back on the home screen does nothing, but it does lift focus out of the strip.
				if (zone === 'strip') setZone('grid');
				return true;
		}
	}, [apps, controls, zone, row, col, stripIndex, rows, onActivateApp, onActivateControl]);

	useKeys(handleKey, active);

	return (
		<div class="screen">
			<div class="home">
				<Header now={now} />
				<Clock now={now} format={timeFormat} />
				<div class="home__grid">
					<AppGrid
						items={apps}
						focused={active && zone === 'grid'}
						row={row}
						col={col}
						onHover={(r, c) => { setZone('grid'); setRow(r); setCol(c); }}
						onActivate={onActivateApp}
					/>
				</div>
				<div class="home__strip">
					<InputStrip
						items={controls}
						focused={active && zone === 'strip'}
						selected={stripIndex}
						onHover={(i) => { setZone('strip'); setStripIndex(i); }}
						onActivate={onActivateControl}
					/>
				</div>
			</div>
		</div>
	);
}
