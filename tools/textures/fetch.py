"""Download Poly Haven source maps (diffuse, OpenGL normal, ARM) for the 10 MARCHIA sets.
usage: python3 -I fetch.py <dest_dir> [res=4k]
Resolves exact URLs + md5 through https://api.polyhaven.com/files/<id>; skips files whose md5
already matches. ARM (R=AO, G=roughness, B=metal) is Poly Haven's own packing of the AO and
Rough maps, so it is used instead of downloading AO + Rough separately.
"""
import hashlib, json, os, sys, urllib.request

IDS = ['sparse_grass', 'brown_mud_02', 'cobblestone_floor_13', 'river_small_rocks', 'forest_leaves_03',
       'old_planks_02', 'reed_roof_04', 'old_stone_wall', 'bark_brown_02', 'worn_mossy_plasterwall']
MAPS = {'Diffuse': 'diff', 'nor_gl': 'nor_gl', 'arm': 'arm'}

dest = sys.argv[1]
res = sys.argv[2] if len(sys.argv) > 2 else '4k'
os.makedirs(dest, exist_ok=True)

def req(url):
    # Poly Haven rejects urllib's default User-Agent with 403.
    return urllib.request.Request(url, headers={'User-Agent': 'marchia-texture-pipeline/1.0'})

def md5(p):
    h = hashlib.md5()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

for pid in IDS:
    with urllib.request.urlopen(req(f'https://api.polyhaven.com/files/{pid}')) as r:
        files = json.load(r)
    for key, short in MAPS.items():
        info = files[key][res]['jpg']
        out = os.path.join(dest, f'{pid}_{short}.jpg')
        if os.path.exists(out) and md5(out) == info['md5']:
            print('ok  ', out); continue
        with urllib.request.urlopen(req(info['url'])) as r, open(out, 'wb') as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)
        assert md5(out) == info['md5'], f'md5 mismatch {out}'
        print('got ', out, info['size'] // 1024, 'KB')
