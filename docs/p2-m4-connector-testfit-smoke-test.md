# P2-M4 Connector Test-Fit Smoke Test Checklist

Run before declaring P2-M4 connector test-fit work complete:

- [ ] `npx vitest run tests/` - all automated tests pass
- [ ] Open Pasak in the web app
- [ ] Load `public/sample-keycap.3mf` from the empty-state sample link
- [ ] Open CutPanel and switch the connector category to Snap
- [ ] Select Snap pin and confirm the connector hint shows default clearance `0.25mm`
- [ ] Click Test-fit next to the connector picker
- [ ] Confirm the downloaded file is named `pasak-connector-testfit.zip`
- [ ] Open the zip and confirm it contains four A/B coupon pairs under `parts/`
- [ ] Confirm coupon filenames include `snap-pin` and increasing clearances starting at the connector default: `c0.25`, `c0.30`, `c0.35`, `c0.40`
- [ ] Open the A and B coupon STL files in a slicer
- [ ] Confirm every A coupon has a barbed Snap pin fused to the block and every B coupon has a matching socket cut from the block
- [ ] Print the coupon strip with the target material and slicer settings
- [ ] Test-fit each matching A/B pair after printing
- [ ] Confirm looser clearances fit more easily across the set
- [ ] Choose the pair where the pin snaps in cleanly without splitting the socket, and keep that clearance label for the connector's future cuts

## Known carry-overs / follow-ups

- Advanced connector placement controls remain deferred beyond Phase 2
- Material-specific connector tuning is validated manually with this coupon sweep
