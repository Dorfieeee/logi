export const teamAdminMessages = {
    teamCatalogAdmin: {
        scrapeWardogs: "Drużyny złomu z Global Wardogs League",
        scrapeHll: "Synchronizuj drużyny z HeLO (2024)",
        scrapingTeams: "Importowanie drużyn…",
        scrapeDescription:
            "Dodaje brakujące drużyny i odświeża logo w celu dopasowania istniejących drużyn. Brakujące lub uszkodzone logo dostawcy nigdy nie usuwają zapisanego logo. Zarejestruj importowane drużyny w zawodach osobno.",
        scrapeResult:
            "Utworzono: {created}. Zaktualizowano logo: {updated}. Pominięte: {skipped}. Niepowodzenie: {failed}. Możesz ponowić próbę zespołową, która zakończyła się niepowodzeniem.",
        scrapeError: "Import drużyny nie powiódł się. Spróbuj ponownie.",
        searchLabel: "Szukaj drużyn",
        statesLabel: "Status",
        states: {
            active: "Aktywny",
            archived: "Zarchiwizowane",
            merged: "Połączone",
        },
        listLabel: "Drużyny",
        detailLabel: "Szczegóły drużyny",
        rowLinked: "klan na Logi",
        rowCompetitions: {
            one: "Rozgrywki: {count}",
            few: "Rozgrywki: {count}",
            many: "Rozgrywki: {count}",
            other: "Rozgrywki: {count}",
        },
        rowPendingChange: "zmiana oczekuje",
        requestBadge: "Wniosek",
        requestBadgeLabel: "Wniosek o zmianę oczekuje",
        updatedOn: "{game} · zaktualizowano {date}",
        changeLogo: "Zmień logo",
        requestBanner: "Klan proponuje zmianę w tej drużynie",
        openRequest: "Otwórz wniosek",
        usageTitle: "Gdzie drużyna jest używana",
        usageFixtures: {
            one: "{count} mecz",
            few: "{count} mecze",
            many: "{count} meczów",
            other: "{count} meczów",
        },
        usageWithdrawn: "wycofano",
        usageNone: "Jeszcze nie w żadnych zawodach.",
        usageMore: "i {count} więcej rozgrywek",
        usageSnapshots:
            "Mecze klanowe zachowują nazwę i logo z momentu ich zapisania.",
        usageUnavailable:
            "Nie można wczytać miejsca, w którym używany jest drużyna.",
        moreDetails: "Opis i linki",
        saveShort: "Zapisz",
        endTitle: "Duplikat lub koniec drużyny",
        mergeIntoOther: "Połącz z inną drużyną",
        endHelp: "Obaj najpierw pytają i pokazują, co się zmieni.",
        selectTeam: "Wybierz drużynę z listy, aby zobaczyć jej szczegóły.",
        archivedHelp:
            "Zarchiwizowany drużyna nie jest oferowany klanom ani rozgrywkom. Przywrócenie go powoduje ponowne wybranie go.",
        mergedHelp:
            "Drużyna ten został połączony w {name}. Scalania nie można cofnąć.",
        mergedTargetUnknown: "inna drużyna",
        title: "Katalog drużyn",
        description:
            "Jedna lista drużyn dla wszystkich Logi. Klany wybierają z niego swoich przeciwników i w zawodach rejestrują z niego drużyny.",
        gamesLabel: "Gra",
        search: "Nazwa lub krótki kod",
        showArchived: "Pokaż zarchiwizowane i połączone drużyny",
        add: "Dodaj drużynę",
        loadMore: "Załaduj więcej",
        loading: "Ładowanie drużyn…",
        empty: "Nie ma jeszcze drużyn dla tej gry.",
        emptySearch: "Żadna drużyna nie pasuje do wyszukiwania.",
        retry: "Spróbuj ponownie",
        archivedBadge: "Zarchiwizowane",
        mergedBadge: "Połączone",
        linkedBadge: "Połączono: {workspace}",
        edit: "Edytuj",
        archive: "Zarchiwizuj",
        restore: "Przywróć",
        merge: "Połącz",
        editTeam: "Edytuj {name}",
        archiveTeam: "Zarchiwizuj {name}",
        restoreTeam: "Przywróć {name}",
        mergeTeam: "Połącz {name} z innym drużyną",
        createTitle: "Nowa drużyna w katalogu",
        editTitle: "Edytuj drużynę z katalogu",
        name: "Nazwa",
        shortCode: "Tag drużyny",
        shortCodeHelp:
            "Opcjonalnie, do 16 znaków; pokazano, gdzie jest mało miejsca.",
        descriptionField: "Opis",
        descriptionHelp: "Opcjonalnie, do 500 znaków.",
        links: "Linki",
        linkLabel: "Link {number}",
        linksHelp:
            "Maksymalnie trzy linki https, takie jak strona internetowa drużyny lub zaproszenie Discord.",
        linkedWorkspace: "Klan na Logi",
        linkedWorkspaceNone: "Brak · drużyna nie używa Logi",
        linkedWorkspaceUnknown: "Obszar roboczy {id}",
        linkedWorkspaceHelp:
            "Oznacza drużynę jako klan z tego obszaru Logi. Powiązanie nie nadaje żadnych uprawnień.",
        logo: "Logo",
        logoHelp:
            "PNG, JPEG lub WebP do 2 MiB, znormalizowany do kwadratu 512×512. Loga katalogowe należą do platformy.",
        upload: "Prześlij logo",
        uploading: "Przesyłanie…",
        removeLogo: "Usuń logo",
        save: "Zapisz drużynę",
        saving: "Zapisywanie…",
        cancel: "Anuluj",
        saved: "Drużyna zapisana.",
        archivedNotice:
            "Drużyna zarchiwizowany. Zapisane mecze zachowują swoje migawki.",
        archiveConfirmTitle: "Zarchiwizować {name}?",
        archiveConfirmDescription:
            "Archiwizacja zaczyna obowiązywać natychmiast. Jakie zmiany:",
        archiveConsequenceSelection:
            "{name} nie jest już oferowany klanom i rozgrywkom.",
        archiveConsequenceSnapshots:
            "Zapisane mecze zachowują nazwę i logo, pod którymi zostały zapisane.",
        archiveConsequenceRestore:
            "Możesz przywrócić drużyna później, chyba że inny aktywny drużyna przyjmie jego nazwę.",
        restoredNotice: "Drużyna przywrócona.",
        mergedNotice: "{source} zostało połączone z {target}.",
        conflictReloaded:
            "W międzyczasie skład drużyny się zmienił. Wyświetlona zostanie najnowsza wersja, a Twoje zmiany zostaną zachowane; przejrzyj je i zapisz ponownie.",
        conflictReloadFailed:
            "W międzyczasie drużyna ten uległ zmianie i nie udało się załadować najnowszej wersji. Zamknij okno dialogowe i spróbuj ponownie.",
        staleRow:
            "W międzyczasie ten drużyna się zmienił; wyświetlana jest teraz najnowsza wersja. Spróbuj ponownie, jeśli działanie jest nadal potrzebne.",
        mergeTitle: "Scal {name}",
        mergeDescription:
            "Wybierz drużynę, która pozostanie. {name} jest zarchiwizowany i wskazuje na niego.",
        mergeTarget: "Drużyna, która pozostanie",
        mergeSearch: "Wyszukaj aktywne drużyny…",
        mergeSearchHint: "Wpisz, aby wyszukać aktywne drużyny w tej grze.",
        mergeNoResults:
            "Żaden inny aktywny drużyna nie pasuje do tego wyszukiwania.",
        mergeLoading: "Wyszukiwanie…",
        mergeChooseTarget: "Wybierz drużynę, która pozostanie.",
        mergeMovesTitle: "Co się stanie",
        mergeMovesRegistrations:
            "Rejestracje zawodów i terminarze {source} przenoszą się do {target}.",
        mergeMovesRequests:
            "Oczekujące prośby drużyny o przeniesienie {source} do {target}.",
        mergeMovesArchive:
            "{source} jest archiwizowany i rejestruje, że został połączony z {target}. Scalania nie można cofnąć.",
        mergeMovesSnapshots:
            "Zapisane migawki meczów nie są przepisywane; zachowują nazwę i logo, pod którymi zostali zapisani.",
        mergeConfirm: "Połącz drużyny",
        merging: "Łączenie…",
        fieldErrors: {
            name: "Wprowadź nazwę składającą się maksymalnie ze 120 znaków bez znaków sterujących.",
            shortCode: "Użyj maksymalnie 16 znaków bez znaków kontrolnych.",
            description: "Użyj maksymalnie 500 znaków.",
            links: "Każdy link musi być innym adresem URL https.",
            linkedGuildId: "Wybierz obszar roboczy z listy.",
        },
        errors: {
            invalid_team: "Sprawdź szczegóły drużyny i spróbuj ponownie.",
            invalid_query:
                "Przy użyciu tych filtrów nie można było odczytać katalogu.",
            game_disabled: "Ta gra nie jest dostępna w katalogu drużyny.",
            duplicate_name:
                "Inna drużyna tej gry używa już tej nazwy. Przeszukaj katalog, w tym zarchiwizowane drużyny, i zamiast tego edytuj, przywracaj lub scalaj ten drużyna.",
            revision_conflict:
                "W międzyczasie skład drużyny się zmienił. Załaduj go ponownie i spróbuj ponownie.",
            idempotency_conflict:
                "Ten zapis został już użyty dla różnych wartości. Zamknij okno dialogowe i spróbuj ponownie.",
            not_found: "Ta drużyna już nie istnieje.",
            archived: "Drużyna jest zarchiwizowana. Przywróć ją przed edycją.",
            not_archived: "Ta drużyna nie jest zarchiwizowana.",
            asset_unavailable:
                "Logo nie jest już dostępne. Prześlij go ponownie.",
            limit_reached: "Katalog tej gry jest pełny.",
            guild_already_linked:
                "Ten serwer Discord jest już połączony z drużyną.",
            invalid_merge:
                "Drużyn tych nie można łączyć. Wybierz aktywną drużynę grającą w tę samą grę, która nigdy nie grała z tą drużyną w zawodach; połączonego drużyny nie można przywrócić ani ponownie połączyć.",
            forbidden:
                "Tylko administratorzy globalni mogą zarządzać katalogiem drużyny.",
            unavailable:
                "Katalog drużyny jest obecnie niedostępny. Spróbuj ponownie.",
        },
        uploadErrors: {
            unsupported_type:
                "Akceptowane są wyłącznie obrazy w formacie PNG, JPEG i WebP.",
            type_mismatch: "Zawartość pliku nie jest zgodna z typem obrazu.",
            bad_dimensions:
                "Obraz musi mieć wymiary co najmniej 1×1 i maksymalnie 4096×4096 pikseli.",
            animated: "Animowane obrazy nie są obsługiwane.",
            undecodable: "Nie można odczytać obrazu.",
            invalid_kind: "To przesłane zdjęcie nie jest logo drużyny.",
            invalid_asset: "Nie można zapisać przesłanego obrazu.",
            too_large: "Rozmiar obrazu przekracza 2 MiB.",
            upload_limited:
                "Za dużo przesłanych plików. Spróbuj ponownie za {seconds} s.",
            forbidden:
                "Tylko administratorzy globalni mogą przesyłać logo katalogów.",
            unavailable: "Przesyłanie jest chwilowo niedostępne.",
        },
    },
    teamRequestAdmin: {
        changeSummary: "Zmiany {fields}",
        changeFields: {
            logo: "logo",
            name: "nazwa",
            shortCode: "tag drużyny",
            links: "linki",
            description: "opis",
        },
        listAnd: " i ",
        kindBadges: {
            create: "Nowy",
            update: "Zmiana",
        },
        similarExists: "Podobny drużyna już istnieje: {name}",
        usageIn: "Drużyna bierze udział w {competitions}.",
        usageNone: "Drużyna nie bierze jeszcze udziału w żadnych rozgrywkach.",
        snapshotsKept: "Zapisane mecze zachowują stare logo.",
        approveDirectTitle: "Zatwierdzić żądanie {name}?",
        approveDirectCreate: "{name} zostaje dodany do katalogu {game}.",
        approveDirectUpdate: "Proponowane szczegóły dotyczą modelu {name}.",
        approveDirectDm: "Osoba żądająca otrzymuje decyzję jako Discord DM.",
        discordUser: "Discord {id}",
        mergeShort: "Połącz z istniejącymi",
        title: "Wnioski dotyczące drużyn",
        description:
            "Klany proszą o utworzenie nowego drużyny lub zmianę istniejącego. Osoba żądająca otrzymuje Twoją decyzję za pośrednictwem Discord DM.",
        statusFilter: "Status",
        statuses: {
            pending: "Oczekuje",
            approved: "Zatwierdzono",
            merged: "Połączone",
            rejected: "Odrzucono",
            cancelled: "Odwołano",
        },
        kinds: {
            create: "Nowa drużyna",
            update: "Wniosek o zmianę",
        },
        loading: "Wczytywanie wniosków…",
        empty: "Brak wniosków o tym statusie.",
        loadMore: "Załaduj więcej",
        tabsLabel: "Status wniosku",
        tabPending: "Oczekuje · {count}",
        tabPendingEmpty: "Oczekuje",
        tabDecided: "Rozpatrzone",
        gameFilter: "Gra",
        clanFilter: "Klan",
        allClans: "Wszystkie klany",
        listLabel: "Wnioski",
        fromClan: "z {clan}",
        titleCreate: "Nowa drużyna {name}",
        titleUpdate: "Zmień na drużynę {name}",
        requestedBy: "{requester} z {clan}",
        field: "Pole",
        now: "Teraz",
        proposed: "Zaproponowano",
        unchanged: "niezmienione",
        emptyValue: "pusty",
        comparisonHint: "Na zielono zaznaczono to, co się zmieni.",
        rejectWithReason: "Odrzuć z podaniem powodu",
        reviewAndApprove: "Przejrzyj i zatwierdź",
        selectRequest: "Wybierz żądanie, aby zobaczyć jego szczegóły.",
        emptyPendingTitle: "Nie ma oczekujących wniosków",
        emptyPendingDescription:
            "Administratorzy klanów wysyłają prośby ze stron swoich drużyn. Tutaj pojawiają się nowe, a osoba żądająca otrzymuje Twoją decyzję przez Discord DM.",
        emptyFiltered: "Żadne załadowane żądanie nie pasuje do tych filtrów.",
        retry: "Spróbuj ponownie",
        requestFor: "Wniosek dotyczący {name}",
        workspace: "Obszar roboczy",
        unknownWorkspace: "Nieznany obszar roboczy ({id})",
        requester: "Wnioskodawca (Discord ID)",
        hiddenRequester: "Nie pokazano",
        game: "Gra",
        kind: "Typ",
        submitted: "Złożony",
        decided: "Rozpatrzone",
        note: "Uwagi wnioskodawcy",
        proposal: "Proponowana drużyna",
        currentTeam: "Obecna drużyna",
        currentTeamLoading: "Wczytywanie obecnej drużyny…",
        currentTeamMissing:
            "Drużyna, którego dotyczy ta prośba, już nie istnieje.",
        currentTeamArchived:
            "Drużyna, którego zmiana dotyczy tego żądania, jest archiwizowany. Przywróć go w katalogu drużyny przed zatwierdzeniem.",
        currentTeamUnavailable: "Nie można wczytać aktualnego drużyny.",
        changed: "Zmieniono",
        resultTeam: "Drużyna po zatwierdzeniu",
        reason: "Powód",
        notification: "DM do wnioskodawcy",
        notifications: {
            none: "Nie wysłano",
            pending: "W kolejce",
            sent: "Wysłano",
            failed: "Nie można było dostarczyć",
        },
        none: "Brak",
        approve: "Zatwierdź",
        approveRequest: "Zatwierdź żądanie {name}",
        approveTitle: "Zatwierdź wniosek",
        approveDescription:
            "Przejrzyj i dostosuj proponowane pola. Zatwierdzenie powoduje utworzenie drużyny lub zastosowanie pól do bieżącego drużyny.",
        approveConfirm: "Zatwierdź wniosek",
        approving: "Zatwierdzanie…",
        merge: "Połącz z istniejącą drużyną",
        mergeRequest: "Połącz prośbę o {name} z istniejącym drużyną",
        mergeTitle: "Połącz z istniejącą drużyną",
        mergeDescription:
            "Nie powstaje żaden nowy drużyna. Osoba żądająca jest informowana, z którego istniejącego drużyny {game} ma skorzystać.",
        mergeConfirm: "Żądanie połączenia",
        merging: "Łączenie…",
        mergeInto: "Zamiast tego połącz się z {name}",
        reject: "Odrzuć",
        rejectRequest: "Odrzuć żądanie {name}",
        rejectTitle: "Odrzuć wniosek",
        rejectDescription:
            "Osoba żądająca otrzymuje przyczynę w wiadomości Discord DM.",
        rejectReason: "Powód",
        rejectReasonHelp: "Wymagane, maksymalnie 500 znaków.",
        rejectConfirm: "Odrzuć wniosek",
        rejecting: "Odrzucanie…",
        cancel: "Anuluj",
        reasonRequired:
            "Wprowadź powód składający się z maksymalnie 500 znaków.",
        decidedNotice: {
            approved:
                "Żądanie zatwierdzone. Osoba składająca wniosek zostanie powiadomiona.",
            merged: "Prośba została połączona z istniejącym drużyną. Osoba składająca wniosek zostanie powiadomiona.",
            rejected:
                "Żądanie odrzucone. Osoba składająca wniosek zostanie powiadomiona.",
        },
        conflictReloaded:
            "Drużyna zmienił się po otwarciu tej prośby. Wyświetlane są aktualne wartości; przejrzyj je i zatwierdź ponownie.",
        duplicateFound:
            "{name} używa już tej nazwy. Połącz z nim żądanie lub zmień nazwę.",
        staleRequest:
            "Wniosek ten został już rozpatrzony lub wycofany; lista została odświeżona.",
        errors: {
            invalid_request: "Ten wniosek jest nieprawidłowy.",
            invalid_decision: "Sprawdź decyzję i spróbuj ponownie.",
            invalid_query: "Nie można odczytać kolejki za pomocą tych filtrów.",
            not_found: "Ta prośba lub drużyna już nie istnieje.",
            not_pending: "Wniosek ten został już rozpatrzony lub wycofany.",
            limit_reached: "Katalog tej gry jest pełny.",
            idempotency_conflict:
                "Decyzja ta jest sprzeczna z wcześniejszą. Załaduj ponownie i spróbuj ponownie.",
            team_archived:
                "Wybrana drużyna jest zarchiwizowana. Wybierz aktywną drużynę.",
            team_game_mismatch: "Wybierz drużynę grającą w tę samą grę.",
            duplicate_name: "Inna drużyna tej gry używa już tej nazwy.",
            revision_conflict:
                "W międzyczasie zmienił się skład drużyny. Przejrzyj go i spróbuj ponownie.",
            archived:
                "Drużyna jest zarchiwizowana. Przywróć ją przed zatwierdzeniem.",
            not_archived: "Drużyna nie jest zarchiwizowana.",
            asset_unavailable:
                "Logo nie jest już dostępne. Prześlij go ponownie lub usuń.",
            invalid_team: "Sprawdź szczegóły drużyny i spróbuj ponownie.",
            guild_already_linked:
                "Ten serwer Discord jest już połączony z drużyną.",
            invalid_merge: "Zgłoszenia nie można połączyć z tym drużyną.",
            game_disabled: "Ta gra nie jest dostępna w katalogu drużyny.",
            forbidden:
                "Tylko administratorzy globalni mogą decydować o prośbach drużyny.",
            unavailable:
                "Żądania drużyny są obecnie niedostępne. Spróbuj ponownie.",
        },
    },
} as const
