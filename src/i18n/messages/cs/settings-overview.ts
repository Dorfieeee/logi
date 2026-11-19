export const settingsHub_overview = {
    title: "Nastavení",
    description: "Profil klanu, nastavení Discordu a integrace.",
    searchLabel: "Hledat v nastavení",
    searchPlaceholder: "Hledat: kanál, role, API klíč…",
    noResults: "Nic nenalezeno",
    noResultsDescription: "Zkuste jiné slovo, například kanál, role nebo klíč.",
    groupHints: {
        clan: "Platí pro všechny hry",
        matches: "Výchozí hodnoty pro nové zápasy a jejich zprávy",
        discord: "Bot, kanály, role a panely",
        gameData: "Servery, ze kterých Logi sbírá výsledky",
        web: "Volitelné: web klanu, přihlášení a další služby",
        maintenance: "Jednorázové nástroje",
    },
    badges: {
        done: "Hotovo",
        notSet: "Nenastaveno",
        on: "Zapnuto",
        off: "Vypnuto",
        collecting: {
            one: "{count} sbírá",
            few: "{count} sbírají",
            many: "{count} sbírá",
            other: "{count} sbírá",
        },
        failing: {
            one: "{count} s chybou",
            few: "{count} s chybou",
            many: "{count} s chybou",
            other: "{count} s chybou",
        },
        missingChannels: {
            one: "Chybí {count} kanál",
            few: "Chybí {count} kanály",
            many: "Chybí {count} kanálu",
            other: "Chybí {count} kanálů",
        },
        gamesOn: {
            one: "{count} zapnutá",
            few: "{count} zapnuté",
            many: "{count} zapnuté",
            other: "{count} zapnutých",
        },
        templates: {
            one: "{count} šablona",
            few: "{count} šablony",
            many: "{count} šablony",
            other: "{count} šablon",
        },
    },
    tiles: {
        profile: {
            title: "Profil klanu",
            description: "Název, logo a popis klanu.",
        },
        games: {
            title: "Hry",
            description:
                "Které hry klan hraje. Podle nich Logi nabízí další volby.",
        },
        "event-categories": {
            title: "Kategorie akcí",
            description: "Barvy a emoji pro typy akcí v kalendáři.",
        },
        "match-templates": {
            title: "Šablony zápasů",
            description:
                "Výchozí časy, přihlášky, ping a soupiska pro nový zápas.",
        },
        presets: {
            title: "Předvolby čet a témat",
            description:
                "Rozložení čet a rolí pro soupisky, témata pro fórum zápasu.",
        },
        messages: {
            title: "Zprávy a panely",
            description: "Vzhled zpráv bota, co bot posílá a přehled panelů.",
        },
        channels: {
            title: "Kanály a jazyk",
            description:
                "Kam bot posílá oznámení, akce a chyby. Časové pásmo a jazyk.",
        },
        "discord-panels": {
            title: "Panely v Discordu",
            description:
                "Živé servery, výsledky, liga a kalendář, které bot drží aktuální.",
        },
        "panel-graphics": {
            title: "Grafika panelů",
            description: "Styl panelů serverů, bannery serverů a obrázky map.",
        },
        "discord-seed": {
            title: "Seed serverů",
            description: "Výzva k seedu, role Seed, rozvrh a historie seedů.",
        },
        roles: {
            title: "Role a přístup",
            description: "Klanová role a role, která smí spravovat Logi.",
        },
        commands: {
            title: "Příkazy",
            description: "Které příkazy bot nabízí, kdo je smí použít a kde.",
        },
        membership: {
            title: "Členství",
            description: "Role náboru a přijetí, pravidla skóre soupisky.",
        },
        tickets: {
            title: "Tickety",
            description: "Panel pro tickety, kategorie a kanály.",
        },
        "game-servers": {
            title: "Herní servery",
            description: "CRCON a Warcon servery, jejich API klíče a sběr dat.",
        },
        history: {
            title: "Uchovávání historie",
            description: "Jak dlouho Logi drží odehrané hry.",
        },
        league: {
            title: "Global Wardogs League",
            description:
                "Sledování ligových zápasů a karty v Discordu. Jen pro Wardogs.",
        },
        apiKeys: {
            title: "API klíče",
            description: "Klíče pro web klanu a další aplikace.",
        },
        login: {
            title: "Přihlášení na web",
            description:
                "Vlastní přihlašovací stránka a aplikace jednotného přihlášení (SSO).",
        },
        webAccess: {
            title: "Oprávnění webu",
            description:
                "Které role smí přes web číst členství a zakládat akce. Navazuje na API klíč a SSO.",
        },
        calendar: {
            title: "Kalendář Google",
            description: "Odkaz pro odběr kalendáře klanu.",
        },
        webhooks: {
            title: "Webhooky",
            description:
                "Upozornění pro jiné služby, když se v Logi něco změní.",
        },
        imports: {
            title: "Importy a opravy dat",
            description:
                "Hromadný import akcí, hráčů a Platform ID, přepočet statistik.",
        },
        "helper-data": {
            title: "Pomocná data",
            description: "Výchozí předvolby a jejich obnovení.",
        },
    },
    setup: {
        title: "Nastavení prostoru",
        description:
            "Dokončete povinné kroky, aby bot mohl ohlašovat akce a hlídat přístup.",
        progress: "{done} ze {total} hotovo",
        progressLabel: "Postup nastavení",
        continue: "Pokračovat v průvodci",
        continueHelp: "Otevře první nedokončený krok.",
        optional: "volitelné",
        fix: "Doplnit",
        setUp: "Nastavit",
        steps: {
            bot: {
                title: "Bot na Discordu",
                done: "Bot je na serveru a vidí kanály.",
                missing: "Bot zatím na serveru není.",
            },
            games: {
                title: "Hry",
                missing: "Vyberte, co klan hraje",
            },
            profile: {
                title: "Profil klanu",
                detail: "Název, logo a popis",
            },
            channels: {
                title: "Kanály",
                done: "Kanál pro oznámení je vybraný",
                missing: "Chybí kanál pro oznámení",
            },
            roles: {
                title: "Role a přístup",
                detail: "Kdo smí spravovat Logi",
            },
            gameServers: {
                title: "Herní servery",
                done: {
                    one: "{count} server sbírá data",
                    few: "{count} servery sbírají data",
                    many: "{count} serveru sbírá data",
                    other: "{count} serverů sbírá data",
                },
                missing: "Výsledky a statistiky ze serveru",
            },
        },
    },
} as const
