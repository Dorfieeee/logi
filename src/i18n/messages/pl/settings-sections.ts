export const settingsHub_sections = {
    profile: {
        title: "Profil klanu",
        description: "Nazwa, logo i opis klanu.",
    },
    games: {
        title: "Rozegrane gry",
        description: "W jakie gry gra klan.",
    },
    "event-categories": {
        title: "Kategorie wydarzeń",
        description:
            "Etykiety i kolory meczów i treningów, np. towarzyskie lub ligowe.",
    },
    "match-templates": {
        title: "Szablony meczów",
        description:
            "Domyślne dane nowego meczu. Możesz je później zmienić w samym meczu.",
    },
    presets: {
        title: "Presety oddziałów i tematów",
        description: "Skład kształty i tematy odpraw pasujące do kopii.",
    },
    messages: {
        title: "Wiadomości i panele",
        description:
            "Wybierz, które wiadomości wysyła bot i jak mają wyglądać.",
    },
    channels: {
        title: "Kanały i język",
        description: "Gdzie bot wysyła wiadomości i w jakim języku je pisze.",
    },
    "discord-panels": {
        title: "Panele Discord",
        description:
            "Wiadomości, które bot jest na bieżąco: serwery na żywo, wyniki, liga, kalendarz i kontrola administracyjna. Odświeżają się co 60 s.",
    },
    "panel-graphics": {
        title: "Grafika panelu",
        description:
            "Jak wyglądają panele serwerowe w Discord: styl, banery serwerów i obrazy map. Ikony frakcji i ikony statusu zostały naprawione.",
    },
    "discord-seed": {
        title: "Seeding",
        description:
            "Gdy serwer jest pusty, Logi wzywa graczy: wysyła połączenie, wysyła ping do roli Seeding i pokazuje w panelu ilu graczy brakuje. Tylko administratorzy Logi mogą go uruchomić.",
    },
    roles: {
        title: "Role i uprawnienia",
        description: "Rola klanu i rola otwierająca panel zarządzania Logi.",
    },
    commands: {
        title: "Komendy",
        description:
            "Które polecenia oferuje bot, kto i gdzie może z nich korzystać. Odpowiada w języku klanu.",
    },
    membership: {
        title: "Członkostwo",
        description:
            "Jak ludzie dołączają do klanu, kto im odpowiada i jakie role otrzymują.",
    },
    tickets: {
        title: "Pomoc",
        description:
            "Członkowie panelu używają do otwierania prywatnego wątku z administratorami.",
    },
    "game-servers": {
        title: "Serwery gier",
        description:
            "Gdzie Logi zbiera wyniki i statystyki. Klucz API jest przechowywany w postaci zaszyfrowanej i nikt go więcej nie widzi.",
    },
    league: {
        title: "Global Wardogs League",
        description: "Śledzone mecze ligowe i ich linki do Twoich wydarzeń.",
    },
    website: {
        title: "Strona internetowa klanu i logowanie",
        description:
            "Dla strony klanu, która odczytuje dane z Logi lub loguje za jej pośrednictwem członków. Kroki opierają się na sobie.",
    },
    calendar: {
        title: "Kalendarz Google",
        description:
            "Subskrybuj kalendarz klanu w Google lub innej aplikacji kalendarza.",
    },
    webhooks: {
        title: "Webhooki",
        description: "Wysyłaj zdarzenia Logi do własnych usług.",
    },
    imports: {
        title: "Importy i poprawki danych",
        description:
            "Masowy import wydarzeń, graczy i identyfikatorów platform, przeliczanie statystyk.",
    },
    "helper-data": {
        title: "Dane pomocnicze",
        description:
            "Dane referencyjne, których Logi używa podczas importowania i dopasowywania graczy.",
    },
} as const
