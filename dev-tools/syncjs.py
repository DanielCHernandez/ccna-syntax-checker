"""Regenerate ios-engine-vX.js from the engine section of terminal-vX.html
(keeps the .js file's own header comment and EXPORTS footer)."""
import sys,re
d=sys.argv[1]; v=sys.argv[2]
h=open(f'{d}/terminal-v{v}.html').read(); j=open(f'{d}/ios-engine-v{v}.js').read()
hs=h.index('const IOS_ENGINE_VERSION'); he=h.index('/* ============================================================\n   UI LAYER')
js=j.index('const IOS_ENGINE_VERSION'); jf=j.index('/* ---------------------------------------------------------\n   EXPORTS')
out=j[:js]+h[hs:he].rstrip('\n')+'\n\n\n'+j[jf:]
open(f'{d}/ios-engine-v{v}.js','w').write(out); print('synced', len(out.splitlines()),'lines')
