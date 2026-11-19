# GWL API examples

These JSON fixtures are invented sandbox examples from the public
[GWL OpenAPI v1 document](https://gwl.gg/api/v1/openapi.json), retrieved
2026-11-19. They contain no live team/player data or API credentials.

The matching endpoint's `200` JSON example produced each file: `/team/fixtures`,
`/team/events`, `/team/slots`, `/team/matches/{number}/file`. Tests parse and map
them without external network calls. The sandbox dates are fixed by GWL.
