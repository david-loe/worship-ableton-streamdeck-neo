import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { after, test } from 'node:test'

const root = fileURLToPath(new URL('../', import.meta.url))
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'worship-next-play-'))
after(() => fs.rmSync(temporary, { recursive: true, force: true }))
const generated = path.join(temporary, 'generated.json')
execFileSync(process.execPath, [path.join(root, 'tools/build_companion_config.mjs'), path.join(root, 'companion/Worship-Live.companionconfig'), generated])
const config = JSON.parse(fs.readFileSync(generated, 'utf8'))
const expressions = Object.fromEntries(Object.values(config.expressionVariables).map(entry => [entry.options.variableName, entry.entity.options.expression.value]))
const actionsAt = (row, column) => config.pages[1].controls[row][column].steps[0].action_sets.down
const nextPlay = actionsAt(0, 3)

// Execute the generated action tree with a recording OSC transport. Wait hooks
// let tests inject the asynchronous selection updates Companion receives.
function controller(custom = {}, expression = {}) {
 const state = { selected_scene: 2, is_playing: true, infinity_ok: true, transition: false, fade_saved: false, ...custom }
 const overrides = { online: true, structure_ok: true, slots_fresh: true, mixed_scenes: false, observed_scene: 2, last_setlist_scene: 4, ...expression }
 const commands = []
 const cancellations = []
 const evaluate = source => vm.runInNewContext(String(source).replace(/\$\((custom|expression):([^)]*)\)/g, (_, kind, name) => {
  const value = kind === 'custom' ? state[name] : Object.hasOwn(overrides, name) ? overrides[name] : evaluate(expressions[name])
  return JSON.stringify(value)
 }), { concat: (...values) => values.join('') })
 const option = entry => entry.isExpression ? evaluate(entry.value) : typeof entry.value === 'string' ? entry.value.replace(/\$\((custom|expression):([^)]*)\)/g, token => String(evaluate(token))) : entry.value
 const run = async (actions, onWait = () => {}) => {
  for (const action of actions) {
   const options = Object.fromEntries(Object.entries(action.options).map(([key, value]) => [key, option(value)]))
   if (action.connectionId !== 'internal') {
    commands.push({ type: action.definitionId, ...options })
   } else if (action.definitionId === 'action_group') {
    assert.equal(options.execution_mode, 'sequential')
    await run(action.children.default, onWait)
   } else if (action.definitionId === 'logic_if') {
    const condition = action.children.condition[0].options.expression
    await run(option(condition) ? action.children.actions : action.children.else_actions, onWait)
   } else if (action.definitionId === 'custom_variable_set_value') {
    state[options.name] = options.value
   } else if (action.definitionId === 'wait') {
    await onWait(Number(options.time))
   } else if (action.definitionId === 'panic_bank') {
    cancellations.push(options.location)
   } else {
    throw new Error(`Unhandled action: ${action.definitionId}`)
   }
  }
 }
 return { state, commands, cancellations, run }
}

test('top-right button selects and starts the same next full scene', async () => {
 const c = controller()
 await c.run(nextPlay)
 assert.equal(config.pages[1].controls[0][3].style.layers[2].text.value, 'Next & Play')
 assert.deepEqual(c.commands.map(command => command.path), [
  '/live/view/set/selected_scene', '/live/song/stop_all_clips',
  '/live/track/set/mute', '/live/track/set/mute', '/live/track/set/mute', '/live/scene/fire',
 ])
 assert.equal(c.commands[0].int, '3')
 assert.equal(c.commands.at(-1).int, '3')
 assert.deepEqual(c.commands.slice(2, 5).map(command => command.arguments), ['10 0', '11 0', '12 0'])
 assert.equal(c.state.transition, false)
})

test('selection replies during a wait do not change the captured target', async () => {
 const c = controller()
 await c.run(nextPlay, () => { c.state.selected_scene = 4 })
 assert.equal(c.commands[0].int, '3')
 assert.equal(c.commands.at(-1).int, '3')
})

for (const [name, custom, expression] of [
 ['last song', { selected_scene: 4 }, { observed_scene: 4 }],
 ['stopped transport', { is_playing: false }, {}],
 ['different song selected', { selected_scene: 3 }, {}],
 ['transport playing without a running song', {}, { observed_scene: -1 }],
 ['header', { selected_scene: 0 }, {}],
 ['outside setlist', { selected_scene: 5 }, {}],
 ['empty setlist', {}, { last_setlist_scene: 0 }],
 ['offline', {}, { online: false }],
 ['invalid INFINITY', { infinity_ok: false }, {}],
 ['invalid structure', {}, { structure_ok: false }],
 ['unknown slots', {}, { slots_fresh: false }],
 ['mixed songs', {}, { mixed_scenes: true }],
 ['transition in progress', { transition: true }, {}],
 ['interrupted fade', { fade_saved: true }, {}],
]) {
 test(`no selection or playback commands for ${name}`, async () => {
  const c = controller(custom, expression)
  await c.run(nextPlay)
  assert.deepEqual(c.commands, [])
  assert.equal(c.state.target_scene, undefined)
 })
}

test('a second press during the start wait is ignored', async () => {
 const c = controller()
 await c.run(nextPlay, async milliseconds => {
  if (milliseconds === 60) await c.run(nextPlay)
 })
 assert.equal(c.commands.filter(command => command.path === '/live/scene/fire').length, 1)
})

test('PLAY still starts the current selection without navigating', async () => {
 const c = controller({ is_playing: false })
 await c.run(actionsAt(1, 1))
 assert.equal(c.commands.at(-1).int, '2')
 assert.equal(c.commands.some(command => command.path === '/live/view/set/selected_scene'), false)
})

test('STOP cancels all four start buttons before stopping clips and transport', async () => {
 const c = controller({ transition: true })
 await c.run(actionsAt(1, 2))
 assert.deepEqual(c.cancellations, ['1/0/1', '1/0/2', '1/0/3', '1/1/1'])
 assert.deepEqual(c.commands.map(command => command.path), ['/live/song/stop_all_clips', '/live/song/stop_playing'])
 assert.equal(c.state.transition, false)
})
