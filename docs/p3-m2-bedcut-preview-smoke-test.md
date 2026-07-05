# P3-M2 Bed-cut Preview Smoke Test Checklist

Run before declaring P3-M2 bed-cut preview work complete:

- [ ] `npm run test` - all automated tests pass
- [ ] `npm run typecheck` - TypeScript passes without emit
- [ ] `npm run build:web` - web production build succeeds
- [ ] `npm run build` - desktop-target production build succeeds
- [ ] Open Pasak in the web app
- [ ] Load an oversized model that does not fit the selected printer volume
- [ ] Select a small printer preset that makes at least one visible part exceed the build volume
- [ ] Click Suggest cuts and confirm the Suggested cuts dialog appears
- [ ] Confirm N amber cut planes appear in the scene, matching the number of pending suggested cuts
- [ ] Confirm the amber planes sit at the intended split locations for the oversized part
- [ ] Start or preview a manual cut and confirm the active cyan cut-plane gizmo remains visually distinct from the amber suggested planes
- [ ] Click on or through an amber suggested plane and confirm it is non-interactive and does not add manual dowels or capture the active cut-plane click
- [ ] Click Cancel in the Suggested cuts dialog and confirm the amber planes clear from the scene
- [ ] Re-run Suggest cuts, press Escape, and confirm the amber planes clear from the scene
- [ ] Re-run Suggest cuts, click Apply, and confirm the amber planes clear after the sequential cuts are applied
- [ ] Switch between light and dark scene themes and confirm the amber suggested planes remain legible

## Known carry-overs / follow-ups

- Manual visual validation is required for preview placement across representative oversized models
- Suggested cut planes are read-only scene gizmos; changing cut strategy remains owned by the fit-to-printer suggestion flow
