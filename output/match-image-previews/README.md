# Match image verification

Synthetic teams and scores rendered with the production renderer. No Discord,
Convex or provider calls are made by the preview command.

```sh
node --import tsx scripts/preview-match-images.ts
```

- `01-clan-only.png`: clan centered without assigned teams.
- `02-two-teams-hll.png`: two teams and the HLL icon.
- `03-three-teams-wardogs-league.png`: three teams and a centered league heading.
- `04-no-map-gray.png`: Discord gray without map art.
- `05-victory.png`: reviewed three-team victory attributed to the clan.
- `06-defeat.png`: reviewed HLL defeat attributed to the clan.
- `all-variants.png` / `index.html`: combined gallery.

Six images plus the gallery render in approximately 1.4 seconds on this machine.
The bot and web server cache unchanged content; uploaded match pictures override
the generated announcement picture. Game icons, map art and the Logi logo are
packaged project assets; sample team badges are synthetic.

Verification logs beside the images record the full tests, focused image checks,
TypeScript check, production build, formatting and Convex runtime bundle checks.
Real Discord publication and authenticated browser flows were not exercised in
this session; the browser automation surface was unavailable. Bot message and
publication behavior are covered by synthetic tests.
