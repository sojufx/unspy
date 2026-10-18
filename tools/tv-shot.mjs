#!/usr/bin/env node
// tv-shot.mjs - screenshot a running web app on the LG TV via its remote web
// inspector (CDP, port 9998) and save the PNG locally, so the design can be
// checked against what is actually on the panel.
//
//   node tv-shot.mjs <out.png> [width] [height]
//
// Env overrides: TV_IP, TV_INSPECT_PORT, TV_APP_MATCH
import {writeFileSync} from 'node:fs';
import process from 'node:process';

const TV    = process.env.TV_IP || '192.168.1.100';
const PORT  = process.env.TV_INSPECT_PORT || '9998';
const MATCH = process.env.TV_APP_MATCH || 'works.partridge.webos-launcher';

const out = process.argv[2] || 'shot.png';
const width = Number(process.argv[3] || 1920);
const height = Number(process.argv[4] || 1080);

const listRes = await fetch(`http://${TV}:${PORT}/json/list`, {signal: AbortSignal.timeout(8000)});
const targets = await listRes.json();
const target = targets.find((t) => (t.url || '').includes(MATCH));
if (!target) {
	console.error('no matching debug target. Available:');
	for (const t of targets) console.error(`  ${t.title} <${t.url}>`);
	process.exit(1);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();

function send (method, params = {}) {
	return new Promise((resolve, reject) => {
		const id = nextId++;
		pending.set(id, {resolve, reject});
		ws.send(JSON.stringify({id, method, params}));
	});
}

ws.addEventListener('message', (ev) => {
	let msg;
	try { msg = JSON.parse(ev.data); } catch { return; }
	if (msg.id && pending.has(msg.id)) {
		const {resolve, reject} = pending.get(msg.id);
		pending.delete(msg.id);
		msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
	}
});
ws.addEventListener('error', (e) => console.error('ws error:', e.message || e));

await new Promise((resolve) => ws.addEventListener('open', resolve, {once: true}));

// The TV's WebKit carries a stale viewport emulation into newly created webviews
// (after a launch, or after this script once set one), which warps the captured
// surface into a tiled mess. Always clear it before capturing.
try {
	await send('Emulation.clearDeviceMetricsOverride');
} catch (e) { console.error('clear metrics failed:', e.message); }

const r = await send('Page.captureScreenshot', {format: 'png', fromSurface: true});
if (!r || !r.data) { console.error('no screenshot data returned'); process.exit(1); }
writeFileSync(out, Buffer.from(r.data, 'base64'));
console.error(`saved ${out} (${Buffer.from(r.data, 'base64').length} bytes)`);

ws.close();
process.exit(0);
