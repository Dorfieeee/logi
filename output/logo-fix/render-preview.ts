import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { parseTeamSource, allowedTeamSourceUrl } from "../../src/infrastructure/team-sources/team-source"
import { buildMatchImage } from "../../src/domain/events/match-image"
import { createMatchImageRenderer } from "../../src/lib/panel-image/match-render"
import { readBoundedBytes } from "../../src/lib/api/request-bytes"

async function main() {
    const wardogs = parseTeamSource("wardogs", await readFile("output/logo-fix/wardogs.html", "utf8"))
    const helo = parseTeamSource("hell_let_loose", await readFile("output/logo-fix/helo.json", "utf8"))
    const wanted = ["VLK", "BAMC", "LZRD"].map(code => wardogs.find(team => team.shortCode === code)).filter(team => !!team)
    const selected = wanted.length === 3 ? wanted : wardogs.slice(0,3)
    const bytes = new Map<string, Uint8Array>()
    for (const team of [...selected, ...helo.slice(0,2)]) {
        if (!team.logoUrl || !allowedTeamSourceUrl(team.logoUrl)) continue
        const response = await fetch(team.logoUrl, {redirect:"error",signal:AbortSignal.timeout(15000)})
        const image = response.ok ? await readBoundedBytes(response, 8*1024*1024) : null
        if (image) bytes.set(team.logoUrl,image)
    }
    const render = createMatchImageRenderer({ publicDir: path.resolve("public"), loadLogo: async url => bytes.get(url) ?? null })
    const base = {clan:{name:selected[0]!.name},ownTeam:{id:"0",name:selected[0]!.name,shortCode:selected[0]!.shortCode},language:"cs" as const,timeZone:"Europe/Prague",league:"Wardogs League",categories:[{id:"friendly",label:"Přátelák"}]}
    const event={name:selected.map(t=>t.shortCode).join(" vs "),gameId:"wardogs",map:"Zestafona",matchType:"friendly",meetingStart:"2026-10-25T16:00:00Z",gameStart:"2026-10-25T16:30:00Z",matchTeams:selected.map((t,i)=>({teamId:String(i),slot:(["a","b","c"] as const)[i]!,side:["Valkyra","Manticore","Lonestar"][i]!,snapshot:t}))}
    await writeFile("output/logo-fix/match.png",await render(buildMatchImage({...base,event})))
    await writeFile("output/logo-fix/result.png",await render(buildMatchImage({...base,event,result:{participants:[{label:"Valkyra",score:300},{label:"Manticore",score:200},{label:"Lonestar",score:100}]}})))
    const hll={...event,name:helo.slice(0,2).map(t=>t.shortCode).join(" vs "),gameId:"hell_let_loose",map:"Carentan_warfare_day",matchTeams:helo.slice(0,2).map((t,i)=>({teamId:String(i),slot:(["a","b"] as const)[i]!,side:i===0?"Allies":"Axis",snapshot:t}))}
    await writeFile("output/logo-fix/hll.png",await render(buildMatchImage({...base,clan:{name:helo[0]!.name},event:hll,league:null})))
    await sharp({create:{width:1200,height:675,channels:4,background:"#313338"}}).composite([{input:await sharp("output/logo-fix/match.png").resize(600,337).toBuffer(),left:0,top:0},{input:await sharp("output/logo-fix/result.png").resize(600,337).toBuffer(),left:600,top:0},{input:await sharp("output/logo-fix/hll.png").resize(600,337).toBuffer(),left:300,top:338}]).png().toFile("output/logo-fix/after.png")
    console.log(JSON.stringify({wardogsTeams:wardogs.length,wardogsLogos:wardogs.filter(t=>t.logoUrl).length,heloTeams:helo.length,heloLogos:helo.filter(t=>t.logoUrl).length,downloadedLogos:bytes.size,previewTeams:selected.map(t=>t.shortCode)}))
}
void main()
