import {FONT, LAYOUT} from '../theme/tokens';
import {Tile, type TileModel} from './Tile';

interface Props {
	items: TileModel[];
	/** the grid, rather than the strip, holds the focus */
	focused: boolean;
	row: number;
	col: number;
	columns?: number;
	onHover: (row: number, col: number) => void;
	onActivate: (item: TileModel) => void;
}

const COLUMNS = 5;
/** label line + its gap below a card */
const LABEL_BLOCK = Math.round(FONT.cardLabel * 1.25) + LAYOUT.cardLabelGap;
/** distance from one row of cards to the next */
const ROW_STRIDE = LAYOUT.cardHeight + LABEL_BLOCK + LAYOUT.cardGapY;
const VIEWPORT_HEIGHT = LAYOUT.gridVisibleRows * ROW_STRIDE - LAYOUT.cardGapY;
/** .cards carries 10px of padding for the focus ring (see global.css) */
const RING_PADDING = 10;

/** The app grid: five cards across, two rows on screen. It scrolls by whole rows so
 *  the focused row is always visible - the reference layout itself never scrolls,
 *  but a real TV has more than ten apps. */
export function AppGrid ({items, focused, row, col, columns = COLUMNS, onHover, onActivate}: Props) {
	const rows = Math.ceil(items.length / columns);
	const maxOffsetRow = Math.max(0, rows - LAYOUT.gridVisibleRows);
	const offsetRow = Math.min(Math.max(0, row - (LAYOUT.gridVisibleRows - 1)), maxOffsetRow);

	if (!items.length) {
		return <div class="cards"><div class="cards__empty">No apps selected — add some in Settings</div></div>;
	}

	return (
		<div class="cards" style={{height: `${VIEWPORT_HEIGHT + RING_PADDING * 2}px`}}>
			<div
				class="cards__track"
				style={{
					transform: `translateY(${-offsetRow * ROW_STRIDE}px)`,
					gridTemplateColumns: `repeat(${columns}, var(--layout-card-width))`
				}}
			>
				{items.map((item, i) => {
					const r = Math.floor(i / columns);
					const c = i % columns;
					return (
						<Tile
							key={item.key}
							model={item}
							variant="card"
							focused={focused && r === row && c === col}
							onHover={() => onHover(r, c)}
							onActivate={() => onActivate(item)}
						/>
					);
				})}
			</div>
		</div>
	);
}
