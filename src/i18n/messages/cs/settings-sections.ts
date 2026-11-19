export const settingsHub_sections = {
    profile: {
        title: "Profil klanu",
        description: "Název, logo a popis klanu.",
    },
    games: {
        title: "Hry",
        description: "Které hry klan hraje.",
    },
    "event-categories": {
        title: "Kategorie akcí",
        description:
            "Štítky a barvy zápasů a tréninků, například Přátelák nebo Liga.",
    },
    "match-templates": {
        title: "Šablony zápasů",
        description:
            "Co se předvyplní při zakládání nového zápasu. V konkrétním zápase to jde změnit.",
    },
    presets: {
        title: "Předvolby čet a témat",
        description:
            "Podoby soupisek a témata briefingu, které zápasy kopírují.",
    },
    messages: {
        title: "Zprávy a panely",
        description: "Vyberte zprávy, které bot posílá, a jejich vzhled.",
    },
    channels: {
        title: "Kanály a jazyk",
        description: "Kam bot posílá zprávy a v jakém jazyce píše.",
    },
    "discord-panels": {
        title: "Panely v Discordu",
        description:
            "Zprávy, které bot drží aktuální: živé servery, výsledky, ligu, kalendář a ovládání pro správce. Obnovují se každých 60 s.",
    },
    "panel-graphics": {
        title: "Grafika panelů",
        description:
            "Jak vypadají panely serverů v Discordu: styl, bannery serverů a obrázky map. Ikony frakcí a stavové ikony jsou pevné.",
    },
    "discord-seed": {
        title: "Seed",
        description:
            "Když je server prázdný, Logi svolá hráče: pošle výzvu, označí roli Seed a v panelu ukazuje, kolik hráčů chybí. Spustit ho smí jen Správci Logi.",
    },
    roles: {
        title: "Role a přístup",
        description: "Role klanu a role, která otevírá správu v Logi.",
    },
    commands: {
        title: "Příkazy",
        description:
            "Které příkazy bot nabízí, kdo je smí použít a kde. Odpovídá v jazyce klanu.",
    },
    membership: {
        title: "Členství",
        description:
            "Jak se lidé přidávají do klanu, kdo jim odpovídá a jaké role dostanou.",
    },
    tickets: {
        title: "Tickety",
        description:
            "Panel, přes který členové otevřou soukromé vlákno se správci.",
    },
    "game-servers": {
        title: "Herní servery",
        description:
            "Odkud Logi sbírá výsledky a statistiky. API klíč se uloží šifrovaně a už ho nikdo neuvidí.",
    },
    league: {
        title: "Global Wardogs League",
        description:
            "Sledované ligové zápasy a jejich propojení s vašimi akcemi.",
    },
    website: {
        title: "Web klanu a přihlášení",
        description:
            "Když má klan vlastní web, který čte data z Logi nebo přes něj přihlašuje členy. Kroky na sebe navazují.",
    },
    calendar: {
        title: "Kalendář Google",
        description:
            "Odběr kalendáře klanu v Googlu nebo jiné kalendářové aplikaci.",
    },
    webhooks: {
        title: "Webhooky",
        description: "Posílání událostí z Logi do vašich služeb.",
    },
    imports: {
        title: "Importy a opravy dat",
        description:
            "Hromadný import akcí, hráčů a Platform ID, přepočet statistik.",
    },
    "helper-data": {
        title: "Pomocná data",
        description:
            "Referenční data, která Logi používá při importu a párování hráčů.",
    },
} as const
