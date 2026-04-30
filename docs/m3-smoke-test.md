# M3 Smoke Test Checklist

Run before declaring M3 complete:

- [ ] All M2 checks still pass
- [ ] `npm run test` — all tests pass (43+)
- [ ] `npm run typecheck` — exit 0
- [ ] `npm run build` — succeeds; worker chunk emitted
- [ ] `npm run dev` opens at http://localhost:5173

## Parts tree + multi-cut

- [ ] PartsTree appears on the left after a model is loaded
- [ ] Selecting a part in tree highlights it and opens the CutPanel
- [ ] Visibility checkboxes hide/show parts in scene
- [ ] After a cut: parent shows as hidden in tree, A/B children appear nested
- [ ] Selecting Body-A and cutting again produces Body-A-A / Body-A-B
- [ ] Dowels appear in their own collapsible section in the tree

## Auto-orient

- [ ] Each new part sits flush on Z=0 in the scene (largest face down)

## Undo / Redo

- [ ] Undo button removes the last cut, restores parent visibility
- [ ] Redo re-applies the cut with the same dowels

## Printer presets

- [ ] Printer dropdown lists Bambu (A1, A1 mini, X1, H2D), Prusa (MK4, Core One),
      Ender 3, Voron 2.4
- [ ] Status bar updates fit indicator when printer changes
- [ ] When all parts fit: green "All parts fit ..."
- [ ] When parts don't fit: amber "{n} parts too big — Suggest cuts" link
- [ ] Click "Suggest cuts" → modal previews count → Apply → cuts execute
- [ ] After apply: all parts fit the chosen printer

## Exploded view

- [ ] Slider appears in toolbar after first cut
- [ ] Dragging slider separates parts smoothly along radial directions from centroid
- [ ] At 0%: parts sit in their original positions

## Export

- [ ] Export button opens dialog
- [ ] Format toggle: Zip-of-STL or Single 3MF (multi-object)
- [ ] Include-dowels checkbox respected
- [ ] Filename input is editable
- [ ] Zip export: contains parts/Part_*.stl, dowels/dowel_*.stl
- [ ] 3MF export: re-import via DropZone → all parts present

## Keyboard shortcuts

- [ ] `O` opens file picker
- [ ] `X`, `Y`, `Z` open CutPanel with that axis selected
- [ ] `Esc` closes CutPanel / dialogs / overlays
- [ ] `Ctrl+Z` undoes the last cut
- [ ] `Ctrl+Shift+Z` redoes
- [ ] `Ctrl+E` opens Export dialog (only when there are cut parts)
- [ ] `?` toggles HelpOverlay
- [ ] None of the shortcuts fire when typing in an input field

## Error states

- [ ] Cut plane outside mesh → friendly "Cut plane doesn't intersect" toast
- [ ] Toast has Dismiss button
- [ ] Repairing the input mesh failure → "mesh has gaps" message (when applicable)

## Empty state

- [ ] On first load: DropZone shows prompt + Browse + "Try with a sample model"
- [ ] Sample model link loads the bundled keycap 3MF and opens CutPanel

## Known carry-overs / follow-ups

- BuildPlate canvas text still says "3D Lab Viewer" — polish before public launch
- No Tauri integration yet — desktop builds + auto-update land in M4
- Web only; Mac/Linux desktop builds, R2 download bucket, STEP support all v1.x+
