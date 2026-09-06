from pathlib import Path

path = Path('apps/discovery-ui/src/app/pages/maps-page.utils.spec.ts')
text = path.read_text()

old = """    saipe: true,
    population: true,
    hydrography: true,
"""
new = """    saipe: true,
    population: true,
    cbp: true,
    hydrography: true,
"""
if old not in text:
    raise SystemExit('allOn debug-toggle fixture anchor not found')
text = text.replace(old, new, 1)

old = """        saipe: false,
        population: false,
        hydrography: false,
"""
new = """        saipe: false,
        population: false,
        cbp: false,
        hydrography: false,
"""
if old not in text:
    raise SystemExit('allOff debug-toggle fixture anchor not found')
text = text.replace(old, new, 1)

path.write_text(text)
print('CBP debug fixtures patched successfully.')
