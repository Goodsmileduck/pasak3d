# P3-M1 Overhang Heatmap Smoke Test Checklist

Run before declaring P3-M1 overhang heatmap work complete:

- [ ] `npm run test` - all automated tests pass
- [ ] `npm run typecheck` - TypeScript passes without emit
- [ ] `npm run build:web` - web production build succeeds
- [ ] `npm run build` - desktop-target production build succeeds
- [ ] Open Pasak in the web app
- [ ] Load `public/sample-keycap.3mf` from the empty-state sample link
- [ ] Click Overhang in the toolbar and confirm the loaded model recolors
- [ ] Confirm up-facing and side-facing surfaces remain green/safe
- [ ] Confirm down-facing or steep underside faces read red/hot
- [ ] Drag the Overhang threshold slider and confirm the heatmap retunes live
- [ ] Click Overhang off and confirm the original palette color is restored
- [ ] Make a cut, enable Overhang, and confirm visible non-dowel cut parts recolor
- [ ] Confirm dowels stay unaffected by the heatmap
- [ ] Confirm the build plate stays unaffected by the heatmap
- [ ] Toggle part visibility and confirm only visible non-dowel parts use the heatmap
- [ ] Switch between light and dark scene themes and confirm the controls and colors remain legible

## Known carry-overs / follow-ups

- Bed-cut preview remains deferred to P3-M2
- Manual visual validation is required for heatmap readability across representative models
- Wireframe + overhang are independent view toggles applied by separate effects; enabling
  overhang while wireframe is on shows the solid heatmap (wireframe flag not carried onto the
  heatmap material). View-only, recoverable by re-toggling wireframe. Low priority; revisit if
  the combined view is wanted.
