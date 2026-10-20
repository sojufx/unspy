import {Glyph} from './Glyph';
import type {TileModel} from './Tile';

interface Props {
	items: TileModel[];
	focused: boolean;
	selected: number;
	onHover: (index: number) => void;
	onActivate: (item: TileModel) => void;
}

/** "Inputs & controls": the source chips and the two system shortcuts, in one row
 *  under the app grid - the same affordance the stock home puts there. */
export function InputStrip ({items, focused, selected, onHover, onActivate}: Props) {
	return (
		<section class="strip">
			<h2 class="strip__label">Inputs &amp; controls</h2>
			<div class="strip__row">
				{items.map((item, i) => (
					<div
						key={item.key}
						class={'chip' + (focused && i === selected ? ' chip--focused' : '')}
						onMouseEnter={() => onHover(i)}
						onClick={() => onActivate(item)}
					>
						{item.glyphImageUrl
							? <img class="chip__icon" src={item.glyphImageUrl} alt="" />
							: item.glyph
								? <Glyph name={item.glyph} className="chip__glyph" />
								: null}
						<span class="chip__label">{item.label}</span>
					</div>
				))}
			</div>
		</section>
	);
}
