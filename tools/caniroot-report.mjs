#!/usr/bin/env node
// caniroot-report.mjs - which root exploits are available for a given webOS device?
//
//   npm i @webosbrew/caniroot
//   node tools/caniroot-report.mjs HE_DTV_W21U_AFADATAA
//   node tools/caniroot-report.mjs HE_DTV_W21U_AFADATAA --matrix
//
// Data comes from the @webosbrew/caniroot dataset (MIT), the same one behind
// https://cani.rootmy.tv - see docs/compatibility.md.
//
// Find your own OTA ID on the TV, as root:
//
//   luna-send -n 1 luna://com.webos.service.tv.systemproperty/getSystemInfo \
//     '{"keys":["otaId","modelName","firmwareVersion","sdkVersion"]}'
import { DeviceExploitAvailabilities, DeviceModel } from '@webosbrew/caniroot';
import exploits from '@webosbrew/caniroot/src/exploits.gen.js';

const args = process.argv.slice(2);
const otaId = args.find((a) => !a.startsWith('-'));
const wantMatrix = args.includes('--matrix');

if (!otaId) {
	console.error('usage: caniroot-report.mjs <OTA-ID> [--matrix]');
	console.error('   eg: caniroot-report.mjs HE_DTV_W21U_AFADATAA');
	process.exit(2);
}

const model = (() => {
	try { return DeviceModel.byOTAId ? DeviceModel.byOTAId(otaId) : DeviceModel.find?.(otaId); }
	catch { return undefined; }
})();

console.log('');
console.log(`  OTA ID   ${otaId}`);
if (model?.model) console.log(`  model    ${model.model}${model.sizes ? '  (' + model.sizes.join('/') + '")' : ''}`);
if (model?.series) console.log(`  series   ${model.series}`);
if (model?.codename) console.log(`  codename ${model.codename}`);

const codenames = DeviceExploitAvailabilities.codenamesByOTAID(otaId);
if (!codenames?.length) {
	console.log('');
	console.log('  No entry for this OTA ID in the dataset.');
	console.log('  Either it is newer than the dataset, or the ID is mistyped.');
	console.log('  Check https://cani.rootmy.tv');
	process.exit(1);
}

console.log(`  codename(s) ${codenames.join(', ')}`);
console.log('');

const rows = [];
let best = null;
for (const codename of codenames) {
	for (const [exploit, data] of Object.entries(exploits[otaId][codename] || {})) {
		const latest = data.latest?.version ?? '-';
		const patched = data.patched?.version ?? '-';
		rows.push([exploit, latest, patched, data.latest?.codename ?? '']);
		// "newest firmware still rootable" across all exploits
		if (data.latest?.version && (!best || cmp(data.latest.version, best.version) > 0)) {
			best = { version: data.latest.version, exploit, release: data.latest.release };
		}
	}
}
rows.sort((a, b) => cmp(a[1], b[1]));

console.log('  exploit         newest firmware still vulnerable   first patched');
console.log('  ' + '-'.repeat(72));
for (const [exploit, latest, patched, codename] of rows) {
	console.log('  ' + exploit.padEnd(16) + latest.padEnd(34) + patched + (codename ? '   ' + codename : ''));
}

if (best) {
	console.log('');
	console.log(`  Newest rootable firmware for this device: ${best.version}`);
	console.log(`    via ${best.exploit}${best.release ? ' (' + best.release + ')' : ''}`);
	console.log('  Stay at or below that. Block the update servers; see docs/privacy.md.');
}

if (wantMatrix) {
	const EX = ['nvm', 'mvpd', 'rootmytv', 'crashd', 'asm', 'wta', 'dejavuln', 'faultmanager'];
	const years = {};
	for (const [id, byCode] of Object.entries(exploits)) {
		const m = /^HE_DTV_W(\d\d)/.exec(id);
		const yr = m ? '20' + m[1] : 'n/a';
		years[yr] ||= { models: 0, ex: {} };
		years[yr].models++;
		for (const cn of Object.keys(byCode)) {
			for (const ex of Object.keys(byCode[cn])) years[yr].ex[ex] = (years[yr].ex[ex] || 0) + 1;
		}
	}
	console.log('');
	console.log('  devices with each exploit, by model year');
	console.log('  year  devices' + EX.map((e) => e.slice(0, 6).padStart(8)).join(''));
	for (const yr of Object.keys(years).sort()) {
		const y = years[yr];
		console.log('  ' + yr.padEnd(6) + String(y.models).padStart(6) + '  ' + EX.map((e) => String(y.ex[e] || 0).padStart(7)).join(' '));
	}
	console.log('');
	console.log(`  ${Object.keys(exploits).length} OTA IDs in the dataset.`);
}

console.log('');

/** compare version strings numerically, segment by segment */
function cmp (a, b) {
	const pa = String(a).split('.').map(Number);
	const pb = String(b).split('.').map(Number);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const d = (pa[i] || 0) - (pb[i] || 0);
		if (d) return d;
	}
	return 0;
}
