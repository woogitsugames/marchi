#!/usr/bin/env python3
"""Summarise docs/research/shadow9-data/<mode>-<quality>.json (tools/frame9-cost.mjs output) as a Markdown table."""
import json, os, sys
D = os.path.dirname(os.path.abspath(__file__))
print('| tryb | jakość | ms/s klatki | render() | cień ms/s | cień % | draw cień/kl. | tris cień/kl. | profil: cień ms/s | odświeżeń mapy |')
print('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|')
for q in ('high', 'low'):
    for m in ('base', 'a0', 'a', 'b', 'c'):
        p = f'{D}/{m}-{q}.json'
        if not os.path.exists(p) or os.path.getsize(p) == 0: continue
        d = json.load(open(p)); c = d['cams']['near']; t = c['timing']
        prof = dict(c['profile']['buckets']).get('three: shadow pass (CPU)', 0)
        s9 = c['scene'].get('shadow9') or {}
        upd = f"{s9['updates']}/{s9['frames']}" if 'frames' in s9 else '-'
        print(f"| {m} | {q} | {t['wall']['med']:.0f} | {t['render']['med']:.0f} | {t['shadow']['med']:.1f} | {100*t['shadow']['med']/t['wall']['med']:.0f} % | {t['drawsShadow']['med']:.0f} | {t['trisShadow']['med']/1000:.0f}k | {prof:.0f} | {upd} |")
