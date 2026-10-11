import type { SquadPresetSquad } from "@/types/domain"
import type { GameId } from "@/domain/games/game"

const hllRoleIconOptions = [
    "/img/roles/icn_commander.png",
    "/img/roles/icn_tankCommand.png",
    "/img/roles/icn_tankCrew.png",
    "/img/roles/icn_officer.png",
    "/img/roles/icn_sniper.png",
    "/img/roles/icn_recon.png",
    "/img/roles/icn_Rifleman.png",
    "/img/roles/icn_support.png",
    "/img/roles/icn_mg.png",
    "/img/roles/icn_assault.png",
    "/img/roles/icn_autorifleman.png",
    "/img/roles/icn_anti-tank.png",
    "/img/roles/icn_eng.png",
    "/img/roles/icn_medic.png",
] as const

// Vietnam currently uses the same role artwork as classic HLL, but it remains
// a distinct game catalog so either game's options can diverge independently.
const hllVietnamRoleIconOptions = [...hllRoleIconOptions] as const

const wardogsRoleIconOptions = [
    "/img/roles/icn_builder.png",
    "/img/roles/icn_havoc.png",
    "/img/roles/icn_humvee.png",
    "/img/roles/icn_littlebird.png",
    "/img/roles/icn_spa.png",
    "/img/roles/icn_tank.png",
    "/img/roles/icn_wdtank.png",
] as const

/**
 * Class and specialisation artwork from github.com/orourkek/Wow-Icons,
 * released under the Unlicense.  Keep this exhaustive so a guild can model
 * future Forever class additions without waiting for a Logi release.
 */
const wowForeverRoleIconOptions = [
    "/img/roles/wowf/class/deathknight.png",
    "/img/roles/wowf/class/druid.png",
    "/img/roles/wowf/class/hunter.png",
    "/img/roles/wowf/class/mage.png",
    "/img/roles/wowf/class/monk.png",
    "/img/roles/wowf/class/paladin.png",
    "/img/roles/wowf/class/priest.png",
    "/img/roles/wowf/class/rogue.png",
    "/img/roles/wowf/class/shaman.png",
    "/img/roles/wowf/class/warlock.png",
    "/img/roles/wowf/class/warrior.png",
    "/img/roles/wowf/spec/blood.png",
    "/img/roles/wowf/spec/frost.png",
    "/img/roles/wowf/spec/unholy.png",
    "/img/roles/wowf/spec/balance.png",
    "/img/roles/wowf/spec/feral.png",
    "/img/roles/wowf/spec/guardian.png",
    "/img/roles/wowf/spec/restoration.png",
    "/img/roles/wowf/spec/beastmastery.png",
    "/img/roles/wowf/spec/marksman.png",
    "/img/roles/wowf/spec/survival.png",
    "/img/roles/wowf/spec/arcane.png",
    "/img/roles/wowf/spec/fire.png",
    "/img/roles/wowf/spec/brewmaster.png",
    "/img/roles/wowf/spec/mistweaver.png",
    "/img/roles/wowf/spec/windwalker.png",
    "/img/roles/wowf/spec/holy.png",
    "/img/roles/wowf/spec/protection.png",
    "/img/roles/wowf/spec/retribution.png",
    "/img/roles/wowf/spec/discipline.png",
    "/img/roles/wowf/spec/shadow.png",
    "/img/roles/wowf/spec/assassination.png",
    "/img/roles/wowf/spec/combat.png",
    "/img/roles/wowf/spec/subtlety.png",
    "/img/roles/wowf/spec/elemental.png",
    "/img/roles/wowf/spec/enhancement.png",
    "/img/roles/wowf/spec/affliction.png",
    "/img/roles/wowf/spec/demonology.png",
    "/img/roles/wowf/spec/destruction.png",
    "/img/roles/wowf/spec/arms.png",
    "/img/roles/wowf/spec/fury.png",
] as const

const wardogsSquadIconOptions = [
    ...wardogsRoleIconOptions,
    "/stratmap/icons/wardogs/artillery.webp",
    "/stratmap/icons/wardogs/assault.webp",
    "/stratmap/icons/wardogs/bulkhead.webp",
    "/stratmap/icons/wardogs/driver.webp",
    "/stratmap/icons/wardogs/dune.webp",
    "/stratmap/icons/wardogs/fob.webp",
    "/stratmap/icons/wardogs/garage_vendor.webp",
    "/stratmap/icons/wardogs/havoc.webp",
    "/stratmap/icons/wardogs/heli.webp",
    "/stratmap/icons/wardogs/hill_warning.webp",
    "/stratmap/icons/wardogs/kodiak.webp",
    "/stratmap/icons/wardogs/lasthit.webp",
    "/stratmap/icons/wardogs/like.webp",
    "/stratmap/icons/wardogs/lonestar.webp",
    "/stratmap/icons/wardogs/manticore.webp",
    "/stratmap/icons/wardogs/medic.webp",
    "/stratmap/icons/wardogs/pilot.webp",
    "/stratmap/icons/wardogs/quad.webp",
    "/stratmap/icons/wardogs/recon.webp",
    "/stratmap/icons/wardogs/spawn_board.webp",
    "/stratmap/icons/wardogs/spawn_deploy.webp",
    "/stratmap/icons/wardogs/spawn_vehicle.webp",
    "/stratmap/icons/wardogs/spotted.webp",
    "/stratmap/icons/wardogs/support.webp",
    "/stratmap/icons/wardogs/tank.webp",
    "/stratmap/icons/wardogs/tower.webp",
    "/stratmap/icons/wardogs/ural.webp",
    "/stratmap/icons/wardogs/valkyra.webp",
    "/stratmap/icons/wardogs/vendor.webp",
    "/stratmap/icons/wardogs/wardogs.webp",
    "/stratmap/icons/wardogs/warning.webp",
    "/stratmap/icons/wardogs/weapons_vendor.webp",
] as const

/**
 * Wardogs uses its full tactical marker catalog for both squads and roles.
 * Keeping these selectors in sync lets a role use every icon available to a
 * squad block.
 */
export const roleIconOptionsByGame: Record<GameId, readonly string[]> = {
    hell_let_loose: hllRoleIconOptions,
    hell_let_loose_vietnam: hllVietnamRoleIconOptions,
    wardogs: wardogsSquadIconOptions,
    world_of_warcraft_forever: wowForeverRoleIconOptions,
}

export function getRoleIconOptions(gameId: GameId) {
    return roleIconOptionsByGame[gameId]
}

export function getSquadIconOptions(gameId: GameId): readonly string[] {
    return gameId === "wardogs"
        ? getRoleIconOptions(gameId)
        : roleIconOptionsByGame[gameId]
}

// Retained for roster layout editing until that editor receives a game context.
export const roleIconOptions = hllRoleIconOptions

export function createHllStarterSquadPreset(): SquadPresetSquad[] {
    return [
        {
            name: "Commander",
            group: "Command",
            order: 0,
            color: "#d4a017",
            icon: "/img/roles/icn_commander.png",
            roles: [
                {
                    name: "Commander",
                    color: "#d4a017",
                    icon: "/img/roles/icn_commander.png",
                    count: 1,
                },
            ],
        },
        {
            name: "Artillery",
            group: "Artillery",
            order: 0,
            color: "#b45309",
            icon: "/img/roles/icn_mg.png",
            roles: [
                {
                    name: "Artillery",
                    color: "#b45309",
                    icon: "/img/roles/icn_mg.png",
                    count: 1,
                },
            ],
        },
        {
            name: "Red",
            group: "Infantry",
            order: 2,
            color: "#dc2626",
            icon: "/img/roles/icn_officer.png",
            roles: [
                {
                    name: "Squad Leader",
                    color: "#dc2626",
                    icon: "/img/roles/icn_officer.png",
                    count: 2,
                },
                {
                    name: "Infantry",
                    color: "#dc2626",
                    icon: "/img/roles/icn_Rifleman.png",
                    count: 5,
                },
            ],
        },
        {
            name: "Blue",
            group: "Infantry",
            order: 3,
            color: "#2563eb",
            icon: "/img/roles/icn_officer.png",
            roles: [
                {
                    name: "Squad Leader",
                    color: "#2563eb",
                    icon: "/img/roles/icn_officer.png",
                    count: 2,
                },
                {
                    name: "Infantry",
                    color: "#2563eb",
                    icon: "/img/roles/icn_Rifleman.png",
                    count: 5,
                },
            ],
        },
        {
            name: "Green",
            group: "Infantry",
            order: 4,
            color: "#16a34a",
            icon: "/img/roles/icn_officer.png",
            roles: [
                {
                    name: "Squad Leader",
                    color: "#16a34a",
                    icon: "/img/roles/icn_officer.png",
                    count: 2,
                },
                {
                    name: "Infantry",
                    color: "#16a34a",
                    icon: "/img/roles/icn_Rifleman.png",
                    count: 5,
                },
            ],
        },
        {
            name: "Defend",
            group: "Defense",
            order: 5,
            color: "#f59e0b",
            icon: "/img/roles/icn_officer.png",
            roles: [
                {
                    name: "Squad Leader",
                    color: "#f59e0b",
                    icon: "/img/roles/icn_officer.png",
                    count: 2,
                },
                {
                    name: "Infantry",
                    color: "#f59e0b",
                    icon: "/img/roles/icn_Rifleman.png",
                    count: 3,
                },
            ],
        },
        {
            name: "Recon 1",
            group: "Recon",
            order: 6,
            color: "#0f766e",
            icon: "/img/roles/icn_recon.png",
            roles: [
                {
                    name: "Squad Leader",
                    color: "#0f766e",
                    icon: "/img/roles/icn_officer.png",
                    count: 1,
                },
                {
                    name: "Sniper",
                    color: "#0f766e",
                    icon: "/img/roles/icn_sniper.png",
                    count: 1,
                },
            ],
        },
        {
            name: "Recon 2",
            group: "Recon",
            order: 6,
            color: "#0f766e",
            icon: "/img/roles/icn_recon.png",
            roles: [
                {
                    name: "Squad Leader",
                    color: "#0f766e",
                    icon: "/img/roles/icn_officer.png",
                    count: 1,
                },
                {
                    name: "Sniper",
                    color: "#0f766e",
                    icon: "/img/roles/icn_sniper.png",
                    count: 1,
                },
            ],
        },
        {
            name: "Flex",
            group: "Flex",
            order: 7,
            color: "#64748b",
            icon: "/img/roles/icn_officer.png",
            roles: [
                {
                    name: "Squad Leader",
                    color: "#64748b",
                    icon: "/img/roles/icn_officer.png",
                    count: 2,
                },
                {
                    name: "Infantry",
                    color: "#64748b",
                    icon: "/img/roles/icn_Rifleman.png",
                    count: 3,
                },
            ],
        },
        {
            name: "Tank 1",
            group: "Armor",
            order: 8,
            color: "#7c3aed",
            icon: "/img/roles/icn_tankCommand.png",
            roles: [
                {
                    name: "Tank Commander",
                    color: "#7c3aed",
                    icon: "/img/roles/icn_tankCommand.png",
                    count: 1,
                },
                {
                    name: "Gunner",
                    color: "#7c3aed",
                    icon: "/img/roles/icn_tankCrew.png",
                    count: 1,
                },
                {
                    name: "Driver",
                    color: "#7c3aed",
                    icon: "/img/roles/icn_tankCrew.png",
                    count: 1,
                },
            ],
        },
        {
            name: "Tank 2",
            group: "Armor",
            order: 9,
            color: "#8b5cf6",
            icon: "/img/roles/icn_tankCommand.png",
            roles: [
                {
                    name: "Tank Commander",
                    color: "#8b5cf6",
                    icon: "/img/roles/icn_tankCommand.png",
                    count: 1,
                },
                {
                    name: "Gunner",
                    color: "#8b5cf6",
                    icon: "/img/roles/icn_tankCrew.png",
                    count: 1,
                },
                {
                    name: "Driver",
                    color: "#8b5cf6",
                    icon: "/img/roles/icn_tankCrew.png",
                    count: 1,
                },
            ],
        },
        {
            name: "Tank 3",
            group: "Armor",
            order: 10,
            color: "#8b5cf6",
            icon: "/img/roles/icn_tankCommand.png",
            roles: [
                {
                    name: "Tank Commander",
                    color: "#8b5cf6",
                    icon: "/img/roles/icn_tankCommand.png",
                    count: 1,
                },
                {
                    name: "Gunner",
                    color: "#8b5cf6",
                    icon: "/img/roles/icn_tankCrew.png",
                    count: 1,
                },
                {
                    name: "Driver",
                    color: "#8b5cf6",
                    icon: "/img/roles/icn_tankCrew.png",
                    count: 1,
                },
            ],
        },
        {
            name: "Tank 4",
            group: "Armor",
            order: 10,
            color: "#8b5cf6",
            icon: "/img/roles/icn_tankCommand.png",
            roles: [
                {
                    name: "Tank Commander",
                    color: "#8b5cf6",
                    icon: "/img/roles/icn_tankCommand.png",
                    count: 1,
                },
                {
                    name: "Gunner",
                    color: "#8b5cf6",
                    icon: "/img/roles/icn_tankCrew.png",
                    count: 1,
                },
                {
                    name: "Driver",
                    color: "#8b5cf6",
                    icon: "/img/roles/icn_tankCrew.png",
                    count: 1,
                },
            ],
        },
    ]
}

/** A flexible 20-player raid layout: managers freely rename/add/remove slots. */
export function createWowForeverStarterSquadPreset(): SquadPresetSquad[] {
    return Array.from({ length: 4 }, (_, index) => ({
        name: `Raid group ${index + 1}`,
        group: "Raid",
        order: index,
        color: "#7c3aed",
        icon: "/img/roles/wowf/class/priest.png",
        roles: [
            {
                name: "Tank",
                color: "#2563eb",
                icon: "/img/roles/wowf/spec/protection.png",
                count: 1,
            },
            {
                name: "Healer",
                color: "#16a34a",
                icon: "/img/roles/wowf/spec/holy.png",
                count: 1,
            },
            {
                name: "Damage",
                color: "#dc2626",
                icon: "/img/roles/wowf/class/mage.png",
                count: 3,
            },
        ],
    }))
}
