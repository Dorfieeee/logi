import * as React from "react"

import { ResourceTableClient } from "@/components/app/resource-table-client"
import { GameBadge } from "@/components/app/game-badge"
import type { Dictionary } from "@/i18n/dictionaries"
import type { GameId } from "@/domain/games/game"

type ColumnConfig<T> = {
    key: string
    title: string
    render: (row: T) => React.ReactNode
    className?: string
}

export function ResourceTable<T extends { id: string }>({
    columns,
    rows,
    getHref,
    dictionary,
    page,
    pageSize,
    pageCount,
    totalRows,
    search,
    searchPlaceholder,
    className,
    gameColumn,
    clickableRows = false,
}: {
    columns: Array<ColumnConfig<T>>
    rows: T[]
    getHref: (row: T) => string
    dictionary: Dictionary
    page: number
    pageSize: number
    pageCount: number
    totalRows: number
    search: string
    searchPlaceholder?: string
    className?: string
    gameColumn?: { show: boolean; getGameId: (row: T) => GameId | undefined }
    clickableRows?: boolean
}) {
    const resolvedColumns = gameColumn?.show
        ? [
              {
                  key: "game",
                  title: dictionary.games.column,
                  className: "w-1",
                  render: (row: T) => (
                      <GameBadge
                          gameId={gameColumn.getGameId(row)}
                          dictionary={dictionary}
                      />
                  ),
              },
              ...columns,
          ]
        : columns
    return (
        <ResourceTableClient
            clickableRows={clickableRows}
            dictionary={dictionary}
            page={page}
            pageSize={pageSize}
            pageCount={pageCount}
            totalRows={totalRows}
            search={search}
            searchPlaceholder={searchPlaceholder}
            className={className}
            columnTitles={resolvedColumns.map((column) => column.title)}
            columnClassNames={resolvedColumns.map(
                (column) => column.className ?? ""
            )}
            rows={rows.map((row) => ({
                id: row.id,
                href: getHref(row),
                cells: resolvedColumns.map((column) => (
                    <React.Fragment key={column.key}>
                        {column.render(row)}
                    </React.Fragment>
                )),
            }))}
        />
    )
}

export { StatusBadge } from "@/components/app/resource-table-client"
