import {CheckMark, Glyph, type GlyphName} from './Glyph';

/** Everything a tile needs to draw itself; rows and grids build these from app/input data. */
export interface TileModel {
	key: string;
	label: string;
	/** full-bleed artwork (app icons) */
	imageUrl?: string;
	/** LG's grey line-art input icons, drawn smaller and lightened */
	glyphImageUrl?: string;
	/** built-in vector icon */
	glyph?: GlyphName;
	/** monogram background when there is no artwork */
	color?: string;
	/** the icon's own background colour: the card is painted with it, so an opaque
	 *  square icon reads as full-bleed art instead of a picture inside a picture */
	plate?: string;
}

interface Props {
	model: TileModel;
	focused: boolean;
	/** 'card' is the home screen's landscape plate; 'square' is the settings picker. */
	variant?: 'square' | 'card';
	/** picked up in re-order mode */
	lifted?: boolean;
	/** shown with a tick badge (settings picker) */
	checked?: boolean;
	/** greyed out (settings picker: not on the home screen) */
	dimmed?: boolean;
	onHover?: () => void;
	onActivate?: () => void;
}

export function Tile ({model, focused, variant = 'square', lifted, checked, dimmed, onHover, onActivate}: Props) {
	const classes = [
		'tile',
		`tile--${variant}`,
		focused && 'tile--focused',
		lifted && 'tile--lifted',
		dimmed && 'tile--dimmed'
	].filter(Boolean).join(' ');

	// A plated card is painted with the icon's own background, so the artwork can fill
	// the card. The background is inline because it must survive the focused state.
	const boxStyle = variant === 'card' && model.plate
		? {background: model.plate}
		: model.color && !model.imageUrl && !model.glyphImageUrl
			? {background: model.color}
			: undefined;

	return (
		<div class={classes} onMouseEnter={onHover} onClick={onActivate}>
			<div class="tile__box" style={boxStyle}>
				{model.imageUrl
					? <img class={'tile__image' + (variant === 'card' && model.plate ? ' tile__image--plate' : '')} src={model.imageUrl} alt="" />
					: model.glyphImageUrl
						? <img class="tile__image tile__image--glyph" src={model.glyphImageUrl} alt="" />
						: model.glyph
							? <Glyph name={model.glyph} />
							: <div class="tile__monogram">{model.label.charAt(0).toUpperCase()}</div>}
				{checked && <div class="tile__badge"><CheckMark /></div>}
			</div>
			<div class="tile__label">{model.label}</div>
		</div>
	);
}
