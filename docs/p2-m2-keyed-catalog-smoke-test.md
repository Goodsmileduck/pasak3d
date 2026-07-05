# P2-M2 Keyed Catalog Smoke Test Checklist

Run before declaring P2-M2 keyed-catalog work complete:

- [ ] `npx vitest run tests/cut/` - all cut and connector tests pass
- [ ] Open Pasak in the web app
- [ ] Load `public/sample-keycap.3mf` from the empty-state sample link
- [ ] Open CutPanel and confirm the Keyed connector catalog lists T-slot alongside Cylinder, Cube, Cross, Dovetail, and Puzzle
- [ ] Select T-slot from the Keyed catalog
- [ ] Cut the part and confirm the result contains two cut halves plus one separate T-slot key
- [ ] Export as Zip-of-STL and confirm the two halves and the printed T-slot key are included
- [ ] Export as Single 3MF and re-import through Pasak DropZone; all exported parts load
- [ ] Print or preview the key and sockets, then confirm the T-slot key slides into the sockets with the selected tolerance preset
- [ ] Select Cylinder, Cube, Cross, Dovetail, and Puzzle again and confirm their Phase 1 / P2-M1 output is unchanged: two cut halves plus the expected M1 connector behavior
- [ ] Confirm Snap still has no selectable connectors in P2-M2

## Known carry-overs / follow-ups

- Snap-fit connectors are deferred to P2-M3
- Connector test-fit coupons and per-connector tolerance sweeps are deferred to P2-M4
