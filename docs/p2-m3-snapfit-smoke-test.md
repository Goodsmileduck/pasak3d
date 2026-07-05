# P2-M3 Snap-Fit Smoke Test Checklist

Run before declaring P2-M3 snap-fit work complete:

- [ ] `npx vitest run tests/cut/` - all cut and connector tests pass
- [ ] Open Pasak in the web app
- [ ] Load `public/sample-keycap.3mf` from the empty-state sample link
- [ ] Open CutPanel and confirm the Snap connector catalog lists Snap pin, Snap dovetail, and Cantilever clip
- [ ] Select Snap pin, cut the part, and confirm the result contains two cut halves plus one separate barbed pin
- [ ] Print or preview the Snap pin sockets and confirm each socket has a narrow bore with a wider relief chamber near the seated end
- [ ] Print the Snap pin with the pin axis lying sideways on the bed so the spherical barbs are supported by perimeter continuity rather than stacked vertically
- [ ] Seat the Snap pin and confirm the barbs pass the bore and hold in the relief chambers without splitting the socket
- [ ] Select Snap dovetail, cut the part, and confirm the result contains two cut halves plus one separate dovetail key with a detent bump
- [ ] Print the Snap dovetail key flat on the broad dovetail face and orient sockets so the detent dimple is not a large unsupported downward-facing overhang
- [ ] Slide the Snap dovetail into the sockets and confirm the detent clicks into the dimple at the seated position
- [ ] Select Cantilever clip, cut the part, and confirm the result contains two cut halves and no separate connector piece
- [ ] Inspect the Cantilever clip output and confirm the source half has the molded beam/hook while the receiver half has a slot with a wider catch recess
- [ ] Print the Cantilever clip with the beam length parallel to the layer direction where possible; avoid orienting the hook as an unsupported downward-facing overhang
- [ ] Seat the Cantilever clip and confirm the hook catches in the recess and holds under light pull force
- [ ] Export as Zip-of-STL and confirm all expected printed bodies are included for each connector
- [ ] Export as Single 3MF and re-import through Pasak DropZone; all exported parts load

## Known carry-overs / follow-ups

- Final per-material clearance is dialed in with connector test-fit coupons in P2-M4
- Advanced connector placement controls are deferred to P2-M4
