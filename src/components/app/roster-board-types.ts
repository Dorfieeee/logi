export type DragState =
    | { type: "squad"; squadIndex: number }
    | { type: "section"; groups: string[] }
    | { type: "reserve"; userId: string }
    | { type: "notAttending"; userId: string }
    | { type: "slot"; squadIndex: number; playerIndex: number }

export type AttendanceStatus = "pending" | "acknowledged" | "confirmed"
export type RosterBoardMode = "view" | "layout" | "assignment"
