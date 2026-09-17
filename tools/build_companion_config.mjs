import fs from 'node:fs'

const inputPath = process.argv[2]
const outputPath = process.argv[3]
if (!inputPath || !outputPath) {
	throw new Error('Usage: node build_companion_config.mjs INPUT OUTPUT')
}

const config = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const abletonId = Object.entries(config.instances).find(([, value]) => value.label === 'ableton')?.[0]
const oscId = Object.entries(config.instances).find(([, value]) => value.label === 'osc-send')?.[0]
if (!abletonId || !oscId) throw new Error('Expected ableton and osc-send connections')

let idCounter = 0
const nextId = (prefix) => `${prefix}_${String(++idCounter).padStart(8, '0')}`
const val = (value) => ({ value, isExpression: false })
const expr = (value) => ({ value, isExpression: true })

const canvasLayer = () => ({
	id: nextId('canvas'),
	name: 'Canvas',
	usage: 'auto',
	type: 'canvas',
	decoration: val('default'),
	showStatusIcons: val('default'),
})

const boxLayer = (color) => ({
	id: nextId('box'),
	name: 'Background',
	usage: 'auto',
	type: 'box',
	enabled: val(true),
	opacity: val(100),
	x: val(0),
	y: val(0),
	width: val(100),
	height: val(100),
	rotation: val(0),
	color: typeof color === 'string' ? expr(color) : val(color),
	borderWidth: val(0),
	borderColor: val(0),
	borderPosition: val('inside'),
})

const textLayer = ({ text, size = 30, x = 0, y = 0, width = 100, height = 100, color = 0xffffff, valign = 'center' }) => ({
	id: nextId('text'),
	name: 'Text',
	usage: 'auto',
	type: 'text',
	enabled: val(true),
	opacity: val(100),
	x: val(x),
	y: val(y),
	width: val(width),
	height: val(height),
	rotation: val(0),
	text: typeof text === 'object' ? text : val(text),
	color: typeof color === 'string' ? expr(color) : val(color),
	halign: val('center'),
	valign: val(valign),
	fontsize: val(size),
	fontsizeAllowShrink: val(true),
	font: val('companion-sans'),
	outlineColor: val(0xff000000),
})

const moduleAction = (definitionId, options) => ({
	id: nextId('action'),
	definitionId,
	connectionId: oscId,
	options: Object.fromEntries(Object.entries(options).map(([key, value]) => [key, val(value)])),
	upgradeIndex: 0,
	type: 'action',
})

const setCustom = (name, value, isExpression = true) => ({
	id: nextId('action'),
	definitionId: 'custom_variable_set_value',
	connectionId: 'internal',
	options: {
		name: val(name),
		create: val(false),
		value: isExpression ? expr(value) : val(value),
	},
	type: 'action',
	children: {},
})

const sendBlank = (path) => moduleAction('send_blank', { path })
const sendInt = (path, int) => moduleAction('send_int', { path, int })

const button = ({ background, texts, actions = [], notes = '' }) => ({
	type: 'button-layered',
	style: {
		layers: [canvasLayer(), boxLayer(background), ...texts.map((t) => textLayer(t))],
	},
	options: {
		stepProgression: 'auto',
		stepExpression: '',
		rotaryActions: false,
		canModifyStyleInApis: false,
		notes,
	},
	feedbacks: [],
	steps: {
		0: {
			action_sets: { down: actions, up: [] },
			options: { runWhileHeld: [] },
		},
	},
	localVariables: [],
})

const customVariables = {
	selected_scene: ['Selected Session scene index', 0],
	running_scene: ['Actually playing INFINITY slot index', -1],
	is_playing: ['Live transport playback state', false],
	blink_phase: ['Slow UI blink phase for PLAY attention feedback', false],
	missed_polls: ['Consecutive heartbeat polls without response', 99],
	last_response: ['Last observed AbletonOSC response, used to make every poll observable', ''],
	heartbeat_track: ['Alternating read-only heartbeat track index', 11],
	infinity_index: ['INFINITY track index discovered from Live', -1],
	infinity_count: ['Number of tracks named INFINITY', 0],
	infinity_ok: ['True only for one INFINITY track at index 12', false],
	track_12_name: ['Current name of track 12', ''],
	scene_names_raw: ['Bulk scene names returned live by AbletonOSC', ''],
	infinity_clip_names_raw: ['Bulk INFINITY clip names returned live by AbletonOSC', ''],
	current_tempo: ['Tempo of the currently displayed scene', 0],
	current_numerator: ['Time signature numerator of the currently displayed scene', 4],
	current_denominator: ['Time signature denominator of the currently displayed scene', 4],
	...Object.fromEntries(Array.from({ length: 72 }, (_, i) => [`scene_${i + 1}_signature_enabled`, [`Whether scene ${i + 1} has its own time signature; used only for SONG boundary detection`, false]])),
}

config.custom_variables = Object.fromEntries(
	Object.entries(customVariables).map(([name, [description, defaultValue]], sortOrder) => [
		name,
		{ description, defaultValue, persistCurrentValue: false, sortOrder },
	])
)
config.customVariablesCollections = []

const SETLIST_SCAN_MAX = 72
const staticSceneName = (index) => `jsonpath(split($(custom:scene_names_raw), ', '), '$[${index}]')`
const staticInfinityKey = (index) => `jsonpath(split($(custom:infinity_clip_names_raw), ', '), '$[${index + 1}]')`
const dynamicSceneName = (indexExpression) => `jsonpath(split($(custom:scene_names_raw), ', '), concat('$[', ${indexExpression}, ']'))`
const dynamicInfinityKey = (indexExpression) => `jsonpath(split($(custom:infinity_clip_names_raw), ', '), concat('$[', ${indexExpression} + 1, ']'))`
let lastSetlistSceneExpression = String(SETLIST_SCAN_MAX)
for (let index = SETLIST_SCAN_MAX; index >= 1; index--) {
	const name = staticSceneName(index)
	const key = staticInfinityKey(index)
	const emptyKey = `(${key} == '' || ${key} == 'null' || ${key} == 'None')`
	const isBoundary = `${index} >= $(expression:scene_count) || ${name} == '' || (toUpperCase(${name}) == 'SONG' && ${emptyKey} && !$(custom:scene_${index}_signature_enabled))`
	lastSetlistSceneExpression = `${isBoundary} ? ${index - 1} : (${lastSetlistSceneExpression})`
}

const expressionDefinitions = {
	online: '$(custom:missed_polls) <= 3',
	scene_count: "length(split($(custom:scene_names_raw), ', '))",
	last_setlist_scene: lastSetlistSceneExpression,
	set_valid: '$(expression:online) && $(custom:infinity_ok) && $(expression:last_setlist_scene) >= 1 && $(custom:selected_scene) >= 1 && $(custom:selected_scene) <= $(expression:last_setlist_scene)',
	active_scene: '$(custom:is_playing) && $(custom:running_scene) >= 1 && $(custom:running_scene) <= $(expression:last_setlist_scene) ? $(custom:running_scene) : $(custom:selected_scene)',
	current_title: dynamicSceneName('$(expression:active_scene)'),
	current_tempo: '$(custom:current_tempo)',
	current_numerator: '$(custom:current_numerator)',
	current_denominator: '$(custom:current_denominator)',
	current_key: dynamicInfinityKey('$(expression:active_scene)'),
	selected_title: dynamicSceneName('$(custom:selected_scene)'),
	selection_differs: '$(custom:is_playing) && $(custom:running_scene) >= 1 && $(custom:running_scene) <= $(expression:last_setlist_scene) && $(custom:selected_scene) >= 1 && $(custom:selected_scene) <= $(expression:last_setlist_scene) && $(custom:selected_scene) != $(custom:running_scene)',
	previous_title: `$(custom:selected_scene) > 1 ? ${dynamicSceneName('$(custom:selected_scene) - 1')} : '—'`,
	next_title: `$(custom:selected_scene) < $(expression:last_setlist_scene) ? ${dynamicSceneName('$(custom:selected_scene) + 1')} : '—'`,
	previous_index: 'max(1, min($(expression:last_setlist_scene), $(custom:selected_scene) - 1))',
	next_index: 'max(1, min($(expression:last_setlist_scene), $(custom:selected_scene) + 1))',
	previous_path: "$(custom:selected_scene) > 1 && $(custom:selected_scene) <= $(expression:last_setlist_scene) && $(expression:online) ? '/live/view/set/selected_scene' : '/live/noop'",
	next_path: "$(custom:selected_scene) < $(expression:last_setlist_scene) && $(expression:online) ? '/live/view/set/selected_scene' : '/live/noop'",
	play_path: "$(expression:set_valid) ? '/live/scene/fire' : '/live/noop'",
	display_title: "!$(expression:online) ? 'ABLETON OFFLINE' : !$(custom:infinity_ok) ? 'CONFIG ERROR' : $(expression:last_setlist_scene) < 1 ? 'NO SETLIST' : $(custom:selected_scene) < 1 || $(custom:selected_scene) > $(expression:last_setlist_scene) ? 'SELECT SONG' : toUpperCase($(expression:current_title))",
	display_meta: "!$(expression:online) ? 'ABLETONOSC / LIVE PRÜFEN' : !$(custom:infinity_ok) ? 'INFINITY-SPUR: EINDEUTIG AUF INDEX 12' : $(expression:selection_differs) ? concat('AUSWAHL: ', toUpperCase($(expression:selected_title))) : concat($(custom:is_playing) ? '' : 'READY • ', round($(expression:current_tempo)), ' BPM • ', $(expression:current_numerator), '/', $(expression:current_denominator), ' • ', $(expression:current_key))",
}

config.expressionVariables = Object.fromEntries(
	Object.entries(expressionDefinitions).map(([variableName, expression], sortOrder) => {
		const controlId = nextId('expression')
		return [
			controlId,
			{
				type: 'expression-variable',
				options: { variableName, description: `Worship controller: ${variableName}`, sortOrder, notes: '' },
				entity: {
					id: nextId('feedback'),
					definitionId: 'expression_value',
					connectionId: 'internal',
					options: { expression: expr(expression) },
					type: 'feedback',
					isInverted: val(false),
					styleOverrides: [],
					children: {},
				},
				localVariables: [],
			},
		]
	})
)
config.expressionVariablesCollections = []

const mainText = (text, size = 28) => [{ text, size }]
const navTexts = (direction, label, titleExpression, enabledExpression) => [
	{ text: `${direction} ${label}`, size: 52, y: 0, height: 42, color: `${enabledExpression} ? 16777215 : 6710886` },
	{ text: expr(titleExpression), size: 56, y: 40, height: 60, color: `${enabledExpression} ? 16498468 : 5526612` },
]
const controls = {
	0: {
		3: button({
			background: 0xb00020,
			texts: mainText('PANIC\nSTOP ALL', 26),
			actions: [sendBlank('/live/song/stop_all_clips'), sendBlank('/live/song/stop_playing'), setCustom('running_scene', '-1')],
			notes: 'Emergency stop: all Session clips plus transport.',
		}),
	},
	1: {
		0: button({
			background: '$(custom:selected_scene) <= 1 ? 1052688 : 1057851',
			texts: navTexts('◀', 'PREV', '$(expression:previous_title)', '$(custom:selected_scene) > 1 && $(custom:selected_scene) <= $(expression:last_setlist_scene)'),
			actions: [sendInt('$(expression:previous_path)', '$(expression:previous_index)')],
			notes: 'Select previous Setlist scene only; never starts playback. Song title uses an amber accent.',
		}),
		1: button({
			background: '$(expression:selection_differs) ? ($(custom:blink_phase) ? 16498468 : 43520) : $(custom:is_playing) ? 43520 : 1003826',
			texts: mainText('▶\nPLAY', 34),
			actions: [sendInt('$(expression:play_path)', '$(custom:selected_scene)'), setCustom('running_scene', '$(custom:selected_scene)')],
			notes: 'Fire selected scene only when valid. Slowly blinks green/amber when a different song is selected during playback.',
		}),
		2: button({
			background: '$(custom:is_playing) ? 7019805 : 11149858',
			texts: mainText('■\nSTOP', 34),
			actions: [sendBlank('/live/song/stop_all_clips'), sendBlank('/live/song/stop_playing'), setCustom('running_scene', '-1')],
			notes: 'One press stops all Session clips and Live transport.',
		}),
		3: button({
			background: '$(custom:selected_scene) >= $(expression:last_setlist_scene) ? 1052688 : 1057851',
			texts: navTexts('▶▶', 'NEXT', '$(expression:next_title)', '$(custom:selected_scene) < $(expression:last_setlist_scene)'),
			actions: [sendInt('$(expression:next_path)', '$(expression:next_index)')],
			notes: 'Select next Setlist scene only; never starts playback. Song title uses an amber accent.',
		}),
	},
	2: {
		0: { type: 'pageup' },
		1: button({
			background: 0x000000,
			texts: [
				{
					text: val('$(expression:display_title)'),
					size: 60,
					y: 0,
					height: 62,
					color: '!$(expression:online) || !$(custom:infinity_ok) ? 16734815 : $(custom:is_playing) ? 5626253 : 8246268',
				},
				{
					text: val('$(expression:display_meta)'),
					size: 80,
					y: 62,
					height: 38,
					color: '!$(expression:online) || !$(custom:infinity_ok) ? 16734815 : $(expression:selection_differs) ? 16498468 : $(custom:is_playing) ? 5626253 : 16498468',
				},
			],
			notes: 'Full 248x58 Neo LCD: running title stays large; lower line switches to amber AUSWAHL when selection differs.',
		}),
		3: { type: 'pagedown' },
	},
}

config.pages = {
	1: {
		id: config.pages?.['1']?.id ?? nextId('page'),
		name: 'WORSHIP LIVE',
		controls,
		gridSize: { minColumn: 0, maxColumn: 3, minRow: 0, maxRow: 2 },
	},
}

const trigger = (name, sortOrder, events, actions, notes = '') => ({
	type: 'trigger',
	options: { name, enabled: true, sortOrder, notes },
	actions,
	condition: [],
	events,
	localVariables: [],
})
const intervalEvent = (seconds) => ({ id: nextId('event'), type: 'interval', enabled: true, options: { seconds } })
const startupEvent = (delay) => ({ id: nextId('event'), type: 'startup', enabled: true, options: { delay } })
const variableEvent = (variableId) => ({ id: nextId('event'), type: 'variable_changed', enabled: true, options: { variableId } })

const rawTrackNames = '$(ableton:raw_live_song_get_track_names)'
const rawSceneNames = '$(ableton:raw_live_song_get_scenes_name)'
const rawInfinityClipNames = '$(ableton:raw_live_track_get_clips_name)'

const statePollActions = [
	setCustom('missed_polls', 'min(99, $(this:current) + 1)'),
	setCustom('heartbeat_track', '$(this:current) == 11 ? 12 : 11'),
	sendBlank('/live/application/get/average_process_usage'),
	setCustom('last_response', "concat($(ableton:last_raw_address), '|', $(ableton:last_raw_response))"),
	setCustom('track_12_name', '$(ableton:track_name_13)'),
	setCustom('infinity_index', `arrayIndexOf(split(${rawTrackNames}, ', '), 'INFINITY')`),
	setCustom('infinity_count', `arrayIndexOf(split(${rawTrackNames}, ', '), 'INFINITY') < 0 ? 0 : arrayIndexOf(split(${rawTrackNames}, ', '), 'INFINITY') == arrayLastIndexOf(split(${rawTrackNames}, ', '), 'INFINITY') ? 1 : 2`),
	setCustom('infinity_ok', `arrayIndexOf(split(${rawTrackNames}, ', '), 'INFINITY') == 12 && arrayLastIndexOf(split(${rawTrackNames}, ', '), 'INFINITY') == 12`),
	sendBlank('/live/view/get/selected_scene'),
	setCustom('selected_scene', 'max(0, min(72, fromRadix($(ableton:raw_live_view_get_selected_scene), 10)))'),
	sendBlank('/live/song/get/is_playing'),
	setCustom('is_playing', 'bool($(ableton:raw_live_song_get_is_playing))'),
	sendInt('/live/track/get/playing_slot_index', '12'),
	setCustom('running_scene', "$(ableton:last_raw_address) == '/live/track/get/playing_slot_index' ? jsonpath(split($(ableton:last_raw_response), ', '), '$[1]') : $(this:current)"),
	sendInt('/live/scene/get/tempo', '$(expression:active_scene)'),
	setCustom('current_tempo', "jsonpath(split($(ableton:raw_live_scene_get_tempo), ', '), '$[0]') == $(expression:active_scene) ? jsonpath(split($(ableton:raw_live_scene_get_tempo), ', '), '$[1]') : $(this:current)"),
	sendInt('/live/scene/get/time_signature_numerator', '$(expression:active_scene)'),
	setCustom('current_numerator', "jsonpath(split($(ableton:raw_live_scene_get_time_signature_numerator), ', '), '$[0]') == $(expression:active_scene) && jsonpath(split($(ableton:raw_live_scene_get_time_signature_numerator), ', '), '$[1]') > 0 ? jsonpath(split($(ableton:raw_live_scene_get_time_signature_numerator), ', '), '$[1]') : $(this:current)"),
	sendInt('/live/scene/get/time_signature_denominator', '$(expression:active_scene)'),
	setCustom('current_denominator', "jsonpath(split($(ableton:raw_live_scene_get_time_signature_denominator), ', '), '$[0]') == $(expression:active_scene) && jsonpath(split($(ableton:raw_live_scene_get_time_signature_denominator), ', '), '$[1]') > 0 ? jsonpath(split($(ableton:raw_live_scene_get_time_signature_denominator), ', '), '$[1]') : $(this:current)"),
]

const metadataActions = [
	sendBlank('/live/song/get/track_names'),
	setCustom('infinity_index', `arrayIndexOf(split(${rawTrackNames}, ', '), 'INFINITY')`),
	setCustom('infinity_count', `arrayIndexOf(split(${rawTrackNames}, ', '), 'INFINITY') < 0 ? 0 : arrayIndexOf(split(${rawTrackNames}, ', '), 'INFINITY') == arrayLastIndexOf(split(${rawTrackNames}, ', '), 'INFINITY') ? 1 : 2`),
	setCustom('infinity_ok', `arrayIndexOf(split(${rawTrackNames}, ', '), 'INFINITY') == 12 && arrayLastIndexOf(split(${rawTrackNames}, ', '), 'INFINITY') == 12`),
	sendBlank('/live/song/get/scenes/name'),
	sendInt('/live/track/get/clips/name', '12'),
	sendInt('/live/scene/get/time_signature_enabled', `max(1, min(${SETLIST_SCAN_MAX}, $(expression:last_setlist_scene) + 1))`),
	setCustom('scene_names_raw', rawSceneNames),
	setCustom('infinity_clip_names_raw', rawInfinityClipNames),
	...Array.from({ length: SETLIST_SCAN_MAX }, (_, offset) => {
		const scene = offset + 1
		return setCustom(`scene_${scene}_signature_enabled`, `jsonpath(split($(ableton:raw_live_scene_get_time_signature_enabled), ', '), '$[0]') == ${scene} ? bool(jsonpath(split($(ableton:raw_live_scene_get_time_signature_enabled), ', '), '$[1]')) : $(this:current)`)
	}),
	sendBlank('/live/view/start_listen/selected_scene'),
	sendBlank('/live/song/start_listen/is_playing'),
	sendInt('/live/track/start_listen/playing_slot_index', '12'),
]

const triggerList = [
	trigger('01 STATE POLL + HEARTBEAT', 0, [startupEvent(700), intervalEvent(1)], statePollActions, 'Read-only 1s state poll. No playback commands.'),
	trigger('02 METADATA + SETLIST SYNC', 1, [startupEvent(1200), intervalEvent(10)], metadataActions, 'Reload track structure, bulk scene names, INFINITY clip names and listeners.'),
	trigger('10 RESPONSE: HEARTBEAT', 10, [variableEvent('ableton:raw_live_application_get_average_process_usage')], [
		setCustom('missed_polls', '0'),
		setCustom('track_12_name', "$(ableton:track_name_13)"),
	]),
	trigger('11 RESPONSE: SELECTED SCENE', 11, [variableEvent('ableton:raw_live_view_get_selected_scene')], [
		setCustom('selected_scene', "max(0, min(72, fromRadix($(ableton:raw_live_view_get_selected_scene), 10)))"),
	]),
	trigger('12 RESPONSE: PLAY STATE', 12, [variableEvent('ableton:raw_live_song_get_is_playing')], [
		setCustom('is_playing', 'bool($(ableton:raw_live_song_get_is_playing))'),
	]),
	trigger('13 RESPONSE: PLAYING SLOT', 13, [variableEvent('ableton:raw_live_track_get_playing_slot_index')], [
		setCustom('running_scene', "jsonpath(split($(ableton:raw_live_track_get_playing_slot_index), ', '), '$[0]') == 12 ? jsonpath(split($(ableton:raw_live_track_get_playing_slot_index), ', '), '$[1]') : $(this:current)"),
	]),
	trigger('14 RESPONSE: TRACK STRUCTURE', 14, [variableEvent('ableton:raw_live_song_get_track_names')], [
		setCustom('infinity_index', `arrayIndexOf(split(${rawTrackNames}, ', '), 'INFINITY')`),
		setCustom('infinity_count', `arrayIndexOf(split(${rawTrackNames}, ', '), 'INFINITY') < 0 ? 0 : arrayIndexOf(split(${rawTrackNames}, ', '), 'INFINITY') == arrayLastIndexOf(split(${rawTrackNames}, ', '), 'INFINITY') ? 1 : 2`),
		setCustom('infinity_ok', `arrayIndexOf(split(${rawTrackNames}, ', '), 'INFINITY') == 12 && arrayLastIndexOf(split(${rawTrackNames}, ', '), 'INFINITY') == 12`),
	]),
	trigger('20 RESPONSE: BULK SCENE NAMES', 20, [variableEvent('ableton:raw_live_song_get_scenes_name')], [
		setCustom('scene_names_raw', rawSceneNames),
	]),
	trigger('21 RESPONSE: BULK INFINITY CLIPS', 21, [variableEvent('ableton:raw_live_track_get_clips_name')], [
		setCustom('infinity_clip_names_raw', rawInfinityClipNames),
	]),
	trigger('22 RESPONSE: CURRENT TEMPO', 22, [variableEvent('ableton:raw_live_scene_get_tempo')], [
		setCustom('current_tempo', "jsonpath(split($(ableton:raw_live_scene_get_tempo), ', '), '$[0]') == $(expression:active_scene) ? jsonpath(split($(ableton:raw_live_scene_get_tempo), ', '), '$[1]') : $(this:current)"),
	]),
	trigger('23 RESPONSE: CURRENT SIGNATURE NUMERATOR', 23, [variableEvent('ableton:raw_live_scene_get_time_signature_numerator')], [
		setCustom('current_numerator', "jsonpath(split($(ableton:raw_live_scene_get_time_signature_numerator), ', '), '$[0]') == $(expression:active_scene) && jsonpath(split($(ableton:raw_live_scene_get_time_signature_numerator), ', '), '$[1]') > 0 ? jsonpath(split($(ableton:raw_live_scene_get_time_signature_numerator), ', '), '$[1]') : 4"),
	]),
	trigger('24 RESPONSE: CURRENT SIGNATURE DENOMINATOR', 24, [variableEvent('ableton:raw_live_scene_get_time_signature_denominator')], [
		setCustom('current_denominator', "jsonpath(split($(ableton:raw_live_scene_get_time_signature_denominator), ', '), '$[0]') == $(expression:active_scene) && jsonpath(split($(ableton:raw_live_scene_get_time_signature_denominator), ', '), '$[1]') > 0 ? jsonpath(split($(ableton:raw_live_scene_get_time_signature_denominator), ', '), '$[1]') : 4"),
	]),
	trigger('25 RESPONSE: SETLIST BOUNDARY SIGNATURE', 25, [variableEvent('ableton:raw_live_scene_get_time_signature_enabled')], Array.from({ length: SETLIST_SCAN_MAX }, (_, offset) => {
		const scene = offset + 1
		return setCustom(`scene_${scene}_signature_enabled`, `jsonpath(split($(ableton:raw_live_scene_get_time_signature_enabled), ', '), '$[0]') == ${scene} ? bool(jsonpath(split($(ableton:raw_live_scene_get_time_signature_enabled), ', '), '$[1]')) : $(this:current)`)
	})),
	trigger('30 UI: PLAY ATTENTION BLINK', 30, [intervalEvent(1)], [
		setCustom('blink_phase', '!bool($(this:current))'),
	], 'UI-only one-second phase toggle. Sends no Ableton command; PLAY uses it only while selection differs from the running scene.'),
]

config.triggers = Object.fromEntries(triggerList.map((item) => [nextId('trigger'), item]))
config.triggerCollections = []

// Keep the discovered Neo and configured connections exactly as exported.
const neo = Object.values(config.surfaces ?? {}).find((surface) => surface.type === 'Elgato Stream Deck Neo')
if (neo?.groupConfig) {
	neo.groupConfig.page = 1
	neo.groupConfig.last_page = 1
	neo.groupConfig.startup_page = 1
	neo.groupConfig.use_last_page = false
}

fs.writeFileSync(outputPath, `${JSON.stringify(config, null, '\t')}\n`)
console.log(`Wrote ${outputPath}`)
console.log(`Ableton connection: ${abletonId}`)
console.log(`Generic OSC connection: ${oscId}`)
console.log(`Triggers: ${Object.keys(config.triggers).length}`)
console.log(`Custom variables: ${Object.keys(config.custom_variables).length}`)
console.log(`Expression variables: ${Object.keys(config.expressionVariables).length}`)
