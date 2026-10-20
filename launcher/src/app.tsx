import {useCallback, useEffect, useMemo, useRef, useState} from 'preact/hooks';
import {Home} from './screens/Home';
import {Settings, type SettingsTab} from './screens/Settings';
import type {OptionItem} from './components/OptionList';
import {Toast, type ToastMessage} from './components/Toast';
import type {TileModel} from './components/Tile';
import {listApps, type AppEntry} from './lib/apps';
import {listInputs, MOCK_INPUTS, type InputSource} from './lib/inputs';
import {launchApp, launchLgHome} from './lib/launch';
import {isWebOS} from './lib/luna';
import {hidePointerOnForeground} from './lib/pointer';
import {loadConfig, saveConfig, toggleId, type UserConfig} from './lib/storage';
import {appTile, inputTile, pickInOrder} from './lib/tiles';
import {accentFor, plateFor} from './lib/accent';
import {TIMING} from './config/constants';

type Screen = 'home' | 'settings';

const ROW = {apps: 'apps', sources: 'sources'} as const;
const CONTROL = {lgHome: 'lg-home', settings: 'settings'} as const;
const OPTION = {useHomebrew: 'use-homebrew'} as const;

/** The two system shortcuts that ride in the "Inputs & controls" strip, after the
 *  sources - the same order the stock home uses. */
const CONTROL_TILES: TileModel[] = [
	{key: CONTROL.settings, label: 'Settings', glyph: 'gear'},
	{key: CONTROL.lgHome, label: 'LG Home', glyph: 'house'}
];

export function App () {
	const [screen, setScreen] = useState<Screen>('home');
	const [config, setConfig] = useState<UserConfig>(loadConfig);
	const [apps, setApps] = useState<AppEntry[]>([]);
	const [inputs, setInputs] = useState<InputSource[]>([]);
	const [accents, setAccents] = useState<Record<string, string>>({});
	const [plates, setPlates] = useState<Record<string, string>>({});
	const [toast, setToast] = useState<ToastMessage | null>(null);
	const toastTimer = useRef(0);

	const showToast = useCallback((text: string, kind: ToastMessage['kind'] = 'info') => {
		window.clearTimeout(toastTimer.current);
		setToast({text, kind});
		toastTimer.current = window.setTimeout(() => setToast(null), TIMING.toastMs);
	}, []);

	// Start in remote (5-way) mode: hide the Magic Remote pointer whenever we come to the
	// front. Shaking the remote still brings it back.
	useEffect(() => hidePointerOnForeground(), []);

	// Load apps at start and whenever the Homebrew option changes; refresh inputs whenever
	// the app comes back to the foreground (labels or connections may have changed).
	useEffect(() => {
		listApps(config.useHomebrew)
			.then(({apps: list, source}) => {
				setApps(list);
				if (config.useHomebrew && source !== 'homebrew') showToast('Homebrew Channel not available, using the built-in app list', 'error');
			})
			.catch(() => showToast('Could not read the app list', 'error'));
	}, [config.useHomebrew, showToast]);

	// The accent colours light the backdrop, and they come from the icons, so they can
	// only be worked out once the app list has arrived. The plates (the icon's own
	// background colour) arrive with them.
	useEffect(() => {
		if (!apps.length) return;
		let cancelled = false;
		Promise.all(apps.map((a) => Promise.all([
			accentFor(a.id, a.iconUrl, a.color),
			plateFor(a.id, a.iconUrl)
		]))).then((sampled) => {
			if (cancelled) return;
			const colours: Record<string, string> = {};
			const plates: Record<string, string> = {};
			apps.forEach((a, i) => {
				colours[a.id] = sampled[i][0];
				if (sampled[i][1]) plates[a.id] = sampled[i][1] as string;
			});
			setAccents(colours);
			setPlates(plates);
		});
		return () => { cancelled = true; };
	}, [apps]);

	useEffect(() => {
		const refresh = () => {
			if (!isWebOS()) { setInputs(MOCK_INPUTS); return; }
			listInputs().then(setInputs).catch(() => showToast('Could not read the inputs', 'error'));
		};
		refresh();
		const onVisibility = () => { if (!document.hidden) refresh(); };
		document.addEventListener('visibilitychange', onVisibility);
		return () => document.removeEventListener('visibilitychange', onVisibility);
	}, [showToast]);

	const updateConfig = (next: UserConfig) => { setConfig(next); saveConfig(next); };

	// ----- derived content -----
	const shownApps = useMemo(() => pickInOrder(apps, config.appIds, (a) => a.id), [apps, config.appIds]);
	const shownInputs = useMemo(
		() => (config.sourceIds ? pickInOrder(inputs, config.sourceIds, (s) => s.appId) : inputs),
		[inputs, config.sourceIds]
	);

	const withAccent = useCallback(
		(a: AppEntry) => appTile(a, accents[a.id], plates[a.id]),
		[accents, plates]
	);

	const appTiles = useMemo(() => shownApps.map(withAccent), [shownApps, withAccent]);
	const controlTiles = useMemo(() => shownInputs.map(inputTile).concat(CONTROL_TILES), [shownInputs]);

	const tabs: SettingsTab[] = useMemo(() => [
		{id: ROW.apps, label: 'Apps', noun: 'apps', items: apps.map(withAccent), shown: shownApps.map(withAccent)},
		{id: ROW.sources, label: 'Sources', noun: 'sources', items: inputs.map(inputTile), shown: shownInputs.map(inputTile)}
	], [apps, inputs, shownApps, shownInputs, withAccent]);

	const options: OptionItem[] = useMemo(() => [
		{
			id: OPTION.useHomebrew,
			label: 'Live app list via Homebrew Channel',
			description: 'Rooted TVs only. Lists every installed app with its real icon, using the Homebrew Channel, which runs commands as root. When off, the built-in app catalogue is used.',
			value: config.useHomebrew
		}
	], [config.useHomebrew]);

	// ----- actions -----
	const open = (id: string, label: string) => {
		launchApp(id).catch(() => showToast(`Couldn't open ${label}`, 'error'));
	};

	const onActivateApp = useCallback((item: TileModel) => {
		open(item.key, item.label);
	}, [showToast]);

	const onActivateControl = useCallback((item: TileModel) => {
		if (item.key === CONTROL.settings) setScreen('settings');
		else if (item.key === CONTROL.lgHome) launchLgHome().catch(() => showToast("Couldn't open LG Home", 'error'));
		else open(item.key, item.label);
	}, [showToast]);

	const onToggle = useCallback((tabId: string, key: string) => {
		if (tabId === ROW.apps) {
			updateConfig({...config, appIds: toggleId(config.appIds, key)});
		} else {
			const current = config.sourceIds || inputs.map((s) => s.appId);
			updateConfig({...config, sourceIds: toggleId(current, key)});
		}
	}, [config, inputs]);

	const onOption = useCallback((optionId: string) => {
		if (optionId === OPTION.useHomebrew) updateConfig({...config, useHomebrew: !config.useHomebrew});
	}, [config]);

	/** Replace a list's order with `keys` (the full list of what's shown). */
	const onReorder = useCallback((tabId: string, keys: string[]) => {
		if (tabId === ROW.apps) updateConfig({...config, appIds: keys});
		else updateConfig({...config, sourceIds: keys});
	}, [config]);

	return (
		<>
			{/* Home stays mounted under Settings so it keeps its focus position. */}
			<Home
				apps={appTiles}
				controls={controlTiles}
				active={screen === 'home'}
				onActivateApp={onActivateApp}
				onActivateControl={onActivateControl}
			/>
			{screen === 'settings' && <Settings tabs={tabs} options={options} active onToggle={onToggle} onReorder={onReorder} onOption={onOption} onClose={() => setScreen('home')} />}
			<Toast message={toast} />
		</>
	);
}
