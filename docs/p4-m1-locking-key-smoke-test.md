# P4-M1 Locking Key Smoke Test Checklist

Run before declaring P4-M1 locking-key work complete:

- [ ] `npm run test` - all tests pass
- [ ] `npm run typecheck` - TypeScript passes without tuple widening errors
- [ ] `npm run build:web` - web build succeeds
- [ ] `npm run build` - desktop-targeted web build succeeds
- [ ] Open Pasak in the web app
- [ ] Load a representative model, such as `public/sample-keycap.3mf`
- [ ] Start a cut and open the Snap connector group
- [ ] Confirm the Snap connector catalog lists Locking key
- [ ] Select Locking key and confirm the cyan connector preview appears at the seam
- [ ] Cut the part and confirm the operation proceeds without connector errors
- [ ] Inspect the result and confirm both halves show a rounded-rectangle paddle socket
- [ ] Confirm the parts tree includes one separate locking key piece in addition to the two cut halves
- [ ] Inspect the locking key and confirm it has a flat paddle body with a snap barb at both ends
- [ ] Run Test-fit for Locking key and confirm it sweeps the key across the clearance ladder
- [ ] Use the Test-fit result to choose a clearance before trusting a single FDM print
- [ ] Export as Zip-of-STL and confirm the two halves and separate locking key are included
- [ ] Export as Single 3MF and re-import through Pasak DropZone; all exported parts load

## Print Notes

- Print the locking key so the paddle width and barb flex direction are supported by continuous perimeters where possible.
- FDM barb stiffness is material-, orientation-, and layer-height-sensitive; dial it in with Test-fit before relying on one clearance value.
