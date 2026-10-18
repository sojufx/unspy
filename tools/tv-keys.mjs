#!/usr/bin/env node
// tv-keys.mjs - press remote-control keys on a running web app on the TV.
//
//   node tv-keys.mjs right right right down enter
//
// Uses CDP Input.dispatchKeyEvent, so the events are real (trusted) key events with the
// same keyCodes the remote produces. Anything the launcher does not handle falls through
// to the TV, exactly as if you pressed it.
import process from 'node:process';

const TV    = process.env.TV_IP || '192.168.1.100';
const PORT  = process.env.TV_INSPECT_PORT || '9998';
const MATCH = process.env.TV_APP_MATCH || 'works.partridge.webos-launcher';

const CODES = {left: 37, up: 38, right: 39, down: 40, enter: 13, back: 461, escape: 27};
const GAP = Number(process.env.TV_KEY_GAP || 380);

const keys = process.argv.slice(2).filter((k) => !k.startsWith('--'));
if (!keys.length) { console.error('usage: tv-keys.mjs <key>...  (left|right|up|down|enter|back)'); process.exit(2); }

const listRes = await fetch(`http://${TV}:${PORT}/json/list`, {signal: AbortSignal.timeout(8000)});
const targets = await listRes.json();
const target = targets.find((t) => (t.url || '').includes(MATCH));
if (!target) { console.error('no matching debug target'); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();
const send = (method, params) => new Promise((resolve, reject) => {
	const id = nextId++;
	pending.set(id, {resolve, reject});
	ws.send(JSON.stringify({id, method, params}));
});
ws.addEventListener('message', (ev) => {
	let msg; try { msg = JSON.parse(ev.data); } catch { return; }
	if (msg.id && pending.has(msg.id)) {
		const {resolve, reject} = pending.get(msg.id);
		pending.delete(msg.id);
		msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
	}
});
ws.addEventListener('error', (e) => console.error('ws error:', e.message || e));

await new Promise((resolve) => ws.addEventListener('open', resolve, {once: true}));

for (const name of keys) {
	const code = CODES[name];
	if (code === undefined) { console.error(`unknown key: ${name}`); continue; }
	const common = {windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key: name, code: name};
	await send('Input.dispatchKeyEvent', {type: 'rawKeyDown', ...common});
	await send('Input.dispatchKeyEvent', {type: 'keyUp', ...common});
	console.error(`  pressed ${name}`);
	await new Promise((r) => setTimeout(r, GAP));
}

ws.close();
process.exit(0);
