export const settingsHub_overview = {
    title: "Ustawienia",
    description: "Profil klanu, ustawienia i integracje Discord.",
    searchLabel: "Szukaj w ustawieniach",
    searchPlaceholder: "Szukaj: kanał, rola, klucz API…",
    noResults: "Nic nie znaleziono",
    noResultsDescription:
        "Spróbuj innego słowa, na przykład kanału, roli lub klucza.",
    groupHints: {
        clan: "Dotyczy każdej gry",
        matches: "Wartości domyślne dla nowych meczów i ich komunikatów",
        discord: "Bot, kanały, role i panele",
        gameData: "Serwery Logi zbiera wyniki",
        web: "Opcjonalnie: strona klanu, logowanie i inne usługi",
        maintenance: "Narzędzia jednorazowe",
    },
    badges: {
        done: "Gotowe",
        notSet: "Nie ustawiono",
        on: "Włączone",
        off: "Wyłączony",
        collecting: {
            one: "Zbieranie danych: {count}",
            few: "Zbieranie danych: {count}",
            many: "Zbieranie danych: {count}",
            other: "Zbieranie danych: {count}",
        },
        failing: {
            one: "Błędy połączenia: {count}",
            few: "Błędy połączenia: {count}",
            many: "Błędy połączenia: {count}",
            other: "Błędy połączenia: {count}",
        },
        missingChannels: {
            one: "Brakujące kanały: {count}",
            few: "Brakujące kanały: {count}",
            many: "Brakujące kanały: {count}",
            other: "Brakujące kanały: {count}",
        },
        gamesOn: {
            one: "Włączone gry: {count}",
            few: "Włączone gry: {count}",
            many: "Włączone gry: {count}",
            other: "Włączone gry: {count}",
        },
        templates: {
            one: "{count} szablon",
            few: "{count} szablony",
            many: "{count} szablonów",
            other: "{count} szablonów",
        },
    },
    tiles: {
        profile: {
            title: "Profil klanu",
            description: "Nazwa klanu, logo i opis.",
        },
        games: {
            title: "Rozegrane gry",
            description:
                "W jakie gry gra klan. Logi oferuje na ich podstawie dalsze opcje.",
        },
        "event-categories": {
            title: "Kategorie wydarzeń",
            description: "Kolory i emoji dla typów wydarzeń w kalendarzu.",
        },
        "match-templates": {
            title: "Szablony meczów",
            description:
                "Domyślne czasy, rejestracje, ping i skład dla nowego meczu.",
        },
        presets: {
            title: "Presety oddziałów i tematów",
            description:
                "Oddział i układy ról dla składów, tematy na forum meczowym.",
        },
        messages: {
            title: "Wiadomości i panele",
            description:
                "Jak wyglądają wiadomości bota, co bot wysyła oraz przegląd paneli.",
        },
        channels: {
            title: "Kanały i język",
            description:
                "Gdzie bot publikuje ogłoszenia, zdarzenia i błędy. Strefa czasowa i język.",
        },
        "discord-panels": {
            title: "Panele Discord",
            description:
                "Serwery na żywo, wyniki, liga i kalendarz, który bot aktualizuje.",
        },
        "panel-graphics": {
            title: "Grafika panelu",
            description: "Styl panelu serwera, banery serwera i obrazy map.",
        },
        "discord-seed": {
            title: "Seeding serwera",
            description:
                "Wywołanie seeding, rola Seeding, harmonogram i historia seeding.",
        },
        roles: {
            title: "Role i uprawnienia",
            description: "Rola klanu i rola, która może zarządzać Logi.",
        },
        commands: {
            title: "Komendy",
            description:
                "Które polecenia oferuje bot, kto i gdzie może z nich korzystać.",
        },
        membership: {
            title: "Członkostwo",
            description:
                "Role rekrutacyjne i członkowskie, zasady punktacji skład.",
        },
        tickets: {
            title: "Pomoc",
            description: "Panel zgłoszeń, kategorie i kanały.",
        },
        "game-servers": {
            title: "Serwery gier",
            description:
                "Serwery CRCON i Warcon, ich klucze API i gromadzenie danych.",
        },
        history: {
            title: "Przechowywanie historii",
            description: "Jak długo Logi utrzymuje uruchomione gry.",
        },
        league: {
            title: "Global Wardogs League",
            description:
                "Śledzenie meczów ligowych i karty w Discord. Tylko Wardogi.",
        },
        apiKeys: {
            title: "Klucze API",
            description: "Klucze do strony klanu i innych aplikacji.",
        },
        login: {
            title: "Logowanie do witryny internetowej",
            description:
                "Własna strona logowania i aplikacje do pojedynczego logowania (SSO).",
        },
        webAccess: {
            title: "Uprawnienia witryny internetowej",
            description:
                "Jakie role witryna internetowa może czytać o członkostwie i tworzyć zdarzenia. Opiera się na kluczu API i logowaniu jednokrotnym.",
        },
        calendar: {
            title: "Kalendarz Google",
            description: "Link do subskrypcji kalendarza klanu.",
        },
        webhooks: {
            title: "Webhooki",
            description:
                "Powiadomienia dla innych usług, gdy coś się zmieni w Logi.",
        },
        imports: {
            title: "Importy i poprawki danych",
            description:
                "Masowy import wydarzeń, graczy i identyfikatorów platform, przeliczanie statystyk.",
        },
        "helper-data": {
            title: "Dane pomocnicze",
            description: "Domyślne presety i ich przywracanie.",
        },
    },
    setup: {
        title: "Konfiguracja obszaru roboczego",
        description:
            "Zakończ wymagane kroki, aby bot mógł ogłaszać zdarzenia i chronić dostęp.",
        progress: "{done} z {total} wykonane",
        progressLabel: "Postęp konfiguracji",
        continue: "Kontynuuj konfigurację",
        continueHelp: "Otwiera pierwszy niedokończony krok.",
        optional: "opcjonalnie",
        fix: "Popraw",
        setUp: "Skonfiguruj",
        steps: {
            bot: {
                title: "Bot na Discord",
                done: "Bot jest na serwerze i widzi kanały.",
                missing: "Bota nie ma jeszcze na serwerze.",
            },
            games: {
                title: "Rozegrane gry",
                missing: "Wybierz, w co gra klan",
            },
            profile: {
                title: "Profil klanu",
                detail: "Nazwa, logo i opis",
            },
            channels: {
                title: "Kanały",
                done: "Wybrano kanał ogłoszeń",
                missing: "Brak kanału ogłoszeń",
            },
            roles: {
                title: "Role i uprawnienia",
                detail: "Kto może zarządzać Logi",
            },
            gameServers: {
                title: "Serwery gier",
                done: {
                    one: "Serwery zbierające dane: {count}",
                    few: "Serwery zbierające dane: {count}",
                    many: "Serwery zbierające dane: {count}",
                    other: "Serwery zbierające dane: {count}",
                },
                missing: "Wyniki i statystyki z serwera",
            },
        },
    },
} as const
