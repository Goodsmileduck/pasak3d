# M2 Test-Fit Smoke Test Checklist

Run before declaring M2 test-fit work complete:

- [ ] `npx vitest run tests/cut/ tests/components/` - all cut and component tests pass
- [ ] Open Pasak in the web app
- [ ] Set the joint shape to Cylinder in the cut panel
- [ ] Click Test-fit in the toolbar
- [ ] Confirm the downloaded file is named `pasak-testfit.zip`
- [ ] Open the zip and confirm it contains four A/B coupon pairs under `parts/`
- [ ] Confirm coupon filenames encode cylinder shape and increasing clearances: `c0.10`, `c0.15`, `c0.20`, `c0.25`
- [ ] Open the A and B coupon STL files in a slicer
- [ ] Confirm every A coupon has a protruding key and every B coupon has a matching socket
- [ ] Print the A/B coupon sweep with normal material and slicer settings
- [ ] Test-fit each matching A/B pair after printing
- [ ] Confirm looser clearances fit more easily across the set
- [ ] Keep the clearance label from the best-fitting pair for future cuts

## Known carry-overs / follow-ups

- Separate-components and cap verification are deferred to M3a
- Seam labels are deferred to M3b
