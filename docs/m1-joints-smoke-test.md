# M1 Joints Smoke Test Checklist

Run before declaring M1 joint-system work complete:

- [ ] `npm run test` - all tests pass
- [ ] `npm run typecheck` - exit 0
- [ ] `npm run build:web` - web build succeeds
- [ ] `npm run build` - desktop build succeeds
- [ ] `npm run dev:web` opens at http://localhost:5173
- [ ] Load `public/sample-keycap.3mf` from the empty-state sample link
- [ ] Open CutPanel and confirm joint shape options: Cylinder, Cube, Cross, Dovetail, Puzzle
- [ ] Confirm joint polarity options: Separate peg, Male, Female, Magnet
- [ ] Default cut with no shape/polarity changes behaves like legacy dowels: cylindrical holes on both halves and separate cylindrical pegs
- [ ] Cylinder + separate peg: cut succeeds, parts and peg appear, export includes peg
- [ ] Cube + separate peg: cut succeeds, square peg appears, export includes peg
- [ ] Cross + separate peg: cut succeeds, cross peg appears, export includes peg
- [ ] Dovetail + separate peg: cut succeeds, dovetail peg appears, export includes peg
- [ ] Puzzle + separate peg: cut succeeds, puzzle peg appears, export includes peg
- [ ] Male polarity: cut succeeds and emits a printable joint piece
- [ ] Female polarity: cut succeeds, holes/recesses are present, no separate peg is emitted
- [ ] Magnet polarity: cut succeeds, blind recesses are visible on both cut faces, no separate peg is emitted
- [ ] Export as Zip-of-STL and open parts plus emitted pegs in Bambu Studio / Orca / PrusaSlicer
- [ ] Export as Single 3MF and re-import through Pasak DropZone; all exported parts load
- [ ] Changing tolerance preset still changes hole clearance only, not nominal peg dimensions
- [ ] Manual joint placement inherits the selected shape and polarity
- [ ] Dragging and deleting joint markers still works for all shapes/polarities

## Known carry-overs / follow-ups

- Test-fit coupon generator is deferred to M2
- Separate-components and cap verification are deferred to M3a
- Seam labels are deferred to M3b
