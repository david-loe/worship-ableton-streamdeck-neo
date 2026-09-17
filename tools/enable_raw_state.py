#!/usr/bin/env python3
"""Expose exact native responses in companion-module-ableton-osc 2.0.0.

Run with the installed module's main.js path; a sibling backup is retained.
The patch is deliberately version-specific and fails closed on other builds.
"""
import hashlib
import sys
from pathlib import Path

path = Path(sys.argv[1])
source = path.read_text()
anchor = 'processOscMessage(e){try{let r=e.address,i=e.args;'
addition = 'if(["/live/track/get/volume","/live/track/get/mute","/live/track/get/playing_slot_index","/live/clip_slot/get/has_clip"].includes(r)){this.handleRawOscResponse(r,i);let k="worship_"+r.split("/").pop()+"_"+i[0].value+(r.includes("clip_slot")?"_"+i[1].value:"");this.checkVariableDefinition(k,k);this.setVariableValues({[k]:i[i.length-1].value});}'
if anchor + addition in source:
    print('Raw state extension already installed')
elif source.count(anchor) != 1:
    raise SystemExit('Unsupported Ableton module build; nothing changed')
else:
    backup = path.with_name(path.name + '.before-worship-raw-state')
    if backup.exists():
        original = backup.read_text()
        if anchor not in original:
            raise SystemExit('Unexpected backup; inspect manually')
        previous = 'if(["/live/track/get/volume","/live/track/get/mute","/live/track/get/playing_slot_index","/live/clip_slot/get/has_clip"].includes(r))this.handleRawOscResponse(r,i);'
        if source != original.replace(anchor, anchor + previous, 1):
            raise SystemExit('Installed module has unrelated changes; inspect manually')
        source = original
    else:
        backup.write_bytes(path.read_bytes())
    path.write_text(source.replace(anchor, anchor + addition, 1))
    print('Installed raw state extension; backup:', backup)
print('SHA256:', hashlib.sha256(path.read_bytes()).hexdigest())
