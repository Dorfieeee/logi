"use client"

import {
    type CellContext,
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Search } from "lucide-react"
import * as React from "react"
import Link from "next/link"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

type ClientRow = {
    id: string
    href: string
    cells: React.ReactNode[]
}

const PAGE_SIZE_OPTIONS = ["10", "20", "30", "50"] as const

export function ResourceTableClient({
    columnTitles,
    columnClassNames,
    rows,
    dictionary,
    page,
    pageSize,
    pageCount,
    totalRows,
    search,
    searchPlaceholder,
    className,
    clickableRows = false,
}: {
    columnTitles: string[]
    columnClassNames?: string[]
    rows: ClientRow[]
    dictionary: Dictionary
    page: number
    pageSize: number
    pageCount: number
    totalRows: number
    search: string
    searchPlaceholder?: string
    className?: string
    clickableRows?: boolean
}) {
    const router = useRouter()
    const pathname = usePathname()
    const currentSearchParams = useSearchParams()
    const [searchValue, setSearchValue] = React.useState(search)

    React.useEffect(() => {
        setSearchValue(search)
    }, [search])

    const updateQuery = React.useCallback(
        (updates: Record<string, string | null>) => {
            const params = new URLSearchParams(currentSearchParams.toString())

            Object.entries(updates).forEach(([key, value]) => {
                if (!value) {
                    params.delete(key)
                    return
                }

                params.set(key, value)
            })

            const query = params.toString()
            router.push(query ? `${pathname}?${query}` : pathname)
        },
        [currentSearchParams, pathname, router]
    )

    React.useEffect(() => {
        const timeout = window.setTimeout(() => {
            if (searchValue === search) return

            updateQuery({
                search: searchValue.trim() || null,
                page: null,
            })
        }, 250)

        return () => window.clearTimeout(timeout)
    }, [search, searchValue, updateQuery])

    const tableColumns = React.useMemo<ColumnDef<ClientRow>[]>(
        () => [
            ...columnTitles.map((title, index): ColumnDef<ClientRow> => ({
                id: `column-${index}`,
                header: title,
                cell: (context: CellContext<ClientRow, unknown>) =>
                    context.row.original.cells[index],
                meta: {
                    className: columnClassNames?.[index],
                },
            })),
            {
                id: "actions",
                header: dictionary.common.actions,
                cell: (context: CellContext<ClientRow, unknown>) => (
                    <div className="text-right">
                        <Button asChild variant="ghost" size="sm">
                            <Link href={context.row.original.href}>
                                {dictionary.shared.openColumn}
                                <ArrowRight className="size-4" />
                            </Link>
                        </Button>
                    </div>
                ),
                meta: {
                    className: "w-[120px] text-right",
                },
            },
        ],
        [
            columnClassNames,
            columnTitles,
            dictionary.common.actions,
            dictionary.shared.openColumn,
        ]
    )

    const table = useReactTable({
        data: rows,
        columns: tableColumns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount,
        state: {
            pagination: {
                pageIndex: page - 1,
                pageSize,
            },
        },
    })

    const firstRow = totalRows === 0 ? 0 : (page - 1) * pageSize + 1
    const lastRow = totalRows === 0 ? 0 : Math.min(page * pageSize, totalRows)

    return (
        <div
            className={`border-border/60 bg-card flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border ${className ?? ""}`}
        >
            <div className="flex shrink-0 flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-sm">
                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        value={searchValue}
                        onChange={(event) => setSearchValue(event.target.value)}
                        placeholder={
                            searchPlaceholder ??
                            dictionary.userManagement.searchPlaceholder
                        }
                        className="rounded-xl pl-9"
                    />
                </div>
                <Select
                    value={String(pageSize)}
                    onValueChange={(value) =>
                        updateQuery({ pageSize: value, page: null })
                    }
                >
                    <SelectTrigger className="w-full rounded-xl sm:w-[150px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                                {option} / page
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className={`bg-card sticky top-0 z-10 ${(header.column.columnDef.meta as { className?: string } | undefined)?.className ?? ""}`}
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef
                                                      .header,
                                                  header.getContext()
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    className={
                                        clickableRows
                                            ? "cursor-pointer"
                                            : undefined
                                    }
                                    onClick={
                                        clickableRows
                                            ? (event) => {
                                                  if (
                                                      (
                                                          event.target as HTMLElement
                                                      ).closest(
                                                          "a,button,input,select,textarea,[role=button]"
                                                      )
                                                  )
                                                      return
                                                  if (
                                                      window
                                                          .getSelection()
                                                          ?.toString()
                                                  )
                                                      return
                                                  if (
                                                      event.ctrlKey ||
                                                      event.metaKey
                                                  )
                                                      window.open(
                                                          row.original.href,
                                                          "_blank",
                                                          "noopener,noreferrer"
                                                      )
                                                  else
                                                      router.push(
                                                          row.original.href
                                                      )
                                              }
                                            : undefined
                                    }
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className={
                                                (
                                                    cell.column.columnDef
                                                        .meta as
                                                        | { className?: string }
                                                        | undefined
                                                )?.className
                                            }
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columnTitles.length + 1}
                                    className="text-muted-foreground px-6 py-12 text-center text-sm"
                                >
                                    {search
                                        ? dictionary.shared.noMatchingResults
                                        : dictionary.shared.nothingCreatedYet}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="text-muted-foreground flex shrink-0 flex-col gap-3 border-t px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                    {dictionary.shared.showingResults
                        .replace("{from}", String(firstRow))
                        .replace("{to}", String(lastRow))
                        .replace("{total}", String(totalRows))}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={page <= 1}
                        onClick={() => updateQuery({ page: String(page - 1) })}
                    >
                        {dictionary.shared.previousPage}
                    </Button>
                    <Badge variant="secondary" className="rounded-full px-3">
                        {dictionary.shared.pageLabel
                            .replace("{page}", String(page))
                            .replace("{pages}", String(pageCount))}
                    </Badge>
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={page >= pageCount}
                        onClick={() => updateQuery({ page: String(page + 1) })}
                    >
                        {dictionary.shared.nextPage}
                    </Button>
                </div>
            </div>
        </div>
    )
}

export function StatusBadge({
    active,
    activeLabel,
    inactiveLabel,
}: {
    active: boolean
    activeLabel: string
    inactiveLabel: string
}) {
    return (
        <Badge
            variant={active ? "default" : "secondary"}
            className="rounded-full px-3"
        >
            {active ? activeLabel : inactiveLabel}
        </Badge>
    )
}
