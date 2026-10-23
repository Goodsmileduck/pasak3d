# P6-M1 SDF Smoke Test Checklist

Run before declaring P6-M1 SDF work complete:

- [ ] `npm run test` - all automated tests pass
- [ ] `npm run typecheck` - TypeScript passes without emit
- [ ] `npm run build:web` - web production build succeeds
- [ ] `npm run build` - desktop-target production build succeeds
- [ ] Confirm `tests/cut/segment/sdf.test.ts` covers the SDF core for thin-slab local thickness
- [ ] Confirm `computeSDF` returns one SDF value per triangle
- [ ] Confirm representative indexed geometry computes SDF values without changing the public API
- [ ] Confirm representative non-indexed geometry computes SDF values without changing the public API
- [ ] Try a low `rayCount` for faster rough segmentation previews
- [ ] Try a higher `rayCount` for slower but steadier thickness estimates
- [ ] Confirm ray-count changes do not alter the `computeSDF(geometry, opts?)` return type

## Known carry-overs / follow-ups

- SDF core behavior is unit-tested; visual segmentation workflows remain deferred to later P6 milestones
- Ray count is a speed/quality tradeoff and may need tuning per model size and target responsiveness
- Indexed and non-indexed geometry are both supported by the same per-face SDF implementation
