export function matchUrl(input: string): { id: string; url: string } {
    const gwl = /^https:\/\/gwl\.gg\/matches\/(\d{1,20})\/?$/.exec(input)
    if (gwl) return { id: gwl[1], url: `https://gwl.gg/matches/${gwl[1]}` }
    const slot =
        /^https:\/\/gwl\.gg\/matches\?slot=([a-zA-Z0-9_-]{1,128})$/.exec(input)
    if (slot) return { id: `gwl-slot-${slot[1]}`, url: input }
    if (
        !/^https:\/\/wardogsleague\.net\/matches\/[a-zA-Z0-9_-]{1,80}\/?$/.test(
            input
        )
    )
        throw new Error("Invalid Wardogs League match URL.")
    const url = new URL(input)
    const id = url.pathname.split("/")[2]
    return { id, url: `https://wardogsleague.net/matches/${id}` }
}
