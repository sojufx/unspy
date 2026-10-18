// Accent colours: the colour the room takes on for a given app.
//
// Apple TV's backdrop is derived from the artwork you are looking at; we do the same by
// drawing the icon into a tiny canvas and averaging it. Icons fetched through the
// Homebrew Channel arrive as data: URIs, which do not taint the canvas. Icons loaded
// from file:// DO taint it, so getImageData throws and we fall back to the brand table.

/** Sensible colour per app, used when the icon cannot be sampled. */
const BRAND: Record<string, string> = {
	netflix: '#E50914',
	amazon: '#00A8E1',
	'com.disney.disneyplus-prod': '#1B4DE4',
	'com.apple.appletv': '#B9B9C2',
	'now.tv': '#1FBF8F',
	'bbc.iplayer.3.0': '#FF4E9B',
	'bbc.sounds.1.0': '#FF7A1A',
	'com.fvp.itv': '#33D6C8',
	'com.fvp.ch4': '#7DE07D',
	demand5: '#2E6BFF',
	'com.bskyb.skystore': '#1E7BFF',
	'com.tubitv.ott.tubi': '#8A2BE2',
	'com.webos.app.browser': '#5B8DEF',
	'org.webosbrew.hbchannel': '#31C48D',
	'youtube.leanback.v4': '#FF2D2D',
	'spotify-beehive': '#1DB954',
	'tv.twitch.tv.starshot.lg': '#9146FF',
	'com.palm.app.settings': '#7A8296'
};

/** A calm slate, for sources and anything else without a colour of its own. */
export const NEUTRAL_ACCENT = '#3C4B6E';

const cache: Record<string, string> = {};

function rgbToHex (r: number, g: number, b: number): string {
	const channel = (n: number) => {
		const v = Math.max(0, Math.min(255, Math.round(n)));
		return (v < 16 ? '0' : '') + v.toString(16);
	};
	return '#' + channel(r) + channel(g) + channel(b);
}

/** Stretch the average so it is a colour you can actually light a room with. */
function boost (r: number, g: number, b: number): string {
	const max = Math.max(r, g, b) || 1;
	const k = 236 / max;
	return rgbToHex(r * k, g * k, b * k);
}

/** Average the icon's pixels, ignoring near-black and blown-out white. */
function sample (url: string): Promise<string | undefined> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			try {
				const size = 20;
				const canvas = document.createElement('canvas');
				canvas.width = size;
				canvas.height = size;
				const ctx = canvas.getContext('2d');
				if (!ctx) { resolve(undefined); return; }
				ctx.drawImage(img, 0, 0, size, size);
				const data = ctx.getImageData(0, 0, size, size).data;
				let r = 0, g = 0, b = 0, n = 0;
				for (let i = 0; i < data.length; i += 4) {
					if (data[i + 3] < 220) continue;                       // transparent
					const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
					if (luma < 16 || luma > 244) continue;                 // black / white
					r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
				}
				resolve(n ? boost(r / n, g / n, b / n) : undefined);
			} catch (e) {
				resolve(undefined);                                     // tainted canvas
			}
		};
		img.onerror = () => resolve(undefined);
		img.src = url;
	});
}

/** The accent for an app: sampled from its icon where possible, else its brand colour. */
export function accentFor (id: string, iconUrl?: string, fallback?: string): Promise<string> {
	if (cache[id]) return Promise.resolve(cache[id]);
	if (!iconUrl) return Promise.resolve(remember(id, BRAND[id] || fallback || NEUTRAL_ACCENT));
	return sample(iconUrl).then((hex) => remember(id, hex || BRAND[id] || fallback || NEUTRAL_ACCENT));
}

function remember (id: string, hex: string): string {
	cache[id] = hex;
	return hex;
}
