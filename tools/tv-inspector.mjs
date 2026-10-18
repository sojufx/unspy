#!/usr/bin/env node
// tv-inspector.mjs
// Evaluate JS inside a running web app on the LG TV, via its remote web inspector
// (Chrome DevTools Protocol over WebSocket, port 9998).
//
//   node tv-inspector.mjs "<js expression>" [--reload]
//
// Env overrides: TV_IP, TV_INSPECT_PORT, TV_APP_MATCH
import process from 'node:process';

const TV    = process.env.TV_IP || '192.168.1.100';
const PORT  = process.env.TV_INSPECT_PORT || '9998';
const MATCH = process.env.TV_APP_MATCH || 'works.partridge.webos-launcher';

const expr      = process.argv[2];
const doReload  = process.argv.includes('--reload');
if (!expr) {
	console.error('usage: tv-inspector.mjs "<js expression>" [--reload]');
	process.exit(2);
}

const listRes = await fetch(`http://${TV}:${PORT}/json/list`, {signal: AbortSignal.timeout(8000)});
const targets = await listRes.json();
const target  = targets.find((t) => (t.url || '').includes(MATCH));
if (!target) {
	console.error('no matching debug target. Available:');
	for (const t of targets) console.error(`  ${t.title} <${t.url}>`);
	process.exit(1);
}
console.error(`target: ${target.title} <${target.url}>`);

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

const r = await send('Runtime.evaluate', {
	expression: expr,
	returnByValue: true,
	awaitPromise: true
});

if (r.exceptionDetails) {
	console.error('EXCEPTION:', JSON.stringify(r.exceptionDetails, null, 2));
	process.exit(1);
}
console.log(JSON.stringify(r.result?.value ?? null, null, 2));

if (doReload) {
	try {
		await send('Runtime.evaluate', {expression: 'setTimeout(function(){location.reload()}, 60); "reloading"'});
		console.error('reload requested');
	} catch (e) {
		console.error('reload failed:', e.message);
	}
}

ws.close();
process.exit(0);
