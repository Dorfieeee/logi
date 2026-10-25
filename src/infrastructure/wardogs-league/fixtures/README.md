# Public HTML fixture provenance

`scheduled.html` is the semantic main content captured anonymously from
https://wardogsleague.net/matches/cmuqt8ep605e1lf018w2nlywu on
2026-10-02T18:32:33.561Z (HTTP 200, text/html). The original response was
145,419 bytes. Scripts/RSC, navigation, forms/dialogs, SVG and artwork URLs,
styling and presentation attributes were removed; section IDs, labels, links,
datetime values and public text were preserved. This is captured Scheduled HTML,
not an invented completed-match fixture. See the evidence manifest for hashes.

Tests mutate this capture to remove/reorder sections, duplicate cards, change
times or substitute an unsupported Completed label. Those are **synthetic
regressions**, not evidence of a real completed, live, canceled or no-show page.

## Verified final-result captures, 24 October 2026

These are actual anonymous HTTP 200 `text/html; charset=utf-8` responses from
the official League site. [results-provenance.json](results-provenance.json)
records each exact URL, UTC capture time, original byte count and SHA-256,
and the reduced fixture byte count and SHA-256. Raw scripts/RSC and media were
discarded; only semantic main content remains. Index-tab navigation is retained
because it establishes the index parser's fixtures/results tab contract.

| Fixture | Official page | Observed meaning |
| --- | --- | --- |
| `completed-admin.html` | [Match #58](https://wardogsleague.net/matches/cmv520uf003glmm01f2ti157i) | `Set by admin`, Placements done with `0/3` submissions, final admin step done; explicit ranks III 1, ROG 2, HTD 3 |
| `completed-confirmed.html` | [Match #26](https://wardogsleague.net/matches/cmuim5nu20073lf01332kozcf) | `Confirmed`, Placements `3/3`, Confirmed done; explicit ranks ROG 1, BMF 2, RCNE 3 |
| `completed-two-ranked.html` | [Match #16](https://wardogsleague.net/matches/cmuduewpx0001o601v5we0g4e) | `Set by admin`, **two** teams; published ranks AK\| 2 and BAMC 3, without a first-place row; profile path `AK%7C` |
| `index-results.html` | [Results index](https://wardogsleague.net/matches?tab=results) | Public match links include all three captures; no authenticated account or Team API key |

Final pages replace the old `lineup-title`/`brief-title` sections with
`section[aria-labelledby="placements-title"]`, whose direct ordered-list cards
show a numeric rank and a team profile link/code/name/faction. The header names
the actual team count. The scoring rule explicitly says `1st 3 pts · 2nd 2 · 3rd 1`.
The result parser uses those ranks and identities, never list order, point totals,
map votes or submission count. It requires exactly the stated number of cards
and the matching Confirmed/Set by admin progress step to be done.

Ties, reordered/removed/duplicated cards, foreign links, disputed/unknown statuses
and unfinished confirmation in tests are **synthetic regressions derived from
these captures**, not evidence of live tied, disputed, provisional or no-show
markup. The two-ranked capture does not establish why first place is absent;
Logi keeps the two published ranks without inventing a winner or no-show.
