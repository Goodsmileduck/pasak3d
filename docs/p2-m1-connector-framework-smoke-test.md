# P2-M1 Connector Framework Smoke Test Checklist

Run before declaring P2-M1 connector-framework work complete:

- [ ] `npx vitest run tests/` - all automated tests pass
- [ ] Open Pasak in the web app
- [ ] Load `public/sample-keycap.3mf` from the empty-state sample link
- [ ] Open CutPanel and confirm the connector category segment shows Keyed and Snap
- [ ] Confirm Keyed lists the M1 connectors: Cylinder, Cube, Cross, Dovetail, Puzzle
- [ ] Confirm Snap has no selectable connectors in P2-M1
- [ ] With default Cylinder selected, cut the part and confirm output matches the Phase 1 default cylinder shape output: two cut parts plus one separate peg
- [ ] Select Cube from the Connector catalog, cut, and confirm the output matches the Phase 1 Cube shape output
- [ ] Select Cross from the Connector catalog, cut, and confirm the output matches the Phase 1 Cross shape output
- [ ] Select Dovetail from the Connector catalog, cut, and confirm the output matches the Phase 1 Dovetail shape output
- [ ] Select Puzzle from the Connector catalog, cut, and confirm the output matches the Phase 1 Puzzle shape output
- [ ] For each keyed connector, export as Zip-of-STL and confirm the cut parts and emitted connector piece are included
- [ ] For each keyed connector, export as Single 3MF and re-import through Pasak DropZone; all exported parts load
- [ ] Manual joint placement inherits the selected connector
- [ ] Changing polarity still preserves Phase 1 behavior for separate peg, male, female, and magnet
- [ ] Changing tolerance preset still changes cavity clearance only, not nominal connector piece dimensions

## Known carry-overs / follow-ups

- Additional keyed connector variants are deferred to P2-M2
- Snap-fit connectors are deferred to P2-M3
- Advanced connector placement controls are deferred to P2-M4
- Cosmetic (not a bug): the **Snap** category is empty until P2-M3, so selecting it shows a
  disabled "No connectors" select. The cut still uses the last keyed connector; geometry is correct.
