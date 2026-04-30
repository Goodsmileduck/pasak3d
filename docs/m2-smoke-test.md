# M2 Smoke Test Checklist

Run before declaring M2 complete:

- [ ] All M1 checks still pass
- [ ] `npm run test` — all tests pass (28+)
- [ ] `npm run typecheck` — exit 0
- [ ] `npm run build` — succeeds; `dist/assets/cut-worker-*.js` chunk present
- [ ] `npm run dev` opens at http://localhost:5173
- [ ] Drop `tests/fixtures/cube.stl` → CutPanel appears on the left
- [ ] Switch axis between X / Y / Z → cut plane re-orients in scene
- [ ] Drag position slider → cut plane translates; dowel markers update live
- [ ] Type position value → cut plane jumps; dowel markers update
- [ ] Adjust dowel count, diameter, length → markers reflect new values
- [ ] Change tolerance preset → no visual change yet (applied at cut time)
- [ ] Click Cut → spinner shows, then two halves + dowels appear in scene
- [ ] Click Export → zip downloads
- [ ] Unzip: contains parts/Part_A.stl, parts/Part_B.stl, dowels/dowel_NN.stl, README.txt
- [ ] Open Part_A.stl in Bambu Studio / Orca / PrusaSlicer → loads cleanly with hole geometry
- [ ] Place dowel in hole → dowel fits with appropriate clearance (PLA-tight: snug; PLA-loose: easy slide)
- [ ] Cut plane outside mesh → error message shown
- [ ] Reload page → state resets cleanly

## Known limitations (deferred to M3 or later)

- Single cut only — multi-cut workflow lands in M3
- No undo/redo — M3
- No auto-orient post-cut — M3
- No printer presets / fit suggest — M3
- BuildPlate canvas text still says "3D Lab Viewer" — polish task before public launch
