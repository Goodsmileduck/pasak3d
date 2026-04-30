# M1 Smoke Test Checklist

Run before declaring M1 complete:

- [ ] `npm install` from clean clone succeeds
- [ ] `npm run typecheck` exits 0
- [ ] `npm run test` — all tests pass
- [ ] `npm run build` produces `dist/` with no errors
- [ ] `npm run dev` opens at http://localhost:5173
- [ ] Empty state: DropZone visible with prompt text
- [ ] Drop `tests/fixtures/cube.stl` → cube renders, status bar shows "12 tris, 10×10×10 mm"
- [ ] Drop `tests/fixtures/sample.3mf` → keycap renders
- [ ] Drop `tests/fixtures/cube.obj` → cube renders
- [ ] Drop `tests/fixtures/cube.glb` → cube renders
- [ ] Drop a `.txt` file → red error banner shows
- [ ] BuildPlate visible under model
- [ ] AxisCube in top-right tracks camera orientation
- [ ] OrbitControls work: drag to rotate, wheel to zoom, right-drag to pan
- [ ] Z-axis is up (model sits on plate)
