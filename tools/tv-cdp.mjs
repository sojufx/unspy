#!/usr/bin/env node
// tv-cdp.mjs - send one arbitrary Chrome DevTools Protocol command to a running web
// app on the LG TV.
//
//   node tv-cdp.mjs <Method> ['<json params>']
//   node tv-cdp.mjs Emulation.clearDeviceMetricsOverride
//
// Env overrides: TV_IP, TV_INSPECT_PORT, TV_APP_MATCH
import process from 'node:process';

const TV    = process.env.TV_IP || '192.168.1.100';
const PORT  = process.env.TV_INSPECT_PORT || '9998';
const MATCH = process.env.TV_APP_MATCH || 'works.partridge.webos-launcher';

const method = process.argv[2];
if (!method) { console.error('usage: tv-cdp.mjs <Method> [json params]'); process.exit(2); }
let params = {};
if (process.argv[3]) {
	try { params = JSON.parse(process.argv[3]); }
	catch (e) { console.error('bad JSON params:', e.message); process.exit(2); }
}

const listRes = await fetch(`http://${TV}:${PORT}/json/list`, {signal: AbortSignal.timeout(8000)});
const targets = await listRes.json();
const target = targets.find((t) => (t.url || '').includes(MATCH));
if (!target) { console.error('no matching debug target'); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();
const send = (m, p) => new Promise((resolve, reject) => {
	const id = nextId++;
	pending.set(id, {resolve, reject});
	ws.send(JSON.stringify({id, method: m, params: p || {}}));
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
const r = await send(method, params);
console.log(JSON.stringify(r ?? null));
ws.close();
process.exit(0);
