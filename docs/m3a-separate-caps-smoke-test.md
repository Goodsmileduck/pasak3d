# M3a Separate + Caps Smoke Test Checklist

Run before declaring M3a separate-components and cap verification complete:

- [ ] `npx vitest run tests/` - all tests pass
- [ ] Open Pasak in the web app
- [ ] Import a multi-body STL or 3MF where one visible mesh contains two or more disconnected bodies
- [ ] Click Separate on the imported part in the parts tree
- [ ] Confirm the original parent part becomes hidden
- [ ] Confirm one child part appears per disconnected body, named `Body-1`, `Body-2`, and so on
- [ ] Select each separated child and confirm it can be shown, hidden, and selected independently
- [ ] Import or select a simple watertight solid
- [ ] Perform a plane cut through the body
- [ ] Confirm both cut halves appear as valid child parts in the parts tree
- [ ] Export the cut halves as STL or 3MF
- [ ] Open the exported halves in a slicer
- [ ] Confirm the planar cut faces are capped and the slicer reports the parts as clean/watertight
- [ ] Confirm no separate dowel parts are created by the Separate action itself
