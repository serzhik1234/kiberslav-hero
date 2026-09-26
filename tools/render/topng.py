import sys, json
from PIL import Image
for base in sys.argv[1:]:
    m = json.load(open(base + '.json'))
    im = Image.frombytes('RGBA', (m['W'], m['H']), open(base + '.raw', 'rb').read()).transpose(Image.FLIP_TOP_BOTTOM).convert('RGB')
    im = im.resize((m['W'] // m['SS'], m['H'] // m['SS']), Image.LANCZOS)
    im.save(base + '.png')
