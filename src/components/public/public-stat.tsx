export function PublicStat({
    label,
    value,
    help,
}: {
    label: string
    value: string
    help?: string
}) {
    return (
        <div title={help}>
            <p className="text-xl font-semibold tabular-nums">{value}</p>
            <p className="text-muted-foreground text-xs">{label}</p>
        </div>
    )
}
