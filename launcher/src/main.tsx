import {render} from 'preact';
import {App} from './app';
import {applyTokens} from './theme/tokens';
import './theme/global.css';

applyTokens();
render(<App />, document.getElementById('root')!);

// webOS 6 (Chrome 79) can rasterise the first frame of text into a surface the TV's
// compositor then overwrites, leaving garbage glyphs in the top strip until something
// forces a repaint. Adding `.settled` applies a sub-pixel tracking nudge (see the note
// in global.css) which repairs it. Harmless everywhere else.
window.setTimeout(() => document.documentElement.classList.add('settled'), 1500);
