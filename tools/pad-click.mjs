// Native Companion actions only. This generator is not a runtime bridge.
export function installAccompaniment(config, h) {
 const { nextId, val, expr, setCustom: set, moduleAction, sendBlank, sendInt, button, trigger, intervalEvent, startupEvent, variableEvent } = h
 const cv = n => `$(custom:${n})`
 const ev = n => `$(expression:${n})`
 const raw = p => `$(ableton:raw_live_${p.replaceAll('/', '_')})`
 const part = (s, i) => `jsonpath(split(${s}, ', '), '$[${i}]')`
 const names = ['1-MIDI','GLITZER','Midi-Perc','Track-Bus','Track','Perc (nicht pitchen)','EGs','Bass','Vocals','GUIDE','CLICK AUDIO','CLICK','INFINITY']
 const tracks = names.map((_, i) => i)
 const leaves = tracks.filter(i => ![3,9,10,11].includes(i))
 const addVar = (n, value, persist = false) => {
  config.custom_variables[n] = { description: `PAD/CLICK: ${n}`, defaultValue: value, persistCurrentValue: persist, sortOrder: Object.keys(config.custom_variables).length }
 }
 const define = (name, expression) => {
  let entry = Object.values(config.expressionVariables).find(e => e.options.variableName === name)
  if (entry) entry.entity.options.expression = expr(expression)
  else config.expressionVariables[nextId('expression')] = { type:'expression-variable', options:{variableName:name,description:`PAD/CLICK: ${name}`,sortOrder:Object.keys(config.expressionVariables).length,notes:''}, entity:{id:nextId('feedback'),definitionId:'expression_value',connectionId:'internal',options:{expression:expr(expression)},type:'feedback',isInverted:val(false),styleOverrides:[],children:{}},localVariables:[] }
 }
 const internal = (definitionId, options = {}, children = {}) => ({id:nextId('action'),type:'action',connectionId:'internal',definitionId,options:Object.fromEntries(Object.entries(options).map(([k,v])=>[k,val(v)])),children})
 const seq = actions => internal('action_group',{execution_mode:'sequential'},{default:actions})
 const iff = (condition, yes, no = []) => internal('logic_if',{}, {condition:[{id:nextId('feedback'),type:'feedback',connectionId:'internal',definitionId:'check_expression',options:{expression:expr(condition)},isInverted:val(false),styleOverrides:[],children:{}}],actions:yes,else_actions:no})
 const wait = ms => internal('wait',{time:String(ms)})
 const multi = (path, args) => {
  const variable=nextId('osc_args')
  define(variable,args)
  const a = moduleAction('send_multiple',{path,arguments:ev(variable),sanitise:true})
  return a
 }
 const mute = (i, value) => multi('/live/track/set/mute', `concat('${i} ', ${value})`)
 const stopTrack = i => multi('/live/track/stop_all_clips', `'${i} false'`)
 const stopAll = () => multi('/live/song/stop_all_clips', "'false'")
 const addTrigger = (name, events, actions) => { config.triggers[nextId('trigger')] = trigger(name,100+Object.keys(config.triggers).length,events,[seq(actions)]) }

 for (const [n,v] of Object.entries({transition:false,target_scene:-1,fade_saved:false,request_tempo:0,request_numerator:0,request_denominator:0,request_has_clip:false,request_track:-1,request_ready:false,component_error:''})) addVar(n,v,n==='fade_saved')
 for (const i of tracks) {
  addVar(`slot_${i}`,-99); addVar(`mute_${i}`,true); addVar(`volume_${i}`,-1); addVar(`slot_age_${i}`,99)
 }
 for (const i of leaves) addVar(`saved_volume_${i}`,-1,true)
 addVar('click_signatures_raw','')
 const clipSignature = offset => `jsonpath(split(${cv('click_signatures_raw')}, ', '), concat('$[', ${cv('target_scene')} + ${offset}, ']'))`
 define('structure_ok', `${ev('online')} && length(split(${raw('song/get/track_names')}, ', ')) == 13 && ` + names.map((n,i)=>`${part(raw('song/get/track_names'),i)} == '${n}'`).join(' && '))
 define('slots_fresh', `${ev('online')} && ` + tracks.map(i=>`${cv(`slot_${i}`)} != -99`).join(' && '))
 const slotExpr = tracks.filter(i=>i!==3).reduceRight((s,i)=>`${cv(`slot_${i}`)} >= 1 ? ${cv(`slot_${i}`)} : (${s})`,'-1')
 define('observed_scene',slotExpr)
 define('mixed_scenes',tracks.filter(i=>i!==3).map(i=>`(${cv(`slot_${i}`)} >= 1 && ${cv(`slot_${i}`)} != ${ev('observed_scene')})`).join(' || '))
 define('active_scene',`${cv('is_playing')} && ${ev('observed_scene')} >= 1 ? ${ev('observed_scene')} : ${cv('selected_scene')}`)
 define('selection_differs',`${cv('is_playing')} && ${ev('observed_scene')} >= 1 && ${cv('selected_scene')} != ${ev('observed_scene')}`)
 define('pad_on',`${cv('is_playing')} && ${cv('slot_12')} >= 1 && !${cv('mute_12')}`)
 define('click_on',`${cv('is_playing')} && ((${cv('slot_11')} >= 1 && !${cv('mute_11')}) || (${cv('slot_10')} >= 1 && !${cv('mute_10')}))`)
 define('backing_running', [0,1,2,4,5,6,7,8,9].map(i=>`${cv(`slot_${i}`)} >= 0`).join(' || '))
 define('component_valid',`${ev('set_valid')} && ${ev('structure_ok')} && ${ev('slots_fresh')} && !${ev('mixed_scenes')} && !${cv('transition')} && !${cv('fade_saved')}`)
 for (const kind of ['pad','click']) define(`${kind}_label`,`${cv('transition')} ? 'WECHSEL …' : !${ev('component_valid')} ? 'NICHT BEREIT' : ${ev('selection_differs')} ? 'NEUER SONG' : ${ev(`${kind}_on`)} ? 'STOP' : 'START'`)

 // Indexed replies are sorted into dedicated variables; never interpret the last
 // arbitrary track response as the playing pad, or as another track's value.
 for (const property of ['playing_slot_index','mute','volume']) {
  for (const i of tracks) {
   const response=`$(ableton:worship_${property}_${i})`
   addTrigger(`40 RESPONSE ${property} ${i}`, [variableEvent(`ableton:worship_${property}_${i}`)], [set(`${property==='playing_slot_index'?'slot':property}_${i}`,property==='mute'?`bool(${response})`:response)])
  }
 }
 addTrigger('41 COMPONENT STATE',[startupEvent(1500),intervalEvent(1)],[...tracks.flatMap(i=>[sendInt('/live/track/get/playing_slot_index',String(i)),sendInt('/live/track/get/mute',String(i)),sendInt('/live/track/get/volume',String(i))]),wait(120),...tracks.flatMap(i=>['playing_slot_index','mute','volume'].map(p=>set(`${p==='playing_slot_index'?'slot':p}_${i}`,p==='mute'?`bool($(ableton:worship_${p}_${i}))`:`$(ableton:worship_${p}_${i})`)))])
 // Fresh listeners report mute changes and clip starts made directly in Live.
 addTrigger('42 COMPONENT LISTENERS',[startupEvent(1700),intervalEvent(10)],tracks.flatMap(i=>['playing_slot_index','mute','volume'].map(p=>sendInt(`/live/track/start_listen/${p}`,String(i)))))
 addTrigger('42 CLICK TIME SIGNATURES',[startupEvent(1900),intervalEvent(10)],[multi('/live/song/get/track_data', `'11 12 "clip.signature_numerator" "clip.signature_denominator"'`),wait(150),set('click_signatures_raw',raw('song/get/track_data'))])
 for(const property of ['tempo','time_signature_numerator','time_signature_denominator']) {
  const field={tempo:'request_tempo',time_signature_numerator:'request_numerator',time_signature_denominator:'request_denominator'}[property]
  addTrigger(`43 TARGET ${property}`,[variableEvent(`ableton:raw_live_scene_get_${property}`)],[iff(`${cv('transition')} && ${part(raw(`scene/get/${property}`),0)} == ${cv('target_scene')}`,[set(field,property==='tempo'?part(raw(`scene/get/${property}`),1):`${part(raw(`scene/get/${property}`),1)} > 0 ? ${part(raw(`scene/get/${property}`),1)} : ${clipSignature(property==='time_signature_numerator'?'0':ev('scene_count'))}`)])])
 }
 addTrigger('44 TARGET CLIP',[variableEvent('ableton:raw_live_clip_slot_get_has_clip')],[iff(`${cv('transition')} && ${part(raw('clip_slot/get/has_clip'),0)} == ${cv('request_track')} && ${part(raw('clip_slot/get/has_clip'),1)} == ${cv('target_scene')}`,[set('request_has_clip',`bool(${part(raw('clip_slot/get/has_clip'),2)})`)])])
 // Force a float OSC argument without appending a second decimal point.
 const volumeFloat = (i,value) => multi('/live/track/set/volume',`concat('${i} ', ${value}, ${value} == round(${value}) ? '.0' : '')`)
 const restore = () => [iff(cv('fade_saved'),leaves.map(i=>iff(`${cv(`saved_volume_${i}`)} >= 0`,[volumeFloat(i,cv(`saved_volume_${i}`))]))),set('fade_saved','false')]
 const abortStarts = () => [internal('panic_bank',{location:'1/0/1',unlatch:true}),internal('panic_bank',{location:'1/0/2',unlatch:true}),internal('panic_bank',{location:'1/1/1',unlatch:true})]
 const finishStop = () => [stopAll(),sendBlank('/live/song/stop_playing'),...restore(),set('transition','false'),set('running_scene','-1')]
 const startClip = track => multi('/live/clip_slot/fire',`concat('${track} ', ${cv('target_scene')})`)
 const release = () => [wait(400),set('transition','false')]
 const startTarget = track => [sendInt('/live/song/set/signature_denominator',cv('request_denominator')),sendInt('/live/song/set/signature_numerator',cv('request_numerator')),moduleAction('send_float',{path:'/live/song/set/tempo',float:cv('request_tempo')}),mute(track,0),startClip(track)]
 const request = track => [set('target_scene',cv('selected_scene')),set('request_track',String(track)),set('request_has_clip','false'),set('request_tempo','0'),set('request_numerator','0'),set('request_denominator','0'),wait(60),...['tempo','time_signature_numerator','time_signature_denominator'].map(p=>sendInt(`/live/scene/get/${p}`,cv('target_scene'))),multi('/live/clip_slot/get/has_clip',`concat('${track} ', ${cv('target_scene')})`),wait(250),
  ...Object.entries({tempo:'request_tempo',time_signature_numerator:'request_numerator',time_signature_denominator:'request_denominator'}).map(([p,n])=>iff(`${part(raw(`scene/get/${p}`),0)} == ${cv('target_scene')}`,[set(n, p==='tempo'?part(raw(`scene/get/${p}`),1):`${part(raw(`scene/get/${p}`),1)} > 0 ? ${part(raw(`scene/get/${p}`),1)} : ${clipSignature(p==='time_signature_numerator'?'0':ev('scene_count'))}`)])),
  iff(`${part(raw('clip_slot/get/has_clip'),0)} == ${track} && ${part(raw('clip_slot/get/has_clip'),1)} == ${cv('target_scene')}`,[set('request_has_clip',`bool(${part(raw('clip_slot/get/has_clip'),2)})`)]),
  wait(60),
 ]
 const ready = `${cv('request_has_clip')} && ${cv('request_tempo')} > 0 && ${cv('request_numerator')} > 0 && ${cv('request_denominator')} > 0 && ${ev('online')}`
 const fade = track => [iff(leaves.map(i=>`${cv(`volume_${i}`)} >= 0`).join(' && '),[
  ...leaves.map(i=>set(`saved_volume_${i}`,cv(`volume_${i}`))),set('fade_saved','true'),wait(60),... [9,10,11].map(stopTrack),
  ...Array.from({length:10},(_,n)=>[wait(100),...leaves.map(i=>volumeFloat(i,`${cv(`saved_volume_${i}`)} * ${(9-n)/10}`))]).flat(),
  stopAll(),sendBlank('/live/song/stop_playing'),...restore(),...startTarget(track),
 ],[set('component_error',"'LAUTSTÄRKE UNBEKANNT'")])]
 const toggle = (track,kind) => {
  const componentTracks=kind==='click'?[10,11]:[12]
  const off=[...componentTracks.map(i=>mute(i,1)),iff(`!${ev('backing_running')} && !${ev(kind==='pad'?'click_on':'pad_on')}`,[stopAll(),sendBlank('/live/song/stop_playing')])]
  const on=[iff(`${cv(`slot_${track}`)} == ${cv('target_scene')}`,componentTracks.map(i=>mute(i,0)),[...startTarget(track)])]
  return [seq([iff(ev('component_valid'),[
   set('transition','true'),set('component_error',"''"),...request(track),
   iff(ready,[iff(`${cv('is_playing')} && ${ev('observed_scene')} >= 1 && ${ev('observed_scene')} != ${cv('target_scene')}`,fade(track),[iff(ev(`${kind}_on`),off,[iff(`${cv('is_playing')}` ,on,[stopAll(),...[10,11,12].map(i=>mute(i,i===track?0:1)),...startTarget(track)])])])],[set('component_error',"'CLIP / TEMPO FEHLT'")]),...release(),
  ])])]
 }
 config.pages[1].controls[0]={}
 for(const [column,kind,track,color] of [[1,'pad',12,0x126a86],[2,'click',11,0x986519]]) {
  config.pages[1].controls[0][column]=button({background:`${ev(`${kind}_on`)} ? ${color} : 1052688`,texts:[{text:kind.toUpperCase(),size:48,height:54},{text:val(`$(expression:${kind}_label)`),size:36,y:54,height:46,color:0xffcc44}],actions:toggle(track,kind),notes:'Same scene: toggle component. Different scene: fade old song and start only this component.'})
 }
 const play=config.pages[1].controls[1][1]
 play.steps[0].action_sets.down=[seq([iff(ev('component_valid'),[set('transition','true'),set('target_scene',cv('selected_scene')),wait(60),stopAll(),...[10,11,12].map(i=>mute(i,0)),sendInt('/live/scene/fire',cv('target_scene')),...release()])])]
 config.pages[1].controls[1][2].steps[0].action_sets.down=[seq([...abortStarts(),...finishStop()])]
 // Startup recovery restores only a previously recorded interrupted fade.
 addTrigger('45 INTERRUPTED FADE RECOVERY',[startupEvent(2200),intervalEvent(2)],[iff(`${cv('fade_saved')} && !${cv('transition')} && ${ev('structure_ok')}`,[...restore()])])
 define('display_title',`${ev('mixed_scenes')} ? 'MEHRERE SONGS' : !${ev('online')} ? 'ABLETON OFFLINE' : !${ev('structure_ok')} ? 'CONFIG ERROR' : toUpperCase(${ev('current_title')})`)
 define('display_meta',`${cv('transition')} ? 'WECHSEL …' : ${cv('component_error')} != '' ? ${cv('component_error')} : ${ev('selection_differs')} ? concat('AUSWAHL: ', toUpperCase(${ev('selected_title')})) : concat(${cv('is_playing')} ? '' : 'READY • ', round(${ev('current_tempo')}), ' BPM • ', ${ev('current_numerator')}, '/', ${ev('current_denominator')}, ' • ', ${ev('current_key')})`)
 // Legacy Generic OSC evaluates variable references, not automatic expressions.
 const externalExpressions = node => {
  if (!node || typeof node !== 'object') return
  if (node.type === 'action' && node.connectionId !== 'internal') {
   for (const [key, option] of Object.entries(node.options ?? {})) {
    if (option.isExpression) {
     const name=nextId('osc_option'); define(name,option.value)
     node.options[key]=val(ev(name))
    }
   }
  }
  for (const value of Object.values(node)) externalExpressions(value)
 }
 externalExpressions(config.pages); externalExpressions(config.triggers)
 // Before Live has answered after a restart, selected_scene can be NaN.
 // Keep discovery running but do not send invalid scene indices while offline.
 const guardSceneQueries = node => {
  if (Array.isArray(node)) return node.map(guardSceneQueries)
  if (!node || typeof node !== 'object') return node
  for (const [key, value] of Object.entries(node)) node[key] = guardSceneQueries(value)
  if (node.type === 'action' && node.connectionId !== 'internal' &&
      node.definitionId === 'send_int' && node.options?.path?.value?.startsWith('/live/scene/get/')) {
   return iff(`${ev('online')} && ${ev('active_scene')} >= 0`, [node])
  }
  return node
 }
 config.triggers = guardSceneQueries(config.triggers)
}
