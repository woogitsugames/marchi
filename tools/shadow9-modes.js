// Research shadow pass (docs/research/2026-11-05-shadow-pass.md): runtime prototypes of the shadow-pass cuts,
// injected into a page of an UNPATCHED build (?debug=1). Evaluated as `(<this file>)(mode, k)` in the page.
//   base  shipped state
//   a     sun shadow map re-rendered every 2nd view frame; forced on any frame where the fitted shadow camera
//         moved (pan / zoom / sun step beyond a texel snap)
//   b     shadow frustum radius x k (default 0.6) around the camera target (fitShadow)
//   c     cost bound of a static-caster cache: only the wagon group casts in the per-frame pass (the cached
//         static map would be re-rendered only when the shadow camera moves; its blit is GPU work)
(mode, k) => {
  const v = window.__marchia.app.view, L = v.lighting, sun = L.sun;
  if (mode === 'a' || mode === 'a0') {
    // a0: refresh forced whenever the shadow camera moved at all (the sun moves every tick, so ~never skips);
    // a:  forced on pan/zoom, or once the sun turned > 0.002 rad since the last refresh (well under a texel)
    sun.shadow.autoUpdate = false;
    let n = 0; const last = [NaN, NaN, NaN, NaN]; const lastDir = L.env.sunDir.clone();
    const r0 = v.renderer.render.bind(v.renderer);
    v.renderer.render = (scene, cam) => {
      const t = v.rig.target, c = sun.shadow.camera, p = sun.position;
      let moved;
      if (mode === 'a0') {
        moved = p.x !== last[0] || p.y !== last[1] || p.z !== last[2] || c.right !== last[3];
        last[0] = p.x; last[1] = p.y; last[2] = p.z; last[3] = c.right;
      } else {
        moved = t.x !== last[0] || t.z !== last[1] || c.right !== last[3] || L.env.sunDir.dot(lastDir) < 1 - 2e-6;
        last[0] = t.x; last[1] = t.z; last[3] = c.right;
      }
      const up = moved || (n++ & 1) === 0 || sun.shadow.map === null;
      if (up) lastDir.copy(L.env.sunDir);
      sun.shadow.needsUpdate = up;
      window.__shadow9 = window.__shadow9 || { frames: 0, updates: 0 };
      window.__shadow9.frames++; if (up) window.__shadow9.updates++;
      return r0(scene, cam);
    };
  } else if (mode === 'b') {
    const kk = k || 0.6;
    const fit = L.fitShadow.bind(L);
    L.fitShadow = (t, r) => fit(t, r * kk);
  } else if (mode === 'c') {
    const dyn = new Set();
    v.wagons.group.traverse((o) => dyn.add(o));
    const statics = [];
    v.scene.traverse((o) => { if (o.castShadow && !dyn.has(o)) statics.push(o); });
    const sm = v.renderer.shadowMap, r0 = sm.render.bind(sm);
    sm.render = (...a) => {
      for (const o of statics) o.castShadow = false;
      try { return r0(...a); } finally { for (const o of statics) o.castShadow = true; }
    };
    window.__shadow9 = { statics: statics.length, dyn: [...dyn].filter((o) => o.castShadow).length };
  }
  return mode;
};
