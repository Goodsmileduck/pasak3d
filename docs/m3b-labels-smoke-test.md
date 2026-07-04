# M3b Seam Labels Smoke Test Checklist

Run before declaring M3b seam-label work complete:

- [ ] `npx vitest run tests/` - all tests pass
- [ ] Open Pasak in the web app
- [ ] Import a watertight sample model and perform a plane cut to create two visible halves
- [ ] Click Label on the first cut half and emboss `A`
- [ ] Click Label on the second cut half and emboss `B`
- [ ] Confirm both parts remain selectable, hideable, and exportable from the parts tree
- [ ] Export the labeled halves as STL or 3MF
- [ ] Open the exported halves in a slicer preview
- [ ] Confirm the raised `A` and `B` labels are real geometry and remain legible on the surface
- [ ] Import or select another watertight part
- [ ] Apply a debossed numeric label, such as `1`, on the top face
- [ ] Export the debossed part and open it in a slicer preview
- [ ] Confirm the engraved number is cut into the surface, ends flush at the original face, and remains legible
- [ ] Confirm slicer preview reports all labeled parts as clean/watertight

## Known carry-overs / follow-ups

- Label placement UI is prompt-based in M3b; richer placement controls are deferred.
- **Flat-top assumption:** labels are a flat slab placed at the part's bbox top (max-Z, +Z normal),
  sunk `LABEL_SINK_MM` into the body so emboss fuses / deboss cuts through on approximately flat tops.
  On strongly curved or sloped top faces the emboss can partially detach and the deboss under-engrave.
  Surface-conforming labels (raycast the true surface point + normal per glyph) are a future enhancement.
