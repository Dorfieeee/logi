export const deMessages = {
    gameHistory: {
        title: "Warcon-Spielhistorie",
        description:
            "Abgeschlossene Serverspiele in Logi. Fraktionen sind Spielseiten, keine Clans.",
        load: "Historie laden / aktualisieren",
        retentionTitle: "Aufbewahrung der Historie",
        retentionDescription:
            "Lege fest, wie lange aufbewahrte Serverspiele in diesem Arbeitsbereich bleiben. Spiele, die vor dem Zeitfenster endeten, werden in einem nächtlichen Lauf endgültig gelöscht; die Historienrevision rückt vor, damit Websites ihre Summen neu aufbauen.",
        retentionWindow: "Aufbewahrte Spiele behalten für",
        retentionIndefinite: "Unbegrenzt (Standard)",
        retentionDays: "{days} Tage",
        retentionSave: "Aufbewahrung speichern",
        retentionSaving: "Wird gespeichert…",
        retentionSaved:
            "Aufbewahrung gespeichert. Abgelaufene Spiele werden im Hintergrund entfernt.",
        retentionError:
            "Das Aufbewahrungsfenster konnte nicht geladen oder gespeichert werden. Bitte aktualisieren und erneut versuchen.",
        loading: "Vollständigen Zeitraum laden…",
        error: "Historie unvollständig. Erneut versuchen oder kürzeren Zeitraum wählen. Keine Teilrangliste wird angezeigt.",
        period: "Zeitraum",
        all: "Alle gespeicherten Spiele",
        week: "7 Tage",
        month: "30 Tage",
        quarter: "90 Tage",
        map: "Karte (exakter Name, optional)",
        source: "Server",
        allSources: "Alle gespeicherten Server",
        minimum: "Mindestspielzeit in Minuten",
        games: "Spiele",
        decided: "Mit Gewinner",
        draw: "Unentschieden",
        no_result: "Ohne Ergebnis",
        unknown: "Unbekannt",
        feed: "Spiele mit Combat-Feed",
        faction: "Fraktion",
        factions: "Fraktionssiege",
        share: "Anteil entschiedener Spiele",
        players: "Spielerrangliste",
        coverage: "Abdeckung",
        lastCollected: "Letzter Spielimport in diesem Workspace",
        empty: "Keine abgeschlossenen Spiele in diesem Zeitraum. Historienerfassung für eine Warcon-Quelle oben aktivieren.",
        player: "Spieler",
        matches: "Spiele",
        wins: "Siege",
        losses: "Niederlagen",
        kills: "Kills",
        deaths: "Tode",
        cash: "Cash-Differenz",
        winRate: "Siegquote",
        kd: "K/D",
        sort: "Sortieren nach",
        history: "Gespeicherte Spiele",
        previous: "Zurück",
        next: "Weiter",
        details: "Spielerdetails",
        ended: "Beendet",
        unavailable: "Unbekannt",
        ratioHelp:
            "K/D erfordert vollständige Kills/Tode und mindestens einen Tod. Unbekannte Ergebnisse zählen nicht zur Siegquote. Summen enthalten nur bekannte Werte; x/y zeigt die Abdeckung.",
        retentionHelp:
            "Nur erfolgreich importierte abgeschlossene Spiele. Fehlende Anbieterhistorie und laufende Spiele sind ausgeschlossen. Die Erfassungszeit bestätigt keinen vollständigen Anbieterimport.",
    },
    panelGraphicsPage: {
        breadcrumbParent: "Panels in Discord",
        unnamedServer: "Server ohne Namen",
        games: { hell_let_loose: "HLL", wardogs: "Wardogs" },
        gameNames: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
        style: {
            title: "Panel-Stil",
            description:
                "Wie Server-Panels in Discord aussehen. Gilt für alle Panels ohne eigenen Stil.",
            defaultLabel: "Standardstil",
            logiDefault: "Standard",
            options: {
                a: {
                    title: "Stil A · Bild",
                    description:
                        "Der Bot zeichnet ein Punktestand-Bild und lädt es höchstens alle 60 s neu hoch.",
                },
                b: {
                    title: "Stil B · Banner und Miniatur",
                    description:
                        "Server-Banner oben, Kartenminiatur rechts, Zeichen und Spieleranzeige.",
                },
                c: {
                    title: "Stil C · Kompakt",
                    description:
                        "Nur Text mit Zeichen und Spieleranzeige. Die kürzeste Nachricht.",
                },
            },
            perPanel: "Einen anderen Stil für ein Panel legen Sie im",
            perPanelLink: "Panel-Editor fest",
        },
        banners: {
            title: "Server-Banner",
            description:
                "Das Bild oben im Panel im Stil B und der Hintergrund des Punktestand-Bilds im Stil A. Eines pro Server.",
            empty: "Es gibt noch keinen Spielserver. Fügen Sie ihn in den Einstellungen Spielserver hinzu.",
            emptyLink: "Spielserver",
            customChip: "Eigenes Banner",
            mapChip: "Kartenbild",
            noneChip: "Kein Banner",
            mapOverlay: "Kartenbild",
            liveServer: "Live-Server",
            banner: "Banner",
            upload: "Banner hochladen",
            uploading: "Wird hochgeladen…",
            remove: "Entfernen",
            help: "PNG, JPG oder WebP · Verhältnis 3 : 1, zum Beispiel 1200 × 400 · höchstens 2 MB.",
            uploadedFile: "Hochgeladen {name} · {width} × {height} · {size}.",
            uploadedBanner: "Hochgeladen · {width} × {height} · {size}.",
            withoutBanner:
                "Ohne Banner erscheint das Bild der aktuellen Karte, jetzt {map}.",
            withoutBannerUnknownMap:
                "Ohne Banner erscheint das Bild der aktuellen Karte.",
            withoutBannerOff: "Ohne Banner hat das Panel oben kein Bild.",
            crop: "Ausschnitt",
            crops: { top: "Oben", center: "Mitte", bottom: "Unten" },
            useMapImage: "Kartenbild verwenden, wenn das Banner fehlt",
            barColor: "Leistenfarbe",
            barColorInput: "Leistenfarbe als Hexadezimalwert",
            clanColor: "Clanfarbe",
            clanColorNote: "Clanfarbe",
            barColorInvalid: "Geben Sie die Farbe als #RRGGBB ein.",
        },
        maps: {
            title: "Kartenbilder",
            description:
                "Die Miniatur im Panel und der Hintergrund des Punktestand-Bilds, wenn der Server kein eigenes Banner hat. Logi hat eingebaute Bilder; der Clan kann sie ersetzen.",
            customCount: {
                one: "{count} eigenes",
                few: "{count} eigene",
                many: "{count} eigene",
                other: "{count} eigene",
            },
            search: "Karte suchen",
            searchPlaceholder: "Kartenname",
            game: "Spiel",
            all: "Alle",
            builtinChip: "Logi-Standard",
            customChip: "Eigenes",
            noneChip: "Kein Bild",
            replace: "Durch eigenes ersetzen",
            restore: "Standard wiederherstellen",
            upload: "Bild hochladen",
            uploading: "Wird hochgeladen…",
            imageAlt: "Karte {name}",
            footer: "{shown} von {total} Karten angezeigt · eigenes Bild: PNG, JPG oder WebP, quadratisch mindestens 160 × 160, höchstens 2 MB.",
            noResults: "Keine Karte passt zur Suche.",
        },
        factions: {
            title: "Fraktionssymbole",
            description:
                "Fest, sie lassen sich nicht ändern. Der Bot lädt sie selbst als App-Emoji in Discord hoch und verwendet sie in allen Panels, Ergebnissen und in der Liga.",
            uploaded: "In Discord hochgeladen ✓ · {count} Emoji",
            pending: "In Discord hochgeladen {ready} von {total} Emoji",
            hllTitle: "Hell Let Loose · Nationen",
            hllChip: "eigene Logi-Symbole",
            nations: {
                us: { name: "USA", side: "Alliierte" },
                gb: { name: "Großbritannien", side: "Alliierte" },
                sov: { name: "Sowjetunion", side: "Alliierte" },
                cw: { name: "Commonwealth", side: "Alliierte" },
                ger: { name: "Deutschland", side: "Achse" },
                dak: { name: "Afrikakorps", side: "Achse" },
                allies: {
                    name: "Alliierte",
                    side: "wenn der Server keine Nation nennt",
                },
                axis: {
                    name: "Achse",
                    side: "wenn der Server keine Nation nennt",
                },
            },
            wardogsTitle: "Wardogs · Fraktionen",
            wardogsChip: "Wardogs-Symbole, MIT-Lizenz",
            wardogsHint:
                "auf dunklem Hintergrund, wie Sie sie in Discord sehen",
            wardogs: {
                valkyra: { name: "Valkyra", role: "Fraktion" },
                manticore: { name: "Manticore", role: "Fraktion" },
                lonestar: { name: "Lonestar", role: "Fraktion" },
                wardogs: { name: "Wardogs", role: "Spielzeichen" },
            },
            note: "Die HLL-Nationszeichen sind unsere eigenen einfachen Symbole, keine Spielgrafik.",
        },
        status: {
            title: "Statussymbole und Spieleranzeige",
            description:
                "Ebenfalls fest; der Bot lädt sie zusammen mit den Fraktionssymbolen hoch. Neben dem Symbol steht immer ein Wort.",
            states: {
                live: { name: "Live", hint: "der Server läuft" },
                seeding: {
                    name: "Seeding",
                    hint: "unter 40 Spielern, Seed läuft",
                },
                empty: { name: "Leer", hint: "niemand spielt" },
                offline: {
                    name: "Nicht erreichbar",
                    hint: "der Server antwortet nicht",
                },
            },
            gauge: {
                players: {
                    name: "Spieler",
                    hint: "ein Segment = ein Zehntel der Kapazität",
                },
                queue: { name: "Warteschlange", hint: "nach einer Lücke" },
                free: { name: "Freier Platz", hint: "" },
            },
            sample: "Beispiel im Panel",
            sampleQueue: "{count} / {capacity} Spieler, Warteschlange {queue}",
            sampleSeed: "{count} / {capacity} Spieler, Seed bis {target}",
        },
        saveNote:
            "Banner und Stil gelten ab der nächsten Aktualisierung der Panels, spätestens nach 60 s",
        saved: "Panel-Grafik gespeichert.",
        reload: "Neu laden",
        errors: {
            conflict:
                "Jemand anderes hat die Grafik inzwischen geändert. Laden Sie die Seite neu und wiederholen Sie Ihre Änderungen.",
            asset_unavailable:
                "Das Bild ist nicht mehr verfügbar. Bitte laden Sie es erneut hoch.",
            unknown_server:
                "Der Spielserver existiert nicht mehr. Laden Sie die Seite neu.",
            invalid_request: "Ein Wert ist ungültig.",
            forbidden: "Sie dürfen die Panel-Grafik nicht ändern.",
            unavailable: "Speichern fehlgeschlagen. Versuchen Sie es erneut.",
        },
        uploadErrors: {
            unsupported_type:
                "Nur PNG-, JPG- und WebP-Bilder werden akzeptiert.",
            type_mismatch: "Der Dateiinhalt passt nicht zu seinem Bildtyp.",
            bad_dimensions:
                "Das Bild ist zu klein oder zu groß. Ein Kartenbild braucht mindestens 160 × 160 Pixel, kein Bild mehr als 4096 × 4096.",
            animated: "Animierte Bilder werden nicht unterstützt.",
            undecodable: "Das Bild konnte nicht gelesen werden.",
            invalid_kind: "Dieses Bild kann hier nicht hochgeladen werden.",
            invalid_asset:
                "Das hochgeladene Bild konnte nicht gespeichert werden.",
            too_large: "Das Bild ist größer als 2 MB.",
            upload_limited:
                "Zu viele Uploads. Versuchen Sie es in {seconds} s erneut.",
            forbidden: "Sie dürfen keine Bilder hochladen.",
            unavailable: "Hochladen ist vorübergehend nicht verfügbar.",
        },
    },
    leagueMatch: {
        title: "Wardogs League Spiel",
        description:
            "Füge einen öffentlichen Spiellink ein, um Termin, Teams und Vorbereitung anzuzeigen. Das Lesen erstellt kein Ereignis.",
        url: "Öffentliche Spiel-URL",
        load: "Spiel laden",
        loading: "Wird geladen…",
        unknown: "Nicht verfügbar",
        error: "Das Spiel konnte nicht geladen werden. Prüfe die öffentliche Wardogs League URL.",
        unavailable:
            "Die Quelle ist vorübergehend nicht verfügbar. Kein gespeichertes Spiel vorhanden.",
        nextCheck: "Nächste Aktualisierung ab",
        source: "Quellspiel öffnen",
        stale: "Das gespeicherte Spiel ist möglicherweise veraltet. Lade den Link erneut, sobald eine Aktualisierung erlaubt ist.",
        fetched: "Abgerufen",
        scheduled: "Spieltermin (Prag)",
        map: "Karte",
        zone: "Zone",
        lighting: "Beleuchtung",
        hosting: "Hosting",
        moderator: "Moderator",
        ready: "Ready Check",
        points: "Punkteregel",
        membersNote:
            "Angezeigte Teammitglieder, nicht die Aufstellung oder Spielerzahl des Spiels.",
        team: "Team",
        faction: "Fraktion",
        nations: "Nationen",
        members: "Teammitglieder",
        teamsUnavailable: "Die Quelle hat keine Teamdetails bereitgestellt.",
        vote: "Kartenabstimmung",
        closes: "Abstimmungsende (Prag)",
        rules: "Regeln",
        progress: "Spielablauf",
        resultsNote:
            "Ergebnisse und Platzierungen werden nicht importiert. Punkteregeln sind keine vergebenen Punkte.",
        partial:
            "Einige Felder oder dieser Spielstatus konnten nicht geprüft werden. Prüfe die Quellseite.",
        age: "Alter des Datensatzes: {seconds} Sekunden",
        timezone:
            "Zeiten in Europe/Prague. Daten werden fünf Minuten zwischengespeichert.",
        done: "Erledigt",
        current: "Aktueller Schritt",
        not_started: "Nicht begonnen",
    },
    membershipIntegration: {
        title: "Integrationen für Discord-Mitgliedschaft",
        description:
            "Wähle die Discord-Rollen, die jede Integration lesen darf. Zusätzlich ist ein schreibgeschützter Schlüssel mit der Freigabe für Discord-Mitgliedschaft erforderlich. Die Website entscheidet über die Nutzung dieser Angaben.",
        enabled: "Mitgliedschaftsabfragen mit diesem Schlüssel erlauben",
        roles: "Erlaubte Rollen",
        rolesHelp:
            "Ohne Rollen werden nur Anwesenheit und Logi-Zuordnung geteilt. Änderungen werden beim Speichern wirksam.",
        empty: "Erstelle einen schreibgeschützten API-Schlüssel mit der Freigabe für Discord-Mitgliedschaft und aktualisiere die Liste.",
        loading: "Wird geladen…",
        refresh: "Aktualisieren",
        saving: "Wird gespeichert…",
        save: "Freigabe speichern",
        saved: "Freigabe für Mitgliedschaft gespeichert.",
        error: "Die Freigaben konnten nicht geladen oder gespeichert werden. Bitte aktualisieren und erneut versuchen.",
        invalid:
            "Verwende gültige Discord-Rollen-IDs, höchstens 100 Rollen pro Spiel.",
    },
    websiteEventPolicies: {
        title: "Website-Befehle für Events",
        description:
            "Erlaube einer verbundenen Website, Events über ihren Dienstschlüssel zu erstellen, zu ändern oder abzusagen. Eine Richtlinie verbindet eine registrierte Single-Sign-on-Anwendung mit einem eingeschränkten API-Schlüssel und nennt je Spiel die Discord-Rollen, deren Mitglieder die Befehle nutzen dürfen.",
        application: "Single-Sign-on-Anwendung",
        applicationPlaceholder: "Anwendung wählen",
        noApplications:
            "Registriere zuerst eine Single-Sign-on-Anwendung. Die Richtlinie bindet die Befehle der Website an diese Anwendung.",
        noKeys: "Erstelle einen eingeschränkten API-Schlüssel für das Website-Backend und aktualisiere die Liste. Ältere uneingeschränkte Schlüssel können keine Befehlsrichtlinie tragen.",
        enabled: "Event-Befehle mit diesem Schlüssel erlauben",
        roles: "Erlaubte Rollen",
        rolesHelp:
            "Ein Spiel ohne Rollen bleibt schreibgeschützt. Das Speichern einer aktivierten Richtlinie gewährt Schreibzugriff für die Spiele mit Rollen; das Deaktivieren entzieht ihn.",
        granted: "Schreibzugriff gewährt für: {games}",
        notGranted: "Kein Schreibzugriff für Event-Befehle gewährt.",
        loading: "Wird geladen…",
        refresh: "Aktualisieren",
        saving: "Wird gespeichert…",
        save: "Richtlinie speichern",
        saved: "Richtlinie für Event-Befehle gespeichert.",
        error: "Die Richtlinie konnte nicht geladen oder gespeichert werden. Bitte aktualisieren und erneut versuchen.",
        denied: "Die Richtlinie wurde abgelehnt. Verwende einen gültigen eingeschränkten Schlüssel dieses Arbeitsbereichs und eine darin registrierte Anwendung.",
        invalid:
            "Verwende gültige Discord-Rollen-IDs, höchstens 64 pro Spiel, für in diesem Arbeitsbereich aktivierte Spiele.",
    },
    publicPanelAppearance: {
        title: "Darstellung",
        description:
            "Layout, Akzentfarbe, Banner und Fraktions-Emojis dieses Panels. Panels, die vor Einführung dieser Einstellungen gespeichert wurden, behalten ihr bisheriges Aussehen, bis du sie hier änderst.",
        mapArtwork: "Kartenbild",
        layout: "Layout",
        showMap: "Kartenname und Kartenbild anzeigen",
        showScoreboard: "Punktestand anzeigen",
        showPlayerCount: "Spielerzahl anzeigen",
        compact: "Kompakte Kopfzeile",
        layoutHelp:
            "Kompakt nutzt eine zweizeilige Kopfzeile, Punktestände in einer Zeile und keine Trennlinien. Das Kartenbild erfordert zusätzlich die Einstellung Kartenbild.",
        resultsLayoutHelp:
            "Ergebnismeldungen nutzen die Karten- und Kompakt-Einstellung; Punktestand und Spielerzahl gelten für Live-Panels.",
        accentColor: "Akzentfarbe",
        accentColorPicker: "Akzentfarbe wählen",
        accentColorPlaceholder: "#77B255",
        accentColorHelp:
            "#RRGGBB. Ersetzt das Grün des Live-Panels; veraltete oder pausierte Panels behalten die orange Warnfarbe. Leer lassen für die Standardfarbe.",
        accentColorReset: "Standardfarbe",
        accentColorInvalid: "Gib eine Farbe im Format #RRGGBB ein.",
        banner: "Banner",
        bannerHelp:
            "PNG, JPEG oder WebP bis 2 MiB und 4096 × 4096 px. Logi wandelt es in WebP mit höchstens 1920 × 1080 px um. Ein Banner ersetzt das Kartenvorschaubild.",
        bannerUpload: "Banner hochladen",
        bannerUploading: "Wird hochgeladen…",
        bannerRemove: "Banner entfernen",
        bannerPreview: "Bannervorschau",
        bannerNone:
            "Kein Banner. Das Panel zeigt das Kartenbild, sofern aktiviert.",
        bannerUploaded:
            "Banner hochgeladen. Speichere das Panel, um es zu veröffentlichen.",
        bannerSelected:
            "Banner ausgewählt. Speichere das Panel, um es zu veröffentlichen.",
        bannerLibrary: "Hochgeladene Banner",
        bannerLibraryShow: "Hochgeladenes Banner wählen",
        bannerLibraryHide: "Hochgeladene Banner ausblenden",
        bannerLibraryLoading: "Hochgeladene Banner werden geladen…",
        bannerLibraryEmpty:
            "In diesem Workspace wurden noch keine Banner hochgeladen.",
        bannerLibraryError:
            "Hochgeladene Banner konnten nicht geladen werden. Versuche es später erneut.",
        bannerLibraryItem: "Banner {width} × {height} px vom {date} verwenden",
        factionEmoji: "Fraktions-Emojis",
        factionEmojiHelp:
            "Ein Unicode-Emoji oder ein eigenes Discord-Emoji im Format <:name:id> (animiert: <a:name:id>). Eigene Emojis müssen zu einem Server gehören, auf dem der Bot ist, oder zur Bot-Anwendung. Leer lassen, um den als Platzhalter gezeigten Standard zu behalten.",
        factionEmojiInvalid: "Gib ein Emoji oder <:name:id> ein.",
        noDefaultEmoji: "Keins",
        factions: {
            allies: "Alliierte",
            axis: "Achsenmächte",
            valkyra: "Valkyra",
            manticore: "Manticore",
            lonestar: "Lonestar",
        },
        invalid:
            "Korrigiere vor dem Speichern die markierten Darstellungseinstellungen.",
        errors: {
            invalid_kind:
                "Dieser Bildtyp kann nicht als Banner verwendet werden.",
            unsupported_type: "Verwende ein PNG-, JPEG- oder WebP-Bild.",
            type_mismatch:
                "Der Dateiinhalt passt nicht zum Dateityp. Exportiere die Datei erneut als PNG, JPEG oder WebP.",
            bad_dimensions:
                "Das Bild darf höchstens 4096 × 4096 Pixel groß sein.",
            animated: "Animierte Bilder werden nicht unterstützt.",
            undecodable:
                "Das Bild konnte nicht gelesen werden. Exportiere es erneut und versuche es noch einmal.",
            invalid_asset:
                "Das Bild konnte nicht gespeichert werden. Lade es erneut hoch.",
            forbidden: "Nur Workspace-Administratoren können Banner hochladen.",
            too_large: "Das Bild ist größer als 2 MiB.",
            upload_limited:
                "Zu viele Uploads. Versuche es in {seconds} s erneut.",
            unavailable:
                "Bild-Uploads sind derzeit nicht verfügbar. Versuche es später erneut.",
            asset_unavailable:
                "Das Banner ist für diesen Workspace nicht mehr verfügbar. Lade es erneut hoch oder entferne es und speichere dann.",
        },
    },
    gameData: {
        servers: {
            emptyTitle: "Noch kein Spielserver verbunden",
            emptyDescription:
                "Verbinde einen CRCON- oder Warcon-Server, damit Logi Ergebnisse und Statistiken sammelt. Der API-Schlüssel wird verschlüsselt gespeichert und ist danach für niemanden mehr sichtbar.",
            closeForm: "Schließen",
            card: {
                status: {
                    collecting: "Sammelt Daten",
                    stopped: "Durch Fehler pausiert",
                    off: "Sammelt nicht",
                    none: "Kein Sammeln",
                },
                key: {
                    set: "gespeichert",
                    missing: "fehlt",
                    not_required: "nicht nötig",
                    environment: "vom Logi-Betreiber gesetzt",
                    needs_operator: "erneut eingeben",
                },
                unverified: "nicht geprüft",
                changed: "geändert {date}",
                testOk: "in Ordnung",
                testFailed: "fehlgeschlagen",
                lastGame: "Letztes Spiel",
                noGame: "noch keins",
                serverNumber: "Server {id}",
                testKey: "Schlüssel testen",
                live: "Live-Punktestand",
                liveHide: "Live-Punktestand ausblenden",
                fixUnauthorized: {
                    crcon: "Der Server hat den Schlüssel abgelehnt. Erstelle in CRCON einen neuen Schlüssel, der Serverinformationen lesen darf, und gib ihn über Schlüssel ändern ein.",
                    other: "Der Server hat den Schlüssel abgelehnt. Erstelle beim Anbieter einen neuen Schlüssel und gib ihn über Schlüssel ändern ein.",
                },
                retentionKeep: "Gespielte Runden aufbewahren",
                retentionHelp:
                    "Ältere Runden werden nachts gelöscht und Websites berechnen ihre Summen neu.",
                browseHistory: "Gespielte Runden ansehen",
            },
            form: {
                type: "Servertyp",
                types: {
                    hll_crcon: "CRCON",
                    wardogs_warcon: "Warcon",
                    wardogs_rcon: "RCON",
                    wardogs_public_directory: "Öffentlich",
                },
                address: "Adresse",
                namePlaceholder: "Zum Beispiel Server 2",
                serverNumber: {
                    hll_crcon: "Servernummer in CRCON",
                    wardogs_warcon: "Server-ID in Warcon",
                    wardogs_rcon: "Server-ID in RCON",
                    wardogs_public_directory: "Server-ID in der Liste",
                },
                keyPlaceholder: "Schlüssel einfügen",
                help: "Das Spiel ergibt sich aus dem Servertyp. Der Schlüssel wird zuerst getestet und erst dann gespeichert.",
                testFirst: "Speichern geht nach einem erfolgreichen Test.",
                testPassed:
                    "Der Test war erfolgreich. Du kannst den Server speichern.",
                saveAndCollect: "Speichern und Sammeln starten",
            },
            keyLabel: "API-Schlüssel",
            lastTestLabel: "Letzter Test",
            notTested: "Noch nicht getestet",
            collectionLabel: "Sammeln",
            moreActions: "Weitere Aktionen für {name}",
            historyTitle: "Spielverlauf",
            title: "Spielserver",
            description:
                "Verbinde die Hell-Let-Loose-CRCON- oder Wardogs-Warcon-Server, von denen dieser Arbeitsbereich Daten sammelt: die HTTPS-Adresse des Servers, seine ID beim Anbieter und den API-Schlüssel. Logi testet die Verbindung und speichert den Schlüssel verschlüsselt. Ein gespeicherter Schlüssel kann weder angezeigt noch exportiert werden; um ihn zu ändern, gib einen neuen ein.",
            encryptionUnavailable:
                "Die verschlüsselte Schlüsselablage ist in dieser Logi-Installation noch nicht aktiviert. Du kannst einen Schlüssel testen, aber das Speichern ist deaktiviert, bis der Logi-Betreiber sie aktiviert.",
            none: "Mit diesem Arbeitsbereich ist noch kein Spielserver verbunden.",
            limit: "Höchstens {limit} Server pro Arbeitsbereich.",
            add: "Server verbinden",
            managed: {
                workspace: "In diesem Arbeitsbereich verwaltet",
                operator: "Vom Logi-Betreiber eingerichtet",
            },
            games: {
                hell_let_loose: "Hell Let Loose",
                wardogs: "Wardogs",
            },
            providers: {
                hll_crcon: "CRCON",
                wardogs_warcon: "Warcon-Panel",
                wardogs_rcon: "Wardogs RCON",
                wardogs_public_directory:
                    "Wardog-Servers-Verzeichnis (öffentlich)",
            },
            fields: {
                displayName: "Name",
                game: "Spiel",
                provider: "Anbieter",
                origin: "HTTPS-Adresse",
                serverId: "Server-ID beim Anbieter",
                key: "API-Schlüssel",
                newKey: "Neuer API-Schlüssel",
            },
            hints: {
                origin: "Nur die Adresse, zum Beispiel https://panel.example.com, ohne Pfad.",
                serverId: {
                    hll_crcon: "Die CRCON-Servernummer, meist 1.",
                    wardogs_warcon: "Die Server-UUID aus dem Warcon-Panel.",
                    wardogs_rcon: "Die Server-ID, die deine RCON-API meldet.",
                    wardogs_public_directory:
                        "Die Server-ID im Wardog-Servers-Verzeichnis.",
                },
                key: "Wird einmal gesendet, getestet und verschlüsselt gespeichert. Logi zeigt ihn nie wieder an.",
                keyOptional:
                    "Bei CRCON optional: Ohne Schlüssel liest Logi nur öffentliche Daten. Mit Schlüssel braucht dessen CRCON-Benutzer die Berechtigung, Verbindungsinformationen anzuzeigen.",
                keyNone:
                    "Das öffentliche Verzeichnis braucht keinen Schlüssel.",
            },
            enableAfterTest: "Nach erfolgreichem Test mit dem Sammeln beginnen",
            allowUnverified:
                "Auch bei fehlgeschlagenem Test speichern (das Sammeln stoppt, bis ein Test besteht)",
            actions: {
                test: "Verbindung testen",
                testing: "Wird getestet…",
                save: "Server speichern",
                saving: "Wird gespeichert…",
                testStored: "Gespeicherten Schlüssel testen",
                changeKey: "Schlüssel ändern",
                saveKey: "Schlüssel speichern",
                cancel: "Abbrechen",
                removeKey: "Schlüssel entfernen",
                rename: "Umbenennen",
                saveName: "Namen speichern",
                enable: "Sammeln starten",
                disable: "Sammeln stoppen",
                remove: "Server entfernen",
            },
            confirm: {
                removeKeyTitle: "Schlüssel für {name} entfernen?",
                removeTitle: "{name} entfernen?",
                cancel: "Abbrechen",
                removeKey:
                    "Sammeln, das den Schlüssel braucht, stoppt, bis ein neuer Schlüssel eingegeben wird.",
                remove: "Das Sammeln stoppt und der gespeicherte Schlüssel wird gelöscht. Gesammelter Verlauf bleibt erhalten.",
            },
            key: {
                set: "Schlüssel verschlüsselt gespeichert",
                missing: "Kein Schlüssel gespeichert",
                not_required: "Kein Schlüssel nötig",
                environment: "Schlüssel vom Logi-Betreiber gesetzt",
                needs_operator:
                    "Alter Schlüsselverweis: Gib den Schlüssel hier erneut ein oder bitte den Logi-Betreiber um die Migration",
            },
            keyChanged: "Schlüssel geändert {date}",
            verified: "Schlüssel hat den letzten Test bestanden",
            unverified: "Schlüssel nicht geprüft: Teste ihn vor dem Sammeln",
            failure: {
                key_unavailable:
                    "Der gespeicherte Schlüssel kann nicht verwendet werden, weil der Verschlüsselungsschlüssel des Betreibers fehlt. Wende dich an den Logi-Betreiber.",
                decrypt_failed:
                    "Der gespeicherte Schlüssel kann für diesen Server nicht gelesen werden. Gib den Schlüssel erneut ein.",
            },
            collection: {
                enabled: "Sammelt",
                disabled: "Sammelt nicht",
                none: "Kein Sammeln eingerichtet",
                lastSuccess: "Letztes erfolgreiches Sammeln {date}",
                never: "Noch kein erfolgreiches Sammeln",
            },
            lastTest: "Letzter Test {date}: {outcome}",
            saved: {
                created: "Server gespeichert, das Sammeln läuft.",
                draft: "Server als deaktivierter Entwurf gespeichert. Teste ihn und starte das Sammeln, sobald der Test besteht.",
                key: "Schlüssel gespeichert.",
                keyUnverified:
                    "Schlüssel gespeichert, aber der Test ist fehlgeschlagen, daher wurde das Sammeln gestoppt.",
                removedKey: "Schlüssel entfernt.",
                renamed: "Name gespeichert.",
                removed: "Server entfernt.",
                enabled: "Sammeln gestartet.",
                disabled: "Sammeln gestoppt.",
            },
            outcomes: {
                ok: "Die Verbindung funktioniert und der Schlüssel wird für diesen Server akzeptiert.",
                unauthorized: "Der Anbieter hat den Schlüssel abgelehnt.",
                server_mismatch:
                    "Der Anbieter hat geantwortet, aber nicht für diese Server-ID.",
                rate_limited:
                    "Der Anbieter drosselt Anfragen. Versuche es später erneut.",
                timeout: "Der Anbieter hat nicht rechtzeitig geantwortet.",
                network: "Der Anbieter ist nicht erreichbar.",
                invalid_response:
                    "Der Anbieter hat unerwartet geantwortet. Prüfe Adresse und Anbieter.",
                configuration:
                    "Diese Adresse ist nicht erlaubt (nur öffentliche HTTPS-Adressen) oder der Server ist nicht vollständig eingerichtet.",
                unsupported: "Der Anbieter unterstützt diese Prüfung nicht.",
                key_unavailable:
                    "Der gespeicherte Schlüssel kann nicht verwendet werden. Gib ihn erneut ein oder wende dich an den Logi-Betreiber.",
            },
            errors: {
                invalid_source:
                    "Prüfe die Felder: eine HTTPS-Adresse ohne Pfad und eine Server-ID im Format des Anbieters.",
                invalid_key:
                    "Der Schlüssel muss aus 8 bis 4096 sichtbaren Zeichen ohne Leerzeichen bestehen.",
                duplicate_name:
                    "Ein anderer Server in diesem Arbeitsbereich hat bereits diesen Namen.",
                duplicate_identity:
                    "Dieser Server ist in diesem Arbeitsbereich bereits verbunden.",
                limit_reached:
                    "Dieser Arbeitsbereich hat bereits die maximale Anzahl an Servern.",
                not_found:
                    "Dieser Server existiert nicht mehr. Aktualisiere die Liste.",
                revision_conflict:
                    "Jemand anderes hat diesen Server geändert. Aktualisiere und versuche es erneut.",
                operator_managed:
                    "Diesen Server richtet der Logi-Betreiber ein: Er kann hier weder umbenannt noch entfernt werden, und sein Schlüssel kann nur ersetzt werden.",
                key_required: "Dieser Anbieter braucht einen API-Schlüssel.",
                key_not_allowed:
                    "Das öffentliche Verzeichnis nimmt keinen Schlüssel an.",
                verification_required:
                    "Der Verbindungstest ist nicht bestanden. Behebe das Problem oder speichere den Schlüssel ausdrücklich als ungeprüft.",
                encryption_unavailable:
                    "Die verschlüsselte Schlüsselablage ist nicht verfügbar. Wende dich an den Logi-Betreiber.",
                rate_limited:
                    "Zu viele Verbindungstests. Versuche es in {seconds} s erneut.",
                unavailable:
                    "Spielserver konnten nicht geladen oder gespeichert werden. Bitte aktualisieren und erneut versuchen.",
            },
        },
        liveScoreboard: "Warcon Live-Scoreboard",
        scoreboardPolling:
            "Aktualisierung alle 15 Sekunden bei geöffneter Ansicht. Die Quelle kann verzögert sein.",
        scoreboardError:
            "Das Live-Scoreboard ist nicht verfügbar. Bitte später erneut versuchen.",
        scoreboardEmpty:
            "Bei der letzten Beobachtung waren keine Spieler verbunden.",
        scoreboardUnavailable: "Keine aktuellen Spielerdaten verfügbar.",
        playerObservation: "Spielerdaten vom",
        joinCode: "Beitrittscode",
        player: "Spieler",
        faction: "Fraktion",
        kills: "Kills",
        deaths: "Tode",
        cash: "Geld",
        ping: "Ping (ms)",
        collectedSessions: "Erfasste Spiele",
        historyObserved: "Letzter Verlaufimport",
        historyError: "Verlauferfassung",
        title: "Spielserver-Daten",
        description:
            "Sammle Serverdaten in Logi und teile ausgewählte Felder mit deiner Website. Verbinde oben einen Server; das Sammeln beginnt, sobald sein Verbindungstest besteht.",
        loading: "Wird geladen…",
        refresh: "Aktualisieren",
        saving: "Wird gespeichert…",
        enable: "Aktivieren / fortsetzen",
        disable: "Deaktivieren",
        disabled: "Deaktiviert",
        error: "Verbindungen konnten nicht geladen oder gespeichert werden. Erneut versuchen oder den Betreiber kontaktieren.",
        empty: "Für diesen Arbeitsbereich sammelt noch kein Spielserver Daten.",
        state: "Datenstatus",
        players: "Spieler",
        map: "Karte",
        observed: "Letzte Beobachtung",
        unknown: "Unbekannt",
        never: "Noch nicht erfasst",
        unconfirmed: "laufender Spielstand, unbestätigt",
        historySupported:
            "Die Quelle unterstützt Spielhistorie. Importierte Daten müssen vor der Ergebnisbestätigung geprüft werden.",
        historyUnsupported:
            "Diese Quelle bietet keine Erfassung der Spielhistorie.",
        freshness: {
            fresh: "Aktuell",
            stale: "Veraltet",
            unavailable: "Nicht verfügbar",
        },
        errors: {
            not_listed:
                "Der Server ist nicht gelistet; sein Zustand ist unbekannt.",
            timeout: "Die Quelle hat nicht rechtzeitig geantwortet.",
            network: "Die Quelle ist nicht erreichbar.",
            rate_limited: "Warten auf das Anfragelimit der Quelle.",
            unauthorized: "Erfassung pausiert: Zugriff verweigert.",
            invalid_response:
                "Die Quelle hat eine nicht unterstützte Antwort geliefert.",
            unsupported:
                "Erfassung pausiert: Die erforderliche Funktion ist nicht verfügbar.",
            configuration:
                "Sammeln pausiert: Prüfe Adresse und Schlüssel des Servers oder wende dich an den Logi-Betreiber.",
        },
    },
    apiKeys: {
        revokeTitle: "Schlüssel {name} widerrufen?",
        groupsLegend: "Bereiche",
        groups: {
            matches: {
                label: "Matches",
                short: "Matches",
                help: "Events, Matches, ihre Zusammenfassungen und Strat-Maps.",
            },
            rosters: {
                label: "Aufstellungen",
                short: "Aufstellungen",
                help: "Aufstellungen, Squads und Zuordnungen der Spieler.",
            },
            results: {
                label: "Ergebnisse",
                short: "Ergebnisse",
                help: "Bestätigte Ergebnisse, Spielerstatistiken und Spielverlauf.",
            },
            members: {
                label: "Mitglieder",
                short: "Mitglieder",
                help: "Clan-Mitglieder und ihr Status. Für das Lesen der Mitgliedschaft gelten zusätzlich eigene Regeln.",
            },
            servers: {
                label: "Spielserver",
                short: "Server",
                help: "Live-Zustand der Server, Warcon, HLL und Zustand der Verbindung.",
            },
            league: {
                label: "Liga und Teams",
                short: "Liga",
                help: "Matches der Wardogs League und der Teamkatalog.",
            },
        },
        partialGroup: "{group} (teilweise)",
        readOnlyShort: "nur lesen",
        everyGame: "alle Spiele",
        createdOn: "erstellt {date}",
        revokeDescription:
            "Alles, was diesen Schlüssel nutzt, etwa deine Website, bekommt sofort keine Daten mehr von Logi. Das lässt sich nicht rückgängig machen; für neuen Zugriff erstellst du einen neuen Schlüssel.",
        revokeConfirm: "Schlüssel widerrufen",
        emptyTitle: "Noch kein API-Schlüssel",
        emptyDescription:
            "Erstelle einen Schlüssel für den Server deiner Website. Wähle nur die Daten und Spiele, die sie braucht.",
        description:
            "Erstelle einen Integrationsschlüssel und bewahre ihn auf deinem Server auf. Wähle nur die benötigten Daten und Spiele.",
        name: "Schlüsselname",
        namePlaceholder: "Name der Website, z. B. Hauptseite",
        access: "Berechtigung",
        readOnly: "Nur lesen",
        fullAccess: "Vollzugriff (bisheriger Modus)",
        readOnlyHelp:
            "Kann nur ausgewählte Ressourcen und Spiele lesen. Kann keine Daten erstellen, ändern oder löschen.",
        fullAccessHelp:
            "Kann alle Clan-Daten für alle Spiele lesen und ändern. Nur für Integrationen verwenden, die Schreibzugriff benötigen.",
        resources: "Ressourcen",
        games: "Spiele",
        selectScope: "Wähle mindestens eine Ressource und ein Spiel.",
        privateData:
            "Vollständige Datensätze können private Betriebsdaten enthalten. Prüfe die Daten vor der Veröffentlichung.",
        createReadOnly: "Leseschlüssel erstellen",
        createFullAccess: "Schlüssel mit Vollzugriff erstellen",
        copyNow:
            "Kopiere den Schlüssel jetzt. Er kann nicht erneut angezeigt werden. Bewahre ihn auf deinem Server auf.",
        copy: "API-Schlüssel kopieren",
        copied: "API-Schlüssel kopiert.",
        copyFailed:
            "Kopieren fehlgeschlagen. Kopiere den Schlüssel manuell, bevor du ihn ausblendest.",
        hide: "Schlüssel ausblenden",
        createFailed:
            "Der Schlüssel konnte nicht erstellt werden. Prüfe deine Auswahl und versuche es erneut.",
        invalidKey:
            "Der Server hat einen ungültigen API-Schlüssel zurückgegeben.",
        revoke: "Widerrufen",
        revokeFailed:
            "Der Schlüssel konnte nicht widerrufen werden. Versuche es erneut.",
        revoked: "widerrufen",
        created: "erstellt",
        existingKeys: "Vorhandene Schlüssel",
        rotateHelp:
            "Erstelle zum Ändern der Berechtigungen einen Ersatzschlüssel, stelle die Integration um und widerrufe dann den alten Schlüssel.",
        allGames: "alle Spiele; Lesen und Schreiben",
        loading: "Schlüssel werden geladen…",
        loadFailed:
            "Schlüssel konnten nicht aktualisiert werden. Angezeigte Berechtigungen sind möglicherweise veraltet.",
        retry: "Erneut versuchen",
        empty: "Es wurden noch keine API-Schlüssel erstellt.",
        invalidPolicy:
            "Unbekannte Einschränkungen; der Backend-Zugriff wird verweigert.",
        resourceLabels: {
            "server-game-history":
                "Gespeicherte Serverspiele (Spielernamen und Steam-IDs)",
            "league-matches": "Öffentliche Wardogs League Spiele",
            "league-fixtures": "Verfolgte Wardogs League Spiele",
            "hll-live":
                "HLL Live-Scoreboard (mit Spielernamen und Plattform-IDs)",
            "warcon-data": "Warcon-Spieldaten (mit Spielernamen und Steam-IDs)",
            "member-summaries": "Mitgliederverzeichnis (nur lesen)",
            "roster-summaries":
                "Veröffentlichte Aufstellungen und Teilnahme (nur lesen)",
            "player-stat-summaries":
                "Verifizierte Spielerdaten aus erfassten Runden",
            "membership-summaries":
                "Discord-Mitgliedschaft (separate Freigabe erforderlich)",
            "server-snapshots": "Spielserver-Status",
            "integration-health": "Erfassungsstatus",
            "event-summaries": "Ereignisübersichten",
            "match-summaries": "Match-Übersichten",
            "result-summaries": "Übersichten geprüfter Ergebnisse",
            events: "Ereignisse (vollständige Datensätze)",
            matches: "Matches (Rohstatistiken)",
            groups: "Gruppen",
            rosters: "Aufstellungen",
            assignments: "Mitgliedszuordnungen",
            stratmaps: "Taktikkarten",
            teams: "Teamverzeichnis (aktive Teams, Namen und Logos)",
        },
    },
    publicProfiles: {
        communityTitle: "Community",
        communityDescription:
            "Durchsuche aktive Clans und ihre öffentlichen Match-Historien.",
        backToLogi: "Zurück zu Logi",
        matches: "Matches",
        kills: "Kills",
        deaths: "Tode",
        kd: "K/D",
        matchHistory: "Match-Historie",
        matchPlayers: "Spieler",
        activeMembers: "aktive Mitglieder",
        recentMatches: "Letzte Matches",
        wins: "Siege",
        winRate: "Siegquote",
        clans: "Clans",
        findPlayer: "Spieler finden",
        findCommunity: "Spieler oder Clan finden",
        findPlayerDescription:
            "Durchsuche öffentliche Profile mit mindestens einem erfassten Match.",
        playerSearchPlaceholder: "Nach Spielernamen suchen...",
        communitySearchPlaceholder: "Spieler und Clans suchen...",
        search: "Suchen",
        noPlayersFound: "Keine öffentlichen Spieler für diese Suche gefunden.",
        noClansFound: "Keine öffentlichen Clans für diese Suche gefunden.",
        platformMatchHistoryDescription:
            "Ergebnisse aller öffentlichen Clans, erst sichtbar, nachdem Match-Daten veröffentlicht wurden.",
        victory: "Sieg",
        defeat: "Niederlage",
        recorded: "Erfasst",
        noMatches:
            "Es wurden noch keine öffentlichen Match-Ergebnisse veröffentlicht.",
        loadMore: "Mehr laden",
        inviteSettings: {
            title: "Discord-Einladung",
            description:
                "Der Button „Auf Discord beitreten“ auf der öffentlichen Clan-Seite öffnet diese Einladung.",
            label: "Einladungslink",
            help: "Nur Links von discord.gg oder discord.com/invite. Lass das Feld leer, um den Button auszublenden.",
            invalid:
                "Das ist keine Discord-Einladung. Kopiere den Link aus Discord (Leute einladen).",
            save: "Einladung speichern",
            saving: "Wird gespeichert …",
            saved: "Einladung gespeichert.",
            removed: "Einladung entfernt.",
            saveError: "Die Einladung konnte nicht gespeichert werden.",
            viewPublicPage: "Öffentliche Seite ansehen",
        },
    },
    app: {
        name: "Logi",
        tagline: "Event-Organisator",
        description:
            "Organisiere Clan-Events, erstelle Roster, veröffentliche Briefings und bereite Discord-verbundene Operationen vor.",
    },
    games: {
        filterLabel: "Spielfilter",
        column: "Spiel",
        all: "Alle Spiele",
        title: "Spiele",
        description: "Aktiviere die Spiele, die dieser Clan verwendet.",
        save: "Spiele speichern",
        saved: "Aktivierte Spiele gespeichert.",
        saveError: "Aktivierte Spiele konnten nicht gespeichert werden.",
        selectTitle: "Wähle zuerst ein Spiel",
        selectDescription:
            "Dieser Eintrag gehört zu einem Spiel. Wähle das Spiel vor dem Erstellen.",
        noActiveTitle: "Kein aktives Spiel",
        noActiveDescription:
            "Aktiviere mindestens ein Spiel in den Clan-Einstellungen, bevor du spielbezogene Eintrage erstellst.",
        openSettings: "Clan-Einstellungen offnen",
    },
    publicNavigation: {
        menu: "Menü",
        wiki: "Wiki",
        discordSupport: "Discord-Support",
        restartTour: "Tour neu starten",
        privacy: "Datenschutz",
        gdpr: "DSGVO",
        terms: "AGB",
    },
    home: {
        openApp: "App öffnen",
        signIn: "Mit Discord anmelden",
        contribute: "Auf GitHub mitwirken",
        loggedInAs: "Angemeldet als {name}",
        dashboard: "Dashboard",
        community: "Community entdecken",
        competitions: "Wettbewerbe",
        featuresNav: "Funktionen",
        liveOperations: "Operationen, vernetzt",
        commandCenter: "Deine Operations-Leitzentrale",
        commandCenterDescription:
            "Events, Roster, Discord-Koordination und öffentliche Match-Historie an einem Ort.",
        eventsMetric: "Events",
        playersMetric: "Spieler",
        matchesMetric: "Matches",
        nextOperation: "Nächste Operation",
        registrationOpen: "Anmeldung offen",
        sampleOperation: "Wettkampf-Match am Samstag",
        sampleOperationMeta: "19:30 · 31 angemeldet",
        featuresEyebrow: "Gebaut für organisierte Teams",
        featureEventsDescription:
            "Plane jede Phase einer Operation mit klaren Zeiten und Discord-fertigen Ankündigungen.",
        featureRostersDescription:
            "Erstelle Aufstellungen, koordiniere Anwesenheit und halte alle auf dem gleichen Stand.",
        featureStats: "Öffentliche Match-Historie",
        featureStatsDescription:
            "Teile Spielerprofile, Ergebnisse und detaillierte Match-Analysen mit deiner Community.",
        badge: "Discord-Operationen für organisierte Gruppen",
        title: "Logi hält Community-Operationen lesbar, strukturiert und an einem Ort.",
        description:
            "Logi ist eine Open-Source-Plattform für Gruppen, die Events, Roster, Trainings, Matches und Discord-Koordination betreiben.",
        featuresTitle: "Was es wirklich kann",
        featuresDescription:
            "Plane Events, verwalte Anmeldungen, erstelle Roster, bereite Matches vor und halte Discord synchron.",
        featureEvents: "Events, Trainings und Match-Workflows",
        featureRosters: "Roster- und Anwesenheitsverwaltung",
        featureDiscord: "Discord-verbundene Serververwaltung",
        featureTools: "Geteilte Tools für organisierte Communities",
        commsBadge: "LogiComms",
        commsTitle: "Klare Squad-Kommunikation ohne Overhead.",
        commsDescription:
            "LogiComms ist eine leichte, schnelle Desktop-App für effiziente Squad-interne Kommunikation. Schnell eingerichtet und anpassbar an deine Einheit.",
        commsDownload: "Für Windows herunterladen",
        commsUnavailable: "Windows-Download vorübergehend nicht verfügbar.",
        freeToUse: "Kostenlos nutzbar",
        sourceAvailable: "Quellcode auf GitHub verfügbar",
        contributionsWelcome: "Beiträge willkommen",
        noMarketingFiller: "Kein Marketing-Blabla",
        landing: {
            heroEyebrow: "Das Betriebssystem für deine Community",
            heroLineOne: "Jeder Spieler.",
            heroLineAccent: "Jede Operation.",
            heroLineThree: "In Formation.",
            heroDescription:
                "Logi verwandelt das schöne Chaos der Community-Verwaltung in eine lebendige Leitzentrale.",
            deployCommunity: "Starte deine Community",
            seeEverything: "Sieh dir alles an",
            playersConfirmed: "31 Spieler bestätigt",
            marquee: [
                "Operationen",
                "Roster",
                "Matches",
                "Briefings",
                "Mitglieder",
                "Discord",
                "Analysen",
            ],
            arsenalEyebrow: "Das komplette Arsenal",
            arsenalTitle:
                "Keine Landingpage voller Versprechen. Eine echte Leitzentrale, Bildschirm für Bildschirm.",
            arsenalDescription:
                "Jedes Modul ist bereits Teil von Logi. Erkunde das ganze System unten.",
            features: {
                dashboard: {
                    title: "Operations-Dashboard",
                    description:
                        "Der Puls deiner Community: Events, Leistung, Spieler und das nächste Vorhaben.",
                },
                calendar: {
                    title: "Kalender & Events",
                    description:
                        "Plane Trainings, Matches und Community-Abende ohne Discord-Sucherei.",
                },
                roster: {
                    title: "Roster-Builder",
                    description:
                        "Baue Squads visuell auf, besetze jede Rolle und wisse genau, wer bereit ist.",
                },
                briefing: {
                    title: "Briefings & Karten",
                    description:
                        "Lege Plan, Map und Befehle dorthin, wo jeder Spieler sie findet.",
                },
                matches: {
                    title: "Match-Historie",
                    description:
                        "Halte fest, was zählt: Ergebnisse, Spielstände, Leistung und besondere Momente.",
                },
                members: {
                    title: "Mitgliederverzeichnis",
                    description:
                        "Ein echter Blick auf deine Leute, Rollen, Anwesenheit und Community-Gesundheit.",
                },
                event: {
                    title: "Event-Leitung",
                    description:
                        "Von einfacher Anmeldung bis zum vollen Operations-Briefing bekommt jedes Event sein eigenes Zuhause.",
                },
                presets: {
                    title: "Squad-Presets",
                    description:
                        "Lege deine Einheitsstruktur einmal fest. Starte in Sekunden mit vertrauter Formation.",
                },
                assignments: {
                    title: "Zuweisungen",
                    description:
                        "Bewege Spieler an den richtigen Platz mit einem Workflow für Kommandeure.",
                },
                matchData: {
                    title: "Match-Daten",
                    description:
                        "Halte die Details hinter jedem Ergebnis griffbereit für Leader, Analysten und Spieler.",
                },
                api: {
                    title: "Öffentliche API & Docs",
                    description:
                        "Umfangreiche API-Referenz und Dokumentation für Server-Admins, Integrationen und Mitwirkende.",
                },
                wiki: {
                    title: "Community-Wiki",
                    description:
                        "Praktische Anleitungen für jede Logi-Funktion, vom ersten Workspace bis zum täglichen Betrieb.",
                },
            },
            botEyebrow: "Discord im Ablauf",
            botTitle: "Der Bot bringt die Operation auf deinen Server.",
            botDescription:
                "Gib Mitgliedern die Aktionen, die sie brauchen, ohne dass Discord zum Ort wird, an dem Informationen verloren gehen.",
            botFeatures: {
                clanRegistration: {
                    title: "Clan-Bewerbungen",
                    description:
                        "Lass Rekruten einen Bewerbungstyp wählen und direkt in Discord eine strukturierte Mitgliedschaftsanfrage starten.",
                },
                eventInfo: {
                    title: "Event-Informationen",
                    description:
                        "Veröffentliche Zeitplan, Briefing, Roster, Server-Details und Kalenderaktion in einem Event-Beitrag.",
                },
                matchSignup: {
                    title: "Match-Anmeldungen",
                    description:
                        "Zeige freie Roster-Slots und lass Spieler sich in Sekunden anmelden, absagen oder ihren Status prüfen.",
                },
                attendance: {
                    title: "Teilnahmebestätigungen",
                    description:
                        "Bitte bestätigte Spieler vor einem Treffen um eine erneute Zusage und gib ihnen eine klare Möglichkeit, Verspätung zu melden.",
                },
                tickets: {
                    title: "Support-Tickets",
                    description:
                        "Mache aus einem Discord-Panel ein geführtes privates Ticket mit allen Angaben, die das Team von Anfang an braucht.",
                },
            },
            workflowEyebrow: "Vom Briefing zum Debriefing",
            workflowTitle: "Die Arbeit fließt. Deine Tools auch.",
            workflowDescription:
                "Eine gute Operation ist kein Bildschirm. Sie ist ein Rhythmus, den Logi zusammenhält.",
            workflow: [
                {
                    title: "Planen",
                    description:
                        "Erstelle ein Event, wähle die Map, veröffentliche das Briefing.",
                },
                {
                    title: "Füllen",
                    description:
                        "Öffne Anmeldungen, forme das Roster, besetze jeden Slot.",
                },
                {
                    title: "Durchführen",
                    description:
                        "Gib Leadern eine lebendige, geteilte Wahrheit.",
                },
                {
                    title: "Erinnern",
                    description:
                        "Erfasse Ergebnisse, verfolge Leistung, erzähle die Geschichte.",
                },
            ],
            ownershipEyebrow: "Deins, für immer",
            ownershipTitle: "Frei nutzbar. Frei besitzbar. Frei erweiterbar.",
            ownershipDescription:
                "Nutze Logi kostenlos auf unserer gehosteten Plattform oder betreibe den vollen Stack auf eigener Infrastruktur, wenn Datenhoheit nicht verhandelbar ist.",
            values: {
                hosted: {
                    title: "Gehostet, für immer kostenlos",
                    description:
                        "Starte sofort mit deiner Community. Unsere gehostete Version ist kostenlos — ohne Funktions-Sperren, ohne Überraschungs-Upgrade.",
                },
                selfHosted: {
                    title: "Selbst hosten, wenn es zählt",
                    description:
                        "Willst du volle Kontrolle über Daten, Umgebung und Deployment? Betreibe Logi selbst und behalte die Schlüssel.",
                },
                openSource: {
                    title: "Open Source, tief dokumentiert",
                    description:
                        "Erkunde den Code, bringe Verbesserungen ein und nutze die umfangreiche API-Dokumentation, um Logi mit deinen eigenen Tools zu verbinden.",
                },
            },
            finalTitle: "Deine nächste Operation wartet schon.",
            finalDescription:
                "Baue den Ort, dem deine Spieler schon vor dem ersten „Ready Check“ vertrauen.",
        },
        pillars: {
            operationsTitle: "Erledigt das Langweilige",
            operationsDescription:
                "Planung, Anmeldungen, Roster-Organisation, Match-Vorbereitung und Discord-Koordination an einem Ort.",
            communitiesTitle: "Gebaut für echte Communities",
            communitiesDescription:
                "Gemacht für Clans, Einheiten und organisierte Gruppen, die Struktur ohne Zeremonie brauchen.",
            contributorsTitle: "Offen für Mitwirkende",
            contributorsDescription:
                "Open Source, offen für Pull Requests und öffentlich verbessert mit den Menschen, die es nutzen.",
        },
    },
    auth: {
        loginTitle: "Plane deine nächste Operation",
        loginDescription:
            "Melde dich mit Discord an, um Clans zu verwalten, Roster zu veröffentlichen und jedes Briefing an einem Ort zu halten.",
        loginButton: "Mit Discord fortfahren",
        heroSubtitle: "Team-Management leicht gemacht.",
        contributeButton: "Mitwirken",
        featureRosterManagement: "Roster-Verwaltung",
        featurePlayerPerformance: "Spielerleistungs-Aggregation",
        featureEventPlanning: "Event-Planung",
        featureOpenSource: "Open Source",
        statsPlayers: "Spieler in der Datenbank",
        statsMatches: "Erfasste Matches",
        statsTeams: "Teams nutzen Logi",
        statsOperations: "Geplante Operationen",
        loginHint:
            "Nutze Discord, um deinen Clan-Workspace, Roster und das Operations-Dashboard zu öffnen.",
        featureRostersTitle: "Roster",
        featureRostersBody:
            "Veröffentliche slotfertige Aufstellungen mit Reserven und Bestätigungen.",
        featureBriefingsTitle: "Briefings",
        featureBriefingsBody:
            "Halte Event-Notizen, Maps und Anhänge bei jeder Operation.",
        featureDiscordTitle: "Discord-ready",
        featureDiscordBody:
            "Bereite zuerst das Web-Dashboard vor und binde die Bot-Ebene später an.",
        englishEnabled: "Englisch aktiviert",
        discordAccessOnly: "Nur Discord-Zugang",
        discordOauth: "Discord OAuth",
        discordOauthBody: "Single Sign-On für Clans, Mitglieder und Mercs.",
        plannedBackendHooks: "Geplante Backend-Hooks",
        plannedBackendHooksBody:
            "Convex-Dokumente, Discord-Identitäts-Sync, Plattform-Identitäts-Verknüpfung, Clan-bewusste Berechtigungen und Roster-Publishing-Flows.",
    },
    dashboard: {
        title: "Deine Clans",
        description:
            "Alles, was du verwaltest, vertrittst oder wofür du kämpfst, ist hier gruppiert.",
        greetingMorning: "Guten Morgen",
        greetingAfternoon: "Guten Tag",
        greetingEvening: "Guten Abend",
        managedServers: "Verwaltete Clans",
        homeServer: "Haupt-Clan",
        mercenaryServers: "Mercenary-Clans",
        openServer: "Clan öffnen",
        inviteBot: "Bot einladen",
        inviteBotHint:
            "Manche verwaltete Clans brauchen noch den Discord-Bot, bevor sie hier vollständig geöffnet werden können.",
        inviteBotModalTitle: "Bevor du den Bot einlädst",
        inviteBotModalDescription:
            "Setze die Bot-Rolle über jede Discord-Rolle, die Logi zuweisen oder entfernen soll. Bleibt die Bot-Rolle darunter, blockiert Discord diese Rollenänderungen, auch wenn die Berechtigungen aktiviert sind.",
        inviteBotModalNotApplicable:
            "Dieser Clan hat derzeit keine Discord-Rollen für Logi zum Zuweisen oder Entfernen konfiguriert, daher gilt die Rollenreihenfolgen-Warnung vorerst nicht.",
        inviteBotModalConfirm: "Discord-Einladung öffnen",
        botStatus: "Bot-Status",
        botInstalled: "Installiert",
        botMissing: "Fehlt",
        refreshBotStatus: "Aktualisieren",
        refreshingBotStatus: "Bot-Status wird aktualisiert...",
        botStatusRefreshed: "Bot-Status aktualisiert.",
        botStatusRefreshError: "Bot-Status konnte nicht aktualisiert werden.",
        botMissingWorkspaceTitle: "Der Logi-Bot fehlt auf {workspace}",
        botMissingWorkspaceDescription:
            "Die meisten Workspace-Funktionen funktionieren erst, wenn du den Discord-Bot einlädst. Installiere ihn auf diesem Server, bestätige die angeforderten Berechtigungen und aktualisiere danach hier seinen Status.",
        botMissingWorkspacePermissions:
            "Der Bot benötigt die von Discord angeforderten Berechtigungen und muss über jeder Rolle stehen, die er verwalten soll.",
        botTitle: "Bot-Operationen",
        botDescription:
            "Globaler Bot-Status, strukturierte Logs und eine gefilterte Sicht über Dashboard-App und Discord-Bot.",
        platformSettingsTitle: "Plattform-Einstellungen",
        platformSettingsDescription:
            "Wähle den Logi-Workspace und Discord-Kanal für den plattformweiten Servicestatus.",
        platformWorkspace: "Workspace für den Plattformstatus",
        platformStatusChannel: "Status-Channel",
        platformStatusChannelHint:
            "Der Bot hält hier eine Statusnachricht aktuell und einen Thread Statusänderungen für Ausfälle und Wiederherstellungen.",
        platformSave: "Plattform-Einstellungen speichern",
        platformSaved: "Plattform-Einstellungen gespeichert.",
        platformWorkspacePlaceholder: "Workspace wählen",
        platformWorkspaceHint:
            "Nur Workspaces mit dem Logi-Bot können die Statusnachricht senden.",
        platformWorkspaceBotMissing:
            "Im gespeicherten Workspace {name} ist der Logi-Bot nicht mehr, daher stoppen die Statusmeldungen. Füge den Bot wieder hinzu oder wähle einen anderen Workspace.",
        platformSavedWorkspace: "Gespeicherter Workspace ({id})",
        platformChannelNone: "Kein Status-Channel",
        platformChannelPlaceholder: "Channel wählen",
        platformChannelsLoading: "Channels werden von Discord geladen…",
        platformChannelsError:
            "Die Channels konnten nicht von Discord geladen werden. Deine Einstellungen sind unverändert.",
        platformChannelsRetry: "Erneut versuchen",
        platformChooseWorkspaceFirst:
            "Wähle zuerst einen Workspace, um seine Channels zu sehen.",
        platformSaveError:
            "Die Plattform-Einstellungen konnten nicht gespeichert werden.",
        totalLogs: "Logs gesamt",
        totalErrors: "Fehler gesamt",
        errorsToday: "Fehler heute",
        nextjsLogs: "Next.js-Logs",
        discordBotLogs: "Discord-Bot-Logs",
        totalLogsHint: "Alle auf diesem Server gespeicherten Einträge",
        totalErrorsHint: "ERROR-Einträge insgesamt",
        errorsTodayHint: "ERROR-Einträge seit Mitternacht",
        nextjsLogsHint: "Von der Dashboard-App geschrieben",
        discordBotLogsHint: "Vom Discord-Bot geschrieben",
        topScopes: "Top-Scopes",
        filtersTitle: "Filter",
        filterLevel: "Level",
        filterSource: "Quelle",
        filterScope: "Scope",
        allLevels: "Alle Level",
        allSources: "Alle Quellen",
        allScopes: "Alle Scopes",
        applyFilters: "Filter anwenden",
        resetFilters: "Filter zurücksetzen",
        tableTimestamp: "Zeitstempel",
        tableLevel: "Level",
        tableSource: "Quelle",
        tableScope: "Scope",
        tableMessage: "Nachricht",
        tableContext: "Kontext",
        noServerTitle: "Noch keine Clans",
        noServerDescription:
            "Deine Clans erscheinen hier, sobald der Logi-Bot auf ihrem Discord-Server ist. Bitte den Admin deines Clans, ihn hinzuzufügen, oder richte ihn auf deinem eigenen Server ein.",
        noServerSetupGuide: "So richtest du den Logi-Bot ein",
        askAdminForBot:
            "Bitte einen Clan-Admin, den Logi-Bot zu diesem Discord-Server hinzuzufügen.",
        botMissingMemberDescription:
            "Die meisten Clan-Funktionen bleiben nicht verfügbar, bis ein Clan-Admin den Discord-Bot einlädt.",
        memberServers: "Clans, in denen du Mitglied bist",
    },
    sidebar: {
        home: "Start",
        overview: "Übersicht",
        calendar: "Kalender",
        events: "Events",
        matches: "Matches",
        trainings: "Trainings",
        topicPresets: "Themen-Presets",
        stratmaps: "Taktikkarten",
        groups: "Gruppen",
        squadPresets: "Squad-Presets",
        rosters: "Roster",
        members: "Mitglieder",
        users: "Spieler",
        serverSettings: "Clan-Einstellungen",
        system: "System",
        memberships: "Mitgliedschaftseinstellungen",
        tickets: "Tickets",
        userSettings: "Benutzereinstellungen",
        serverLabel: "Aktiver Clan",
        workspace: "Workspace",
        operations: "Operationen",
        configuration: "Konfiguration",
        bot: "Bot",
        platformSettings: "Plattform-Einstellungen",
        adminNav: {
            label: "Globale Verwaltung",
            title: "Globale Verwaltung",
            subtitle: "Ganz Logi, alle Clans",
            backToClan: "Zurück zu {clan}",
            backToDashboard: "Zurück zu deinen Clans",
            competitionsAndTeams: "Wettbewerbe und Teams",
            operations: "Betrieb",
            botLogs: "Bot-Protokolle",
            pendingRequests: "Offene Anfragen: {count}",
            open: "Globale Verwaltung",
            adminsOnly: "nur Admins",
        },
        crumbs: {
            detail: "Details",
            event: "Event",
            training: "Training",
            group: "Gruppe",
            article: "Artikel",
            stratmap: "Stratmap",
            player: "Spieler",
            competition: "Wettbewerb",
            matchResult: "Spielergebnis",
            matchStatistics: "Spielstatistik",
        },
        competitions: "Wettbewerbe",
        games: "Spiele",
        articles: "Artikel",
        logiComms: "LogiComms",
        signupActivity: "Anmeldeverlauf",
        teams: "Teams",
        teamCatalog: "Teamkatalog",
        teamRequests: "Teamanfragen",
        dashboard: "Dashboard",
        settings: "Einstellungen",
        settingsAttention:
            "Einstellungen, die Aufmerksamkeit brauchen: {count}",
        globalAdmin: "Globale Verwaltung",
        myAccount: "Mein Konto",
        showSubpages: "Seiten unter {item} anzeigen",
    },
    teams: {
        title: "Teams",
        description:
            "Durchsuche den Logi-Teamkatalog für jedes Spiel. Logi-Administratoren pflegen ihn: Beantrage fehlende Teams oder schlage Änderungen vor und wähle freigegebene Teams in deinen Matches aus.",
        cancel: "Abbrechen",
        name: "Name",
        shortCode: "Kürzel",
        shortCodeHelp:
            "Optional, bis zu 16 Zeichen; wird angezeigt, wo wenig Platz ist.",
        logo: "Logo",
        logoHelp:
            "PNG, JPEG oder WebP bis 2 MiB. Das Bild wird auf ein Quadrat von 512×512 normalisiert.",
        upload: "Logo hochladen",
        uploading: "Wird hochgeladen…",
        removeLogo: "Logo entfernen",
        search: "Teams suchen…",
        loadMore: "Mehr laden",
        archivedBadge: "Archiviert",
        empty: "Der Katalog enthält für dieses Spiel noch keine Teams.",
        emptySearch: "Keine Teams entsprechen dieser Suche.",
        loading: "Teams werden geladen…",
        notAvailableForGame:
            "Der Teamkatalog ist für dieses Spiel nicht verfügbar.",
        gameDisabled:
            "Dieses Spiel ist in diesem Arbeitsbereich nicht aktiviert. Du kannst Teams durchsuchen und beantragen, in Matches lassen sie sich aber erst verwenden, wenn das Spiel in den Clan-Einstellungen aktiviert ist.",
        retry: "Erneut versuchen",
        requestNew: "Neues Team beantragen",
        suggestChange: "Änderung vorschlagen",
        suggestChangeTeam: "Änderung für {name} vorschlagen",
        teamLinks: "Links von {name}",
        errors: {
            invalid_team: "Prüfe die Teamangaben und versuche es erneut.",
            game_disabled:
                "Dieses Spiel ist für den Arbeitsbereich nicht aktiviert.",
            duplicate_name:
                "Ein Team mit diesem Namen ist für dieses Spiel bereits im Katalog.",
            revision_conflict:
                "Dieses Team wurde zwischenzeitlich geändert. Lade es neu und versuche es erneut.",
            idempotency_conflict:
                "Diese Anfrage wurde bereits mit anderen Angaben verwendet. Schließe den Dialog und beginne neu.",
            not_found: "Das Team existiert nicht mehr.",
            archived: "Das Team ist archiviert.",
            not_archived: "Das Team ist nicht archiviert.",
            asset_unavailable:
                "Das hochgeladene Logo ist nicht mehr verfügbar. Lade es erneut hoch.",
            limit_reached:
                "Der Katalog dieses Spiels hat sein Limit von 2000 Teams erreicht.",
            invalid_merge: "Diese Teams können nicht zusammengeführt werden.",
            forbidden: "Du hast hier keinen Zugriff auf den Teamkatalog.",
            unavailable: "Der Teamkatalog ist vorübergehend nicht verfügbar.",
            rate_limited:
                "Zu viele Anfragen; warte einen Moment und versuche es erneut.",
        },
        uploadErrors: {
            unsupported_type:
                "Nur PNG-, JPEG- und WebP-Bilder werden akzeptiert.",
            type_mismatch:
                "Der Dateiinhalt passt nicht zum angegebenen Bildtyp.",
            bad_dimensions:
                "Das Bild muss mindestens 1×1 und höchstens 4096×4096 Pixel groß sein.",
            animated: "Animierte Bilder werden nicht unterstützt.",
            undecodable: "Das Bild konnte nicht gelesen werden.",
            invalid_kind: "Dieser Upload ist kein Teamlogo.",
            invalid_asset:
                "Das hochgeladene Bild konnte nicht gespeichert werden.",
            too_large: "Das Bild überschreitet 2 MiB.",
            upload_limited:
                "Zu viele Uploads. Versuche es in {seconds} s erneut.",
            forbidden: "Du darfst hier keine Logos hochladen.",
            unavailable: "Uploads sind vorübergehend nicht verfügbar.",
        },
        picker: {
            title: "Teams",
            description:
                "Wähle die Teams, die dieses Match spielen, aus dem Logi-Teamkatalog. Jedes Team behält Name und Logo vom Zeitpunkt der Auswahl, bis du es aktualisierst.",
            slots: { a: "Team A", b: "Team B", c: "Team C" },
            team: "Team",
            side: "Seite",
            noTeam: "Kein Team",
            noSide: "Keine Seite",
            search: "Teams suchen…",
            noResults: "Keine aktiven Teams gefunden.",
            unknownTeam: "Teamdaten nicht verfügbar",
            savedSelections: "In diesem Match gespeichert",
            requestTeam: "Neues Team beantragen",
            requestNamed: "„{name}“ beantragen",
            requestHint:
                "Fehlt ein Team? Beantrage es; sobald ein Logi-Administrator es freigibt, kann es ausgewählt werden.",
            requestSent:
                "Antrag gesendet. Sobald ein Logi-Administrator das Team freigibt, kannst du es hier auswählen; die antragstellende Person erhält die Entscheidung per Discord-DM.",
            refreshSnapshot: "Schnappschuss aktualisieren",
            refreshing: "Wird aktualisiert…",
            snapshotRefreshed:
                "Schnappschuss aus dem Teamkatalog aktualisiert.",
            archivedSelection:
                "Archiviertes Team; der gespeicherte Schnappschuss bleibt bei diesem Match.",
            mergedBadge: "Zusammengeführt",
            mergedSelection:
                "Mit einem anderen Katalogteam zusammengeführt. Aktualisiere den Schnappschuss, um dieses Match auf das verbleibende Team umzustellen.",
            duplicateTeam: "Jedes Team kann nur einem Platz zugewiesen werden.",
            duplicateSide: "Jede Seite kann nur einem Team zugewiesen werden.",
            errors: {
                invalid_match_teams: "Die Teamzuweisung ist ungültig.",
                team_not_found: "Das Team existiert im Katalog nicht mehr.",
                team_archived:
                    "Das Team ist archiviert; wähle ein anderes Team.",
                team_game_mismatch: "Das Team gehört zu einem anderen Spiel.",
                match_concluded:
                    "Abgeschlossene Matches behalten ihre Teamschnappschüsse.",
                training_event: "Trainings haben keine Match-Teams.",
                forbidden: "Du darfst die Teams dieses Matches nicht ändern.",
                unavailable:
                    "Der Teamkatalog ist vorübergehend nicht verfügbar.",
                rate_limited:
                    "Zu viele Anfragen; warte einen Moment und versuche es erneut.",
            },
        },
    },
    teamRequests: {
        title: "Eure Teamanträge",
        description:
            "Anträge aus diesem Arbeitsbereich. Logi-Administratoren geben jeden Antrag frei, führen ihn zusammen oder lehnen ihn ab; die antragstellende Person erhält die Entscheidung per Discord-DM. Ein Arbeitsbereich kann bis zu 20 offene Anträge haben.",
        empty: "Dieser Arbeitsbereich hat noch keine Teams beantragt.",
        loading: "Anträge werden geladen…",
        loadMore: "Mehr laden",
        retry: "Erneut versuchen",
        kinds: { create: "Neues Team", update: "Änderung" },
        statuses: {
            pending: "Offen",
            approved: "Freigegeben",
            merged: "Zusammengeführt",
            rejected: "Abgelehnt",
            cancelled: "Zurückgezogen",
        },
        requestedOn: "Beantragt am {date}",
        decidedOn: "Entschieden am {date}",
        note: "Deine Notiz",
        reason: "Begründung",
        resultTeam: "Resultierendes Team",
        resultTeamUnavailable: "Teamdaten nicht verfügbar",
        cancel: "Antrag zurückziehen",
        cancelRequest: "Antrag für {name} zurückziehen",
        cancelling: "Wird zurückgezogen…",
        cancelled: "Antrag zurückgezogen.",
        submitted:
            "Antrag gesendet. Logi-Administratoren prüfen ihn; die Entscheidung kommt per Discord-DM.",
        dialog: {
            createTitle: "Neues Team beantragen",
            updateTitle: "Änderung vorschlagen",
            createDescription:
                "{game} · Logi-Administratoren prüfen jeden Antrag. Nach der Freigabe kann das Team in Matches ausgewählt werden.",
            updateDescription:
                "{game} · Schlage neue Angaben für {name} vor. Logi-Administratoren prüfen die Änderung, bevor sie übernommen wird.",
            description: "Beschreibung",
            descriptionHelp: "Optional, bis zu 500 Zeichen.",
            links: "Links",
            linksHelp:
                "Bis zu 3 https-Links, zum Beispiel die Teamwebsite oder eine Discord-Einladung.",
            link: "Link {index}",
            addLink: "Link hinzufügen",
            removeLink: "Link {index} entfernen",
            note: "Notiz für die Administratoren",
            noteHelp:
                "Optional, bis zu 500 Zeichen. Nenne alles, was bei der Prüfung hilft.",
            submit: "Antrag senden",
            submitting: "Wird gesendet…",
            cancel: "Abbrechen",
            unchanged:
                "Ändere vor dem Senden mindestens eine Angabe des Teams.",
            duplicate:
                "{name} ist für dieses Spiel bereits im Katalog. Wähle das Team aus oder schlage eine Änderung dafür vor.",
        },
        validation: {
            nameRequired: "Gib den Teamnamen ein.",
            nameInvalid: "Verwende bis zu 120 Zeichen ohne Zeilenumbrüche.",
            shortCodeInvalid: "Verwende bis zu 16 Zeichen ohne Zeilenumbrüche.",
            descriptionInvalid:
                "Verwende bis zu 500 Zeichen ohne Steuerzeichen.",
            linksInvalid:
                "Jeder Link muss eine https-Adresse ohne Benutzername und Passwort sein.",
            linksDuplicate: "Jeder Link darf nur einmal vorkommen.",
            linksTooMany: "Gib höchstens 3 Links an.",
            noteInvalid: "Verwende bis zu 500 Zeichen ohne Steuerzeichen.",
            invalid: "Prüfe die Angaben des Antrags und versuche es erneut.",
        },
        errors: {
            invalid_request:
                "Prüfe die Angaben des Antrags und versuche es erneut.",
            not_found: "Der Antrag oder sein Team existiert nicht mehr.",
            not_pending:
                "Über diesen Antrag wurde bereits entschieden, oder er wurde zurückgezogen.",
            limit_reached:
                "Dieser Arbeitsbereich hat bereits 20 offene Anträge. Warte auf eine Entscheidung oder ziehe einen zurück.",
            idempotency_conflict:
                "Dieser Antrag wurde bereits mit anderen Angaben gesendet. Schließe den Dialog und stelle einen neuen Antrag.",
            team_archived:
                "Das Team ist archiviert; Änderungen können nicht mehr beantragt werden.",
            team_game_mismatch: "Das Team gehört zu einem anderen Spiel.",
            invalid_decision:
                "Diese Entscheidung ist für den Antrag nicht möglich.",
            forbidden: "Du darfst hier keine Teamanträge verwalten.",
            rate_limited:
                "Zu viele Anfragen; warte einen Moment und versuche es erneut.",
            unavailable: "Teamanträge sind vorübergehend nicht verfügbar.",
        },
    },
    signupActivity: {
        title: "Anmeldeverlauf",
        description:
            "Sieh, wer sich für Matches und Trainings angemeldet, Rollen geändert oder abgemeldet hat.",
        empty: "Noch keine Anmeldeaktivitäten.",
        role: "Rolle",
        noRole: "Keine Rolle",
        actions: {
            signed_up: "hat sich angemeldet",
            changed_role: "hat die Rolle geändert",
            unsigned: "hat sich abgemeldet",
            declined: "hat abgesagt",
        },
        emptyTitle: "Noch keine Anmeldeaktivität",
        emptyDescription:
            "Anmeldungen, Rollenwechsel und Abmeldungen für Matches und Trainings erscheinen hier, sobald sie passieren.",
        limitNotice:
            "Es werden die letzten {count} Änderungen angezeigt. Ältere Änderungen erscheinen hier nicht.",
        filteredBy: "Nur {event}",
        showAll: "Alle Aktivitäten anzeigen",
    },
    teamCatalogAdmin: {
        searchLabel: "Teams suchen",
        statesLabel: "Status",
        states: {
            active: "Aktiv",
            archived: "Archiviert",
            merged: "Zusammengeführt",
        },
        listLabel: "Teams",
        detailLabel: "Teamdetails",
        rowLinked: "Clan in Logi",
        rowCompetitions: {
            one: "{count} Wettbewerb",
            few: "{count} Wettbewerbe",
            many: "{count} Wettbewerbe",
            other: "{count} Wettbewerbe",
        },
        rowPendingChange: "Änderung ausstehend",
        requestBadge: "Anfrage",
        requestBadgeLabel: "Eine Änderungsanfrage wartet",
        updatedOn: "{game} · geändert am {date}",
        changeLogo: "Logo ändern",
        requestBanner: "Ein Clan schlägt eine Änderung dieses Teams vor",
        openRequest: "Anfrage öffnen",
        usageTitle: "Wo das Team verwendet wird",
        usageFixtures: {
            one: "{count} Spiel",
            few: "{count} Spiele",
            many: "{count} Spiele",
            other: "{count} Spiele",
        },
        usageWithdrawn: "zurückgezogen",
        usageNone: "Noch in keinem Wettbewerb.",
        usageMore: "und {count} weitere Wettbewerbe",
        usageSnapshots:
            "Clan-Spiele behalten Namen und Logo vom Zeitpunkt des Speicherns.",
        usageUnavailable:
            "Die Verwendung des Teams konnte nicht geladen werden.",
        moreDetails: "Beschreibung und Links",
        saveShort: "Speichern",
        endTitle: "Duplikat oder Ende des Teams",
        mergeIntoOther: "In ein anderes Team zusammenführen",
        endHelp: "Beides fragt zuerst nach und zeigt, was sich ändert.",
        selectTeam: "Wähle ein Team in der Liste, um seine Daten zu sehen.",
        archivedHelp:
            "Ein archiviertes Team wird Clans und Wettbewerben nicht angeboten. Durch Wiederherstellen ist es wieder auswählbar.",
        mergedHelp:
            "Dieses Team wurde in {name} zusammengeführt. Das lässt sich nicht rückgängig machen.",
        mergedTargetUnknown: "ein anderes Team",
        title: "Teamkatalog",
        description:
            "Eine Teamliste für ganz Logi. Clans wählen daraus ihre Gegner, Wettbewerbe melden daraus Teams an.",
        gamesLabel: "Spiel",
        search: "Name oder Kürzel",
        showArchived: "Archivierte und zusammengeführte Teams anzeigen",
        add: "Team hinzufügen",
        loadMore: "Mehr laden",
        loading: "Teams werden geladen…",
        empty: "Für dieses Spiel gibt es noch keine Teams.",
        emptySearch: "Keine Teams passen zu dieser Suche.",
        retry: "Erneut versuchen",
        archivedBadge: "Archiviert",
        mergedBadge: "Zusammengeführt",
        linkedBadge: "Verknüpft: {workspace}",
        edit: "Bearbeiten",
        archive: "Archivieren",
        restore: "Wiederherstellen",
        merge: "Zusammenführen",
        editTeam: "{name} bearbeiten",
        archiveTeam: "{name} archivieren",
        restoreTeam: "{name} wiederherstellen",
        mergeTeam: "{name} mit einem anderen Team zusammenführen",
        createTitle: "Neues Katalogteam",
        editTitle: "Katalogteam bearbeiten",
        name: "Name",
        shortCode: "Kürzel",
        shortCodeHelp:
            "Optional, höchstens 16 Zeichen; wird angezeigt, wo wenig Platz ist.",
        descriptionField: "Beschreibung",
        descriptionHelp: "Optional, höchstens 500 Zeichen.",
        links: "Links",
        linkLabel: "Link {number}",
        linksHelp:
            "Bis zu drei https-Links, etwa die Website des Teams oder eine Discord-Einladung.",
        linkedWorkspace: "Clan in Logi",
        linkedWorkspaceNone: "Keiner · das Team nutzt Logi nicht",
        linkedWorkspaceUnknown: "Workspace {id}",
        linkedWorkspaceHelp:
            "Hält fest, dass dieses Team der Clan dieses Logi-Workspaces ist. Die Verknüpfung gewährt keine Berechtigungen.",
        logo: "Logo",
        logoHelp:
            "PNG, JPEG oder WebP bis 2 MiB, normalisiert auf ein Quadrat von 512×512. Kataloglogos gehören der Plattform.",
        upload: "Logo hochladen",
        uploading: "Wird hochgeladen…",
        removeLogo: "Logo entfernen",
        save: "Team speichern",
        saving: "Wird gespeichert…",
        cancel: "Abbrechen",
        saved: "Team gespeichert.",
        archivedNotice:
            "Team archiviert. Gespeicherte Matches behalten ihren Snapshot.",
        archiveConfirmTitle: "{name} archivieren?",
        archiveConfirmDescription:
            "Die Archivierung gilt sofort. Das ändert sich:",
        archiveConsequenceSelection:
            "{name} wird Clans und Wettbewerben nicht mehr angeboten.",
        archiveConsequenceSnapshots:
            "Gespeicherte Spiele behalten Name und Logo aus der Zeit des Speicherns.",
        archiveConsequenceRestore:
            "Du kannst das Team später wiederherstellen, sofern kein anderes aktives Team seinen Namen übernimmt.",
        restoredNotice: "Team wiederhergestellt.",
        mergedNotice: "{source} wurde mit {target} zusammengeführt.",
        conflictReloaded:
            "Dieses Team wurde zwischenzeitlich geändert. Die neueste Version wird angezeigt und deine eigenen Änderungen wurden beibehalten; prüfe sie und speichere erneut.",
        conflictReloadFailed:
            "Dieses Team wurde zwischenzeitlich geändert und die neueste Version konnte nicht geladen werden. Schließe den Dialog und versuche es erneut.",
        staleRow:
            "Dieses Team wurde zwischenzeitlich geändert; jetzt wird die neueste Version angezeigt. Versuche es erneut, falls die Aktion noch nötig ist.",
        mergeTitle: "{name} zusammenführen",
        mergeDescription:
            "Wähle das Team, das bleibt. {name} wird archiviert und verweist darauf.",
        mergeTarget: "Team, das bleibt",
        mergeSearch: "Aktive Teams suchen…",
        mergeSearchHint: "Tippe, um die aktiven Teams dieses Spiels zu suchen.",
        mergeNoResults: "Kein anderes aktives Team passt zu dieser Suche.",
        mergeLoading: "Suche läuft…",
        mergeChooseTarget: "Wähle das Team, das bleibt.",
        mergeMovesTitle: "Was passiert",
        mergeMovesRegistrations:
            "Wettbewerbsanmeldungen und Begegnungen von {source} gehen auf {target} über.",
        mergeMovesRequests:
            "Offene Teamanfragen zu {source} gehen auf {target} über.",
        mergeMovesArchive:
            "{source} wird archiviert und hält fest, dass es mit {target} zusammengeführt wurde. Das Zusammenführen kann nicht rückgängig gemacht werden.",
        mergeMovesSnapshots:
            "Gespeicherte Match-Snapshots werden nicht umgeschrieben; sie behalten den Namen und das Logo, mit denen sie gespeichert wurden.",
        mergeConfirm: "Teams zusammenführen",
        merging: "Wird zusammengeführt…",
        fieldErrors: {
            name: "Gib einen Namen mit höchstens 120 Zeichen ohne Steuerzeichen ein.",
            shortCode: "Verwende höchstens 16 Zeichen ohne Steuerzeichen.",
            description: "Verwende höchstens 500 Zeichen.",
            links: "Jeder Link muss eine andere https-URL sein.",
            linkedGuildId: "Wähle einen Workspace aus der Liste.",
        },
        errors: {
            invalid_team: "Prüfe die Teamangaben und versuche es erneut.",
            invalid_query:
                "Der Katalog konnte mit diesen Filtern nicht gelesen werden.",
            game_disabled: "Dieses Spiel ist im Teamkatalog nicht verfügbar.",
            duplicate_name:
                "Ein anderes Team dieses Spiels verwendet diesen Namen bereits. Suche es im Katalog, einschließlich archivierter Teams, und bearbeite, stelle es wieder her oder führe es stattdessen zusammen.",
            revision_conflict:
                "Dieses Team wurde zwischenzeitlich geändert. Lade es neu und versuche es erneut.",
            idempotency_conflict:
                "Dieses Speichern wurde bereits für andere Werte verwendet. Schließe den Dialog und versuche es erneut.",
            not_found: "Dieses Team existiert nicht mehr.",
            archived:
                "Dieses Team ist archiviert. Stelle es vor dem Bearbeiten wieder her.",
            not_archived: "Dieses Team ist nicht archiviert.",
            asset_unavailable:
                "Das Logo ist nicht mehr verfügbar. Lade es erneut hoch.",
            limit_reached: "Der Katalog für dieses Spiel ist voll.",
            invalid_merge:
                "Diese Teams können nicht zusammengeführt werden. Wähle ein aktives Team desselben Spiels, das in keinem Wettbewerb gegen dieses Team gespielt hat; ein zusammengeführtes Team kann weder wiederhergestellt noch erneut zusammengeführt werden.",
            forbidden:
                "Nur globale Administratoren können den Teamkatalog verwalten.",
            unavailable:
                "Der Teamkatalog ist gerade nicht verfügbar. Versuche es erneut.",
        },
        uploadErrors: {
            unsupported_type:
                "Nur PNG-, JPEG- und WebP-Bilder werden akzeptiert.",
            type_mismatch:
                "Der Dateiinhalt passt nicht zum angegebenen Bildtyp.",
            bad_dimensions:
                "Das Bild muss mindestens 1×1 und höchstens 4096×4096 Pixel groß sein.",
            animated: "Animierte Bilder werden nicht unterstützt.",
            undecodable: "Das Bild konnte nicht gelesen werden.",
            invalid_kind: "Dieser Upload ist kein Teamlogo.",
            invalid_asset:
                "Das hochgeladene Bild konnte nicht gespeichert werden.",
            too_large: "Das Bild überschreitet 2 MiB.",
            upload_limited:
                "Zu viele Uploads. Versuche es in {seconds} s erneut.",
            forbidden:
                "Nur globale Administratoren können Kataloglogos hochladen.",
            unavailable: "Uploads sind vorübergehend nicht verfügbar.",
        },
    },
    teamRequestAdmin: {
        changeSummary: "Ändert {fields}",
        changeFields: {
            logo: "Logo",
            name: "Namen",
            shortCode: "Kürzel",
            links: "Links",
            description: "Beschreibung",
        },
        listAnd: " und ",
        kindBadges: {
            create: "Neu",
            update: "Änderung",
        },
        similarExists: "Ein ähnliches Team gibt es schon: {name}",
        usageIn: "Das Team wird in {competitions} verwendet.",
        usageNone: "Das Team ist noch in keinem Wettbewerb.",
        snapshotsKept: "Gespeicherte Spiele behalten das alte Logo.",
        approveDirectTitle: "Anfrage für {name} genehmigen?",
        approveDirectCreate:
            "{name} wird in den Katalog von {game} aufgenommen.",
        approveDirectUpdate:
            "Die vorgeschlagenen Daten werden auf {name} übernommen.",
        approveDirectDm:
            "Die anfragende Person bekommt die Entscheidung per Discord-DM.",
        discordUser: "Discord {id}",
        mergeShort: "Mit bestehendem zusammenführen",
        title: "Teamanfragen",
        description:
            "Clans fragen ein neues Team oder eine Änderung an einem bestehenden an. Die anfragende Person erhält deine Entscheidung per Discord-DM.",
        statusFilter: "Status",
        statuses: {
            pending: "Offen",
            approved: "Genehmigt",
            merged: "Zusammengeführt",
            rejected: "Abgelehnt",
            cancelled: "Zurückgezogen",
        },
        kinds: {
            create: "Neues Team",
            update: "Änderungsanfrage",
        },
        loading: "Anfragen werden geladen…",
        empty: "Keine Anfragen mit diesem Status.",
        loadMore: "Mehr laden",
        tabsLabel: "Status der Anfragen",
        tabPending: "Offen · {count}",
        tabPendingEmpty: "Offen",
        tabDecided: "Entschieden",
        gameFilter: "Spiel",
        clanFilter: "Clan",
        allClans: "Alle Clans",
        listLabel: "Anfragen",
        fromClan: "von {clan}",
        titleCreate: "Neues Team {name}",
        titleUpdate: "Änderung am Team {name}",
        requestedBy: "{requester} von {clan}",
        field: "Feld",
        now: "Jetzt",
        proposed: "Vorgeschlagen",
        unchanged: "unverändert",
        emptyValue: "leer",
        comparisonHint: "Grün markiert ist, was sich ändert.",
        rejectWithReason: "Mit Begründung ablehnen",
        reviewAndApprove: "Prüfen und genehmigen",
        selectRequest: "Wähle eine Anfrage, um ihre Details zu sehen.",
        emptyPendingTitle: "Keine Anfrage wartet",
        emptyPendingDescription:
            "Clan-Admins senden Anfragen von ihrer Teamseite. Neue erscheinen hier, und die anfragende Person erhält deine Entscheidung per Discord-DM.",
        emptyFiltered: "Keine geladene Anfrage passt zu diesen Filtern.",
        retry: "Erneut versuchen",
        requestFor: "Anfrage für {name}",
        workspace: "Workspace",
        unknownWorkspace: "Unbekannter Workspace ({id})",
        requester: "Anfragende Person (Discord-ID)",
        hiddenRequester: "Nicht angezeigt",
        game: "Spiel",
        kind: "Art",
        submitted: "Eingereicht",
        decided: "Entschieden",
        note: "Notiz der anfragenden Person",
        proposal: "Vorgeschlagenes Team",
        currentTeam: "Aktuelles Team",
        currentTeamLoading: "Aktuelles Team wird geladen…",
        currentTeamMissing:
            "Das Team, das diese Anfrage ändert, existiert nicht mehr.",
        currentTeamArchived:
            "Das Team, das diese Anfrage ändert, ist archiviert. Stelle es im Teamkatalog wieder her, bevor du genehmigst.",
        currentTeamUnavailable:
            "Das aktuelle Team konnte nicht geladen werden.",
        changed: "Geändert",
        resultTeam: "Ergebnisteam",
        reason: "Begründung",
        notification: "DM an die anfragende Person",
        notifications: {
            none: "Nicht gesendet",
            pending: "In der Warteschlange",
            sent: "Gesendet",
            failed: "Konnte nicht zugestellt werden",
        },
        none: "Keine",
        approve: "Genehmigen",
        approveRequest: "Anfrage für {name} genehmigen",
        approveTitle: "Anfrage genehmigen",
        approveDescription:
            "Prüfe und passe die vorgeschlagenen Angaben an. Beim Genehmigen wird das Team erstellt oder die Angaben werden auf das aktuelle Team angewendet.",
        approveConfirm: "Anfrage genehmigen",
        approving: "Wird genehmigt…",
        merge: "Mit bestehendem Team zusammenführen",
        mergeRequest:
            "Anfrage für {name} mit einem bestehenden Team zusammenführen",
        mergeTitle: "Mit einem bestehenden Team zusammenführen",
        mergeDescription:
            "Es wird kein neues Team erstellt. Die anfragende Person erfährt, welches bestehende {game}-Team sie verwenden soll.",
        mergeConfirm: "Anfrage zusammenführen",
        merging: "Wird zusammengeführt…",
        mergeInto: "Stattdessen mit {name} zusammenführen",
        reject: "Ablehnen",
        rejectRequest: "Anfrage für {name} ablehnen",
        rejectTitle: "Anfrage ablehnen",
        rejectDescription:
            "Die anfragende Person erhält die Begründung per Discord-DM.",
        rejectReason: "Begründung",
        rejectReasonHelp: "Erforderlich, höchstens 500 Zeichen.",
        rejectConfirm: "Anfrage ablehnen",
        rejecting: "Wird abgelehnt…",
        cancel: "Abbrechen",
        reasonRequired: "Gib eine Begründung mit höchstens 500 Zeichen ein.",
        decidedNotice: {
            approved:
                "Anfrage genehmigt. Die anfragende Person wird benachrichtigt.",
            merged: "Anfrage mit einem bestehenden Team zusammengeführt. Die anfragende Person wird benachrichtigt.",
            rejected:
                "Anfrage abgelehnt. Die anfragende Person wird benachrichtigt.",
        },
        conflictReloaded:
            "Das Team wurde geändert, nachdem du diese Anfrage geöffnet hast. Die aktuellen Werte werden angezeigt; prüfe sie und genehmige erneut.",
        duplicateFound:
            "{name} verwendet diesen Namen bereits. Führe die Anfrage damit zusammen oder ändere den Namen.",
        staleRequest:
            "Diese Anfrage wurde bereits entschieden oder zurückgezogen; die Liste wurde aktualisiert.",
        errors: {
            invalid_request: "Diese Anfrage ist ungültig.",
            invalid_decision: "Prüfe die Entscheidung und versuche es erneut.",
            invalid_query:
                "Die Warteschlange konnte mit diesen Filtern nicht gelesen werden.",
            not_found: "Diese Anfrage oder dieses Team existiert nicht mehr.",
            not_pending:
                "Diese Anfrage wurde bereits entschieden oder zurückgezogen.",
            limit_reached: "Der Katalog für dieses Spiel ist voll.",
            idempotency_conflict:
                "Diese Entscheidung widerspricht einer früheren. Lade neu und versuche es erneut.",
            team_archived:
                "Das gewählte Team ist archiviert. Wähle ein aktives Team.",
            team_game_mismatch: "Wähle ein Team desselben Spiels.",
            duplicate_name:
                "Ein anderes Team dieses Spiels verwendet diesen Namen bereits.",
            revision_conflict:
                "Das Team wurde zwischenzeitlich geändert. Prüfe es und versuche es erneut.",
            archived:
                "Das Team ist archiviert. Stelle es vor dem Genehmigen wieder her.",
            not_archived: "Das Team ist nicht archiviert.",
            asset_unavailable:
                "Das Logo ist nicht mehr verfügbar. Lade es erneut hoch oder entferne es.",
            invalid_team: "Prüfe die Teamangaben und versuche es erneut.",
            invalid_merge:
                "Die Anfrage kann nicht mit diesem Team zusammengeführt werden.",
            game_disabled: "Dieses Spiel ist im Teamkatalog nicht verfügbar.",
            forbidden:
                "Nur globale Administratoren können über Teamanfragen entscheiden.",
            unavailable:
                "Teamanfragen sind gerade nicht verfügbar. Versuche es erneut.",
        },
    },
    publicSite: {
        status: {
            eyebrow: "Logi-Status",
            title: "Verfügbarkeit der Dienste",
            description:
                "Diese Seite umfasst das Logi-Dashboard, die Convex-Dienste, Datenspeicher, die Erreichbarkeit von Discord und die Abhängigkeiten von LogiComms.",
            link: "Dienststatus",
            operational: "Alle Dienste laufen",
            degraded: "Einige Dienste sind beeinträchtigt",
            unknown: "Dienststatus nicht verfügbar",
            serviceOperational: "Läuft",
            serviceDegraded: "Beeinträchtigt",
            unavailableTitle: "Der Dienststatus konnte nicht geladen werden",
            unavailableDescription:
                "Die Statusüberwachung hat nicht geantwortet, daher kann Logi nicht sagen, welche Dienste laufen. Logi selbst funktioniert womöglich trotzdem. Lade die Seite in einer Minute neu oder frag auf dem Discord-Supportserver, wenn etwas nicht geht.",
            reload: "Neu laden",
        },
        login: {
            errorTitle: "Die Anmeldung wurde nicht abgeschlossen",
            errors: {
                "oauth-state":
                    "Der Anmeldelink ist abgelaufen oder wurde in einem anderen Browser geöffnet. Starte mit dem Button unten neu.",
                "discord-login":
                    "Discord hat die Anmeldung nicht bestätigt. Versuch es gleich noch einmal; wenn es weiter scheitert, frag auf dem Discord-Supportserver.",
            },
        },
        guildLogin: {
            notMemberTitle: "Du bist noch kein Mitglied von {clan}",
            notMemberDescription:
                "Du bist als {name} angemeldet, aber Logi sieht dich nicht auf dem Discord-Server dieses Clans und kann dir den Clan deshalb nicht öffnen.",
            notMemberNextStep:
                "Bitte den Clan um eine Discord-Einladung und tritt dem Server bei. Melde dich danach hier erneut an, damit Logi deine Server aktualisiert.",
            signInAgain: "Erneut anmelden",
            openDashboard: "Meine Clans öffnen",
        },
        community: {
            pickGameTitle: "Wähle ein Spiel",
            pickGameDescription:
                "Clans, Spieler und Spielergebnisse werden für jedes Spiel getrennt geführt. Wähle eines, um seine Community zu durchsuchen.",
        },
        legal: {
            privacyTitle: "Datenschutzerklärung",
            termsTitle: "Nutzungsbedingungen",
            loadFailed:
                "Dieses Dokument konnte gerade nicht geladen werden. Versuch es später erneut oder frag auf dem Discord-Supportserver.",
        },
        competition: {
            divisionsLabel: "Divisionen",
            standings: "Tabelle",
            standingsNote:
                "Punkte nach den Regeln des Wettbewerbs. Clans bestätigen die Ergebnisse; Korrekturen erscheinen hier innerhalb weniger Minuten.",
            upcoming: "Anstehend",
            noUpcoming: "Keine Spiele geplant.",
            noResults: "Noch keine Ergebnisse.",
            unknownTeam: "Unbekanntes Team",
            noDivisionsTitle: "Noch keine Divisionen",
            noDivisionsDescription:
                "Die Veranstalter haben für diesen Wettbewerb noch keine Divisionen angelegt. Schau später wieder vorbei.",
            emptyTitle: "Noch keine öffentlichen Wettbewerbe",
            emptyDescription:
                "Wettbewerbe erscheinen hier, sobald die Logi-Administratoren sie veröffentlichen.",
            matchesColumn: "Spiele",
            winsColumn: "Siege",
            pointsColumn: "Punkte",
            standingsNoteFor:
                "Punkte nach den Regeln von {name}. Clans bestätigen die Ergebnisse; Korrekturen erscheinen hier innerhalb weniger Minuten.",
            round: "Runde {round}",
            resultsSuffix: "Ergebnisse",
            thisWeekend: "dieses Wochenende",
            thisWeek: "diese Woche",
            nextWeek: "nächste Woche",
            undated: "Termin noch offen",
            noFixturesTitle: "Noch keine Spiele",
            noFixturesDescription:
                "Der Spielplan erscheint hier, sobald die Veranstalter ihn veröffentlichen.",
            divisionsIn: {
                one: "in {count} Division",
                few: "in {count} Divisionen",
                many: "in {count} Divisionen",
                other: "in {count} Divisionen",
            },
            rules: "Regeln",
            statistics: "Statistiken",
            moreRounds: "Weitere Runden ({count})",
        },
        clan: {
            noMatchesTitle: "Noch keine erfassten Spiele",
            noMatchesDescription:
                "Spiele erscheinen hier, sobald der Clan Ergebnisse in Logi veröffentlicht.",
            joinDiscord: "Auf Discord beitreten",
            activeMembers: {
                one: "{count} aktives Mitglied",
                few: "{count} aktive Mitglieder",
                many: "{count} aktive Mitglieder",
                other: "{count} aktive Mitglieder",
            },
            statsLabel: "Clan-Statistiken",
            competition: "Wettbewerb",
            place: "Platz {place}",
            upcoming: "Demnächst",
            noUpcoming: "Der Clan hat noch kein weiteres Spiel angekündigt.",
            recent: "Letzte Spiele",
            versus: "vs {opponent}",
            outcomeShort: {
                victory: "S",
                defeat: "N",
                draw: "U",
            },
        },
    },
    competition: {
        title: "Wettbewerbe",
        description:
            "Offizielle Wettbewerbsinfos und Ergebnisse, erfasst in Logi.",
        back: "Zurück zu Logi",
        standings: "Tabelle und Ergebnisse ansehen",
        rules: "Offizielles Regelwerk",
        website: "Offizielle Website",
        seasonSummary:
            "{season}-Saison · Tabelle und Ergebnisse erfasst von Logi",
        divisions: {
            one: "{count} Division · Live-Tabelle und erfasste Ergebnisse",
            few: "{count} Divisionen · Live-Tabelle und erfasste Ergebnisse",
            many: "{count} Divisionen · Live-Tabelle und erfasste Ergebnisse",
            other: "{count} Divisionen · Live-Tabelle und erfasste Ergebnisse",
        },
        results: "Ergebnisse",
        statistics: "Match-Statistiken",
        statisticsUnavailable: "Statistiken nicht verfügbar",
        noCompetitions:
            "Es wurden noch keine öffentlichen Wettbewerbe erstellt.",
        capScore: "Cap-Score",
        regularWins: "Reguläre Siege",
        totalWins: "Siege gesamt",
        regularMatches: "Reguläre Matches",
        totalMatches: "Matches gesamt",
        team: "Team",
        withdrawn: "(zurückgezogen)",
        noTeams: "Noch keine Teams registriert.",
        phases: {
            league: "Liga",
            playoff: "Playoff",
            relegation: "Relegation",
        },
        fixtureStatus: {
            scheduled: "Geplant",
            final: "Endgültig",
            forfeit: "Forfeit",
        },
    },
    competitionAdmin: {
        breadcrumb: "Brotkrumennavigation",
        round: "Runde",
        roundHelp: "Optional, 1–99. Spiele werden nach Runde gruppiert.",
        roundHeading: "{round}. Runde",
        noRound: "Ohne Runde",
        noFixturesInView:
            "In dieser Division und Phase gibt es noch keine Spiele.",
        linkWithMatch: "Mit Spiel verknüpfen",
        clanMatch: "Spiel von {clan}",
        clanMatchUnknown: "Verknüpftes Clan-Spiel",
        awaitingConfirmation: "Wartet auf Bestätigung durch den Clan",
        played: "Gespielt",
        editFixtureNamed: "Spiel {teams} bearbeiten",
        linkPanelTitle: "{teams} verknüpfen",
        linkPanelDescription:
            "Das Ergebnis wird dann automatisch übernommen, sobald der Clan es bestätigt. Angeboten werden die Clan-Spiele beider Teams um den Termin.",
        searchMatches: "Spiel nach Namen suchen",
        candidateClan: "Clan {clan}",
        noCandidateResults: "Kein Spiel passt zur Suche.",
        manualEventId: "Spiel-ID manuell eingeben",
        deleteFixture: "Spiel löschen",
        listDescription:
            "Erstelle und betreue Wettbewerbe für Hell Let Loose und Wardogs mit Teams aus dem globalen Katalog.",
        newCompetition: "Neuer Wettbewerb",
        createTitle: "Wettbewerb erstellen",
        createDescription:
            "Wähle zuerst das Spiel – es lässt sich später nicht ändern. Der Wettbewerb startet unveröffentlicht.",
        game: "Spiel",
        name: "Name",
        season: "Saison",
        slug: "Adresse (Slug)",
        slugHelp:
            "2–64 Kleinbuchstaben, Ziffern und Bindestriche; wird in der öffentlichen Adresse verwendet.",
        description: "Beschreibung",
        published: "Veröffentlicht",
        publishedHelp:
            "Unveröffentlichte Wettbewerbe sind auf den öffentlichen Seiten und in der öffentlichen API verborgen.",
        publishedBadge: "Veröffentlicht",
        draftBadge: "Unveröffentlicht",
        create: "Erstellen",
        creating: "Wird erstellt…",
        cancel: "Abbrechen",
        save: "Speichern",
        saving: "Speichert…",
        saved: "Gespeichert.",
        manage: "Verwalten",
        openPublic: "Öffentliche Seite",
        back: "Alle Wettbewerbe",
        noCompetitions: "Noch keine Wettbewerbe.",
        countDivisions: {
            one: "{count} Division",
            few: "{count} Divisionen",
            many: "{count} Divisionen",
            other: "{count} Divisionen",
        },
        countTeams: {
            one: "{count} Team",
            few: "{count} Teams",
            many: "{count} Teams",
            other: "{count} Teams",
        },
        countFixtures: {
            one: "{count} Spiel",
            few: "{count} Spiele",
            many: "{count} Spiele",
            other: "{count} Spiele",
        },
        sectionsLabel: "Bereiche des Wettbewerbs",
        legacyTitle: "Migration ausstehend",
        legacyDescription:
            "{count} Wettbewerbsdatensätze verweisen noch auf Logi-Workspaces statt auf globale Teams. Sie bleiben sichtbar, lassen sich aber erst bearbeiten oder verknüpfen, wenn der Plattformbetreiber die einmalige Wettbewerbsmigration ausführt.",
        legacyBadge: "Migration ausstehend",
        detailsTitle: "Details",
        detailsDescription:
            "Name, öffentliche Adresse, Saison, Beschreibung und Sichtbarkeit. Das Spiel ist festgelegt.",
        divisionsTitle: "Divisionen",
        divisionsDescription:
            "Divisionen erscheinen in dieser Reihenfolge auf der öffentlichen Seite. Eine Division kann nur gelöscht werden, wenn sie weder Teams noch Spiele hat.",
        divisionName: "Name der Division",
        addDivision: "Division hinzufügen",
        addDivisionFirst:
            "Füge eine Division hinzu, bevor du Teams registrierst.",
        rename: "Umbenennen",
        moveUp: "Nach oben",
        moveDown: "Nach unten",
        delete: "Löschen",
        confirmDeleteDivision: "Division „{name}“ löschen?",
        confirmDeleteDivisionDescription:
            "Die Division verschwindet von der öffentlichen Seite. Das kann nicht rückgängig gemacht werden.",
        noDivisions: "Noch keine Divisionen.",
        teamsTitle: "Teams",
        teamsDescription:
            "Registriere aktive Teams aus dem globalen Katalog, die zum Spiel dieses Wettbewerbs gehören. Ein Team kann nur entfernt werden, solange es keine Spiele hat; ziehe es sonst zurück, damit seine Ergebnisse erhalten bleiben.",
        team: "Team",
        division: "Division",
        unassigned: "Keine Division",
        chooseTeam: "Team wählen",
        searchTeams: "Teams suchen…",
        loadingTeams: "Teams werden geladen…",
        noTeamResults: "Kein passendes aktives, noch nicht registriertes Team.",
        register: "Registrieren",
        withdraw: "Zurückziehen",
        reinstate: "Wieder aufnehmen",
        remove: "Entfernen",
        moveTo: "Division",
        confirmRemoveTeam: "{name} aus diesem Wettbewerb entfernen?",
        confirmRemoveTeamDescription:
            "Die Anmeldung des Teams wird gelöscht. Um seine Ergebnisse zu behalten, ziehe das Team stattdessen zurück.",
        noTeams: "Keine Teams in dieser Division.",
        withdrawnBadge: "Zurückgezogen",
        archivedBadge: "Archiviert",
        fixturesTitle: "Spiele",
        fixturesDescription:
            "Endgültige Ergebnisse und Forfeits mit beiden Punktständen zählen für die Tabelle, geplante Spiele nicht.",
        allDivisions: "Alle Divisionen",
        addFixture: "Spiel hinzufügen",
        editFixture: "Spiel bearbeiten",
        noFixtures: "Noch keine Spiele.",
        fixtureHelp:
            "Ligaspiele bestreiten zwei Teams der gewählten Division; Playoff- und Relegationsspiele dürfen divisionsübergreifend sein.",
        invalidFixture:
            "Wähle eine Division und zwei verschiedene Teams und gib bei einem endgültigen Ergebnis oder Forfeit beide Punktstände als ganze Zahlen ein.",
        confirmDeleteFixture: "Dieses Spiel löschen?",
        confirmDeleteFixtureDescription:
            "{teams}: Das Spiel und sein Ergebnis verschwinden aus der Tabelle. Das kann nicht rückgängig gemacht werden.",
        phase: "Phase",
        phases: {
            league: "Liga",
            playoff: "Playoff",
            relegation: "Relegation",
        },
        status: "Status",
        statuses: {
            scheduled: "Geplant",
            final: "Endgültig",
            forfeit: "Forfeit",
        },
        teamA: "Team A",
        teamB: "Team B",
        teamC: "Team C",
        scoreA: "Punkte Team A",
        scoreB: "Punkte Team B",
        scoreC: "Punkte Team C",
        resultConflict: "Ergebnisabweichung",
        score: "Ergebnis",
        scheduledAt: "Termin",
        event: "Match-Event",
        actions: "Aktionen",
        linkEvent: "Match-Event verknüpfen",
        linkEventTitle: "Logi-Match-Event verknüpfen",
        linkEventDescription:
            "Für das verknüpfte Match importierte Ergebnisse aktualisieren dieses Spiel. Das Match muss zum selben Spiel gehören, und wenn ihm Teams zugeordnet sind, müssen beide Teams dieses Spiels darunter sein.",
        linked: "Derzeit verknüpft mit {name}.",
        candidates: "Matches aus den verknüpften Workspaces der Teams",
        loadingCandidates: "Matches werden geladen…",
        noCandidates:
            "In den verknüpften Workspaces der Teams wurden keine Matches gefunden.",
        teamsMatch: "beide Teams zugeordnet",
        teamsUnassigned: "Seiten nicht zugeordnet",
        hasResult: "Ergebnis importiert",
        eventId: "Event-ID",
        eventIdHelp:
            "Oder füge die Event-ID aus der Dashboard-Adresse des Matches ein.",
        link: "Verknüpfen",
        unlink: "Verknüpfung lösen",
        errors: {
            invalid_competition:
                "Prüfe die eingegebenen Werte und versuche es erneut.",
            not_found:
                "Dieser Wettbewerbsdatensatz existiert nicht mehr. Lade die Seite neu.",
            duplicate_slug:
                "Ein anderer Wettbewerb verwendet diese Adresse bereits.",
            duplicate_division:
                "Dieser Wettbewerb hat bereits eine Division mit diesem Namen.",
            division_not_found:
                "Die Division existiert nicht mehr. Lade die Seite neu.",
            division_not_empty:
                "Verschiebe oder entferne ihre Teams und Spiele, bevor du die Division löschst.",
            invalid_order:
                "Die Divisionen haben sich inzwischen geändert. Lade die Seite neu und versuche es erneut.",
            limit_reached: "Dieser Wettbewerb hat seine Größengrenze erreicht.",
            team_not_found: "Das Team existiert nicht mehr im Katalog.",
            team_archived:
                "Archivierte oder zusammengeführte Teams können nicht registriert werden.",
            team_game_mismatch:
                "Das Team gehört zu einem anderen Spiel als der Wettbewerb.",
            already_registered:
                "Dieses Team ist bereits im Wettbewerb registriert.",
            registration_has_fixtures:
                "Das Team hat Spiele. Lösche sie zuerst oder ziehe das Team stattdessen zurück.",
            team_not_registered:
                "Beide Teams müssen in diesem Wettbewerb registriert sein.",
            division_mismatch:
                "Ligaspiele brauchen zwei Teams, die in der gewählten Division registriert sind.",
            event_not_found: "Es gibt kein Logi-Event mit dieser ID.",
            event_not_match:
                "Nur Match-Events können verknüpft werden, keine Trainings.",
            event_game_mismatch:
                "Das Match gehört zu einem anderen Spiel als der Wettbewerb.",
            event_already_linked:
                "Dieses Match ist bereits mit einem anderen Spiel verknüpft.",
            event_team_mismatch:
                "Die zugeordneten Teams des Matches enthalten nicht beide Teams dieses Spiels.",
            migration_pending:
                "Alte Datensätze müssen zuerst zu globalen Teams migriert werden.",
            forbidden:
                "Nur globale Logi-Administratoren können Wettbewerbe verwalten.",
            unavailable:
                "Der Wettbewerbsdienst ist nicht verfügbar. Versuche es erneut.",
        },
    },
    articles: {
        title: "Artikel",
        description: "Clan-News und ausführliche Updates.",
        createTitle: "Artikel erstellen",
        createDescription: "Schreibe einen Clan-Artikel in Markdown.",
        create: "Artikel erstellen",
        noArticles: "Noch keine Artikel.",
        titlePlaceholder: "Titel",
        descriptionPlaceholder: "Kurzbeschreibung",
        tagsPlaceholder: "Tags, kommagetrennt",
        bodyPlaceholder: "Artikeltext",
        publish: "Artikel veröffentlichen",
        attachments: "Anhänge",
        saveFailed: "Artikel konnte nicht veröffentlicht werden.",
        titleLabel: "Titel",
        descriptionLabel: "Kurzbeschreibung",
        tagsLabel: "Tags",
        tagsHint: "Trenne Tags mit Kommas.",
        bodyLabel: "Artikel",
        attachmentsHint:
            "Dateien werden sofort hochgeladen und unter dem Artikel verlinkt.",
        uploading: "{count} Datei(en) werden hochgeladen…",
        uploadFailed: "Die Datei konnte nicht hochgeladen werden: {reason}",
        removeAttachment: "Anhang {name} entfernen",
        waitForUpload: "Warte, bis der Upload fertig ist.",
        publishing: "Wird veröffentlicht…",
        titleRequired: "Gib einen Titel ein.",
        descriptionRequired: "Gib eine Kurzbeschreibung ein.",
        bodyRequired: "Schreib den Artikel.",
        emptyTitle: "Noch keine Artikel",
        emptyDescription:
            "Artikel bringen allen Mitgliedern Clan-News und längere Updates.",
        emptyMemberDescription:
            "Clan-News und längere Updates erscheinen hier, sobald ein Manager sie veröffentlicht.",
        publishedOn: "Veröffentlicht {date}",
        deleteAction: "Artikel löschen",
        deleteTitle: "„{title}“ löschen?",
        deleteDescription:
            "Der Artikel verschwindet für alle Mitglieder. Hochgeladene Dateien bleiben über bereits geteilte Links erreichbar. Das lässt sich nicht rückgängig machen.",
        deleted: "Artikel gelöscht.",
        deleteFailed:
            "Der Artikel konnte nicht gelöscht werden. Versuch es noch einmal.",
        backToList: "Alle Artikel",
    },
    common: {
        actions: "Aktionen",
        edit: "Bearbeitungsmodus",
        cancel: "Abbrechen",
        save: "Änderungen speichern",
        create: "Neu erstellen",
        publish: "Veröffentlichen",
        published: "Veröffentlicht",
        unpublished: "Entwurf",
        upcoming: "Bevorstehend",
        past: "Vergangen",
        viewDetails: "Details ansehen",
        notAvailable: "Noch nicht verfügbar",
        assigned: "Zugewiesen",
        reserves: "Reserven",
        acknowledge: "Bestätigen",
        acknowledged: "Bestätigt",
        membersOnly: "Nur Mitglieder",
        adminOnly: "Nur Admins",
        admins: "Admins",
        members: "Mitglieder",
        openAction: "Öffnen",
        openStatus: "Offen",
        settings: "Einstellungen",
        logout: "Abmelden",
        account: "Konto",
        today: "Heute",
        searchReserves: "Reserven suchen...",
        searchNotAttending: "Abwesende suchen...",
        noneAssigned: "Niemand zugewiesen.",
        unknown: "Unbekannt",
        createPreset: "Preset erstellen",
        createEvent: "Event erstellen",
        getPublicLink: "Öffentlichen Share-Link holen",
        publicLinkCopied: "Öffentlicher Link kopiert.",
        publicLinkCopyFailed: "Öffentlicher Link konnte nicht kopiert werden.",
        createRoster: "Roster erstellen",
        addSquad: "Squad hinzufügen",
        addSlot: "Slot hinzufügen",
        clear: "Leeren",
        playerNote: "Spielernotiz",
        slotNote: "Notiz",
        otherGroups: "Andere Gruppen",
        openSlot: "Offener Slot",
        readyForAssignment: "Bereit zur Zuweisung",
        saveAssignment: "Zuweisung speichern",
        removeAssignment: "Zuweisung entfernen",
        upload: "Hochladen",
        error: "Fehler",
    },
    emojiPicker: {
        pickEmoji: "Emoji wählen",
        search: "Emoji suchen",
        clear: "Emoji entfernen",
        customCategory: "Server-Emojis",
        suggestedCategory: "Zuletzt verwendet",
        smileysPeopleCategory: "Smileys & Personen",
        animalsNatureCategory: "Tiere & Natur",
        foodDrinkCategory: "Essen & Trinken",
        travelPlacesCategory: "Reisen & Orte",
        activitiesCategory: "Aktivitäten",
        objectsCategory: "Objekte",
        symbolsCategory: "Symbole",
        flagsCategory: "Flaggen",
    },
    resultReview: {
        title: "Ergebnis prüfen",
        dialogHelp:
            "Prüfe die Punktzahlen und Quellen des Events vor der Bestätigung.",
        description:
            "Importe bleiben vorläufig, bis ein Prüfer diese Version bestätigt. Korrekturen bewahren das vorherige Ergebnis und benötigen eine Begründung.",
        loading: "Laden…",
        refresh: "Aktualisieren",
        error: "Das Ergebnis konnte nicht geladen oder gespeichert werden. Aktualisiere die Ansicht und prüfe Berechtigungen sowie Quellenänderungen. Unvollständige Sitzungen können nicht bestätigt werden.",
        status: {
            unknown: "Kein geprüftes Ergebnis",
            provisional: "Vorläufig",
            confirmed: "Bestätigt",
            corrected: "Korrigiert",
        },
        revision: "Version",
        unknownScore: "Unbekannt",
        attribution: "Spielerzuordnung",
        verified: "verifiziert",
        unresolved: "ungeklärt",
        reviewedAt: "Geprüft",
        reviewer: "Prüfer",
        complete: "Vollständig",
        incomplete: "Unvollständig",
        source: "Ergebnisquelle",
        manual: "Manuelle Punktzahlen",
        keepSources: "Verknüpfte Sitzungen behalten",
        scoreHelp:
            "Ein leeres Feld bedeutet unbekannt. Null ist eine bekannte Punktzahl. Die Auswahl einer Sitzung bestätigt kein Ergebnis automatisch.",
        participant: "Teilnehmer",
        score: "Punkte",
        remove: "Teilnehmer entfernen",
        addParticipant: "Teilnehmer hinzufügen",
        reason: "Korrekturgrund",
        stage: "Vorläufiges Ergebnis speichern",
        confirm: "Angezeigte Version bestätigen",
        useImport: "Letzten bisherigen Import verwenden",
        correct: "Geprüfte Korrektur speichern",
        unsaved:
            "Es gibt ungespeicherte Änderungen. Speichere und prüfe die vorläufige Version vor der Bestätigung.",
        history: "Letzte Ergebnisversionen",
        importer: "Import",
    },
    appStates: {
        loading: "Wird geladen…",
        loadingPage: "Seite wird geladen",
        errorTitle: "Diese Seite wurde nicht geladen",
        errorDescription:
            "Beim Laden ist etwas schiefgelaufen. Deine Einstellungen und Daten wurden nicht geändert.",
        errorNextStep:
            "Versuche es erneut. Wenn es wieder passiert, schick die Details unten an den Support.",
        retry: "Erneut versuchen",
        supportDetails: "Details für den Support",
        errorReference: "Fehlerreferenz",
        errorTime: "Zeit",
        errorPage: "Seite",
        copyDetails: "Details kopieren",
        detailsCopied: "Details kopiert.",
        notFoundTitle: "Seite nicht gefunden",
        notFoundDescription:
            "Der Link ist vielleicht veraltet oder vertippt, oder die Seite wurde entfernt. Prüf die Adresse oder mach auf einer dieser Seiten weiter.",
        notFoundDashboardDescription:
            "Diese Clan-Seite gibt es nicht, oder du hast keinen Zugriff mehr darauf.",
        goHome: "Zur Startseite",
        backToClans: "Zurück zu deinen Clans",
        openMenu: "Menü öffnen",
        mainNavigation: "Hauptnavigation",
        backTo: "Zurück zu {page}",
    },
    verifiedPlatformLinks: {
        title: "Verifiziertes Steam-Konto",
        description:
            "Bestätige den Zugriff auf dein Steam-Konto durch eine Anmeldung bei Steam. Manuell eingetragene Profil-IDs sind nicht verifiziert.",
        loading: "Laden…",
        refresh: "Aktualisieren",
        error: "Die Steam-Verknüpfung ist nicht verfügbar. Aktualisiere die Übersicht oder versuche es später erneut.",
        callbackFailed:
            "Die Steam-Verifizierung wurde nicht abgeschlossen. Starte einen neuen Versuch.",
        verified: "Über Steam verifiziert",
        empty: "Kein verifiziertes Steam-Konto",
        verifiedAt: "Verifiziert",
        revokedAt: "Getrennt",
        link: "Mit Steam verifizieren",
        unlink: "Steam trennen",
        history: "Letzte Verknüpfungsänderungen",
        effect: "Das Trennen beendet zukünftige Spielerzuordnungen. Dieser Nachweis vergibt keine Discord-Rollen, bestätigt keinen Spielbesitz und veröffentlicht dein Profil nicht auf der Website.",
    },
    userSettings: {
        privacyTitle: "Privatsphäre und Daten",
        privacyDescription:
            "Fordere eine Kopie deiner personenbezogenen Daten an oder beantrage die Kontolöschung.",
        requestExport: "Meine Datenexport anfordern",
        requestErasure: "Kontolöschung beantragen",
        erasureWarning:
            "Die Löschung entfernt auch deine Clan-Zuweisungen, Anmeldungen, Roster-Platzierungen und andere kontoverknüpfte Datensätze. Manche Daten können bleiben, wo gesetzlich erforderlich.",
        requestSubmitted: "Deine Datenschutzanfrage wurde übermittelt.",
        title: "Benutzereinstellungen",
        description:
            "Verwalte dein Profil und deine Plattform-Identität für importiertes Match-Matching.",
        profile: "Profil",
        discordName: "Discord-Name",
        discordId: "Discord-ID",
        avatar: "Avatar",
        preferredLanguage: "Bevorzugte Sprache",
        preferredLanguageHelp:
            "Ändert die Sprache von Dashboard und Website auf diesem Gerät.",
        profileSaved: "Profil gespeichert.",
        matchRecapsSaved: "Einstellung für Spielzusammenfassungen gespeichert.",
        erasureConfirmTitle: "Löschung des Kontos beantragen?",
        erasureConfirmDescription:
            "Das Logi-Team bearbeitet deine Anfrage. Danach werden dein Konto und die oben beschriebenen Daten gelöscht und können nicht wiederhergestellt werden.",
        erasureConfirm: "Löschung beantragen",
        notLinked: "Nicht verknüpft",
        streamerMode: "Streamer-Modus",
        enabled: "Aktiviert",
        disabled: "Deaktiviert",
        matchRecapsTitle: "Match-Zusammenfassungen",
        matchRecapsEnabled: "Match-Zusammenfassungen erhalten",
        matchRecapsDescription:
            "Erhalte nach einem erfassten Match eine Discord-Zusammenfassung, wenn dein Roster-Slot mit den Spielerstatistiken verknüpft ist.",
        defaultWorkspace: "Standard-Workspace",
        defaultWorkspaceAutomatic: "Automatisch (bester verfügbarer Workspace)",
        defaultWorkspaceHelp:
            "Dieser Workspace wird beim Öffnen des Dashboards angezeigt. Automatisch bevorzugt deinen Hauptclan und danach einen weiteren zugänglichen Workspace.",
        platformConnection: "Plattform-Identität",
        platformConnected: "Plattform-ID gesetzt",
        platformDisconnected: "Plattform-ID nicht gesetzt",
        platformId: "Plattform-ID (nicht verifiziert)",
        platformIdPlaceholder: "Steam64- oder Epic-Spieler-ID",
        currentPlatformId: "Aktuelle Plattform-ID",
        platformIdHelp:
            "Füge hier deine Steam64-ID oder Epic-Account-ID ein. Keine Leerzeichen.",
        platformIdSteamLink: "Steam-Anleitung",
        platformIdSteamHint:
            "Nutze Valves Anleitung, um deine SteamID zu finden, und kopiere dann den langen numerischen Steam64-Wert.",
        platformIdEpicLink: "Epic-Anleitung",
        platformIdEpicHint:
            "Öffne die Epic-Kontoeinstellungen oder den Launcher und kopiere deine Account-ID.",
        accountTitle: "Mein Konto",
        accountDescription:
            "Deine Sprache, Spielkonten, Bot-Nachrichten und persönlichen Daten.",
        signedInWith: "{name} · über Discord angemeldet",
        autoSaveNote:
            "Änderungen werden sofort gespeichert. Du musst nichts mit einem Button bestätigen.",
        changeAvatar: "Avatar ändern",
        avatarSaved: "Avatar gespeichert.",
        lookTitle: "Sprache und Darstellung",
        appLanguage: "App-Sprache",
        theme: "Design",
        startClan: "Clan nach der Anmeldung",
        startClanAutomatic: "Automatisch (dein Hauptclan)",
        startClanSaved: "Clan nach der Anmeldung gespeichert.",
        gameAccountsTitle: "Spielkonten",
        steamVerifiedOn:
            "Am {date} über Steam bestätigt · Statistiken werden automatisch zugeordnet",
        steamNotVerified:
            "Nicht bestätigt. Bestätige dein Konto über Steam, dann werden deine Statistiken automatisch zugeordnet.",
        steamUnavailable:
            "Die Steam-Bestätigung ist gerade nicht verfügbar. Versuche es gleich noch einmal.",
        steamUnlink: "Trennen",
        steamUnlinked: "Steam-Konto getrennt.",
        steamVerify: "Mit Steam bestätigen",
        manualIdsTitle: "Epic, Xbox, PlayStation",
        manualIdsUnverified: "Manuell eingegeben, nicht bestätigt",
        manualIdsEmpty: "Noch keine ID eingegeben",
        addId: "ID hinzufügen",
        editIds: "IDs bearbeiten",
        manualIdsDialogTitle: "Spielkonto-IDs",
        manualIdsDialogDescription:
            "Trenne mehrere IDs mit Kommas. Logi kann sie nicht bestätigen, dein Clan sieht sie deshalb als nicht bestätigt.",
        platformIdsSaved: "Spielkonto-IDs gespeichert.",
        botDmTitle: "Direktnachrichten vom Bot",
        recapTitle: "Zusammenfassung nach dem Match",
        recapDescription: "Deine Statistiken aus einem bestätigten Match.",
        remindersTitle: "Erinnerungen an Anmeldungen und Anwesenheit",
        remindersDescription:
            "Dein Clan schickt sie nach seinen Einstellungen.",
        remindersByClan: "legt dein Clan fest",
        downloadAllData: "Alle meine Daten herunterladen",
        downloadZip: "ZIP herunterladen",
        deleteAccountTitle: "Konto löschen",
        deleteAccountDescription:
            "Entfernt dein Profil, deine Anmeldungen und verknüpften Konten. Gib zur Bestätigung deinen Namen ein.",
        deleteAccountConfirmLabel: "Bestätigung mit deinem Namen",
        deleteAccountButton: "Konto löschen",
        deleteAccountRequested:
            "Deine Löschanfrage wurde gesendet. Das Logi-Team bearbeitet sie.",
    },
    serverSettings: {
        title: "Clan-Einstellungen",
        description:
            "Verwalte Aussehen dieses Clans und wer Operationen leiten darf.",
        pageDescription:
            "Aktualisiere Clan-Profil, Discord-Automatisierung und Zugriffskontrollen für deinen Workspace.",
        frontendOnlyDescription: "Vorläufig nur Frontend-Clan-Konfiguration.",
        clanName: "Clan-Name",
        discordTitle: "Discord-Bot-Einstellungen",
        discordDescription:
            "Steuere Channels, Rollen, Zeitzonenbehandlung und Gruppen-Anmeldeverhalten für den Discord-Bot.",
        timezone: "Zeitzone",
        defaultLanguage: "Clan-Sprache",
        languageEnglish: "Englisch",
        languageCzech: "Tschechisch",
        languageGerman: "Deutsch",
        announcementsChannelId: "Ankündigungs-Channel-ID",
        eventInfoChannelId: "Event-Info-Channel-ID",
        errorsChannelId: "Fehler-Channel-ID",
        calendarChannelId: "Kalender-Channel-ID",
        forumCategoryId: "Forums-Kategorie-ID",
        squadVoiceCategoryId: "Standard-Squad-Sprachkategorie",
        meetingChannelId: "Meeting-Sprachchannel-ID",
        clanRoleId: "Clan-Rollen-ID",
        dashboardAdminRoleId: "Dashboard-Admin-Rollen-ID",
        playerStatsServersTitle: "Server-Statistik-Verbindungen",
        playerStatsServersDescription:
            "Füge eine oder mehrere Stats-API-Verbindungen hinzu. Die Spielersuche fragt alle konfigurierten Server ab.",
        playerStatsServerToken: "Server-Stats-Token",
        playerStatsServerTokenPlaceholder: "bearer ...",
        playerStatsServerUrl: "Server-Stats-URL",
        playerStatsServerUrlPlaceholder: "https://.../api/get_players_history",
        addPlayerStatsServer: "Stats-Server hinzufügen",
        statsCommandTitle: "Befehl für Spielerstatistiken",
        statsCommandDescription:
            "Lege fest, ob Mitglieder /stats auf diesem Server nutzen dürfen, für welche Spiele, und wohin Teilen standardmäßig veröffentlicht. Die Befehlsberechtigungen von Discord gelten weiterhin.",
        statsCommandEnabled: "/stats aktivieren",
        statsCommandGame: "Statistiken für {game}",
        statsCommandDefaultChannel: "Standardkanal zum Teilen",
        statsCommandDefaultChannelHelp:
            "Wird verwendet, wenn der Befehl ohne Kanaloption ausgeführt wird. Ohne Standard fragt Teilen nach einem Kanal. Geteilte Karten setzen weiterhin voraus, dass Mitglied und Bot dort posten dürfen.",
        removePlayerStatsServer: "Stats-Server entfernen",
        rosterScoreTitle: "Roster-Score-Regeln",
        rosterScoreDescription:
            "Passe an, wie sich der Spieler-Score ändert, sobald Event-Anmeldungen finalisiert sind.",
        rosterScoreNoResponse: "Keine Reaktion (-2)",
        rosterScoreDeclined: "Abgelehnt (-1)",
        rosterScoreAccepted: "Jede andere Reaktion (+1)",
        guildLoginUrl: "Eigene Login-Seite",
        copyLoginUrl: "Kopieren",
        copiedLoginUrl: "Kopiert",
        ssoTitle: "Single-Sign-on-Anwendungen",
        ssoDescription:
            "Verbundene Websites verwenden Logi als Discord-basierten Identitätsanbieter. Client-Geheimnisse werden nur einmal angezeigt.",
        ssoSecret: "Dieses Client-Geheimnis jetzt kopieren:",
        ssoName: "Anwendungsname",
        ssoWebsiteUrl: "Website-URL",
        ssoRedirectUris: "Weiterleitungs-URL (eine pro Zeile)",
        ssoCreate: "Anwendung erstellen",
        ssoRemove: "Anwendung entfernen",
        googleCalendarTitle: "Google-Kalender-Synchronisierung",
        googleCalendarDescription:
            "Erstelle einen privaten Abonnement-Link für den vollständigen Logi-Kalender dieses Clans, einschließlich geplanter Events und wiederkehrender manueller Einträge.",
        createCalendarFeed: "Google-Kalender-Link erstellen",
        rotateCalendarFeed: "Google-Kalender-Link erneuern",
        copyCalendarFeed: "Kalender-Link kopieren",
        copiedCalendarFeed: "Kopiert",
        googleCalendarInstructions:
            "Wähle in Google Kalender Weitere Kalender → Per URL und füge diesen Link ein. Jede Person mit dem Link kann den Clan-Kalender lesen; durch Erneuern wird der alte Link deaktiviert.",
        eventCategoriesTitle: "Event-Kategorien",
        eventCategoriesDescription:
            "Wiederverwendbare Kategorien für Matches und Trainings. Farbe und Emoji werden auf allen Dashboard-Kalenderflächen wiederverwendet.",
        addEventCategory: "Kategorie hinzufügen",
        eventCategoryLabel: "Kategorie",
        eventCategoryName: "Kategoriename",
        noEventCategories: "Noch keine Event-Kategorien.",
        calendarItemsTitle: "Kalendereinträge",
        calendarItemsDescription:
            "Füge manuelle reine Kalendereinträge hinzu, etwa Sommerpausen, Clan-Meetings oder andere wiederkehrende Erinnerungen.",
        addCalendarItem: "Kalendereintrag hinzufügen",
        calendarItemLabel: "Kalendereintrag",
        calendarItemTitle: "Titel",
        calendarItemLabelName: "Legenden-Label",
        calendarItemAllDay: "Ganztägig",
        calendarItemStart: "Beginnt",
        calendarItemEnd: "Endet",
        calendarItemRecurrence: "Wiederholung",
        calendarItemRecurrenceInterval: "Alle wiederholen",
        calendarItemRecurrenceUntil: "Wiederholen bis",
        recurrenceNone: "Keine Wiederholung",
        recurrenceWeekly: "Wöchentlich",
        recurrenceMonthlyDate: "Monatlich nach Datum",
        recurrenceMonthlyNthWeekday: "Monatlich nach Wochentag",
        recurrenceYearly: "Jährlich",
        noCalendarItems: "Noch keine manuellen Kalendereinträge.",
        groupRoleMappings: "Gruppen-Rollen-Zuordnungen",
        requiredRoleId: "Erforderliche Rollen-ID",
        groupEmoji: "Gruppen-Emoji",
        noGroupRole: "Keine erforderliche Rolle",
        saveDiscordSettings: "Discord-Einstellungen speichern",
        discordSettingsSaved: "Discord-Einstellungen gespeichert.",
        discordSettingsSaveError:
            "Discord-Einstellungen konnten nicht gespeichert werden.",
        botRequiredNotice:
            "Der Bot muss bereits auf dem Server sein, bevor der volle Workspace verfügbar wird.",
        accessModel: "Zugriffsmodell",
        accessAdmins:
            "Admins: Vollzugriff auf Events, Presets, Roster und Clan-Einstellungen.",
        accessMembers:
            "Mitglieder und Mercenaries: Kalendersicht plus nur veröffentlichte Roster.",
        accessBackend:
            "Spätere Backend-Arbeit kann diese Regeln mit Discord-Rollen und Convex-Queries verbinden.",
    },
    integrationSettings: {
        cancel: "Abbrechen",
        web: {
            stepKey: "API-Schlüssel für die Website",
            stepLogin: "Anmelden mit Logi",
            stepMembers: "Was die Website für Mitglieder tun darf",
            newKey: "Neuer Schlüssel",
            closeForm: "Schließen",
            keyShownOnce:
                "Ein Schlüssel wird nur einmal angezeigt, direkt nach dem Erstellen. Bewahre ihn auf dem Server deiner Website auf.",
            loginPage: "Anmeldeseite des Clans",
            ssoApps: "Anwendungen für Single Sign-on",
            addApplication: "Anwendung hinzufügen",
            membersRowHelp:
                "Über den Schlüssel {key}. Ein Mitglied braucht eine der Rollen.",
            saveRoles: "Rollen speichern",
            membersTitle: "Herausfinden, wer Mitglied ist",
            membersHelp:
                "Über einen Nur-Lese-Schlüssel mit Zugriff auf die Discord-Mitgliedschaft. Die Website sieht nur Mitglieder mit einer der gewählten Rollen.",
            eventsTitle: "Events anlegen und bearbeiten",
            eventsHelp:
                "Über eine Single-Sign-on-Anwendung und ihren Schlüssel. Nur Personen mit einer der gewählten Rollen.",
            footer: "Schlüssel und Anwendungen werden sofort gespeichert. Rollen speicherst du mit dem Button des jeweiligen Schlüssels.",
            rolesPlaceholder: "Rollen wählen",
            rolesUnavailable:
                "Die Discord-Rollen konnten nicht geladen werden. Lade die Seite neu.",
        },
        sso: {
            emptyTitle: "Noch keine Anmelde-Anwendung",
            emptyDescription:
                "Füge deine Website als Anwendung hinzu, damit sich Mitglieder dort über Logi mit ihrem Discord-Konto anmelden können.",
            redirects: "Rücksprungadressen nach der Anmeldung: {count}",
            clientId: "Client-ID",
            edit: "Bearbeiten",
            save: "Änderungen speichern",
            saved: "Anwendung gespeichert.",
            removeTitle: "{name} entfernen?",
            removeDescription:
                "Mitglieder können sich auf {website} nicht mehr mit Logi anmelden. Client-ID und Secret der Anwendung werden ungültig, und Event-Befehle der Website über diese Anwendung funktionieren nicht mehr. Das lässt sich nicht rückgängig machen.",
            removeConfirm: "Anwendung entfernen",
        },
        webhooks: {
            emptyTitle: "Noch keine Webhooks",
            emptyDescription:
                "Gib eine HTTPS-Adresse an, und Logi sendet Änderungen an Events, Aufstellungen, Artikeln und Einstellungen dorthin, signiert mit einem Secret.",
            deleteTitle: "Diesen Webhook löschen?",
            deleteDescription:
                "Logi sendet sofort keine Änderungen mehr an {url}, und das Signatur-Secret wird ungültig. Das lässt sich nicht rückgängig machen.",
            deleteConfirm: "Webhook löschen",
            loadFailed:
                "Webhooks konnten nicht geladen werden. Lade neu und versuche es erneut.",
            createFailed:
                "Der Webhook konnte nicht erstellt werden. Prüfe die Adresse und versuche es erneut.",
            actionFailed:
                "Die Änderung wurde nicht gespeichert. Versuche es erneut.",
            rotateFailed: "Das Signatur-Secret konnte nicht erneuert werden.",
            historyFailed: "Der Zustellverlauf konnte nicht geladen werden.",
        },
        calendar: {
            emptyTitle: "Noch kein Kalenderlink",
            emptyDescription:
                "Erstelle einen privaten Link und füge ihn in Google Kalender oder einer anderen Kalender-App hinzu. Wer den Link hat, sieht die Events des Clans.",
            rotateTitle: "Neuen Kalenderlink erstellen?",
            rotateDescription:
                "Der aktuelle Link funktioniert dann nicht mehr. Alle, die ihn abonniert haben, müssen den neuen Link hinzufügen.",
            rotateConfirm: "Neuen Link erstellen",
        },
        league: {
            title: "Wardogs League verfolgen",
            cadence:
                "Neue Spiele werden alle {scan} Minuten gesucht, verfolgte Details alle {refresh} Minuten aktualisiert. Website und Discord nutzen denselben Eintrag.",
            enable: "Wardogs League und Spiel-Links verfolgen",
            teamCodes: "Kürzel der verfolgten Teams (durch Komma getrennt)",
            scanEvery: "Neue Spiele suchen alle",
            refreshEvery: "Verfolgte Details aktualisieren alle",
            minutes: "{minutes} Minuten",
            scanNote:
                "Der gemeinsame Index-Scan läuft im kürzesten Intervall, das ein aktivierter Clan wünscht; dieser Clan übernimmt einen neuen Index erst nach seinem eigenen Intervall. Begrenzungen der Quelle können die Intervalle verlängern.",
            intakeChannel: "Kanal, in dem Leute Links posten",
            intakePlaceholder: "Kanal für Links wählen",
            panelsNote:
                "Tabelle und nächste Spiele der ganzen Liga gehen als Panel WD League unter Einstellungen → Panels in Discord in den Discord. Karten für einzelne Spiele werden nicht mehr gepostet. Wenn ihr das Verfolgen ausschaltet, löscht der Bot die Nachrichten des Panels.",
            intakeNote:
                "Nachrichten von Bots werden ignoriert. Damit Nachrichten von Leuten automatisch gelesen werden, muss der Betreiber des Bots Message Content aktivieren. Scan und manuelles Hinzufügen funktionieren auch ohne.",
            save: "Einstellungen speichern",
            saved: "Gespeichert.",
            saveFailed:
                "Speichern fehlgeschlagen. Prüfe Berechtigungen, Link und Kanaleinstellungen.",
            loadFailed:
                "Die Einstellungen zum Verfolgen konnten nicht geladen werden.",
            lastScan: "Letzter erfolgreicher Scan",
            nextScan: "Nächster Scan",
            incomplete:
                "Die Liste ist unvollständig; füge ein fehlendes Spiel manuell hinzu.",
            queueFull:
                "Die automatische Suche ist voll. Bestehende Spiele werden weiter aktualisiert; die restlichen Plätze bleiben für manuelles Hinzufügen frei.",
            sourceError:
                "Die Quelle ist nicht erreichbar. Die letzten gültigen Daten bleiben erhalten.",
            addByUrl: "Spiel über seinen League-Link hinzufügen",
            preview: "Vorschau laden",
            previewFailed: "Keine Vorschau verfügbar. Prüfe den Link.",
            track: "Dieses Spiel verfolgen",
            createNative: "Eigenes Spiel in Logi anlegen",
            states: {
                pending: "Wartet aufs Laden",
                tracked: "Wird verfolgt",
                paused: "Pausiert",
                ignored: "Ignoriert",
                archived: "Archiviert",
                unmatched: "Außerhalb des Filters",
            },
            refreshOnce: "Erneut laden",
            resume: "Fortsetzen",
            pause: "Pausieren",
            ignore: "Ignorieren",
            staleData: "Ältere Daten, zuletzt geladen {time}",
            linkedEvent: "Logi-Spiel zu dieser Begegnung",
            notLinked: "Nicht verknüpft",
            unknownEvent: "Verknüpftes Spiel, das nicht mehr gelistet ist",
            noEvents:
                "In Logi gibt es noch kein Wardogs-Spiel. Lege eins an und verknüpfe es dann hier.",
            saveLink: "Verknüpfung speichern",
            emptyTitle: "Noch kein verfolgtes Spiel",
            emptyDescription:
                "Spiele der verfolgten Teams erscheinen hier nach dem nächsten Scan. Du kannst oben auch eins über seinen Link hinzufügen.",
        },
    },
    ticketSettings: {
        questionsTitle: "Fragen im Formular",
        questionsCount: "{count} von {max}",
        edit: "Bearbeiten",
        doneEditing: "Fertig",
        removeQuestion: "Frage entfernen",
        requiredShort: "Pflicht",
        optionalShort: "optional",
        untitledQuestion: "Frage ohne Titel",
        noQuestionsShort:
            "Keine Fragen: Der Thread öffnet sich direkt nach dem Klick.",
        enabledLabel: "An",
        enabledAria: "Tickets an",
        flowLabel: "So läuft ein Ticket ab",
        flow: {
            pick: "Ein Mitglied wählt eine Kategorie im Panel",
            form: "Füllt ein kurzes Formular aus",
            thread: "Ein privater Thread mit dem Support öffnet sich",
            close: "Der Support schließt ihn und die Person bekommt eine DM",
        },
        panelSection: "Panel",
        panelChannel: "Kanal mit dem Panel",
        threadChannel: "Wo Threads entstehen",
        threadChannelHint:
            "Der Bot muss hier private Threads erstellen können.",
        threadChannelOk: "Der Bot kann hier private Threads anlegen",
        categoriesShort: "Kategorien",
        categoriesEditorNote: "Jede Kategorie ist ein Button im Panel.",
        headingLabel: "Überschrift",
        textLabel: "Text",
        imageOptional: "optional",
        previewTitle: "Vorschau in Discord",
        panelColor: "Panelfarbe",
        panelColorHint: "Leer = Clanfarbe. Hex, z. B. #E8A33D.",
        panelColorInvalid: "Die Farbe muss hex sein, z. B. #E8A33D.",
        threadTitle: "Titel der Karte im Thread",
        threadTitlePlaceholder: "{author} meldet einen Spieler",
        threadTitleHint:
            "{author} ist der Name des Autors, {category} die Kategorie. Leer ergibt „{author} · {category}“.",
        columns: {
            button: "Button",
            handledBy: "Wer antwortet",
            questions: "Fragen",
            actions: "Aktionen",
        },
        nobodyAdmins: "niemand, nur Logi-Administratoren",
        removeCategory: "Kategorie entfernen",
        untitledCategory: "Kategorie ohne Titel",
        noCategoriesDescription:
            "Jede Kategorie wird ein Button im Panel, zum Beispiel Spieler melden oder Problem mit dem Bot.",
        saveNote:
            "Speichert nur die Tickets. Andere Einstellungen bleiben, wie sie sind.",
        saveAndRefresh: "Speichern und Panel aktualisieren",
        discard: "Verwerfen",
        unsaved: "Ungespeicherte Änderungen",
        title: "Ticket-Einstellungen",
        pageDescription:
            "Konfiguriere Ticket-Panel, Kategorien, Staff-Rollen und Modal-Fragen für Discord-Tickets.",
        enableTitle: "Ticket-System aktivieren",
        enableDescription:
            "Poste ein konfigurierbares Ticket-Panel in Discord und öffne private Ticket-Threads über seine Kategorie-Buttons.",
        submitChannel: "Ticket-Channel einreichen",
        parentChannel: "Ticket-Thread-Eltern-Channel",
        panelTitle: "Panel-Embed-Titel",
        panelDescription: "Panel-Embed-Beschreibung",
        panelDescriptionPlaceholder:
            "Erkläre, wie Mitglieder dieses Ticket-Panel nutzen sollen.",
        image: "Thumbnail-Bild",
        embedLimitNotice: "Der Paneltext in Discord nutzt derzeit",
        embedLimitExceeded:
            "(zu lang, kürze einige Kategoriebeschreibungen vor dem Speichern).",
        categoriesTitle: "Ticket-Kategorien",
        categoriesDescription:
            "Jede Kategorie wird ein Button und kann optional vor Erstellung des Ticket-Threads ein Discord-Modal öffnen.",
        addCategory: "Kategorie hinzufügen",
        categoryLabel: "Kategorie",
        buttonText: "Button-Text",
        buttonTextPlaceholder: "Spieler melden",
        emoji: "Emoji",
        pickServerEmoji: "Server-Emoji wählen",
        typeAnyEmoji: "oder ein beliebiges Emoji tippen",
        categoryDescription: "Beschreibung",
        categoryDescriptionPlaceholder:
            "Steht im Panel hinter dem Kategorienamen, z. B. „Verhalten auf dem Server“.",
        supportRoles: "Support-Rollen für dieses Ticket",
        modalQuestions: "Modal-Fragen",
        modalQuestionsDescription:
            "Discord unterstützt bis zu 5 Texteingaben pro Modal.",
        addQuestion: "Frage hinzufügen",
        questionLabel: "Frage",
        questionText: "Frage-Label",
        questionTextPlaceholder: "Was ist passiert?",
        inputStyle: "Eingabestil",
        shortInput: "Kurz",
        paragraphInput: "Absatz",
        placeholder: "Platzhalter",
        required: "Erforderlich",
        noQuestions:
            "Noch keine Modal-Fragen. Wenn du dies leer lässt, erstellt der Button-Klick sofort das Ticket.",
        noCategories: "Noch keine Ticket-Kategorien.",
        defaultPanelTitle: "Brauchst du Hilfe?",
        defaultPanelDescription:
            "Wähle, wobei du Hilfe brauchst. Es öffnet sich ein privater Thread, den nur du und die Admins sehen.",
        incompleteTitle: "Ticket-Panel-Setup ist unvollständig",
        incompleteDescription:
            "Das Ticket-System ist aktiviert, aber das Discord-Ticket-Panel wird nicht gepostet und Ticket-Threads können nicht geöffnet werden, bis du fertigstellst: {items}.",
        routingInfoTitle: "So funktioniert Ticket-Routing",
        routingInfoDescription:
            "Kategorie-Support-Rollen werden automatisch in neue Ticket-Threads eingeladen. Dashboard-Administratoren können Tickets verwalten, werden aber nicht jedem Thread hinzugefügt.",
    },
    memberRoleOperations: {
        unlinkedTarget: "Logi-ID (Discord nicht verknüpft)",
        title: "Änderungen der Mitgliedsrollen",
        refresh: "Aktualisieren",
        loading: "Laden…",
        description:
            "Die letzten 100 Verwaltungs- oder Bewerbungsvorgänge für alle Spiele. Das Speichern stellt eine Änderung in die Warteschlange; erst die Discord-Prüfung bestätigt sie. Abgelehnte, ersetzte und fehlgeschlagene Vorgänge werden 30 Tage nach ihrem Ende gelöscht.",
        error: "Rollenvorgänge sind nicht verfügbar. Bitte erneut aktualisieren.",
        empty: "Noch keine Änderungen verwalteter Rollen.",
        target: "Discord-ID des Mitglieds",
        actor: "Discord-ID des Auftraggebers",
        origin: "Quelle",
        version: "Version",
        updated: "Aktualisiert",
        audit: "Versuchsverlauf",
        auditDescription:
            "Die letzten 5 Versuche werden angezeigt; maximal 20 je Vorgang gespeichert. Eine tägliche Prüfung, die die Rollen bestätigt, fügt keinen Versuch hinzu. Zeiten in UTC. Grundcodes helfen bei der Fehlerdiagnose.",
        reason: "Grund",
        status: {
            pending: "Ausstehend",
            running: "In Bearbeitung",
            retry_scheduled: "Wiederholung geplant",
            applied: "Angewendet",
            denied: "Abgelehnt",
            superseded: "Ersetzt",
            failed: "Fehlgeschlagen",
        },
        provenance: {
            dashboard: "Administrator",
            recruitment: "Rekrutierungsteam",
            application: "Mitgliedsbewerbung",
            rollback: "Bewerbung zurückgenommen",
        },
        hint: {
            pending: "Der Bot prüft vor der Rollenänderung die Berechtigungen.",
            running:
                "Der Bot prüft Discord und bearbeitet den aktuellen Auftrag.",
            retry_scheduled:
                "Der Bot wiederholt den Versuch nach der Wartezeit automatisch.",
            applied:
                "Die Discord-Rollen entsprachen beim letzten Prüfen dem Auftrag. Der Bot prüft einmal täglich erneut.",
            denied: "Zugang des Auftraggebers, Mitgliedschaft, Bot-Rechte und Rollenhierarchie prüfen, dann einen neuen Mitgliedsauftrag speichern.",
            superseded:
                "Zuweisung oder Regeln wurden geändert. Der neue Zustand benötigt einen neuen berechtigten Auftrag.",
            failed: "Automatische Versuche wurden beendet. Ursache beheben und einen neuen Mitgliedsauftrag speichern.",
        },
    },
    membershipSettings: {
        clanRoleMissingChip: "Clan-Rolle fehlt",
        applicationsTitle: "Beitrittsanfragen",
        applicationsChannel: "Der Bewerben-Button in #{channel}",
        applicationsNoChannel:
            "Wähle den Kanal für das Panel unter Panel und Threads.",
        roleSyncToggleTitle: "Rollen-Synchronisierung",
        roleSyncToggleDescription:
            "Logi vergibt und entzieht Rollen nach dem Status des Mitglieds. Sie wird zusammen mit den Beitrittsanfragen ein- und ausgeschaltet.",
        roleSyncOn: "An",
        roleSyncOff: "Aus",
        roleSyncSwitchDescription:
            "Logi vergibt und entzieht Rollen nach dem Mitgliedsstatus. Das funktioniert auch, wenn Bewerbungen ausgeschaltet sind.",
        skipPendingCategoryTitle:
            "Warten überspringen und direkt als Rekrut aufnehmen",
        skipPendingCategoryHelp: "Nur für Hauptmitglieder.",
        categoryDescriptionHelp:
            "Im Panel steht sie nach Name und Spiel, in Fenster 1 unter dem Namen der Kategorie.",
        addRole: "Rolle",
        addRoleAria: "Rolle hinzufügen: {status}",
        removeRole: "Rolle {role} entfernen",
        roleSearch: "Rolle suchen",
        roleEmpty: "Keine weitere Rolle.",
        tabsLabel: "Bereiche der Mitgliedschaft",
        tabs: {
            categories: "Kategorien",
            panel: "Panel und Threads",
            scores: "Punkte für Anwesenheit",
            roleChanges: "Rollenänderungen",
        },
        categoryButtonTitle: "Im Panel und in Fenster 1",
        categoryText: "Name",
        categoryDescriptionLabel: "Beschreibung",
        resultTitle: "Nach der Aufnahme wird der Spieler",
        rolesByStatus: "Rollen nach Status",
        statusPending: "Wartet auf Entscheidung",
        statusRecruit: "Rekrut",
        noRoles: "keine Rollen",
        handledBy: "Wer Anfragen bearbeitet",
        handledByAdmins: "und Logi-Administratoren",
        clanRoleNote:
            "{role} ist die Clan-Rolle aus Rollen und Zugriff. Sie gilt für jede Kategorie.",
        clanRoleMissingNote:
            "Die Clan-Rolle ist noch nicht gesetzt. Wähle sie unter Rollen und Zugriff; sie gilt für jede Kategorie.",
        clanRoleLink: "Rollen und Zugriff öffnen",
        missingFinalRole: "endgültige Rolle fehlt",
        missingRecruitRole: "Rekrutenrolle fehlt",
        removeCategory: "Kategorie entfernen",
        noCategoriesDescription:
            "Jede Kategorie ist eine Option in der Bewerbung, zum Beispiel Hauptmitglied, Reserve oder Söldner.",
        rolePlaceholder: "Rolle hinzufügen",
        saveNote:
            "Speichert nur die Mitgliedschaft. Andere Einstellungen bleiben, wie sie sind.",
        discard: "Verwerfen",
        saveShort: "Speichern",
        unsaved: "Ungespeicherte Änderungen",
        title: "Mitgliedschaftseinstellungen",
        pageDescription:
            "Konfiguriere das Discord-Bewerbungs-Embed, erforderliche Bewerbungskategorien und Standardzuweisung für neue Clan-Mitglieder.",
        enableTitle: "Mitgliedsbewerbungen aktivieren",
        enableDescription:
            "Poste ein Clan-Bewerbungs-Embed in Discord und öffne Staff-verwaltete private Threads daraus.",
        submitChannel: "Embed-Channel einreichen",
        parentChannel: "Bewerbungs-Thread-Eltern",
        skipPendingTitle: "Pending-Phase überspringen",
        skipPendingDescription:
            "Neue Mitgliederbewerbungen starten sofort nach Einreichung als Rekruten.",
        inviteSupportMembersIndividuallyTitle:
            "Mitglieder der Support-Rolle einzeln hinzufügen",
        inviteSupportMembersIndividuallyDescription:
            "Ein: Logi fügt alle mit den Support-Rollen der Kategorie einzeln zum Thread jeder Bewerbung hinzu. Aus: Logi fügt sie nicht hinzu, und sie kommen nur über die Erwähnung ihrer Support-Rolle in den Thread; Discord macht das nur bei Rollen mit weniger als 100 Mitgliedern. Logi-Admins können Bewerbungen in Logi bearbeiten, ohne im Thread zu sein.",
        panelTitle: "Panel-Titel",
        panelDescription: "Panel-Beschreibung",
        welcomeMessage: "Begrüßungsnachricht im Bewerbungs-Thread",
        welcomeMessageDescription:
            "Wird über der Bewerbungsübersicht in jedem privaten Thread gepostet. Verwende {applicant}, {support_roles} und {category} für Discord-Erwähnungen und die gewählte Kategorie.",
        welcomeMessagePlaceholder:
            "Hallo {applicant}, danke für deine Bewerbung. {support_roles} meldet sich in Kürze.",
        image: "Thumbnail-Bild",
        applicationThumbnail: "Bewerbungs-Thumbnail",
        specializationTitle: "Spezialisierung abfragen",
        specializationDescription:
            "Zeigt Infanterie und Panzer als Schritt im Discord-Bewerbungsassistenten. Bei Wardogs wird dieser Schritt nie angezeigt.",
        categoryGame: "Spiel",
        categoryDetails: "Kategorie-Details",
        categoryRoles: "Rollen und Zugriff",
        categoryRolesDescription:
            "Wähle die Rollen, die Logi nach der Genehmigung verwaltet, und das Team mit Zugriff auf den Bewerbungs-Thread.",
        categoriesTitle: "Bewerbungskategorien",
        categoriesDescription:
            "Jede Kategorie wird ein Button. Modal-Fragen sind optional und folgen demselben Muster wie Tickets.",
        addCategory: "Kategorie hinzufügen",
        buttonLabel: "Button-Label",
        applicationResult: "Bewerbungsergebnis",
        recruitRole: "Rekruten-Rolle für diese Kategorie",
        recruitRolePlaceholder: "Rekruten-Rolle",
        finalRole: "Finale Rolle für diese Kategorie",
        finalRolePlaceholder: "Finale Rolle",
        modalQuestionsDescription:
            "Bis zu 5 Texteingaben, genau wie der Ticket-Modal-Flow.",
        noQuestions:
            "Noch keine Modal-Fragen. Leer lassen, wenn die Kategorie den Thread sofort nach dem Precheck öffnen soll.",
        noCategories: "Noch keine Bewerbungskategorien.",
        embedFieldUsage: "Embed-Feldnutzung: {length} / {max}",
        embedFieldTooLong:
            "(zu lang, kürze Kategoriebeschreibungen vor dem Speichern)",
        incompleteTitle: "Mitglieds-Panel-Setup ist unvollständig",
        incompleteDescription:
            "Bewerbungen sind aktiviert, aber das Discord-Mitglieds-Panel wird nicht gepostet und Bewerbungs-Threads können nicht geöffnet werden, bis du {items} setzt.",
        roleSyncTitle: "So funktioniert Mitglieds-Rollen-Sync",
        roleSyncDescription:
            "Ausstehende Bewerbungen weisen keine Mitgliedsrollen zu. Rekruten-Status nutzt die Clan-Rolle plus die Kategorie-Rekruten-Rolle, und Aktiv-Status nutzt die Clan-Rolle plus die Kategorie-Finalrolle, wenn diese Rollen konfiguriert sind. Mitgliedsrollen werden über eine Warteschlange geändert; das Ergebnis steht in den Mitgliedschaftseinstellungen unter Rollenvorgänge.",
        rosterScoreDescription:
            "Lege Score-Änderungen pro Server nach Event-Abschluss fest. Alles auf 0 lassen deaktiviert automatische Score-Bewegung.",
        rosterScoreNoCategory: "Keine Kategorie / keine Reaktion",
        rosterScorePresentRoster: "Reagiert und im Roster anwesend",
        rosterScorePresentReserve: "Reagiert und in Reserven anwesend",
        rosterScoreAbsentRoster: "Reagiert und im Roster abwesend",
        rosterScoreAbsentReserve: "Reagiert und in Reserven abwesend",
        rosterScoreExcusedAbsence: "Reagiert, abwesend, aber entschuldigt",
        rolesMissingTitle: "Manche Mitgliedsrollen sind nicht konfiguriert",
        rolesMissingClanRole: "Die Basis-Clan-Rolle ist nicht gesetzt. ",
        rolesMissingRecruitRole: "Rekrutenrolle fehlt: {categories}. ",
        rolesMissingFinalRole: "Endgültige Rolle fehlt: {categories}. ",
        rolesMissingSummary:
            "In diesen Fällen verfolgt Logi den Bewerbungsstatus weiter, aber Discord-Rollenänderungen werden teilweise oder gar nicht durchgeführt.",
        save: "Mitgliedschaftseinstellungen speichern",
        saved: "Mitgliedschaftseinstellungen gespeichert.",
        saveError:
            "Mitgliedschaftseinstellungen konnten nicht gespeichert werden.",
    },
    userManagement: {
        grantAdminAccess: "Zum Admin machen",
        removeAdminAccess: "Admin-Zugriff entziehen",
        adminAccessGranted: "Spieler ist jetzt Admin.",
        adminAccessRemoved: "Spieler-Admin-Zugriff entfernt.",
        adminAccessUpdateFailed:
            "Spieler-Admin-Zugriff konnte nicht aktualisiert werden.",
        title: "Spieler",
        description:
            "Füge Spieler aus dem bestehenden System als Hauptmitglieder oder Mercenaries hinzu und setze dabei Clan-Mitgliedsregeln durch.",
        addMember: "Als Mitglied hinzufügen",
        addReserveMember: "Als Reservemitglied hinzufügen",
        addMerc: "Als Mercenary hinzufügen",
        removeMember: "Mitglied entfernen",
        removeMerc: "Mercenary entfernen",
        memberLabel: "Hauptmitglied",
        reserveMemberLabel: "Reservemitglied",
        mercLabel: "Mercenary",
        eligibleMembers: "Für Mitglied geeignet",
        eligibleMercs: "Für Mercenary geeignet",
        blocked: "Nicht geeignet",
        searchPlaceholder: "Spieler im System suchen...",
        noResults: "Keine passenden Spieler im System gefunden.",
        rulesTitle: "Zuweisungsregeln",
        rulesMember:
            "Ein Spieler kann nur Hauptmitglied werden, wenn er nicht bereits zu einem anderen Haupt-Clan gehört.",
        rulesMerc:
            "Ein Spieler kann Mercenary für andere Clans sein, aber nicht gleichzeitig Mitglied und Mercenary im selben Clan.",
        rulesSystem:
            "Die Suche gibt nur Spieler zurück, die bereits in unserem System sind, bereit für Backend-Autocomplete später.",
        tablePlayer: "Spieler",
        tableType: "Typ",
        tableGroup: "Gruppe",
        tableStatus: "Status",
        tableScore: "Score",
        platformId: "Plattform-ID",
        playerNote: "Spielernotiz",
        platformNotConnected: "Plattform-ID nicht gesetzt",
        platformConnectedAs: "Plattform-ID gesetzt als {platformId}",
        platformIdNoSpaces: "Plattform-ID darf keine Leerzeichen enthalten.",
        platformAlreadyLinked:
            "Diese Plattform-ID ist bereits mit einem anderen Spieler verknüpft.",
        paused: "Pausiert",
        active: "Aktiv",
        membershipStatus: "Mitgliedsstatus",
        pendingLabel: "Ausstehend",
        recruitLabel: "Rekrut",
        addPlayer: "Spieler hinzufügen",
        autoLinkPlatformIds: "Plattform-IDs automatisch verknüpfen",
        autoLinkPlatformIdsDescription:
            "Durchsuche importierte Event-Scoreboards, entferne deinen Clan-Tag aus Spielernamen und fülle passende Plattform-IDs automatisch aus.",
        autoLinkPlatformIdsHint:
            "Gib den Clan-Tag genau so ein, wie er vor Spielernamen in importierten Events erscheint. Beispiel: VLKㆍ",
        autoLinkPlatformIdsSuccess:
            "{linked} Plattform-IDs aus {players} passenden Spielereinträgen verknüpft.",
        autoLinkPlatformIdsPartial:
            "Manche Ergebnisse übersprungen: {ambiguous} mehrdeutig, {conflicts} Konflikte, {failed} fehlgeschlagene Events.",
        dedupePlayerStats: "Spielerstatistiken deduplizieren",
        dedupePlayerStatsDescription:
            "Entferne doppelte importierte Match-Zeilen für Events dieses Clans und behalte möglichst die bessere Nicht-Unbekannt-Kopie.",
        dedupePlayerStatsHint:
            "Dies bereinigt nur importierte Spielerstatistiken für Events dieses Clans. Matches anderer Clans werden nicht berührt.",
        dedupePlayerStatsSuccess:
            "{matches} doppelte Match-Zeilen bei {users} Spielern entfernt.",
        refreshPerformanceHistory: "Clan- & Spielerstatistiken aktualisieren",
        refreshPerformanceHistorySuccess:
            "Clan- und Spielerstatistiken aktualisiert.",
        refreshPerformanceHistoryError:
            "Clan- und Spielerstatistiken konnten nicht aktualisiert werden.",
        mergeUsers: "Nutzer zusammenführen",
        mergeUsersDescription:
            "Führe zwei Konten vollständig zusammen. Das primäre Konto gewinnt bei überlappenden Daten.",
        mergeUsersPrimary: "Primäres Konto",
        mergeUsersSecondary: "Sekundäres Konto",
        mergeUsersPickPrimary: "Wähle das zu behaltende Konto",
        mergeUsersPickSecondary: "Wähle das hineinzuführende Konto",
        mergeUsersHint:
            "Dies schreibt Spielerstatistiken, importierte Matches, Zuweisungen, Roster und eingebettete Event-Referenzen auf das primäre Konto um.",
        mergeUsersConfirm: "Konten zusammenführen",
        mergeUsersSuccess: "Konten zusammengeführt.",
        clanTag: "Clan-Tag",
        clanTagPlaceholder: "VLKㆍ",
        importDiscordMembers: "Discord-Mitglieder importieren",
        importDiscordMembersDescription:
            "Importiere alle mit einer gewählten Discord-Rolle in die Spielerverwaltung.",
        importDiscordMembersHint:
            "Importierte Spieler erhalten keine primäre Gruppe. Passende Discord-pflichtige Gruppenrollen werden als sekundäre Gruppen hinzugefügt.",
        membershipMigration: "Mitgliedschaft per Rolle migrieren",
        membershipMigrationDescription:
            "Wähle eine Discord-Rolle und den Mitgliedsstatus, auf den sie für bestehende Clan-Zuweisungen abgebildet werden soll.",
        membershipMigrationTarget: "Ziel-Mitgliedsstatus",
        membershipMigrationHint:
            "Nur bereits in diesem Clan zugewiesene Spieler werden aktualisiert. Nicht zugewiesene Discord-Mitglieder werden übersprungen.",
        membershipMigrationSuccess:
            "{updated} Spieler auf {status} aktualisiert.",
        membershipMigrationSkippedUnassigned:
            "{count} Discord-Mitglieder ohne Clan-Zuweisung übersprungen.",
        membershipMigrationSkippedUnchanged:
            "{count} Spieler bereits in diesem Mitgliedsstatus übersprungen.",
        linkMissingDiscordIds: "Fehlende Discord-IDs verknüpfen",
        linkMissingDiscordIdsDescription:
            "Gleiche importierte Spieler ohne Discord-IDs mit Mitgliedern einer gewählten Discord-Rolle ab.",
        linkMissingDiscordIdsHint:
            "Namen werden vor dem Abgleich normalisiert und das erste passende Discord-Mitglied wird verknüpft.",
        linkMissingDiscordIdsSuccess:
            "{linked} importierte Spieler aus {scanned} Kandidaten verknüpft.",
        linkMissingDiscordIdsMerged:
            "{count} importierte Spielerdatensätze in bestehende Discord-verknüpfte Nutzer zusammengeführt.",
        discordSourceRole: "Discord-Quellrolle",
        discordImportSuccess:
            "{players} Spieler aus {matched} passenden Discord-Mitgliedern importiert.",
        discordImportSkipped:
            "{count} passende Discord-Mitglieder wurden übersprungen, weil sie mit dem gewählten Zuweisungstyp nicht importiert werden konnten.",
        editAssignment: "Zuweisung bearbeiten",
        playerSearch: "Spielersuche",
        assignmentType: "Zuweisungstyp",
        primaryGroup: "Primäre Gruppe",
        secondaryGroups: "Sekundäre Gruppen",
        noGroup: "Keine primäre Gruppe",
        noSecondaryGroups: "Keine sekundären Gruppen",
        pauseMembership: "Mitgliedschaft pausieren",
        pauseHelp:
            "Nutze dies für Inaktivität oder vorübergehende Abwesenheit.",
        pauseNote: "Pausennotiz",
        pauseNoteRequired:
            "Füge eine Pausennotiz hinzu, wenn die Mitgliedschaft pausiert ist.",
        pickPlayerFirst: "Wähle zuerst einen Spieler aus der System-Suchliste.",
        currentAssignment: "Aktuelle Zuweisung",
        mainClan: "Haupt-Clan",
        none: "Keine",
        assignmentDescription:
            "Bearbeite Zuweisungstyp, Gruppe, pausierten Mitgliedsstatus oder entferne den Spieler aus diesem Clan.",
        assignmentMetaDescription:
            "Bearbeite Clan-Mitgliedschaft, Mercenary-Rolle, Gruppe und Pausenstatus.",
        assignmentTitleSuffix: "Zuweisung",
        averageDescription: "Durchschnitt über die letzten {count} Matches.",
        storedAverageDescription:
            "Durchschnitt über {count} importierte Matches.",
        averageKills: "Ø Kills",
        averageKd: "Ø K/D",
        averageDeaths: "Ø Tode",
        averageOffense: "Ø Offense",
        averageDefense: "Ø Defense",
        averageSupport: "Ø Support",
        matchKills: "Kills",
        matchKd: "K/D",
        matchDeaths: "Tode",
        matchOffense: "Offense",
        matchDefense: "Defense",
        matchSupport: "Support",
        matchHistorySearch: "Match-Historie suchen...",
        matchHistoryEvent: "Event",
        matchHistoryPlayedAt: "Gespielt",
        removePlayerFromClan: "Entferne den Spieler aus diesem Clan.",
        removePlayerConfirm:
            "Diesen Spieler aus dem Clan entfernen? Dies löscht seine Zuweisung.",
        saveError: "Spielerzuweisung konnte nicht gespeichert werden.",
        deleteError: "Spielerzuweisung konnte nicht gelöscht werden.",
        assignmentSaved: "Spielerzuweisung gespeichert.",
        assignmentCreated: "Spielerzuweisung erstellt.",
        assignmentDeleted: "Spielerzuweisung gelöscht.",
        primaryGroupRequired: "Wähle vor dem Speichern eine primäre Gruppe.",
        alreadyAssigned: "Dieser Spieler ist diesem Clan bereits zugewiesen.",
        mercenaryRecruitStatusError:
            "Mercenaries können den Rekruten-Status nicht nutzen.",
        reserveMemberRecruitStatusError:
            "Reservemitglieder können den Rekruten-Status nicht nutzen.",
        roleSyncTitle: "So funktioniert Mitglieds-Rollen-Sync",
        roleSyncDescription:
            "Gruppenverknüpfte Discord-Rollen syncen aus den gewählten primären und sekundären Gruppen. Mitgliedsrollen syncen nur für nicht-ausstehende Mitglieder, und Rekruten- oder Aktiv-Status hängt von Clan-Rolle plus verknüpften Mitglieds-Kategorierollen ab, wenn verfügbar. Mitgliedsrollen werden über eine Warteschlange geändert; das Ergebnis steht in den Mitgliedschaftseinstellungen unter Rollenvorgänge.",
        missingClanRoleTitle: "Clan-Rolle ist nicht konfiguriert",
        missingClanRoleDescription:
            "Dieser Spieler kann in Logi weiterhin als Rekrut oder aktiv markiert werden, aber in Discord wird keine Basis-Clan-Rolle hinzugefügt, bis die Clan-Rolle in den Clan-Einstellungen gesetzt ist.",
        missingMembershipCategoryTitle:
            "Diese Zuweisung ist mit keiner Mitglieds-Kategorie verknüpft",
        missingMembershipCategoryDescription:
            "Rekruten- und Final-Kategorierollen können für manuelle Zuweisungen ohne verknüpfte Mitglieds-Bewerbungskategorie nicht gesynct werden. In Discord können nur Clan-Rolle und gruppenverknüpfte Rollen angewendet werden.",
        missingCategoryRolesTitle:
            "Mitglieds-Kategorierollen sind unvollständig",
        missingRecruitRoleDescription:
            "Diese Kategorie hat keine Rekruten-Rolle konfiguriert. ",
        missingFinalRoleDescription:
            "Diese Kategorie hat keine finale Rolle konfiguriert. ",
        missingCategoryRolesSummary:
            "Logi behält den Mitgliedsstatus hier, aber die passende Discord-Rolle wird für diese Stufe nicht hinzugefügt.",
        platformIdsHint:
            "Trenne mehrere IDs mit Kommas. Eine Steam-ID hat 17 Ziffern und beginnt mit 7656119; schreib Xbox- und PlayStation-IDs als xbox:… oder psn:….",
        platformIdsInvalid:
            "Korrigiere die markierten Plattform-IDs vor dem Speichern.",
        platformIssues: {
            steam_format:
                "Keine Steam-ID: Sie muss 17 Ziffern haben und mit 7656119 beginnen.",
            epic_format: "Keine Epic-Games-ID.",
            too_long: "Zu lang für eine Plattform-ID.",
            duplicate: "Doppelt angegeben; wird einmal gespeichert.",
            linked_elsewhere: "Bereits mit {name} verknüpft.",
        },
        grantAdminTitle: "{name} zum Admin machen?",
        grantAdminDescription:
            "{name} kann dann im Logi-Dashboard die Einstellungen, Matches, Roster und Mitglieder dieses Clans ändern. Du kannst den Zugriff später wieder entfernen.",
        removeAdminTitle: "{name} den Admin-Zugriff entziehen?",
        removeAdminDescription:
            "{name} bleibt im Clan, kann ihn aber nicht mehr im Dashboard verwalten, außer eine Discord-Rolle gewährt weiterhin Zugriff.",
        removePlayerTitle: "{name} aus dem Clan entfernen?",
        removePlayerDescription:
            "Zuordnung, Gruppen und Mitgliedsstatus in diesem Clan werden gelöscht, und Logi entfernt die von ihm verwalteten Discord-Rollen. Der Match-Verlauf bleibt.",
    },
    navUser: {
        scoreSuffix: "Score",
    },
    workspace: {
        selectWorkspace: "Clan wählen",
        activeWorkspace: "Aktiver Workspace",
        noWorkspaceSelected: "Kein Clan gewählt",
        searchWorkspace: "Clans suchen…",
        missingWorkspaceHelp:
            "Fehlt ein Clan? Stelle sicher, dass du auf seinem Discord-Server bist oder dort Administratorzugriff hast.",
        allClans: "Alle Clans",
        showAllResults: "Alle anzeigen ({count})",
        allGames: "Alle Spiele",
        gameHeading: "Spiel",
        clanHeading: "Clans",
        clanStats: "Mitglieder {members} · Admins {admins}",
        botMissingBadge: "Bot fehlt",
    },
    languageSwitcher: {
        selectLanguage: "Sprache wählen",
        changeLanguage: "Sprache ändern",
        theme: "Design",
        themeLight: "Hell",
        themeDark: "Dunkel",
        themeSystem: "System",
    },
    calendarPage: {
        title: "Kalender",
        description:
            "Nutze den Kalender, um bevorstehende und vergangene Events zu durchsuchen, dann springe in volle Event-Details oder das veröffentlichte Roster.",
        monthView: "Monatliche Operations-Ansicht",
        moreEvents: "weitere Events",
        allDay: "Ganztägig",
        manualItemAdminHint:
            "Nur Manager sehen das. Ändere den Eintrag unter Clan-Einstellungen → Clan-Profil oder lösche ihn hier.",
        nextUp: "Als Nächstes",
        emptyTitle: "Noch nichts geplant",
        emptyDescription:
            "Matches, Trainings und Kalendereinträge erscheinen hier, sobald sie geplant sind.",
        emptyMonth: "In diesem Monat ist nichts geplant.",
        previousMonth: "Vorheriger Monat",
        nextMonth: "Nächster Monat",
        timezoneHint: "Zeiten in der Zeitzone des Clans ({timezone}).",
        start: "Beginn",
        end: "Ende",
        category: "Kategorie",
        meetingPlace: "Treffpunkt",
        openVoiceChannel: "Sprachkanal in Discord",
        toBeDecided: "Folgt noch",
        deleteItem: "Eintrag löschen",
        deleteItemTitle: "„{title}“ löschen?",
        deleteItemDescription:
            "Der Eintrag verschwindet für alle aus dem Kalender und dem Kalender-Abo. Das lässt sich nicht rückgängig machen.",
        deleteRecurringNote:
            "Alle Wiederholungen dieses Eintrags werden ebenfalls gelöscht.",
        itemDeleted: "Kalendereintrag gelöscht.",
        itemDeleteFailed:
            "Der Kalendereintrag konnte nicht gelöscht werden. Versuch es noch einmal.",
        itemCreated: "Kalendereintrag hinzugefügt.",
        itemCreateFailed:
            "Der Kalendereintrag konnte nicht gespeichert werden. Versuch es noch einmal.",
        titleRequired: "Gib einen Titel ein.",
        startRequired: "Wähle den Beginn.",
        endRequired: "Wähle das Ende.",
        endBeforeStart: "Das Ende muss nach dem Beginn liegen.",
    },
    settingsHub: {
        title: "Clan-Einstellungen",
        description:
            "Alles, was Logi über euren Clan wissen muss, nach Themen geordnet. Öffne eine Karte, um etwas zu ändern.",
        setupTitle: "Ersteinrichtung",
        setupProgress: "{done} von {total} Pflichteinstellungen erledigt",
        setupNext: "Nächster Schritt: {item}",
        setupDone:
            "Die Pflichteinstellungen sind erledigt. Optionale Funktionen lassen sich jederzeit einschalten.",
        continueSetup: "Weiter",
        backToOverview: "Alle Einstellungen",
        sectionNavLabel: "Bereiche der Einstellungen",
        menu: "Bereiche",
        breadcrumbLabel: "Brotkrumen-Navigation",
        channelsPage: {
            missingAnnouncements: "Der Ankündigungskanal fehlt.",
            missingAnnouncementsHelp:
                "Ohne ihn kündigt der Bot keine neuen Events an.",
            languageTitle: "Sprache und Zeit",
            textTitle: "Textkanäle",
            voiceTitle: "Sprachkanäle",
            timezone: "Zeitzone",
            timezoneHelp: "Danach schreibt der Bot die Zeiten der Events.",
            language: "Sprache des Bots",
            languageHelp: "Nachrichten, Embeds und Antworten auf Befehle.",
            announcements: "Ankündigungen",
            required: "Pflicht",
            announcementsHelp: "Neue Events und Änderungen an Aufstellungen.",
            eventInfo: "Event-Informationen",
            eventInfoHelp: "Details und Anmeldungen zum Event.",
            calendar: "Kalender",
            calendarHelp: "Überblick über kommende Events.",
            errors: "Bot-Fehler",
            errorsHelp: "Nur für Admins. Optional.",
            forum: "Kategorie für Event-Foren",
            forumHelp: "Wo der Bot Threads zu Events anlegt.",
            squadVoice: "Kategorie für Squad-Sprachkanäle",
            squadVoiceHelp:
                "Jedes Match bekommt für seine Squad-Kanäle eine eigene Kategorie direkt unter dieser, mit denselben Berechtigungen.",
            meeting: "Treffpunkt-Kanal",
            meetingHelp: "Wo sich die Spieler vor einem Event treffen.",
            addChannelException: "Anderer Kanal für ein Spiel",
            addCategoryException: "Andere Kategorie für ein Spiel",
            selectChannel: "Kanal wählen",
            selectCategory: "Kategorie wählen",
            none: "Keiner",
        },
        scopeLegend: {
            clanWide: "Ganzer Clan: ein Wert für alle Spiele",
            exception: "Ausnahme nur für ein Spiel",
            clanWideShort: "Ganzer Clan",
        },
        overview: {
            title: "Einstellungen",
            description:
                "Clan, Discord, Spieldaten und verbundene Websites an einem Ort.",
            searchLabel: "Einstellungen durchsuchen",
            searchPlaceholder: "Suchen: Kanal, Rolle, API-Schlüssel…",
            noResults: "Nichts gefunden",
            noResultsDescription:
                "Versuch ein anderes Wort, zum Beispiel Kanal, Rolle oder Schlüssel.",
            groupHints: {
                clan: "Gilt für alle Spiele",
                matches: "Vorgaben für neue Matches und ihre Nachrichten",
                discord: "Bot, Kanäle, Rollen und Panels",
                gameData: "Server, von denen Logi Ergebnisse sammelt",
                web: "Optional: Clan-Website, Anmeldung und weitere Dienste",
                maintenance: "Einmalige Werkzeuge",
            },
            badges: {
                done: "Erledigt",
                notSet: "Nicht eingestellt",
                on: "An",
                off: "Aus",
                collecting: {
                    one: "{count} sammelt",
                    few: "{count} sammeln",
                    many: "{count} sammeln",
                    other: "{count} sammeln",
                },
                failing: {
                    one: "{count} mit Fehler",
                    few: "{count} mit Fehler",
                    many: "{count} mit Fehler",
                    other: "{count} mit Fehler",
                },
                missingChannels: {
                    one: "{count} Kanal fehlt",
                    few: "{count} Kanäle fehlen",
                    many: "{count} Kanäle fehlen",
                    other: "{count} Kanäle fehlen",
                },
                gamesOn: {
                    one: "{count} aktiv",
                    few: "{count} aktiv",
                    many: "{count} aktiv",
                    other: "{count} aktiv",
                },
                templates: {
                    one: "{count} Vorlage",
                    few: "{count} Vorlagen",
                    many: "{count} Vorlagen",
                    other: "{count} Vorlagen",
                },
            },
            tiles: {
                profile: {
                    title: "Clan-Profil",
                    description: "Name, Logo und Beschreibung des Clans.",
                },
                games: {
                    title: "Spiele",
                    description:
                        "Welche Spiele der Clan spielt. Danach bietet Logi weitere Optionen an.",
                },
                "event-categories": {
                    title: "Event-Kategorien",
                    description:
                        "Farben und Emoji für die Event-Arten im Kalender.",
                },
                "match-templates": {
                    title: "Match-Vorlagen",
                    description:
                        "Standardzeiten, Anmeldungen, Ping und Aufstellung für ein neues Match.",
                },
                presets: {
                    title: "Squad- und Themenvorlagen",
                    description:
                        "Squad- und Rollenaufteilung für Aufstellungen, Themen für das Match-Forum.",
                },
                messages: {
                    title: "Nachrichten und Panels",
                    description:
                        "Wie Bot-Nachrichten aussehen, was der Bot sendet und eine Übersicht der Panels.",
                },
                channels: {
                    title: "Kanäle und Sprache",
                    description:
                        "Wohin der Bot Ankündigungen, Events und Fehler schickt. Zeitzone und Sprache.",
                },
                "discord-panels": {
                    title: "Panels in Discord",
                    description:
                        "Live-Server, Ergebnisse, Liga und Kalender, die der Bot aktuell hält.",
                },
                "panel-graphics": {
                    title: "Panel-Grafik",
                    description:
                        "Stil der Server-Panels, Server-Banner und Kartenbilder.",
                },
                "discord-seed": {
                    title: "Server-Seeding",
                    description:
                        "Seed-Aufruf, Rolle Seed, Zeitplan und Seed-Verlauf.",
                },
                roles: {
                    title: "Rollen und Zugriff",
                    description:
                        "Die Clan-Rolle und die Rolle, die Logi verwalten darf.",
                },
                commands: {
                    title: "Befehle",
                    description:
                        "Welche Befehle der Bot anbietet, wer sie nutzen darf und wo.",
                },
                membership: {
                    title: "Mitgliedschaft",
                    description:
                        "Rollen für Rekruten und Mitglieder, Regeln für den Aufstellungs-Score.",
                },
                tickets: {
                    title: "Tickets",
                    description: "Ticket-Panel, Kategorien und Kanäle.",
                },
                "game-servers": {
                    title: "Spielserver",
                    description:
                        "CRCON- und Warcon-Server, ihre API-Schlüssel und die Datensammlung.",
                },
                history: {
                    title: "Verlauf aufbewahren",
                    description: "Wie lange Logi gespielte Runden behält.",
                },
                league: {
                    title: "Wardogs League",
                    description:
                        "Liga-Matches verfolgen und Karten in Discord. Nur für Wardogs.",
                },
                apiKeys: {
                    title: "API-Schlüssel",
                    description:
                        "Schlüssel für die Clan-Website und andere Apps.",
                },
                login: {
                    title: "Anmeldung auf der Website",
                    description:
                        "Eigene Anmeldeseite und Single-Sign-on-Anwendungen (SSO).",
                },
                webAccess: {
                    title: "Website-Berechtigungen",
                    description:
                        "Für welche Rollen die Website Mitgliedschaften lesen und Events anlegen darf. Baut auf API-Schlüssel und SSO auf.",
                },
                calendar: {
                    title: "Google Kalender",
                    description: "Ein Abo-Link für den Clan-Kalender.",
                },
                webhooks: {
                    title: "Webhooks",
                    description:
                        "Benachrichtigungen für andere Dienste, wenn sich in Logi etwas ändert.",
                },
                imports: {
                    title: "Importe und Datenkorrekturen",
                    description:
                        "Massenimport von Events, Spielern und Platform-IDs, Neuberechnung der Statistiken.",
                },
                "helper-data": {
                    title: "Hilfsdaten",
                    description: "Standardvorlagen und ihre Wiederherstellung.",
                },
            },
            setup: {
                title: "Einrichtung des Bereichs",
                description:
                    "Schließ die Pflichtschritte ab, damit der Bot Events ankündigen und den Zugriff prüfen kann.",
                progress: "{done} von {total} erledigt",
                progressLabel: "Fortschritt der Einrichtung",
                continue: "Einrichtung fortsetzen",
                continueHelp: "Öffnet den ersten offenen Schritt.",
                optional: "optional",
                fix: "Ergänzen",
                setUp: "Einrichten",
                steps: {
                    bot: {
                        title: "Bot auf Discord",
                        done: "Der Bot ist auf dem Server und sieht die Kanäle.",
                        missing: "Der Bot ist noch nicht auf dem Server.",
                    },
                    games: {
                        title: "Spiele",
                        missing: "Wähle, was der Clan spielt",
                    },
                    profile: {
                        title: "Clan-Profil",
                        detail: "Name, Logo und Beschreibung",
                    },
                    channels: {
                        title: "Kanäle",
                        done: "Der Ankündigungskanal ist gewählt",
                        missing: "Der Ankündigungskanal fehlt",
                    },
                    roles: {
                        title: "Rollen und Zugriff",
                        detail: "Wer Logi verwalten darf",
                    },
                    gameServers: {
                        title: "Spielserver",
                        done: {
                            one: "{count} Server sammelt Daten",
                            few: "{count} Server sammeln Daten",
                            many: "{count} Server sammeln Daten",
                            other: "{count} Server sammeln Daten",
                        },
                        missing: "Ergebnisse und Statistiken vom Server",
                    },
                },
            },
        },
        openSection: "Öffnen",
        gameExceptionsNote:
            "Diese Einstellungen gelten für den ganzen Clan. Braucht ein Spiel einen anderen Kanal, füge unter der Einstellung eine Ausnahme für dieses Spiel hinzu.",
        gameExceptionAdd: "Für ein Spiel abweichend",
        gameExceptionRemove: "Ausnahme für {game} entfernen",
        gameExceptionPlaceholder: "Für {game} wählen",
        statsServersPerGame: "Server für ein einzelnes Spiel",
        statsServersPerGameHelp:
            "Jedes Spiel liest die Server oben, außer es hat hier eine eigene Liste.",
        clanWideOnly: "Diese Einstellungen gelten für den ganzen Clan.",
        resyncHelp:
            "Ein Superadministrator kann den Dashboard-Zugriff anhand der aktuellen Mitglieder der Dashboard-Rolle neu laden.",
        saved: "Einstellungen gespeichert.",
        groups: {
            clan: "Clan",
            matches: "Matches",
            discord: "Discord",
            gameData: "Spieldaten",
            web: "Website und Integrationen",
            maintenance: "Wartung",
        },
        status: {
            ready: "Eingerichtet",
            attention: "Fehlt noch",
            off: "Aus",
        },
        requirements: {
            enabledGames: "Wähle die Spiele, die euer Clan spielt",
            announcements: "Wähle den Ankündigungskanal",
            clanRole: "Wähle die Clan-Rolle",
        },
        channelPicker: {
            search: "Kanäle suchen",
            searchPlaceholder: "Name oder ID suchen",
            channelId: "Kanal-ID",
            pasteId: "Kanal-ID einfügen",
            showList: "Liste",
            enterId: "ID",
            checkAccess: "Zugriff prüfen",
            noCategory: "Ohne Kategorie",
            unsupportedType: "nicht unterstützter Typ",
            manualHelp: "Nutze eine Kanal-ID von diesem Discord-Server.",
        },
        saveBar: {
            none: "Keine ungespeicherten Änderungen",
            changes: {
                one: "{count} ungespeicherte Änderung",
                few: "{count} ungespeicherte Änderungen",
                many: "{count} ungespeicherte Änderungen",
                other: "{count} ungespeicherte Änderungen",
            },
            discard: "Verwerfen",
            save: "Speichern",
        },
        rolesPage: {
            membersTitle: "Clanmitglieder",
            clanRole: "Clanrolle",
            clanRoleHelp:
                "Alle Mitglieder haben sie. Logi vergibt und entzieht sie je nach Mitgliedschaft.",
            adminsTitle: "Logi-Verwaltung",
            adminRole: "Verwaltungsrolle",
            notSet: "nicht festgelegt",
            adminRoleHelp:
                "Personen mit dieser Rolle können Einstellungen, Matches und Aufstellungen ändern.",
            chooseRole: "Rolle auswählen",
            noRole: "Keine Rolle",
            noResults: "Keine passende Rolle.",
            rolesUnavailable:
                "Die Discord-Rollen konnten nicht geladen werden. Deine Einstellungen sind unverändert; lade die Seite neu, um es erneut zu versuchen.",
            resyncHelp:
                "Wenn sich Rollen geändert haben und Logi es noch nicht weiß.",
            resyncNeedsRole:
                "Wähle und speichere zuerst eine Verwaltungsrolle.",
            resync: "Aus Discord neu laden",
            resynced: "Verwaltungszugriff aus Discord neu geladen.",
            resyncError:
                "Der Verwaltungszugriff konnte nicht neu geladen werden.",
            holders: {
                one: "{count} Person hat diese Rolle",
                few: "{count} Personen haben diese Rolle",
                many: "{count} Personen haben diese Rolle",
                other: "{count} Personen haben diese Rolle",
            },
            accessNow: "Wer gerade Zugriff hat",
            updated: "aktualisiert {time}",
            accessUnavailable:
                "Die Zugriffsübersicht konnte gerade nicht geladen werden. Du kannst die Rollen trotzdem ändern.",
            noManagers:
                "Noch niemand. Speichere eine Verwalterrolle oder gib jemandem in Discord die Administrator-Berechtigung.",
            reasonAdministrator: "Administrator-Berechtigung",
            reasonRole: "Rolle {role}",
            reasonManagerRole: "Verwalterrolle",
            reasonGranted: "in Logi hinzugefügt",
            unknownMember: "Mitglied ohne Logi-Konto",
            moreManagers: "und {count} weitere",
        },
        commandsPage: {
            title: "Befehle in Discord",
            description:
                "Welche Befehle der Bot anbietet, wer sie nutzen darf und wo. Er antwortet in der Clan-Sprache.",
            registration: {
                title: "Registrierung der Befehle",
                phoneTitle: "Befehle sind registriert",
                registered:
                    "Registriert {when} · {count} auf dem Server {server}. Nach dem Speichern registriert der Bot sie selbst erneut; Discord zeigt sie innerhalb einer Minute.",
                registeredShort: "{when} · {count}",
                count: { one: "{count} Befehl", other: "{count} Befehle" },
                today: "heute um {time}",
                yesterday: "gestern um {time}",
                neverTitle: "Befehle sind noch nicht registriert",
                never: "Der Bot registriert sie, sobald er läuft und diesen Server sieht. Nach dem Speichern registriert er sie selbst erneut.",
                pending:
                    "Der Bot registriert die Befehle innerhalb einer Minute erneut.",
                failedTitle: "Registrierung der Befehle fehlgeschlagen",
                failed: "{reason} Prüfen Sie, dass der Bot auf dem Server ist und Befehle verwalten darf, und versuchen Sie es erneut.",
                failures: {
                    forbidden:
                        "Discord hat dem Bot die Registrierung nicht erlaubt.",
                    rate_limited:
                        "Discord hat Anfragen vorübergehend begrenzt.",
                    unavailable: "Discord hat nicht geantwortet.",
                },
                reregister: "Erneut registrieren",
                requested:
                    "Der Bot registriert die Befehle innerhalb einer Minute erneut.",
                requestFailed: "Die Anfrage konnte nicht gesendet werden.",
            },
            legacy: {
                title: "Alte Stats-Server-Verbindungen · {count}",
                help: "Weder /link noch die Clan-Bewerbung oder /stats nutzt sie: Die Spielersuche liest die gespeicherten Spiele der Clan-Server. Nach dem Übertragen zu den Spielservern wird der Schlüssel verschlüsselt gespeichert und kann getestet werden.",
                convert: "Zu Spielservern übertragen",
                show: "Verbindungen anzeigen",
                hide: "Verbindungen ausblenden",
                converted:
                    "Übertragen: {converted}. Testen Sie sie unter Spielserver; danach können Sie die alten Verbindungen entfernen.",
                nothingToConvert:
                    "Alle Verbindungen sind schon bei den Spielservern oder lassen sich nicht übertragen.",
                skipped:
                    "Nicht übertragen: {count} (kein https, kein Schlüssel oder ein anderes Spiel).",
                encryptionUnavailable:
                    "Die Schlüsselverschlüsselung ist gerade nicht verfügbar; nichts wurde übertragen.",
                failed: "Das Übertragen ist fehlgeschlagen.",
            },
            commands: {
                title: "Befehle",
                intro: "Logi prüft die Berechtigung bei jeder Nutzung, frisch aus Discord. Das Menü nach „/“ ist für alle gleich; wer einen Befehl nicht nutzen darf, bekommt eine kurze Erklärung und /help bietet ihn nicht an.",
                members: "Für Mitglieder",
                staff: "Für Verwalter",
                new: "Neu",
                on: "An",
                off: "Aus",
                who: "Wer darf ihn nutzen",
                reply: "Antwort",
                where: "Wo er funktioniert",
                audiences: {
                    everyone: {
                        label: "Alle auf dem Server",
                        description: "Jedes Mitglied des Discord-Servers",
                    },
                    clanMembers: {
                        label: "Clan-Mitglieder",
                        description:
                            "Mit der Clan-Rolle aus Rollen und Zugriff",
                    },
                    logiAdmins: {
                        label: "Logi-Verwalter",
                        description: "Administrator oder die Verwalterrolle",
                    },
                },
                rolesHint: "Zusätzlich können Sie bestimmte Rollen hinzufügen.",
                audienceWithRoles: "{group} und zusätzlich die Rolle {roles}.",
                addRole: "Rolle",
                addRoleAria: "Rolle zu {command} hinzufügen",
                removeRole: "Rolle {role} entfernen",
                searchRoles: "Rolle suchen",
                noRoles: "Keine weitere Rolle",
                replies: {
                    private: "Nur der Autor",
                    privateShare: "Nur der Autor, mit Teilen-Button",
                },
                fixedWho: {
                    help: "Alle auf dem Server · jeder sieht nur seine Befehle",
                    link: "Alle auf dem Server · auch Bewerber brauchen ihn",
                    notice: "Angemeldet für ein Event, das noch nicht begonnen hat",
                },
                allChannels: "Alle Kanäle",
                someChannels: "Nur ausgewählte Kanäle",
                addChannel: "Kanal",
                addChannelAria: "Kanal zu {command} hinzufügen",
                removeChannel: "Kanal {channel} entfernen",
                searchChannels: "Kanal suchen",
                noChannels: "Kein weiterer Kanal",
                channelsHint:
                    "Anderswo sagt der Bot, wo der Befehl funktioniert.",
                playerShareHint:
                    "Teilen sendet das Profil in den Kanal, in dem der Befehl genutzt wurde.",
                whoLabel: "Wer {command} nutzen darf",
                replyLabel: "Antwort von {command}",
                whereLabel: "Wo {command} funktioniert",
                closeTicket: {
                    toggle: "folgt Tickets",
                    who: "Kategorie-Support oder Logi-Verwalter",
                    whoLink: "Tickets",
                    reply: "Bestätigung an den Autor des Befehls, Zusammenfassung im Thread, DM an den Ticket-Autor",
                    where: "Nur in Ticket-Threads",
                },
                closeApplication: {
                    toggle: "folgt Mitgliedschaft",
                    who: "Kategorie-Support oder Logi-Verwalter",
                    whoLink: "Mitgliedschaft",
                    reply: "Bestätigung an den Autor des Befehls, Entscheidung im Thread, DM an den Bewerber",
                    where: "Nur in Bewerbungs-Threads",
                },
            },
            stats: {
                gamesTitle: "Spiele und Datenquelle",
                gameSwitch: "{game}-Statistiken",
                hllSource:
                    "Aus öffentlichen HLL-Records-Profilen, über das Steam-Konto des Spielers.",
                wardogsSource: "Aus gespeicherten Spielen Ihrer",
                gameServersLink: "Spielserver",
                shareChannel: "Kanal für Teilen",
                shareChannelHelp:
                    "Teilen sendet die Karte direkt hierher. Ohne Kanal fragt der Bot den Spieler, wohin.",
                noShareChannel: "Kein Kanal",
                previewTitle: "Antwortvorschau · Beispieldaten",
                previewPlayer: "Spieler 17",
            },
            descriptions: {
                title: "Befehlsbeschreibungen in Discord",
                intro: "Discord zeigt die Beschreibung allen Mitgliedern in der Clan-Sprache, unabhängig von der Sprache ihrer App. Die Clan-Sprache ist {language}; nach einer Änderung unter {channels} registriert der Bot die Befehle erneut. Den Zusatz „(für Verwalter)“ fügt der Bot nur Befehlen hinzu, die nur Logi-Verwalter nutzen dürfen.",
                channelsLink: "Kanäle und Sprache",
                languages: { cs: "Tschechisch", en: "Englisch", de: "Deutsch" },
                command: "Befehl",
                clanLanguage: "Clan-Sprache",
                columns: { cs: "Čeština", en: "English", de: "Deutsch" },
            },
            saveNote:
                "Nach dem Speichern registriert der Bot die Befehle erneut.",
            saved: "Befehlseinstellungen gespeichert. Der Bot registriert die Befehle erneut.",
            saveError:
                "Die Befehlseinstellungen konnten nicht gespeichert werden.",
        },
        messagesPage: {
            title: "Nachrichten und Panels in Discord",
            description:
                "Alles, was der Bot sendet: wohin, ob überhaupt und wie es aussieht. Er schreibt in der Clansprache und mit der Clanfarbe.",
            lookTitle: "Aussehen aller Nachrichten",
            lookIntro:
                "Gilt für Ankündigungen, Panels, DMs und Befehlsantworten. Bot-Fehler für Admins haben einen grauen Balken.",
            clanColor: "Clanfarbe",
            clanColorHelp:
                "Der Balken jeder Nachricht. Ein Panel kann im Panel-Editor eine eigene Farbe haben.",
            clanColorPicker: "Farbe wählen",
            clanColorInvalid: "Geben Sie die Farbe als #E8A33D ein.",
            clanColorDefault:
                "Die Standardfarbe von Logi. Eine Eventkategorie erscheint als Label und ändert den Balken nicht.",
            clanColorCustom:
                "Eine Eventkategorie erscheint als Label und ändert den Balken nicht.",
            icons: "Icons in Nachrichten",
            iconsHelp: "In allen Nachrichten, nicht nur in Ankündigungen.",
            iconsSparse: "Sparsam",
            iconsRich: "Emoji in jeder Zeile",
            factions: "Fraktionszeichen",
            factionsHelp:
                "Gleich in Ankündigungen, Ergebnissen, Panels und /stats.",
            factionNames: {
                allies: "Alliierte",
                axis: "Achse",
                valkyra: "Valkyra",
                manticore: "Manticore",
                lonestar: "Lonestar",
            },
            factionsDefault: "Standardzeichen von Logi",
            factionsChange: "Zeichen ändern",
            language: "Sprache",
            languages: { en: "Englisch", cs: "Tschechisch", de: "Deutsch" },
            languageFrom: "Aus",
            languageLink: "Kanäle und Sprache",
            languageScope:
                "Alle Nachrichten und Befehlsantworten, unabhängig von der App-Sprache des Mitglieds.",
            livePreview: "Live-Vorschau",
            livePreviewLabel: "Live-Vorschau des Aussehens",
            livePreviewSparse:
                "Eine Match-Ankündigung mit sparsamen Icons. Sie ändert sich mit Farbe und Icons links.",
            livePreviewRich:
                "Eine Match-Ankündigung mit Emoji in jeder Zeile. Sie ändert sich mit Farbe und Icons links.",
            previewTime: "heute um 18:02",
            listTitle: "Was der Bot sendet",
            listIntro:
                "Jeder Kanal wird an genau einer Stelle bearbeitet. Ein Kanal mit Schloss gehört zu einer anderen Seite, der Link führt Sie dorthin. Einen Kanal mit Auswahl bearbeiten Sie direkt hier.",
            groups: {
                matches: "Matches",
                direct: "Private Nachrichten",
                directNote: "DMs und Antworten, die nur eine Person sieht",
                panels: "Panels",
                membership: "Mitgliedschaft und Tickets",
                system: "System",
            },
            preview: "Vorschau",
            close: "Schließen",
            edit: "Bearbeiten",
            fromPage: "aus",
            newChip: "Neu",
            previewRegion: "Vorschau von {message}",
            channelUnknown: "festgelegter Kanal",
            notSet: "nicht festgelegt",
            category: "Kategorie {name}",
            threadsUnder: "Threads unter {channel}",
            pages: {
                channels: "Kanäle und Sprache",
                matchTemplates: "Match-Vorlagen",
                commands: "Befehle",
                membership: "Mitgliedschaft",
                tickets: "Tickets",
                panels: "Panels in Discord",
                league: "Wardogs League",
            },
            rows: {
                announcement: {
                    title: "Match-Ankündigung",
                    detail: "Neues Match oder Training · Anmeldungen und Rollen-Ping laut Vorlage",
                },
                roster: {
                    title: "Kader",
                    detail: "Das Kaderfoto unter dem Kopf mit Einteilung anzeigen und Kader öffnen · Einteilung und Passwort sieht nur der Spieler",
                    variantLabel: "Standardansicht",
                    variants: {
                        photo_text: "Foto und Text",
                        photo: "Nur Foto",
                    },
                    variantNote:
                        "Beim Veröffentlichen änderbar. Sonst: {other}.",
                },
                rosterChanges: {
                    title: "Kaderänderungen",
                    detail: "Beim nächsten Veröffentlichen · Standardwahl im Dialog Veröffentlichen",
                    target: "in den Kaderkanal",
                    switchLabel: "Kaderänderungen vorauswählen",
                },
                forum: {
                    title: "Match-Forum",
                    detail: "Ein Thread mit Informationen und Briefing-Themen · von der Match-Vorlage eingeschaltet",
                },
                debrief: {
                    title: "Debrief im Forum",
                    detail: "Nach dem Match in den Forumthread",
                    target: "Thread im Match-Forum",
                    switchLabel: "Debrief im Forum",
                },
                notices: {
                    title: "Abwesenheiten und Verspätungen im Match-Thread",
                    detail: "Nach /notice, Komme später und Kann nicht: wer, verspätet oder abwesend und die Ankunftszeit · den Grund sieht nur die Führung im Web",
                    target: "Thread im Match-Forum",
                    switchLabel:
                        "Abwesenheiten und Verspätungen im Match-Thread",
                },
                scheduledEvent: {
                    title: "Discord-Event",
                    detail: "Ein geplantes Server-Event mit Treffpunkt und Link zum Match",
                    switchLabel: "Discord-Event",
                },
                squadRoles: {
                    title: "Squad-Rollen und Sprachkanäle",
                    detail: "Rollen Teilnehmer und Reserve für jedes Match, Squad-Kanäle laut Kader · von der Vorlage eingeschaltet",
                },
                signupReminder: {
                    title: "Anmeldeerinnerung",
                    detail: "An alle ohne Antwort · täglich bis Anmeldeschluss · an wen: laut Vorlage",
                    target: "DM an Mitglieder",
                },
                attendanceReminder: {
                    title: "Anwesenheitserinnerung",
                    detail: "An Spieler im Kader ohne Bestätigung · wie viele Stunden vorher, legt das Match fest",
                    target: "DM an Spieler",
                },
                recap: {
                    title: "Match-Zusammenfassung",
                    detail: "Eigene Statistiken nach einem bestätigten Match · der Spieler kann sie abschalten",
                    target: "DM an Spieler",
                    switchLabel: "Match-Zusammenfassung",
                    previewTitle:
                        "Vorschau · DM an einen Spieler nach dem Match · Beispieldaten",
                    whoTitle: "Wer sie bekommt",
                    who: "Spieler im Kader, deren Logi-Konto mit den Match-Statistiken verknüpft ist.",
                    whoOff: "Ein Spieler schaltet die Zusammenfassung mit dem Button in der Nachricht oder unter {link} ab.",
                    whoLink: "Mein Konto → Bot-Nachrichten per DM",
                },
                trainingResult: {
                    title: "Trainingsergebnis",
                    detail: "An die Teilnehmer nach Abschluss des Trainings",
                    target: "DM an Teilnehmer",
                    switchLabel: "Trainingsergebnis",
                },
                rosterChangeDm: {
                    title: "Änderung der Einteilung",
                    detail: "An Spieler, deren Squad oder Rolle sich geändert hat · Standardwahl im Dialog Veröffentlichen",
                    target: "DM an Spieler",
                    switchLabel: "Änderungen der Einteilung vorauswählen",
                },
                teamRequest: {
                    title: "Teamanfrage",
                    detail: "Die Entscheidung der globalen Logi-Administratoren: genehmigt, zusammengeführt oder abgelehnt",
                    target: "DM an den Antragsteller",
                },
                buttonReplies: {
                    title: "Antworten auf Buttons",
                    detail: "Anmelden, Anmeldung ändern, Einteilung anzeigen, Komme später, Kann nicht · nur wer geklickt hat, sieht sie",
                    target: "private Antwort",
                },
                commandReplies: {
                    title: "Befehlsantworten",
                    detail: "/help, /stats, /player, /link, /notice, /server-status · /stats teilt in #statistiky, /player dort, wo der Befehl kam",
                },
                recruitmentPanel: {
                    title: "Recruiting-Panel",
                    detail: "Der Button Bewerbung abschicken",
                },
                application: {
                    title: "Clan-Bewerbung",
                    detail: "Der Assistent für Bewerber und ein privater Thread mit dem Recruiting",
                },
                applicationClose: {
                    title: "Bewerbung abgeschlossen",
                    detail: "Eine Ergebniskarte im Thread · eine DM an den Bewerber mit Ergebnis und Grund",
                    target: "Thread und DM an den Bewerber",
                    switchLabel:
                        "DM an den Bewerber nach Abschluss der Bewerbung",
                },
                ticketPanel: {
                    title: "Ticket-Panel",
                    detail: "Die Buttons der Ticketkategorien",
                },
                ticket: {
                    title: "Ticket",
                    detail: "Ein Formular und ein privater Thread mit dem Support",
                },
                ticketClose: {
                    title: "Ticket geschlossen",
                    detail: "Eine Karte im Thread · eine DM an den Autor mit dem Grund",
                    target: "Thread und DM an den Autor",
                    switchLabel:
                        "DM an den Autor nach dem Schließen des Tickets",
                },
                playerReport: {
                    title: "Spielermeldung",
                    detail: "Vom Button im Live-Score · ein privater Thread für Admins",
                },
                errors: {
                    title: "Bot-Fehler",
                    detail: "Was der Bot nicht tun konnte und wie man es behebt · nur für Admins · grauer Balken",
                    selectLabel: "Kanal für Bot-Fehler",
                    noChannel: "Kein Kanal",
                },
            },
            panels: {
                intro: "Alle Panels verwalten Sie auf der Seite {link}. Hier ist nur die Übersicht.",
                add: "Panel hinzufügen",
                liveDetail: "Live-Server · wird alle {seconds} s aktualisiert",
                liveButtons: "Buttons {buttons}",
                buttonNames: {
                    join: "Beitreten",
                    players: "Spieler anzeigen",
                    report: "Spieler melden",
                },
                and: "und",
                privateDetail:
                    "Live-Server in einem privaten Kanal · zeigt auch das Serverpasswort",
                combinedTitle: "Unsere Server",
                combinedDetail: "{servers} in einer Nachricht",
                controlTitle: "Serversteuerung",
                controlDetail:
                    "Seed, Aktualisieren und Pausieren · nur Logi-Admins",
                resultsTitle: "Ergebnisse {game}",
                resultsDetail:
                    "Nach der Bestätigung des Ergebnisses in Logi · sendet beim Erstellen die letzten 5 bestätigten",
                leagueTitle: "WD League",
                leagueDetail:
                    "Zwei Nachrichten untereinander: Tabelle und nächste Matches der ganzen Liga · alle 60 s aktualisiert",
                calendarTitle: "Kalender",
                calendarDetail:
                    "Kommende Events des Clans, Kategorien {categories}",
                calendarAll: "alle",
                competitionTitle: "Wettbewerbstabelle",
                competitionDetail:
                    "Gruppentabelle des Wettbewerbs {name} · nach jedem bestätigten Ergebnis",
                competitionDetailAny:
                    "Gruppentabelle des Wettbewerbs · nach jedem bestätigten Ergebnis",
                pausedBy: "pausiert von {name}",
                chips: {
                    error: "Fehler",
                    waiting: "Wartet auf den Bot",
                    unsent: "Nicht gesendet",
                    paused: "Pausiert",
                },
                switchLabel: "Panel {name}",
                controlSwitch: "Serversteuerung",
                leagueSwitch: "Panels WD League",
                calendarSwitch: "Panel Kalender",
                calendarHint:
                    "Der Kalenderkanal wird unter Panels in Discord festgelegt.",
                errorFallback: "Das letzte Senden ist fehlgeschlagen.",
                loading: "Panels werden geladen…",
                unavailable: "Die Panels konnten nicht geladen werden.",
                none: "Noch kein Panel.",
                editorTitle: "Panels",
            },
        },
        panelsForm: {
            regionLabel: "Öffentliche Discord-Panels",
            title: "Öffentliche Panels",
            refresh: "Kanäle und Status aktualisieren",
            intro: "Ein kompaktes Panel pro Quelle. Ein separates Scoreboard nur in einem anderen Kanal. Ergebnisse werden erst nach der Prüfung in Logi veröffentlicht; frühere Ergebnisse werden nicht nachgereicht.",
            kind: "Funktion",
            kinds: {
                server: "Server und Ergebnis",
                scoreboard: "Separates Scoreboard",
                results: "Bestätigte Ergebnisse",
            },
            source: "Datenquelle",
            selectSource: "Quelle auswählen",
            destination: "Zielkanal",
            reportCategory: "Spieler melden · private Ticket-Kategorie",
            reportOff: "Aus",
            reportHelp:
                "Kanal und Verwaltungsrollen legst du unter Tickets fest. Der Bot prüft Privatsphäre und Zugriff, bevor eine Meldung gesendet wird.",
            enabled: "An",
            showPlayers: "Private Spielerdetails (Warcon / CRCON)",
            showLeaders: "Öffentliche Top-Spieler (Namen und Statistiken)",
            refreshRate: "Aktualisierung",
            save: "Panel speichern und aktualisieren",
            verify: "Kanal prüfen",
            loadError:
                "Die Panels konnten nicht geladen werden. Prüfe den Zugriff des Bots und die Datenquellen.",
            invalid: "Wähle eine Quelle und einen gültigen Kanal.",
            verified: "Der Bot hat die nötigen Berechtigungen.",
            saved: "Gespeichert. Der Bot übernimmt die Änderung innerhalb von 15 Sekunden; ein Umzug wartet, bis die ursprüngliche Nachricht entfernt ist.",
            requestFailed: "Die Anfrage ist fehlgeschlagen.",
            previewTitle: "Datenvorschau des Panels",
            panelOn: "an",
            panelPaused: "pausiert",
            message: "Nachricht",
            awaitingBot: "Wartet auf den Bot",
            pendingReconciliation: "wartet auf Abgleich",
        },
        presetLinks: {
            squadPresets: "Trupp-Vorlagen",
            topicPresets: "Themen-Vorlagen",
        },
        sections: {
            profile: {
                title: "Clan-Profil",
                description: "Name, Logo und Beschreibung des Clans.",
            },
            games: {
                title: "Spiele",
                description: "Welche Spiele der Clan spielt.",
            },
            "event-categories": {
                title: "Event-Kategorien",
                description:
                    "Bezeichnungen und Farben für Matches und Trainings, etwa Freundschaftsspiel oder Liga.",
            },
            "match-templates": {
                title: "Match-Vorlagen",
                description:
                    "Was beim Anlegen eines neuen Matches vorausgefüllt wird. Im Match selbst kannst du es noch ändern.",
            },
            presets: {
                title: "Squad- und Themen-Presets",
                description:
                    "Aufstellungsformen und Briefing-Themen, die Matches übernehmen.",
            },
            messages: {
                title: "Nachrichten und Panels",
                description:
                    "Alles, was der Bot sendet: wohin, ob überhaupt und wie es aussieht. Er schreibt in der Clansprache und mit der Clanfarbe.",
            },
            channels: {
                title: "Kanäle und Sprache",
                description:
                    "Wohin der Bot Nachrichten schickt und in welcher Sprache er schreibt.",
            },
            "discord-panels": {
                title: "Panels in Discord",
                description:
                    "Nachrichten, die der Bot aktuell hält: Live-Server, Ergebnisse, die Liga, der Kalender und die Steuerung für Admins. Sie werden alle 60 s aktualisiert.",
            },
            "panel-graphics": {
                title: "Panel-Grafik",
                description:
                    "Wie Server-Panels in Discord aussehen: Stil, Server-Banner und Kartenbilder. Fraktions- und Statussymbole sind fest.",
            },
            "discord-seed": {
                title: "Seed",
                description:
                    "Wenn ein Server leer ist, ruft Logi Spieler zusammen: Es sendet einen Aufruf, markiert die Rolle Seed und zeigt im Panel, wie viele Spieler fehlen. Starten dürfen ihn nur Logi-Admins.",
            },
            roles: {
                title: "Rollen und Zugriff",
                description:
                    "Die Clan-Rolle und die Rolle, die das Logi-Dashboard öffnet.",
            },
            commands: {
                title: "Befehle",
                description:
                    "Welche Befehle der Bot anbietet, wer sie nutzen darf und wo. Er antwortet in der Clan-Sprache.",
            },
            membership: {
                title: "Mitgliedschaft",
                description:
                    "Wie Leute dem Clan beitreten, wer ihnen antwortet und welche Rollen sie bekommen.",
            },
            tickets: {
                title: "Tickets",
                description:
                    "Das Panel, über das Mitglieder einen privaten Thread mit den Admins öffnen.",
            },
            "game-servers": {
                title: "Spielserver",
                description:
                    "Woher Logi Ergebnisse und Statistiken sammelt. Ein API-Schlüssel wird verschlüsselt gespeichert und ist danach für niemanden mehr sichtbar.",
            },
            league: {
                title: "Wardogs League",
                description:
                    "Verfolgte Liga-Matches und ihre Verknüpfung mit euren Events.",
            },
            website: {
                title: "Clan-Website und Anmeldung",
                description:
                    "Wenn euer Clan eine eigene Website hat, die Daten aus Logi liest oder Mitglieder über Logi anmeldet. Die Schritte bauen aufeinander auf.",
            },
            calendar: {
                title: "Google Kalender",
                description:
                    "Den Clan-Kalender in Google oder einer anderen Kalender-App abonnieren.",
            },
            webhooks: {
                title: "Webhooks",
                description: "Logi-Ereignisse an eure eigenen Dienste senden.",
            },
            imports: {
                title: "Importe und Datenkorrekturen",
                description:
                    "Massenimport von Events, Spielern und Platform-IDs, Neuberechnung der Statistiken.",
            },
            "helper-data": {
                title: "Hilfsdaten",
                description:
                    "Referenzdaten, die Logi beim Import und Abgleich von Spielern nutzt.",
            },
        },
        guidedSetup: {
            metaTitle: "Einrichtungsassistent",
            workspace: "Einrichtung des Bereichs",
            exit: "Assistent beenden",
            progressLabel: "Fortschritt des Assistenten",
            stepsLabel: "Schritte des Assistenten",
            reopenHint:
                "Einen erledigten Schritt kannst du jederzeit wieder öffnen.",
            required: "Pflicht",
            optional: "Optional",
            optionalSuffix: "optional",
            stepOf: "Schritt {number} von {total}",
            doneMark: "Erledigt",
            back: "Zurück",
            skip: "Überspringen",
            continue: "Weiter",
            finish: "Abschließen",
            saving: "Wird gespeichert…",
            saveError: "Speichern fehlgeschlagen. Versuch es noch einmal.",
            discordUnavailable:
                "Logi kann die Kanäle und Rollen gerade nicht von Discord lesen. Prüf den Bot in Schritt 1.",
            steps: {
                bot: {
                    heading: "Lade den Logi-Bot auf Discord ein",
                    description:
                        "Der Bot kündigt Events an, legt Squad-Kanäle an und achtet auf Rollen. Er muss auf dem Server deines Clans sein.",
                    ready: "Der Bot ist auf dem Server und sieht Kanäle und Rollen.",
                    checking:
                        "Der Bot ist auf dem Server. Es wird geprüft, was er sieht…",
                    blind: "Der Bot ist auf dem Server, sieht aber keine Kanäle und Rollen. Gib ihm auf Discord die Berechtigungen „Kanäle ansehen“ und „Rollen verwalten“.",
                    missing:
                        "Der Bot ist noch nicht auf dem Server deines Clans.",
                    invite: "Bot einladen",
                    checkAgain: "Erneut prüfen",
                },
                games: {
                    heading: "Welche Spiele spielt dein Clan?",
                    description:
                        "Logi zeigt dann nur die Optionen, die zu diesen Spielen gehören. Du kannst das jederzeit ändern.",
                    groupLabel: "Spiele des Clans",
                    required: "Wähle mindestens ein Spiel.",
                },
                profile: {
                    heading: "Stell den Clan vor",
                    description:
                        "Name und Logo erscheinen auf der Logi-Website und in den Nachrichten des Bots.",
                    name: "Clan-Name",
                    namePlaceholder: "Clan-Name",
                    logo: "Logo",
                    logoAlt: "Clan-Logo",
                    upload: "Logo hochladen",
                    uploading: "Wird hochgeladen…",
                    formats: "PNG oder JPG",
                    about: "Beschreibung",
                    aboutPlaceholder: "Ein paar Sätze über den Clan",
                    nameRequired: "Gib den Clan-Namen ein.",
                    logoRequired: "Lade das Clan-Logo hoch.",
                },
                channels: {
                    heading: "Wo soll der Bot schreiben?",
                    description:
                        "Wähle Kanäle auf deinem Discord. Für einzelne Spiele kannst du sie später anders einstellen.",
                    announcements: "Ankündigungen",
                    announcementsHelp: "Neue Events und Kaderänderungen.",
                    eventInfo: "Event-Informationen",
                    eventInfoHelp: "Event-Details und Anmeldungen.",
                    errors: "Bot-Fehler",
                    errorsHelp: "Nur für Admins, wenn etwas schiefgeht.",
                    choose: "Kanal wählen",
                    none: "Keiner",
                },
                roles: {
                    heading: "Wer gehört zum Clan und wer verwaltet ihn?",
                    description:
                        "An den Discord-Rollen erkennt Logi Clan-Mitglieder und Admins.",
                    clanRole: "Clan-Rolle",
                    clanRoleHelp: "Wer diese Rolle hat, ist Clan-Mitglied.",
                    adminRole: "Rolle der Logi-Admins",
                    adminRoleHelp:
                        "Personen mit dieser Rolle sehen die Einstellungen und können sie ändern.",
                    choose: "Rolle wählen",
                    none: "Keine Rolle",
                    noResults: "Keine Rolle gefunden.",
                },
                gameServers: {
                    heading: "Verbinde einen Spielserver",
                    description:
                        "Logi kann Ergebnisse und Spielerstatistiken von deinem CRCON- oder Warcon-Server sammeln. Der API-Schlüssel wird verschlüsselt gespeichert und ist danach für niemanden mehr sichtbar.",
                    empty: "Noch kein Server. Das Verbinden dauert etwa eine Minute: Adresse, Server-ID und API-Schlüssel.",
                    connect: "Server verbinden",
                },
            },
            finished: {
                title: "Fertig. Logi ist bereit.",
                description:
                    "Du kannst alles später in den Einstellungen ändern. Dort findest du auch Optionen für die Website, Panels und Befehle.",
                openSettings: "Einstellungen öffnen",
                again: "Noch einmal durchgehen",
            },
        },
    },
    configurationScope: {
        clanWide: "Clanweite Konfiguration",
        clanWideDescription:
            "Änderungen gelten für alle aktiven Spiele dieses Clans.",
        singleGame: "Spielspezifische Konfiguration",
        singleGameDescription:
            "Änderungen gelten nur für das ausgewählte Spiel.",
    },
    calendarCards: {
        eventCalendar: "Event-Kalender",
        registrationEnds: "Anmeldeschluss",
        meeting: "Meeting",
        gameStart: "Spielbeginn",
        map: "Map",
        showRoster: "Roster anzeigen",
        noEvents:
            "Für das gewählte Datum sind in dieser Vorschau keine Events geplant.",
    },
    matchDetail: {
        deletion: {
            action: "Spiel löschen",
            title: "{name} löschen?",
            description:
                "Spiel, Anmeldungen, Aufstellung und Spielergebnis werden dauerhaft gelöscht. Bisherige Spielerstatistiken, andere Serientermine, Wettbewerbe und Strategiekarten bleiben erhalten. Der Bot entfernt die Discord-Nachrichten, Threads, Sprachkanäle und Teilnehmerrollen dieses Spiels.",
            cancel: "Abbrechen",
            deleted: "Spiel gelöscht. Die Discord-Bereinigung ist vorgemerkt.",
            failed: "Das Spiel konnte nicht gelöscht werden. Bitte erneut versuchen.",
        },
        backToMatches: "Matches",
        breadcrumbLabel: "Brotkrumen-Navigation",
        notFoundTitle: "Match nicht gefunden",
        notFoundDescription:
            "Es wurde gelöscht oder gehört zu einem anderen Clan oder Spiel. Wähle es erneut aus der Liste.",
        progressLabel: "Ablauf des Matches",
        tabsLabel: "Bereiche des Matches",
        tabs: {
            overview: "Übersicht",
            attendance: "Anmeldungen und Anwesenheit",
            roster: "Aufstellung",
            discord: "Discord",
            result: "Ergebnis",
        },
        openInDiscord: "In Discord ansehen",
        tabSignups: "Anmeldungen",
        moreActions: "Weitere Aktionen",
        backLabel: "Zurück zu den Matches",
        stepOf: "Schritt {current} von {total} · {label}",
        actions: {
            edit: "Match bearbeiten",
            openRoster: "Aufstellungsseite öffnen",
            signupHistory: "Anmeldeverlauf",
        },
        reminders: {
            remind: "Erinnern",
            sending: "Wird gesendet…",
            queued: "Eine Erinnerung geht per DM an {count} Spieler.",
            nobody: "Niemand zu erinnern.",
            rateLimited: "Du kannst die Erinnerung um {time} wieder senden.",
            unavailable: {
                concluded: "Das Match ist abgeschlossen.",
                draft: "Ein Entwurf wird nicht an Spieler geschickt.",
                signups_closed: "Die Anmeldung ist geschlossen.",
                no_roster: "Es gibt noch keine Aufstellung.",
                roster_unpublished: "Die Aufstellung ist nicht veröffentlicht.",
                meeting_started: "Das Treffen hat begonnen.",
            },
        },
        scheduleLine: "{date} · Treffpunkt {meeting} · Start {start}",
        playedLine: "Gespielt am {date} um {time}",
        phases: {
            draft: "Entwurf",
            signups: "Anmeldungen",
            roster: "Aufstellung",
            match: "Match",
            result: "Ergebnis",
        },
        phaseState: {
            done: "erledigt",
            current: "aktueller Schritt",
            upcoming: "ausstehend",
        },
        phaseDetail: {
            createdAt: "erstellt {date}",
            opensAt: "öffnet {date}",
            closesAt: "bis {date}",
            closedAt: "geschlossen {date}",
            signedUp: "{count} angemeldet",
            rosterMissing: "noch nicht erstellt",
            rosterDraft: "vor dem Treffpunkt veröffentlichen",
            rosterPublished: "{count} Spieler",
            meetingAt: "Treffpunkt {date}",
            present: "{count} anwesend",
            result: {
                none: "Import vom Server",
                imported: "importiert, nicht geprüft",
                provisional: "wartet auf Bestätigung",
                confirmed: "bestätigt",
                corrected: "korrigiert",
            },
        },
        roster: {
            missingTitle: "Noch keine Aufstellung",
            missingDescription:
                "Erstelle die Aufstellung aus einer Squad-Vorlage. Angemeldete Spieler starten als Reserve.",
            create: "Aufstellung erstellen",
            openFull: "Aufstellungsseite öffnen",
            openMatch: "Match öffnen",
            pageTitle: "Aufstellung: {name}",
            modeLabel: "Aufstellungsmodus",
            unsavedChanges: "Ungespeicherte Änderungen: {count}",
            legendAdmin: "vom Admin bestätigt",
            legendPlayer: "vom Spieler bestätigt",
            legendPending: "noch nicht bestätigt",
            hint: "Zieh Spieler aus der Reserve in einen Slot oder tippe auf einen freien Platz und wähle aus der Liste.",
            pickPlayer: "Spieler wählen",
            reservesCount: "{count} · angemeldet ohne Platz",
            notAttendingCount: "{count}",
            noResponse: "Ohne Antwort: {count} Mitglieder",
            dropHere: "Hier ablegen: {name}",
            removeFromSlot: "{name} aus dem Platz entfernen",
            occupied: "{assigned}/{total} besetzt",
            moreActions: "Weitere Aktionen der Aufstellung",
            playerActions: "Aktionen für {name}",
            autoFill: "Automatisch füllen",
            save: "Speichern",
            meetingTime: "Treffzeit",
        },
        attendance: {
            summaryLabel: "Anwesenheit im Überblick",
            rosterSummary: "Aufstellung · {count}",
            reservesSummary: "Reserve · {count}",
            declinedSummary: "Abgesagt",
            noResponseSummary: "Ohne Antwort",
            rosterCounts:
                "{present} anwesend · {excused} entschuldigt · {absent} nicht gekommen",
            reserveCounts: "{present} anwesend · {absent} nicht",
            playerCount: "{count} Spieler",
            memberCount: "{count} Spieler",
            loadFromVoice: "Aus Sprachkanal laden",
            loadingFromVoice: "Sprachkanal wird gelesen…",
            voiceNotConfigured:
                "Lege in den Discord-Einstellungen einen Treffpunkt-Sprachkanal fest, um die Anwesenheit daraus zu laden.",
            loadedFromVoice:
                "{count} Spieler aus dem Sprachkanal als anwesend markiert.",
            closeMatch: "Match abschließen und Punkte vergeben",
            help: "Die Anwesenheit lässt sich ändern, bis du das Match abschließt. Vor dem Abschluss bestätigst du eine Übersicht der Punkte. Punkte folgen den Regeln unter Mitgliedschaft.",
            autoClose:
                "Schließt es niemand ab, schließt sich das Match 15 Minuten nach seinem Ende selbst.",
            filterLabel: "Filter",
            filters: {
                roster: "Aufstellung und Reserve · {count}",
                declined: "Abgesagt · {count}",
                noResponse: "Ohne Antwort · {count}",
            },
            signupHistory: "Anmeldeverlauf",
            columns: {
                player: "Spieler",
                place: "Platz",
                before: "Vor dem Match",
                attendance: "Anwesenheit",
                points: "Punkte",
            },
            marks: {
                present: "Anwesend",
                excused: "Entschuldigt",
                absent: "Nicht gekommen",
            },
            markGroupLabel: "Anwesenheit von {name}",
            reserve: "Reserve",
            before: {
                acknowledged: "Teilnahme bestätigt",
                pending: "Nicht bestätigt",
                reserve: "Reserve",
                notice: "Verspätung: „{reason}“",
                declined: "Abgesagt",
                noResponse: "Keine Antwort",
            },
            excusedHelp:
                "Der Spieler hat in Discord eine Verspätung gemeldet und bleibt daher mindestens entschuldigt.",
            unsavedChanges: "Ungespeicherte Änderungen: {count}",
            save: "Anwesenheit speichern",
            saved: "Anwesenheit gespeichert.",
            saveFirst:
                "Speichere die Anwesenheit, bevor du das Match abschließt.",
            closedApplied:
                "Das Match ist abgeschlossen und die Punkte sind vergeben.",
            closedSkipped:
                "Das Match ist ohne Punkte abgeschlossen: Es wurde vor dem Treffpunkt abgesagt.",
            closedPending:
                "Das Match ist abgeschlossen. Die Punkte werden im Hintergrund vergeben.",
            noRosterTitle: "Noch keine Aufstellung",
            noRosterDescription:
                "Die Anwesenheit wird in der Aufstellung erfasst. Erstelle zuerst die Aufstellung.",
            empty: "Niemand in dieser Liste.",
            lastLoaded:
                "Zuletzt um {time} gelesen: {count} Spieler in {channel}",
            fromVoice: "aus dem Sprachkanal",
            noResponseHint:
                "{count} Spieler haben auf die Anmeldung noch nicht geantwortet.",
        },
        close: {
            title: "Match abschließen und Punkte vergeben?",
            description:
                "Die Anwesenheit lässt sich danach nicht mehr ändern. Punkte ändern sich für {count} Spieler:",
            descriptionNone:
                "Die Anwesenheit lässt sich danach nicht mehr ändern. Mit den aktuellen Regeln ändern sich keine Punkte.",
            back: "Zurück",
            confirm: "Match abschließen",
            closed: "Match abgeschlossen und Punkte vergeben.",
            categories: {
                rosterPresent: "{count} aus der Aufstellung anwesend",
                reservePresent: "{count} aus der Reserve anwesend",
                excusedAbsence: "{count} entschuldigt",
                rosterAbsent: "{count} nicht gekommen",
                reserveAbsent: "{count} aus der Reserve nicht gekommen",
                declined: "{count} abgesagt",
                noCategory: "{count} ohne Antwort",
            },
        },
        discord: {
            title: "Nachrichten in Discord",
            description:
                "Wo der Bot dieses Match gepostet hat. Die Links öffnen Discord.",
            announcement: "Anmeldungs-Ankündigung",
            eventInfo: "Match-Infos",
            forumThread: "Match-Thread",
            rosterUpdate: "Aufstellungsänderung",
            scheduledEvent: "Discord-Event",
            notPosted: "Noch nicht gepostet",
            open: "Öffnen",
            channels: "Kanäle",
            announcementChannel: "Ankündigungen",
            eventInfoChannel: "Match-Infos",
            meetingChannel: "Treffpunkt-Sprachkanal",
            notSet: "Nicht festgelegt",
            scheduledStatus: {
                scheduled: "Geplant",
                active: "Läuft",
                completed: "Beendet",
                canceled: "Abgesagt",
            },
            noSyncTitle: "Noch nichts gepostet",
            noSyncDescription:
                "Der Bot postet das Match, sobald die Anmeldungen öffnen. Falls nicht, prüfe die Kanäle in den Discord-Einstellungen.",
        },
        result: {
            title: "Ergebnis des Matches",
            status: {
                none: "Noch kein Ergebnis",
                provisional: "Wartet auf Bestätigung",
                confirmed: "Bestätigt",
                corrected: "Korrigiert",
            },
            scoreLabel: "Punktestand von {name}",
            nameLabel: "Name von Teilnehmer {index}",
            source: "Woher das Ergebnis stammt",
            sourceSession: "Serverspiel · {map} · {time}",
            sourceManual: "Von Hand eingegeben",
            sourceKeep: "Verknüpfte Spiele behalten ({count})",
            sourceSuggested: "Nach der Match-Zeit gewählt",
            complete: "vollständige Aufzeichnung",
            incomplete: "unvollständige Aufzeichnung",
            otherGame: "Anderes Spiel",
            attribution:
                "{linked} Spieler mit Logi verknüpft, {unlinked} ohne Konto.",
            saveWithoutConfirm: "Ohne Bestätigung speichern",
            confirm: "Ergebnis {score} bestätigen",
            correct: "Korrektur speichern",
            reason: "Grund der Korrektur",
            reasonRequired: "Eine Korrektur braucht einen Grund.",
            history: "Verlauf",
            historyEmpty: "Noch kein Ergebnis gespeichert.",
            historyEntry: {
                provisional: "Gespeichert · {score}",
                confirmed: "Bestätigt · {score}",
                corrected: "Korrigiert · {score}",
            },
            historyImport: "Import vom Server · {score}",
            historyAt: "{date} · {who}",
            automatic: "automatisch",
            historyNext: "Bestätigung",
            historyNextDetail: "erfasst Admin und Zeitpunkt",
            correctionNote:
                "Ein bestätigtes Ergebnis lässt sich nur mit Begründung korrigieren. Die Korrektur wird hier erfasst.",
            unknownMap: "unbekannte Karte",
            stats: "Match-Statistiken",
            statsDescription: "Importierte Spielerstatistiken dieses Matches.",
            openStats: "Statistiken öffnen",
            importTitle: "Aus Link importieren",
            membersOnly: "Nur Clan-Admins sehen und prüfen das Ergebnis.",
            notYetTitle: "Noch kein Ergebnis",
            notYetDescription:
                "Das Ergebnis wird hier geprüft, sobald das Match gespielt ist.",
            outcome: {
                win: "Sieg",
                loss: "Niederlage",
                draw: "Unentschieden",
            },
            afterConfirm: "Nach der Bestätigung",
            effectResultsChannel: "Das Ergebnis erscheint in #{channel}.",
            effectNoResultsChannel:
                "Es ist kein Ergebnis-Panel in Discord eingerichtet, das Ergebnis bleibt in Logi und in der Clan-API.",
            effectRecaps:
                "Spieler bekommen eine persönliche Zusammenfassung per DM. Heute kommt sie schon beim Import.",
            showPlayers: "Spieler anzeigen",
            effectCompetition:
                "Bei einem Ligamatch wird es auch in die Wettbewerbstabelle eingetragen.",
            correctionNoteUpdates:
                "Ein bestätigtes Ergebnis lässt sich nur mit Begründung korrigieren. Die Korrektur wird hier festgehalten und aktualisiert {targets}.",
            correctionTargets: {
                discord: "die Discord-Nachricht",
                competition: "die Wettbewerbstabelle",
                and: " und ",
            },
        },
        stats: {
            killTypes: {
                infantry: "Infanterie",
                machine_gun: "Maschinengewehr",
                artillery: "Artillerie",
                armor: "Panzer",
                sniper: "Scharfschütze",
                commander: "Kommandant",
                grenade: "Granate",
                bazooka: "Bazooka",
                satchel: "Sprengladung",
                mine: "Mine",
            },
            badges: {
                blade: "Klinge",
                bladeDescription:
                    "Hat jemanden mit einer Nahkampfwaffe getötet.",
                miner: "Minenleger",
                minerDescription: "Hat jemanden mit einer Mine getötet.",
                artillery: "Artillerie",
                artilleryDescription: "Mindestens 3 Artillerie-Kills.",
                streak: "Serie",
                streakDescription: "Eine Kill-Serie von 8 oder mehr erreicht.",
                friendlyFire: "Eigenbeschuss",
                friendlyFireDescription:
                    "Mindestens dreimal Teamkameraden getötet.",
                nemesis: "Erzfeind",
                nemesisDescription:
                    "Mindestens fünfmal vom selben Gegner getötet.",
                carry: "Carry",
                carryDescription:
                    "Mit 25+ Kills und höchstens 10 Toden beendet.",
            },
            awards: {
                topFragger: "Top-Fragger",
                topFraggerDetail: "{count} Kills",
                anchor: "Anker",
                anchorDetail: "{count} Verteidigung",
                supportSpine: "Rückgrat der Unterstützung",
                supportSpineDetail: "{count} Unterstützung",
                cleanestKd: "Beste K/D",
                cleanestKdDetail: "{value} K/D",
                underFire: "Unter Beschuss",
                underFireDetail: "{count} Tode",
                hotStreak: "Heiße Serie",
                hotStreakDetail: "Serie von {count}",
            },
            columns: {
                team: "Team",
                player: "Spieler",
                level: "Lvl",
                kills: "Kills",
                kd: "K/D",
                deaths: "Tode",
                offense: "Off",
                defense: "Def",
                support: "Sup",
                teamkills: "TK",
            },
            kills: "Kills",
            deaths: "Tode",
            total: "Gesamt",
            killsShort: "{count} K",
            deathsShort: "{count} T",
            kdShort: "{value} K/D",
            versus: "{left} vs. {right}",
            duels: "{count} Duelle",
            deathsByType: "Tode nach Typ",
            server: "Server",
            matchId: "Match-ID",
        },
    },
    roster: {
        dragSection: "Bereich ziehen",
        dragSquad: "Trupp ziehen",
        moveUp: "Nach oben",
        moveDown: "Nach unten",
        squadFull: "Dieser Trupp hat keine freien Plätze.",
        squadActions: "Truppaktionen",
        editSquad: "Trupp und Rollen bearbeiten",
        editPlayers: "Spieler bearbeiten",
        finishEditing: "Bearbeitung beenden",
        squadName: "Truppname",
        squadGroup: "Bereich",
        squadColor: "Truppfarbe",
        moveToSection: "In Bereich verschieben",
        removeSquad: "Trupp entfernen",
        assignReserve: "Einem Platz zuweisen",
        chooseSlot: "Trupp und Platz auswählen",
        dragHelp:
            "Spieler auf einen Platz oder Trupp ziehen. Mit der Zuweisungsschaltfläche einen Platz auswählen.",

        title: "Roster",
        listDescription:
            "Durchsuche Event-Roster, prüfe Squad-Stärken und sieh, welche Aufstellungen bereits veröffentlicht sind.",
        modeView: "Übersicht",
        modeLayout: "Squad-Editor",
        modeAssignment: "Roster-Editor",
        updatePublished: "Veröffentlichtes Roster aktualisieren",
        publishRoster: "Roster veröffentlichen",
        unpublishRoster: "Roster-Veröffentlichung aufheben",
        deleteRoster: "Roster löschen",
        deleteRosterTitle: "Entwurf-Roster löschen?",
        deleteRosterDescription:
            "Dies löscht dieses unveröffentlichte Roster endgültig. Veröffentlichte Roster müssen zuerst unveröffentlicht werden.",
        deleted: "Roster gelöscht",
        changeSquadTemplateTitle: "Squad-Vorlage ändern?",
        changeSquadTemplateDescription:
            "Dies ersetzt das Squad-Layout und setzt alle manuellen Spielerzuweisungen zurück. Aktuell zugewiesene Spieler wandern zurück in die Reserven.",
        changeSquadTemplateAction:
            "Vorlage ändern und Zuweisungen zurücksetzen",
        squadTemplateChanged:
            "Squad-Vorlage geändert. Speichere das Roster, um sie anzuwenden.",
        setupRoster: "Roster einrichten",
        selectEvent: "Event wählen",
        selectEventPlaceholder: "Wähle ein Event",
        selectPreset: "Squad-Preset wählen",
        selectPresetPlaceholder: "Wähle ein Preset",
        noEventsAvailable: "Keine Events ohne Roster verfügbar",
        selectEventAndPresetToStart:
            "Wähle ein Event und ein Squad-Preset, um mit dem Roster-Entwurf zu starten",
        matchTime: "Match-Zeit",
        opponent: "Gegner",
        mapSide: "Map & Seite",
        notes: "Notizen",
        noExtraNotes: "Noch keine weiteren Notizen.",
        squadSetup: "Squad-Setup",
        role: "Rolle",
        moveToReserves: "In Reserven verschieben",
        moveToNotAttending: "Zu Abwesenden verschieben",
        addSlot: "Slot hinzufügen",
        addSquad: "Squad hinzufügen",
        newSquadName: "Squad",
        newRoleName: "Neue Rolle",
        defaultSquadGroup: "Infanterie-Squad",
        defaultSquadLeadRole: "Squad-Lead",
        versusDelimiter: "vs",
        rosterNotAssigned: "Roster wurde noch keinem Event zugewiesen.",
        rosterNotCreated: "Roster wurde noch nicht erstellt.",
        rosterNotAvailable: "Roster noch nicht verfügbar.",
        notAttending: "Nicht anwesend",
        declinedSignup: "Anmeldung explizit abgelehnt",
        noSignupResponse: "Keine Anmeldeantwort",
        unsignedPlayerConfirmTitle: "Nicht angemeldeten Spieler hinzufügen?",
        unsignedPlayerConfirmDescription:
            "{name} hat sich für dieses Event nicht angemeldet. Bist du sicher, dass du sie zum Roster hinzufügen willst?",
        unsignedPlayerConfirmAction: "Zum Roster hinzufügen",
        autoFill: "Roster automatisch füllen",
        autoFillDescription:
            "Spieler werden stärkste-zuerst zugewiesen und dann nach Anmeldepräferenz, primärer Gruppe und sekundären Gruppen in den nächstgelegenen verfügbaren Squad platziert.",
        autoFillScoreWeight: "Score-Gewichtung",
        autoFillKdWeight: "K/D-Gewichtung",
        autoFillConfirm: "Jetzt automatisch füllen",
        autoFilled: "Roster automatisch gefüllt",
        confirmFromMeetingChannel: "Aus Meeting-VC bestätigen",
        confirmFromMeetingChannelHelp:
            "Lege einen Meeting-Sprachchannel in den Clan-Einstellungen fest, um diese Aktion zu aktivieren.",
        confirmingFromMeetingChannel: "Bestätige aus Meeting-VC...",
        confirmedFromMeetingChannel:
            "{count} Roster-Spieler aus dem Meeting-VC bestätigt.",
        noRosterPlayersInMeetingChannel:
            "Keine Roster-Spieler im Meeting-VC gefunden.",
        noNewMeetingChannelAttendanceChanges:
            "Roster-Spieler wurden im Meeting-VC gefunden, aber es waren keine neuen Anwesenheitsänderungen nötig.",
        attendancePending: "Nicht bestätigt",
        attendanceAcknowledged: "Bestätigt",
        attendanceConfirmed: "Anwesend bestätigt",
        saved: "Roster gespeichert",
        published: "Roster veröffentlicht",
        attendanceUpdated: "Anwesenheit aktualisiert",
    },
    gameCatalogue: {
        title: "Spiele",
        description:
            "Globale Spieledetails, Fähigkeiten und Event-Auswahlfelder.",
        addGame: "Spiel hinzufügen",
        newGameName: "Neues Spiel",
        gameId: "Spiel-ID",
        managedIconAssetId: "Verwaltete Icon-Asset-ID (optional)",
        displayName: "Anzeigename",
        eventSelectionLabel: "Beschriftung der Event-Auswahl",
        optionsOnePerLine: "Optionen (eine pro Zeile)",
        optionalTargetLabel: "Optionale Ziel-Beschriftung",
        targetIsOptional: "Ziel ist optional",
        defaultEventSelectionLabel: "Aktivität",
        saveGame: "Spiel speichern",
        saving: "Wird gespeichert…",
        saved: "Gespeichert.",
        saveFailed: "Dieses Spiel konnte nicht gespeichert werden.",
        capabilities: {
            title: "Fähigkeiten",
            maps: "Karten",
            stratmaps: "Taktische Karten",
            serverData: "Serverdaten",
            playerStats: "Spielerstatistiken",
            matchResults: "Matchergebnisse",
            competitions: "Wettbewerbe",
        },
    },
    newMatch: {
        title: "Neues Match",
        titleTraining: "Neues Training",
        description:
            "Das meiste füllt die Vorlage aus. Rechts siehst du, wie die Spieler das Match in Discord sehen.",
        autosave: {
            idle: "Angefangenes wird als Entwurf gespeichert",
            saving: "Entwurf wird gespeichert…",
            saved: "Entwurf um {time} gespeichert",
            failed: "Der Entwurf konnte nicht gespeichert werden",
        },
        deleteDraft: "Entwurf löschen",
        deleteDraftTitle: "Entwurf {name} löschen?",
        deleteDraftDescription:
            "Der Entwurf verschwindet aus der Matchliste. Nach Discord wurde nichts gesendet, die Spieler merken also nichts.",
        draftDeleted: "Entwurf gelöscht.",
        untitled: "Ohne Namen",
        steps: {
            label: "Schritte",
            match: "Match",
            training: "Training",
            time: "Zeit",
            signups: "Anmeldungen",
            discord: "Discord",
            review: "Prüfen",
            done: "Erledigt",
        },
        back: "Zurück",
        next: "Weiter",
        saveDraft: "Als Entwurf speichern",
        publish: "Veröffentlichen",
        draftSaved: "Entwurf gespeichert.",
        published: "Match veröffentlicht.",
        publishedTraining: "Training veröffentlicht.",
        errors: {
            invalid_event: "Prüfe die Angaben in diesen Schritten: {fields}.",
            not_found:
                "Diesen Entwurf gibt es nicht mehr. Vielleicht hat ihn jemand gelöscht.",
            not_draft: "Dieses Match ist schon veröffentlicht.",
            forbidden:
                "Nur Clan-Verwalter können Matches anlegen. Wenn deine Sitzung abgelaufen ist, melde dich neu an.",
            save_failed: "Speichern fehlgeschlagen. Versuche es noch einmal.",
            invalid_request: "Die Anfrage war ungültig. Lade die Seite neu.",
            nameRequired: "Gib einen Namen ein.",
        },
        match: {
            activity: "Aktivität",
            target: "Ziel",
            chooseActivity: "Aktivität auswählen",
            otherActivity: "Andere",
            targetPlaceholder: "z. B. Hyjal Summit",
            game: "Spiel",
            template: "Vorlage",
            noTemplates: "Noch keine Vorlagen, es gelten die Standardwerte.",
            manageTemplates: "Vorlagen bearbeiten",
            templateRegistration: "Anmeldeschluss {hours} h vor dem Treffpunkt",
            templateTraining: "Ohne Gegner und Karte",
            teams: "Teams",
            yourClan: "Dein Clan",
            yourTeam: "Dein Team",
            yourSide: "Seite deines Teams",
            opponentSide: "Seite des Gegners",
            opponentFromCatalogue: "Gegner aus dem Teamkatalog",
            chooseOpponent: "Gegner wählen",
            searchOpponent: "Team suchen…",
            noTeams: "Kein Team passt.",
            loadingTeams: "Teams werden geladen…",
            teamsError: "Der Teamkatalog konnte nicht geladen werden.",
            changeOpponent: "Gegner ändern",
            missingTeam: "Team fehlt im Katalog?",
            requestTeam: "Hinzufügen anfragen",
            requestSent:
                "Anfrage gesendet. Du kannst das Team wählen, sobald die Logi-Administratoren es freigeben.",
            noSide: "Keine Seite",
            sides: {
                Allies: "Alliierte",
                Axis: "Achse",
                Valkyra: "Valkyra",
                Manticore: "Manticore",
                Lonestar: "Lonestar",
            },
            map: "Karte",
            timeOfDay: "Tageszeit",
            strongpoint: "Mittelpunkt",
            timesOfDay: {
                day: "Tag",
                morning: "Morgen",
                dusk: "Dämmerung",
                evening: "Abend",
                night: "Nacht",
                rain: "Regen",
                overcast: "Bewölkt",
            },
            choose: "Wählen",
            name: "Name",
            nameHint: "Aus Teams und Vorlage ergänzt. Du kannst ihn ändern.",
            category: "Kategorie",
            noCategory: "Keine Kategorie",
            mode: "Modus",
            modes: {
                warfare: "Warfare",
                offensive: "Offensive",
                skirmish: "Skirmish",
                koth: "King of the Hill",
            },
            storedMap:
                "Gespeicherte Karte: {map}. Wähle nur eine Karte, wenn du sie ändern willst.",
            otherTeam: "Weiteres Team",
            addTeam: "Weiteres Team hinzufügen",
            otherSide: "Seite des weiteren Teams",
            removeTeam: "Team entfernen",
        },
        time: {
            date: "Startdatum",
            time: "Startzeit",
            trainingDate: "Datum",
            trainingTime: "Treffpunkt",
            fromTemplate: "Nach der Vorlage {name}",
            defaults: "Standardzeiten",
            editHere: "Nur für dieses Match ändern",
            editHereTraining: "Nur für dieses Training ändern",
            doneEditing: "Fertig",
            announcement: "Ankündigung",
            onPublish: "sofort nach dem Veröffentlichen",
            immediately: "Sofort",
            beforeStart: "Vor dem Start",
            hoursBeforeStart: "h vor dem Start",
            registrationEnd: "Anmeldeschluss",
            hoursBeforeMeeting: "h vor dem Treffpunkt",
            meeting: "Treffpunkt",
            minutesBeforeStart: "Min. vor dem Start",
            end: "Matchende",
            endTraining: "Trainingsende",
            duration: "Dauer",
            minutes: "Min.",
            repeat: "Jede Woche wiederholen",
            repeatHint:
                "Die nächsten Matches werden zwei Wochen im Voraus automatisch angelegt.",
        },
        signups: {
            fromTemplate: "Aus der Vorlage {name}",
            who: "Wer sich anmelden darf",
            statuses: {
                member: "Mitglied",
                recruit: "Rekrut",
                reserve_member: "Reserve",
                mercenary: "Söldner",
            },
            noLimit: "ohne Limit",
            max: "max. {count}",
            noGroups:
                "Dieses Spiel hat keine Anmeldegruppen; Spieler melden sich ohne Gruppe an.",
            general: "Anmeldung ohne Gruppenwahl",
            generalOn: "erlaubt",
            reminder: "Anmeldeerinnerung",
            reminderOff: "aus",
            reminderOn: "einmal täglich an {audience}",
            audience: {
                member: "Mitglieder",
                memberRecruit: "Mitglieder und Rekruten",
                all: "Mitglieder, Rekruten und Reserve",
            },
            trainingNote:
                "Zu einem Training meldet sich jedes Clanmitglied mit einem Knopf an.",
            groupOffered: "Gruppe {name} anbieten",
            capLabel: "Limit der Gruppe {name}",
            capPlaceholder: "ohne Limit",
            capHint:
                "Ein niedrigeres Limit meldet niemanden ab: Wer schon einen Platz hat, behält ihn, nur neue Anmeldungen kommen in die Reserve.",
            reminderOptions: {
                off: "Niemandem",
                member: "Mitgliedern",
                memberRecruit: "Mitgliedern und Rekruten",
                all: "Mitgliedern, Rekruten und Reservisten",
            },
            attendanceReminders: "Anwesenheitserinnerungen",
            attendanceHint:
                "Eine DM vor dem Treffen an Spieler im Kader, die nicht bestätigt haben.",
            attendanceHour: "{hours} h",
            attendanceEditHint:
                "Eine Änderung plant die noch nicht gesendeten Erinnerungen neu.",
            squadPreset: "Trupp-Vorlage",
            squadPresetNone: "Keine Vorlage",
            squadPresetHint:
                "Der Kader startet mit ihr, sobald du ihn anlegst.",
            squadPresetRosterExists:
                "Der Kader existiert schon, die Vorlage ändert ihn nicht. Die Trupps bearbeitest du im Kader.",
            requiredRoles: "Rollen für die Anmeldung",
            rewardRoles: "Rollen für das Bestehen",
            rolesPlaceholder: "Rollen wählen",
        },
        discord: {
            announcement: "Ankündigung und Anmeldungen",
            roster: "Aufstellung",
            ping: "Ping",
            pingNone: "Niemanden",
            pingClan: "Clan-Rolle",
            pingRoles: "Gewählte Rollen",
            pingRolesLabel: "Rollen zum Pingen",
            forum: "Match-Forum",
            voice: "Sprachkanäle der Trupps beim Treffpunkt",
            serverAndPassword: "Server und Passwort",
            server: "Server",
            serverPlaceholder: "Servername",
            password: "Passwort",
            passwordHint: "Das Passwort sehen nur Spieler in der Aufstellung.",
            defaultChannel: "Standardkanal",
            channelsLocked:
                "Die Kanäle bleiben wie bei der Veröffentlichung; dort verwaltet der Bot seine Nachrichten.",
            meetingChannel: "Sprachkanal für das Treffen",
            meetingChannelDefault: "Clan-Standard",
            meetingChannelHint:
                "Aus diesem Kanal liest Logi die Anwesenheit beim Treffen.",
            voiceCategory: "Kategorie für die Sprachkanäle",
            voiceCategoryDefault: "Clan-Standard",
            topicPreset: "Forenthemen",
            topicPresetNone: "Keine Themen",
            participantRoles: "Teilnehmer- und Reserverollen",
            participantRolesHint:
                "Der Bot gibt den Spielern eine Rolle dieses Matches.",
            participantRolesOffHint:
                "Schaltest du es aus, löscht der Bot die Rollen, die er angelegt hat.",
            forumMissing:
                "Der Clan hat keine Forenkategorie, daher wird kein Forum angelegt.",
            openChannelSettings: "Kanäle einrichten",
        },
        review: {
            edit: "Bearbeiten",
            template: "Vorlage {name}",
            noOpponent: "ohne Gegner",
            groupMax: "{name} max. {count}",
            pingNone: "kein Ping",
            pingClan: "Ping der Clan-Rolle",
            pingRoles: "Ping gewählter Rollen",
            forum: "Forum",
            voice: "Sprachkanäle",
            and: "und",
            reviewMeeting: "Treffpunkt {time}",
            reviewSignupsUntil: "Anmeldung bis {date}",
            repeats: "jede Woche",
            notice: "Nach dem Veröffentlichen postet der Bot die Ankündigung in {channel}{forum}. Die Aufstellung erstellst du nach dem Anmeldeschluss{preset}.",
            noticeForum: " und legt das Forum an",
            noticePreset: " aus der Vorlage {name}",
            channelFallback: "den Ankündigungskanal",
            missing: "Fehlt",
            changes: "Was sich ändert",
            noChanges: "Du hast noch nichts geändert.",
            noticeEdit:
                "Nach dem Speichern aktualisiert der Bot die Ankündigung in {channel}. Wer schon angemeldet ist, bleibt angemeldet.",
        },
        preview: {
            title: "Vorschau in Discord",
            hint: "Jeder sieht die Zeiten in seiner Zeitzone",
            note: "Genau diese Nachricht postet der Bot nach dem Veröffentlichen. Sie zeigt nie das Serverpasswort.",
            today: "heute",
            meetingAt: "Treffen {time}",
            registrationCloses: "Anmeldung endet {time}",
            signedUpTotal: "Angemeldet {count}",
            managedShort: "Verwaltet in Logi",
            forum: "match-forum",
            factions: { allies: "Alliierte", axis: "Achsenmächte" },
            times: {
                day: "Tag",
                morning: "Morgen",
                dusk: "Dämmerung",
                evening: "Abend",
                night: "Nacht",
                rain: "Regen",
                overcast: "bewölkt",
            },
        },
        more: {
            title: "Weitere Optionen",
            summary: "Beschreibung, Bilder, Notizen und Taktikkarten",
            description: "Beschreibung",
            descriptionHint:
                "Steht in der Discord-Ankündigung, wenn es keine Notizen gibt.",
            notes: "Notizen",
            notesHint:
                "Stehen in der Discord-Ankündigung statt der Beschreibung.",
            thumbnail: "Vorschaubild",
            image: "Bild",
            upload: "Hochladen",
            remove: "Entfernen",
            stratmaps: "Taktikkarten",
            stratmapsPlaceholder: "Taktikkarten wählen",
            noStratmaps: "Für dieses Spiel gibt es noch keine Taktikkarten.",
        },
        edit: {
            title: "Match bearbeiten",
            titleTraining: "Training bearbeiten",
            description:
                "Gespeicherte Änderungen landen sofort in der Ankündigung in Discord.",
            breadcrumb: "Bearbeiten",
            breadcrumbTrainings: "Trainings",
            savedTimes: "Gespeicherte Zeiten",
            noChanges: "Keine Änderungen",
            unsaved: "Ungespeicherte Änderungen: {count}",
            cancel: "Abbrechen",
            save: "Änderungen speichern",
            saved: "Änderungen gespeichert.",
            leaveTitle: "Ungespeicherte Änderungen verwerfen?",
            leaveDescription:
                "Deine Änderungen an diesem Match werden nicht gespeichert.",
            leaveConfirm: "Änderungen verwerfen",
            leavePrompt:
                "Du hast ungespeicherte Änderungen. Trotzdem verlassen?",
            series: "Dieses Match gehört zu einer wöchentlichen Serie. Änderungen gelten nur für diesen Termin.",
            seriesEdit: "Serie bearbeiten",
            seriesSource:
                "Dieses Match startet eine wöchentliche Serie. Änderungen gelten auch für Termine, die später angelegt werden; bereits angelegte bleiben, wie sie sind.",
            stopHint: "Schalte die Wiederholung aus, um die Serie zu beenden.",
            lockedTitle: "Dieses Match kann nicht mehr bearbeitet werden",
            lockedTrainingTitle:
                "Dieses Training kann nicht mehr bearbeitet werden",
            lockedDescription:
                "Das Match ist abgeschlossen. Ergebnis und Anwesenheit findest du auf der Match-Seite.",
            lockedTrainingDescription:
                "Das Training ist abgeschlossen. Die Anwesenheit findest du auf der Trainingsseite.",
            backToMatch: "Zurück zum Match",
            backToTraining: "Zurück zum Training",
            notFoundTitle: "Match nicht gefunden",
            notFoundDescription:
                "Es wurde vielleicht gelöscht oder gehört zu einem anderen Clan.",
            invalidSchedule:
                "Die Zeiten passen nicht: Die Anmeldung muss vor dem Treffen enden und das Treffen vor dem Start liegen.",
            fields: {
                name: "Name",
                category: "Kategorie",
                teams: "Teams",
                map: "Karte",
                cap: "Mittelpunkt",
                start: "Start",
                meeting: "Treffen",
                registrationEnd: "Anmeldeschluss",
                announcement: "Ankündigung",
                end: "Ende",
                repeat: "Jede Woche wiederholen",
                statuses: "Wer sich anmelden kann",
                groups: "Gruppen und Limits",
                general: "Anmeldung ohne Gruppe",
                signupReminder: "Anmeldeerinnerung",
                attendanceReminders: "Anwesenheitserinnerungen",
                squadPreset: "Trupp-Vorlage",
                requiredRoles: "Rollen für die Anmeldung",
                rewardRoles: "Rollen für das Bestehen",
                ping: "Ping",
                forum: "Match-Forum",
                topicPreset: "Forenthemen",
                voice: "Trupp-Sprachkanäle",
                meetingChannel: "Sprachkanal für das Treffen",
                participantRoles: "Teilnehmer- und Reserverollen",
                server: "Server",
                password: "Passwort",
                description: "Beschreibung",
                notes: "Notizen",
                thumbnail: "Vorschaubild",
                image: "Bild",
                stratmaps: "Taktikkarten",
            },
            values: {
                none: "—",
                on: "an",
                off: "aus",
                noSide: "ohne Seite",
                passwordSet: "gesetzt",
                passwordNew: "neues Passwort",
                imageSet: "hochgeladen",
                imageNew: "neues Bild",
                textEdited: "bearbeitet",
            },
        },
        overview: {
            title: "Übersicht",
            description:
                "Wie das Match eingerichtet ist und wie Spieler es in Discord sehen.",
            descriptionTraining:
                "Wie das Training eingerichtet ist und wie Spieler es in Discord sehen.",
            edit: "Bearbeiten",
            readOnly: "Nur Clan-Manager können das Match ändern.",
            stratmaps: "Taktikkarten",
            previewHint: "So sehen es die Spieler jetzt",
        },
    },
    matchList: {
        title: "Matches und Trainings",
        description:
            "Die nächsten zuerst. Bei jedem Event siehst du, in welcher Phase es ist und was fehlt.",
        recurring: "Wiederkehrend",
        newMatch: "Neues Match",
        editTemplates: "Vorlagen bearbeiten",
        emptyTitle: "Noch keine Matches",
        emptyAdmin:
            "Lege das erste Match an. Eine Vorlage füllt Zeiten, Anmeldungen und die Discord-Nachricht vor.",
        emptyMember: "Dein Clan hat noch keine Matches oder Trainings geplant.",
        emptyTrainingsTitle: "Noch keine Trainings",
        emptyTrainingsAdmin:
            "Lege ein Training an. Mitglieder melden sich in Discord an, und danach trägst du ein, wer bestanden hat.",
        emptyTrainingsMember: "Dein Clan hat noch keine Trainings geplant.",
        unknownChannel: "Kanal nicht gefunden",
        trainingsTitle: "Trainings",
        trainingsDescription:
            "Die nächsten zuerst. Bei jedem Training siehst du, wer angemeldet ist und wer bestanden hat.",
        newTraining: "Neues Training",
        tabsLabel: "Anzeigen",
        tabs: {
            upcoming: "Anstehend",
            played: "Gespielt",
            drafts: "Entwürfe",
            draftsCount: "Entwürfe · {count}",
        },
        filters: {
            matches: "Matches",
            trainings: "Trainings",
            game: "Spiel",
            allGames: "Alle Spiele",
            searchLabel: "Matches durchsuchen",
            searchPlaceholder: "Gegner, Karte …",
            searchTrainingsLabel: "Trainings durchsuchen",
            searchTrainingsPlaceholder: "Name des Trainings …",
        },
        weeks: {
            thisWeek: "Diese Woche",
            nextWeek: "Nächste Woche",
            lastWeek: "Letzte Woche",
            weekOf: "Woche ab {date}",
        },
        recentlyPlayed: "Kürzlich gespielt",
        noUpcoming: "Keine anstehenden Events passen zu den Filtern.",
        noPlayed: "Keine gespielten Events passen zu den Filtern.",
        noDraftsTitle: "Keine Entwürfe",
        noDrafts:
            "Ein Match, an dem du noch arbeitest, speicherst du im neuen Match mit „Als Entwurf speichern“. Der Bot kündigt es erst an, wenn du es veröffentlichst.",
        noDraftsMatch: "Keine Entwürfe passen zu den Filtern.",
        clearFilters: "Filter zurücksetzen",
        showMore: "Mehr anzeigen",
        signedUp: {
            one: "{count} angemeldet",
            few: "{count} angemeldet",
            many: "{count} angemeldet",
            other: "{count} angemeldet",
        },
        notAnnounced: "nicht angekündigt",
        noOpponent: "noch kein Gegner",
        competition: "Wettbewerb {name}",
        competitionPhases: {
            playoff: "Playoffs",
            relegation: "Relegation",
        },
        training: "Training",
        participants: {
            one: "{count} Teilnehmer",
            few: "{count} Teilnehmer",
            many: "{count} Teilnehmer",
            other: "{count} Teilnehmer",
        },
        trainingPassed: {
            one: "{count} bestanden",
            few: "{count} bestanden",
            many: "{count} bestanden",
            other: "{count} bestanden",
        },
        trainingFailed: {
            one: "{count} nicht bestanden",
            few: "{count} nicht bestanden",
            many: "{count} nicht bestanden",
            other: "{count} nicht bestanden",
        },
        phase: {
            draft: "Entwurf",
            registration: "Anmeldung bis {when}",
            registrationClosed: "Anmeldung geschlossen",
            rosterMissing: "Aufstellung fehlt",
            rosterDraft: "Aufstellung · Entwurf",
            rosterPublished: "Aufstellung veröffentlicht",
            unconfirmed: "{count} nicht bestätigt",
            awaitingResult: "Ergebnis fehlt",
            resultPending: "Ergebnis wartet auf Bestätigung",
            resultConfirmed: "{outcome} · bestätigt",
            resultCorrected: "{outcome} · korrigiert",
            confirmed: "Bestätigt",
            corrected: "Korrigiert",
            concluded: "Abgeschlossen",
        },
        queue: {
            title: "Wartet auf dich",
            publishRoster: "Aufstellung veröffentlichen",
            confirmResult: "Ergebnis bestätigen",
            confirmAttendance: "Anwesenheit prüfen",
            openSlots: {
                one: "{count} freier Platz",
                few: "{count} freie Plätze",
                many: "{count} freie Plätze",
                other: "{count} freie Plätze",
            },
            unconfirmed: {
                one: "{count} Spieler ohne Bestätigung",
                few: "{count} Spieler ohne Bestätigung",
                many: "{count} Spieler ohne Bestätigung",
                other: "{count} Spieler ohne Bestätigung",
            },
            resultWaiting: "{source} {score} wartet",
            resultWaitingNoScore: "{source} wartet",
            sources: {
                legacy_import: "Import",
                collected: "Serverspiel",
                manual: "eingetragenes Ergebnis",
            },
        },
        recurrence: {
            weekly: "Jede Woche: {days}",
            everyWeeks: "Alle {count} Wochen: {days}",
            monthlyDate: "Monatlich am {day}.",
            monthlyWeekday: "Monatlich, {nth}. {day}",
            and: "und",
            repeats: "wiederholt sich {days}",
            every: [
                "jeden Sonntag",
                "jeden Montag",
                "jeden Dienstag",
                "jeden Mittwoch",
                "jeden Donnerstag",
                "jeden Freitag",
                "jeden Samstag",
            ],
        },
        recurringTitle: "Wiederkehrende Matches",
        recurringDescription:
            "Match-Serien, die sich nach Zeitplan wiederholen.",
        recurringStopHint:
            "Eine Serie änderst oder beendest du in ihrem Match bei den Wiederholungseinstellungen.",
        editSeries: "Serie bearbeiten",
        recurringEmptyTitle: "Noch keine wiederkehrenden Matches",
        recurringEmptyAdmin:
            "Schalte beim Anlegen eines Matches die Wiederholung ein, um eine Serie zu starten.",
        recurringEmptyMember:
            "Dein Clan hat noch keine wiederkehrenden Matches.",
        backToMatches: "Zurück zu den Matches",
    },
    matchTemplates: {
        chooserLabel: "Vorlage",
        newName: "Neue Vorlage",
        allGames: "alle Spiele",
        add: "Neue Vorlage",
        emptyTitle: "Noch keine Match-Vorlagen",
        emptyDescription:
            "Eine Vorlage füllt ein neues Match vor: Zeiten, wer sich anmelden darf und was der Bot in Discord macht. Im einzelnen Match kannst du alles ändern.",
        saved: "Vorlagen gespeichert.",
        errors: {
            too_many: "Ein Clan kann höchstens 20 Vorlagen haben.",
            duplicate_id:
                "Zwei Vorlagen haben dieselbe ID. Lade die Seite neu.",
            missing_name: "Gib der Vorlage einen Namen.",
            invalid_times:
                "Zeiten müssen ganze Zahlen sein und die Dauer mindestens eine Minute.",
            missing_ping_roles: "Wähle mindestens eine Rolle zum Pingen.",
            invalid_templates: "Einige Werte sind ungültig.",
            forbidden:
                "Nur Clan-Admins können Vorlagen ändern. Melde dich neu an, falls deine Sitzung abgelaufen ist.",
            save_failed: "Die Vorlagen konnten nicht gespeichert werden.",
        },
        basics: {
            title: "Vorlage",
            name: "Name",
            kind: "Typ",
            match: "Match",
            training: "Training",
            game: "Spiel",
            category: "Event-Kategorie",
            categoryHint: "Farbe und Bezeichnung in Discord und im Kalender.",
        },
        times: {
            title: "Zeiten",
            announcement: "Ankündigung",
            immediately: "Sofort",
            scheduled: "Vor dem Start",
            hoursBeforeStart: "h vor dem Start",
            registrationEnd: "Anmeldeschluss",
            hoursBeforeMeeting: "h vor dem Treffen",
            meeting: "Treffen",
            minutesBeforeStart: "min vor dem Start",
            duration: "Matchdauer",
            minutes: "min",
            exampleCaption: "Beispiel für einen Start am Sonntag um 20:00",
            onPublish: "bei Veröffentlichung",
            start: "Start",
            end: "Ende",
        },
        signup: {
            title: "Anmeldungen",
            who: "Wer sich anmelden kann",
            whoHint: "Nach dem Status aus den Mitgliedschaftseinstellungen.",
            groups: "Gruppen",
            groupsHint:
                "Was ein Spieler bei der Anmeldung wählt. Neu sind Limits: Ist eine Gruppe voll, wird ein Reserveplatz angeboten.",
            noGroups: "Dieses Spiel hat noch keine Anmeldegruppen.",
            groupsAllGames:
                "Eine Vorlage für alle Spiele bietet alle Anmeldegruppen des Spiels des Matches an. Wähle ein Spiel, um Gruppen auszuwählen.",
            general: "Anmeldung ohne Gruppenwahl",
            reminder: "Anmeldeerinnerung",
            noLimit: "ohne Limit",
            max: "max.",
            limitFor: "Limit für {group}",
            setLimit: "Limit für {group} festlegen",
            reminderHint: "DM an alle, die noch nicht geantwortet haben.",
            reminderDaily: "Einmal täglich",
            reminderOff: "Aus",
            audienceLabel: "An wen",
            audience: {
                member: "Mitglieder",
                memberRecruit: "Mitglieder und Rekruten",
                all: "Mitglieder, Rekruten und Reserve",
            },
        },
        discord: {
            title: "Discord",
            ping: "Ping bei der Ankündigung",
            create: "Automatisch erstellen",
            forum: "Match-Forum",
            forumHint: "Briefing, Themen und Nachbesprechung nach dem Match.",
            voice: "Sprachkanäle der Trupps",
            voiceHint:
                "Beim Treffpunkt in der Kategorie Trupps, nach dem Match gelöscht.",
            roles: "Rollen für Teilnehmer und Reserve",
            rolesHint:
                "Spieler in der Aufstellung und die Reserve erhalten eine Match-Rolle, die ihnen das Forum öffnet. Nach dem Match wird sie gelöscht.",
            channel: "Kanal für Anmeldungen",
            channelHint: "Kommt aus Kanäle und Sprache.",
            channelMissing: "Ankündigungskanal fehlt",
            channelSet: "Einrichten",
            pingNone: "Niemanden",
            pingClan: "Clan-Rolle",
            pingRoles: "Gewählte Rollen",
            password: "Serverpasswort",
            passwordHint: "Öffentliche Nachrichten zeigen das Passwort nie.",
            passwordRoster: "Nur Spielern in der Aufstellung",
            passwordRosterHint:
                "Der Knopf Meine Einteilung und die Anwesenheitserinnerung",
        },
        roster: {
            title: "Aufstellung",
            preset: "Trupp-Vorlage",
            presetHint:
                "Nach dem Anmeldeschluss beginnst du die Aufstellung mit dieser Vorlage.",
            presetNone: "Keine Vorlage",
            presetAllGames:
                "Wähle für die Vorlage ein Spiel, um eine Trupp-Vorlage auszuwählen.",
            attendance: "Anwesenheitserinnerungen",
            attendanceHint:
                "DM an Spieler der Aufstellung, die nicht bestätigt haben.",
            hours: "{count} h",
            beforeMeeting: "vor dem Treffpunkt",
        },
        appliesToNew:
            "Gilt für neue Matches. Bereits angelegte Matches ändern sich nicht.",
        remove: "Vorlage löschen",
        removeTitle: "Vorlage {name} löschen?",
        removeDescription:
            "Die Vorlage verschwindet beim Speichern. Matches, die daraus entstanden sind, bleiben unverändert.",
        discard: "Verwerfen",
        save: "Vorlage speichern",
        presets: {
            squadDescription:
                "Die Ausgangsform einer Aufstellung: Squads, Rollen und Plätze. Neue Aufstellungen übernehmen sie.",
            topicDescription:
                "Briefing-Themen, die ein Match in sein Discord-Forum übernimmt.",
            count: "Presets: {count}",
            manage: "Verwalten",
        },
        picker: {
            label: "Vorlage",
            none: "Ohne Vorlage",
            hint: "Eine Vorlage füllt Zeiten, Anmeldungen und Discord-Optionen. Unten kannst du weiterhin alles ändern.",
            empty: "Noch keine Vorlagen.",
            manage: "Vorlagen bearbeiten",
            applied: "Vorlage {name} übernommen.",
            registration: "Anmeldung bis {hours} h vor dem Treffen",
        },
        preview: {
            title: "Vorschau in Discord",
            hint: "Discord zeigt die Zeiten in der Zeitzone jedes Lesers.",
            note: "Aus denselben Feldern wie die Ankündigung des Bots. Angemeldete Spieler und der Forumslink erscheinen, sobald das Match existiert.",
            today: "Heute",
        },
        createDescription:
            "Das meiste füllt eine Vorlage aus. Rechts siehst du, wie Spieler das Match in Discord sehen.",
    },
    event: {
        signupStatusSignedUpAs: "Du bist angemeldet als: {type}.",
        signupStatusGeneral: "allgemeiner Teilnehmer",
        signupStatusDeclined: "Du hast angegeben, dass du nicht teilnimmst.",
        signupStatusNotSignedUp:
            "Du hast dich noch nicht für dieses Event angemeldet.",
        infoTitle: "Event-Informationen",
        infoDescription:
            "Diese Seite bleibt für alle ansichtsorientiert, und Admins können sie in den Bearbeitungsmodus schalten, ohne Routen zu wechseln.",
        listDescription:
            "Verfolge geplante Operationen, Meeting-Zeiten, Map-Details und Veröffentlichungseinstellungen an einem Ort.",
        createTitle: "Event erstellen",
        created: "Event erstellt.",
        saved: "Event gespeichert.",
        createDescription:
            "Richte Event-Details, Zeitplan und Discord-Optionen ein, bevor du es an deinen Clan veröffentlichst.",
        createPageDescription:
            "Erstelle ein neues Event mit denselben Feldern, die du später auf der Event-Detailseite verwalten kannst.",
        relatedRoster: "Zugehöriges Roster",
        showRoster: "Roster anzeigen",
        rosterPublishedHint:
            "Dieses Event hat ein veröffentlichtes Roster. Öffne es bei Bedarf von hier.",
        rosterDraftHint:
            "Ein Roster ist zugewiesen, aber noch vor regulären Mitgliedern verborgen.",
        rosterMissingHint:
            "Noch kein Roster zugewiesen. Füge später eines hinzu, wenn du bereit bist, Squads für dieses Event zu organisieren.",
        detailMetaTitle: "Event-Details",
        requiredLabel: "Erforderlich",
        optionalLabel: "Optional",
        noPreset: "Kein Preset",
        topicPreset: "Themen-Preset",
        topicPresetCompleteMatch: "Vollständige Übereinstimmung",
        topicPresetPartialMatch: "Teilweise Übereinstimmung",
        resyncTopicThread: "Themen-Thread neu syncen",
        topicThreadResyncQueued: "Themen-Thread-Resync eingereiht.",
        generalSignupDescription:
            "Aktiviere einen allgemeinen Anmelde-Button, der Spieler ihrer primären Gruppe zuweist, wenn sie für dieses Match verfügbar ist, sonst den Reserven.",
        signupGroupsDescription:
            "Wähle, welche gruppenspezifischen Anmelde-Buttons für dieses Match gezeigt werden sollen.",
        allowedSignupStatusesDescription:
            "Leer lassen, um jedem Clan-Mitgliedsstatus die Anmeldung zu erlauben. Sonst können sich nur die gewählten Status für dieses Match anmelden.",
        allowedSignupStatusesAll: "Alle Clan-Mitgliedsstatus",
        signupReminderStatusesDescription:
            "Sendet die vollständige Match-Anmeldung alle 24 Stunden per DM, beginnend 24 Stunden nach Erstellung bis zum Anmeldeschluss. Keine Auswahl deaktiviert die Erinnerung.",
        signupReminderDisabled:
            "Tägliche Anmeldeerinnerungen sind deaktiviert.",
        createForumChannelDescription:
            "Erstelle den Discord-Forums-Channel und Briefing-Themen für dieses Event.",
        conclude: "Event abschließen",
        submitMatchResults: "Match-Ergebnisse einreichen",
        submitMatchResultsDescription:
            "Füge einen Match-Link ein, der mit /games/[id] endet. Die App importiert das Scoreboard und speichert Spielerstatistiken.",
        importEvents: "Events importieren",
        importEventsDescription:
            "Füge Event-Links im selben Format wie Match-Ergebnis-Importe ein. Kommas und Zeilenumbrüche werden beide unterstützt.",
        importEventsHint: "{count} Link(s) bereit zum Import.",
        importEventsSuccess:
            "{events} Event(s) und {players} Spielerdatensätze importiert.",
        importEventsPartial:
            "{failed} Link(s) konnten nicht importiert werden.",
        importEventPlayers: "Spieler importieren und abgleichen",
        importEventPlayersDescription:
            "Gleiche importierte HLL-Spieler mit der Datenbank ab, verknüpfe fehlende Plattform-IDs und erstelle bei Bedarf neue Spieler.",
        importEventPlayersHint:
            "Spielernamen werden nach Entfernen des Clan-Tags, Kleinschreibung und Entfernen von Sonderzeichen verglichen.",
        matchLink: "Match-Link",
        matchLinks: "Event-Links",
        matchResultsImported:
            "{players} Spielerdatensätze importiert. Event-Ergebnis: {result}.",
        resultSaved: "gespeichert",
        resultSkipped: "übersprungen",
        resultVictory: "Sieg",
        resultDefeat: "Niederlage",
        resultDraw: "Unentschieden",
        resultColumn: "Ergebnis",
        matchColumn: "Match",
        openMatch: "Match öffnen",
        matchDetailTitle: "Match-Details",
        matchDetailDescription:
            "Roh importiertes Scoreboard, Spielerleistung und Team-Aufschlüsselungen für dieses Event.",
        rawSource: "Quelle",
        importedAt: "Importiert",
        playedAt: "Gespielt",
        duration: "Dauer",
        players: "Spieler",
        score: "Score",
        overviewTab: "Übersicht",
        playersTab: "Spieler",
        weaponsTab: "Waffen",
        killsByTypeTab: "Kills nach Typ",
        noMatchLinked:
            "Noch kein importiertes Match mit diesem Event verknüpft.",
        alliedTeam: "Alliierte",
        axisTeam: "Achse",
        teamUnknown: "Unbekannt",
        topWeapons: "Top-Waffen",
        deathsByWeapon: "Tode durch Waffe",
        playerBreakdowns: "Spieler-Aufschlüsselungen",
        standoutAwards: "Herausragende Auszeichnungen",
        topRivalries: "Top-Rivalitäten",
        encounters: "Begegnungen",
        encountersDescription:
            "Abgeleitet aus importierten Spieler-Aggregaten wie „meist getötet“ und „Tod durch“.",
        killsByWeaponForPlayer: "Kills nach Waffe",
        deathsByWeaponForPlayer: "Tode nach Waffe",
        badges: "Abzeichen",
        killed: "Getötet",
        diedTo: "Gestorben durch",
        plusMinus: "+/-",
        noDerivedData: "Keine abgeleiteten Daten",
        performanceScatter: "Kills vs. Tode",
        rawStats: "Roh-Statistiken",
        concludedSuccess: "Event abgeschlossen",
        trainingCompletionTitle: "Training abschließen",
        trainingCompletionDescription:
            "Lege vor Abschluss des Trainings für jeden anwesenden Teilnehmer ein Bestanden- oder Nicht-bestanden-Ergebnis fest.",
        trainingCompletionEmpty:
            "Derzeit sind keine anwesenden Teilnehmer für dieses Training angemeldet.",
        trainingCompletionSuccess:
            "Training abgeschlossen. Belohnt: {rewarded}. DMs gesendet: {dmed}.",
        trainingPassed: "Bestanden",
        trainingFailed: "Nicht bestanden",
        trainingCompleteAction: "Speichern und abschließen",
        saveHelp:
            "Name und die vier Zeitlinienfelder sind erforderlich. Alles andere ist optional.",
        saveError: "Event konnte nicht gespeichert werden.",
        writeForbidden:
            "Nur Administratoren des Arbeitsbereichs können dieses Event ändern. Melde dich erneut an, falls deine Sitzung abgelaufen ist.",
        notices: {
            announcementsTitle: "Ankündigungs-Channel ist nicht gesetzt",
            announcementsDescription:
                "Event-Ankündigungsnachrichten werden nicht in Discord gepostet oder aktualisiert, bis ein Ankündigungs-Channel für diesen Clan konfiguriert ist.",
            forumTitle: "Forums-Kategorie ist nicht gesetzt",
            forumDescription:
                "Dieses Event soll einen Discord-Forums-Channel erstellen, aber keine Forums-Kategorie ist konfiguriert. Forums-Channel und Briefing-Themen werden übersprungen, bis diese Einstellung ausgefüllt ist.",
            meetingAutomationTitle:
                "Meeting-Sprachautomatisierung ist deaktiviert",
            meetingAutomationDescription:
                "Discord-geplante Events und Roster-Anwesenheitsbestätigung aus dem Meeting-VC hängen beide von der Clan-Meeting-Sprachchannel-Einstellung ab.",
            openClanSettings: "Clan-Einstellungen öffnen",
        },
        statuses: {
            registration: "Anmeldung",
            closed: "Geschlossen",
            starting: "Startet",
            concluded: "Abgeschlossen",
        },
        fields: {
            name: "Name",
            kind: "Typ",
            matchType: "Event-Kategorie",
            description: "Beschreibung",
            thumbnail: "Thumbnail",
            image: "Embed-Bild",
            announcementChannelId: "Event-Anmelde-Channel",
            eventInfoChannelId: "Event-Info-Channel",
            meetingChannelId: "Meeting-VC / Ort",
            server: "Server",
            serverPassword: "Server-Passwort",
            map: "Map",
            mapVariant: "Tageszeit / Wetter",
            mapMode: "Spielmodus",
            mapPresetCode: "Map-Preset-Code",
            side: "Seite",
            capMode: "Mittlerer Cap-Point",
            registrationStart: "Start der Anmeldeankündigung",
            registrationEnd: "Anmeldeschluss",
            meetingStart: "Meeting-Beginn",
            gameStart: "Spielbeginn",
            gameEnd: "Spielende",
            notes: "Notizen",
            stratmaps: "Stratmaps",
            requiredRoleIds: "Erforderliche Rollen-IDs",
            rewardRoleIds: "Belohnungs-Rollen-IDs",
            signupGroupIds: "Sichtbare Anmeldegruppen",
            allowedSignupStatuses: "Erlaubte Anmeldestatus",
            signupReminderStatuses: "Empfänger täglicher Anmeldeerinnerungen",
            useGeneralSignup: "Allgemeine Anmeldung aktivieren",
            pingClan: "Clan pingen",
            pingMode: "Ankündigungs-Ping",
            pingRoleIds: "Zu pingende Rollen",
            createForumChannel: "Forums-Channel erstellen",
            createSquadVoiceChannels:
                "Squad-Sprachkanäle beim Meeting-Beginn erstellen",
            squadVoiceCategory:
                "Squad-Sprachkategorie (leer nutzt den Serverstandard)",
            conclusionReserveHelp:
                "Das Event wird 15 Minuten nach dieser Dauer automatisch abgeschlossen.",
        },
        channelRoutingCreateHelp:
            "Startet mit den Clan-Einstellungen als Voreinstellung. Diese Wahl ist nach Erstellung gesperrt, um Discord-Nachrichten stabil zu halten.",
        channelRoutingSharedHelp:
            "Wähle den Anmelde-Channel. Wenn der Event-Info-Channel leer bleibt, wird der Anmelde-Channel für beide Nachrichten genutzt.",
        channelRoutingLockedHelp:
            "Dieses Routing ist nach Erstellung gesperrt, um Discord-Nachrichten-IDs stabil zu halten.",
        pingNone: "Niemanden pingen",
        pingClanOption: "Clan-Rolle pingen",
        pingRolesOption: "Gewählte Rollen pingen",
        quickScheduleTitle: "Schnellplanung",
        quickScheduleDescription:
            "Lege die vier Schlüsselzeiten für dieses Match fest. Du kannst die generierte Zeitlinie jederzeit überarbeiten.",
        registrationHoursBefore:
            "Stunden vor Headcount zum Schließen der Anmeldung",
        meetingMinutesBefore: "Minuten vor Start für das Meeting",
        durationHours: "Dauer (Stunden)",
        durationMinutes: "Match-Dauer (Minuten)",
        quickEventStart: "Match-Startdatum und -zeit",
        applyQuickSchedule: "Zeitplan anwenden",
        quickScheduleApplied: "Zeitplan angewendet.",
        recurringMatch: "Daraus ein wiederkehrendes Match machen",
        recurringMatches: "Wiederkehrende Matches",
        recurringMatchesDescription:
            "Verwalte die Match-Serien, die sich nach Zeitplan wiederholen.",
        noRecurringMatches:
            "Es wurden noch keine wiederkehrenden Matches erstellt.",
        recurrenceHelp:
            "Das erstellte Match ist das erste Match dieser Serie. Seine Details und Zeit werden für künftige Vorkommen genutzt.",
        recurrenceFrequency: "Wiederholen",
        recurrenceWeekly: "Wöchentlich",
        recurrenceMonthlyDate: "Monatlich an einem Datum",
        recurrenceMonthlyNthWeekday: "Monatlich an einem Wochentag",
        recurrenceInterval: "Alle (Intervall)",
        recurrenceWeekdays: "Wochentage",
        recurrenceMonthDay: "Tag des Monats",
        recurrenceNth: "Woche des Monats",
        recurrenceWeekday: "Wochentag",
        editSchedule: "Zeitplan bearbeiten",
        quickScheduleStepLabel: "Schritt {step} von 4",
        wizardBack: "Zurück",
        wizardNext: "Weiter",
        discordPreview: "Discord-Vorschau",
        previewUntitled: "Event ohne Titel",
        previewNoDescription: "Deine Event-Beschreibung erscheint hier.",
        createMatchAction: "Match erstellen",
        createTrainingAction: "Training erstellen",
        recurrenceEditHelp:
            "Schalte die Wiederholung aus, um die Serie zu beenden. Bereits angelegte Matches bleiben.",
    },
    presets: {
        topicTitle: "Themen-Presets",
        topicDescription:
            "Preset-Briefings sind Referenzdaten. Events können sie kopieren, sodass spätere Preset-Änderungen alte Matches nicht überschreiben.",
        squadTitle: "Squad-Presets",
        squadDescription:
            "Diese definieren die anfängliche Roster-Struktur. Neue Roster kopieren daraus, damit vergangene Events stabil bleiben.",
        createTopicTitle: "Themen-Preset erstellen",
        createTopicDescription:
            "Erstelle und bearbeite Themenstrukturen an einem Ort.",
        createSquadTitle: "Squad-Preset erstellen",
        createSquadDescription:
            "Erstelle und passe die Preset-Struktur an einem Ort an.",
        presetDetails: "Preset-Details",
        presetCreateMode:
            "Erstellungsmodus startet direkt im Bearbeitungsmodus.",
        squadPresetPageDescription:
            "Preset-Squads und Rollen, die in Event-Roster kopiert werden können.",
        squadPresetMetaDescription: "Preset-Squad-Struktur für neue Roster.",
        topicPresetMetaDescription:
            "Wiederverwendbare Briefing-Vorlagen, die bei Bedarf in Events kopiert werden.",
        topics: "Themen",
        squadStructure: "Squad-Struktur",
        presetSetup: "Preset-Setup",
        presetSetupDescription:
            "Preset-Informationen und Squad-Struktur liegen in einem Editor, damit das gesamte Setup zusammenbleibt.",
        addTopic: "Thema hinzufügen",
        role: "Rolle",
        roleNote: "Rollennotiz",
        addRole: "Rolle hinzufügen",
        squadBlock: "Squad-Block",
        presetName: "Preset-Name",
        topicEditorDescription:
            "Briefing-Themen sind im selben Admin-Bearbeitungsflow wie die Preset-Details editierbar.",
        attachmentPlaceholder: "Eine Anhang-URL pro Zeile",
        attachmentCountSuffix: "Anhang/Anhänge",
        newTopic: "Neues Thema",
        newSquad: "Neuer Squad",
        newRole: "Neue Rolle",
        importStarterTemplate: "Start-Vorlage importieren",
        starterTemplateName: "HLL Standard-Aufstellung",
        wowForeverStarterTemplateName: "WoW:F-Schlachtzug für 20 Spieler",
        shortNote: "Notiz",
        untitledPreset: "Unbenanntes Preset",
        topicPresetMetaFallback: "Themen-Preset",
        topicPresetPageDescription:
            "Gleiche Struktur wie Events, aber fokussiert auf wiederverwendbare Briefing-Inhalte.",
        squadPresetMetaFallback: "Squad-Preset",
        fields: {
            name: "Name",
            map: "Map",
            side: "Seite",
            cap: "Cap",
            notes: "Notizen",
        },
        table: {
            preset: "Preset",
            topics: "Themen",
            groups: "Gruppen",
            roleSlots: "Rollen-Slots",
            squads: "Squads",
        },
        emptySquadTitle: "Noch keine Squad-Presets",
        emptySquadAdmin:
            "Ein Squad-Preset ist die Ausgangsform einer Aufstellung: Squads, Rollen und Plätze. Lege eines an, und neue Aufstellungen übernehmen es.",
        emptyTopicTitle: "Noch keine Themen-Presets",
        emptyTopicAdmin:
            "Ein Themen-Preset enthält Briefing-Themen, die ein Match in sein Discord-Forum übernimmt.",
        emptyMember:
            "Die Admins deines Clans haben noch keine Presets angelegt.",
        delete: {
            action: "Preset löschen",
            title: "Preset {name} löschen?",
            squadConsequence:
                "Bestehende Aufstellungen behalten ihre Squads. Neue Aufstellungen können nicht mehr mit diesem Preset starten.",
            topicConsequence:
                "Abgeschlossene Matches behalten die bereits geposteten Themen. Ein nicht abgeschlossenes Match, das dieses Preset nutzt, verhindert das Löschen.",
            confirm: "Löschen",
            done: "Preset gelöscht.",
            inUse: "Offene Matches, die dieses Preset noch nutzen: {count}. Wähle dort zuerst ein anderes.",
            forbidden:
                "Nur Clan-Admins können Presets löschen. Melde dich neu an, falls deine Sitzung abgelaufen ist.",
            failed: "Das Preset konnte nicht gelöscht werden.",
        },
    },
    groups: {
        title: "Gruppen",
        description:
            "Gruppen sind wiederverwendbare Clan-Spezialisierungen für Spieler und Squad-Presets. Roster kopieren die Namen, damit ältere Events intakt bleiben.",
        createTitle: "Gruppe erstellen",
        createDescription:
            "Erstelle eine wiederverwendbare Clan-Spezialisierung mit Farbe und Kurzbeschreibung.",
        name: "Gruppenname",
        color: "Farbe",
        descriptionLabel: "Beschreibung",
        order: "Reihenfolge",
        parent: "Übergeordnete Gruppe",
        none: "Keine",
        reset: "Hilfsdaten zurücksetzen",
        initialize: "Standard-Presets importieren",
        resetConfirm:
            "Dies löscht Gruppen, Squad-Presets und Themen-Presets für diesen Clan. Events, Roster und Spieler bleiben erhalten. Fortfahren?",
        initializeConfirm:
            "Dies setzt Gruppen, Squad-Presets und Themen-Presets zurück und erstellt dann das Standard-Gruppen-Preset und das Start-Squad-Preset neu. Fortfahren?",
        resetSuccess: "Hilfsdaten-Reset abgeschlossen.",
        initializeSuccess: "Standard-Presets importiert.",
        usedByPlayers: "Primäre Spieler",
        starterDescription:
            "Start-Clan-Spezialisierungen abgestimmt auf das Standard-HLL-Squad-Setup.",
        created: "Gruppe erstellt.",
        saved: "Gruppe gespeichert.",
        saveFailed:
            "Die Gruppe konnte nicht gespeichert werden. Versuch es noch einmal.",
        duplicateName: "Eine Gruppe mit diesem Namen gibt es schon.",
        deleteAction: "Gruppe löschen",
        deleteTitle: "Gruppe „{name}“ löschen?",
        deleteDescription:
            "Spieler verlieren diese Gruppe. Roster und vergangene Events behalten den kopierten Gruppennamen. Das lässt sich nicht rückgängig machen.",
        deleteImpact:
            "{primary} Spieler haben sie als Hauptgruppe und {secondary} als zusätzliche Gruppe.",
        deleted: "Gruppe gelöscht.",
        deleteFailed:
            "Die Gruppe konnte nicht gelöscht werden. Versuch es noch einmal.",
        emptyTitle: "Noch keine Gruppen",
        emptyDescription:
            "Gruppen sind Clan-Spezialisierungen wie Panzerfahrer oder Kommandeure. Squad-Presets und Spieler nutzen sie.",
    },
    tables: {
        event: "Event",
        meeting: "Meeting",
        status: "Status",
        pingClan: "Clan pingen",
        enabled: "Aktiviert",
        disabled: "Deaktiviert",
        squads: "Squads",
        reserves: "Reserven",
        visibility: "Sichtbarkeit",
        hidden: "Ausgeblendet",
        unassigned: "Nicht zugewiesen",
    },
    clanOverview: {
        listAnd: "und",
        unavailableTitle: "Dieser Clan kann nicht geöffnet werden",
        unavailableDescription:
            "Vielleicht hast du keinen Zugriff, oder er konnte nicht geladen werden. Versuche es erneut oder kehre zu deinen Clans zurück.",
        backToClans: "Deine Clans",
        dateLine: "{date} · {games}",
        allMatches: "Alle Matches",
        newMatch: "Neues Match",
        nextMatch: "Nächstes Match · {when}",
        today: "heute um {time}",
        tomorrow: "morgen um {time}",
        onDay: "{day} um {time}",
        meeting: "Treffen {time}",
        rosterDraft: "Aufstellung · Entwurf",
        rosterPublished: "Aufstellung · veröffentlicht",
        rosterMissing: "Noch keine Aufstellung",
        rosterFill: "Aufstellung {filled} von {total} Plätzen",
        rosterFillLabel: "Belegte Plätze der Aufstellung",
        signedUp: "{count} angemeldet",
        unanswered: "{count} ohne Antwort",
        finishRoster: "Aufstellung fertigstellen",
        createRoster: "Aufstellung erstellen",
        showRoster: "Aufstellung ansehen",
        openMatch: "Match öffnen",
        versus: "vs",
        noMatchTitle: "Kein Match geplant",
        noMatchManager:
            "Plane das nächste Match und der Bot kündigt es in Discord an.",
        noMatchMember:
            "Sobald deine Verwaltung ein Match plant, siehst du es hier.",
        waitingTitle: "Wartet auf dich",
        confirmResult: "Ergebnis von {name} bestätigen",
        resultScore: "{score} · {date}",
        resultNoScore: "Vorbereitetes Ergebnis · {date}",
        requirementHints: {
            enabledGames:
                "Logi zeigt Matches und Einstellungen für diese Spiele.",
            announcements:
                "Ohne ihn kann der Bot keine neuen Events ankündigen.",
            clanRole: "Daran erkennt Logi die Clanmitglieder.",
        },
        applications: {
            one: "{count} Mitgliedsantrag wartet",
            few: "{count} Mitgliedsanträge warten",
            many: "{count} Mitgliedsanträge warten",
            other: "{count} Mitgliedsanträge warten",
        },
        applicationsOldest: "der älteste seit {date}",
        nothingWaiting: "Nichts wartet. Alles ist erledigt.",
        setupProgress: "Clan-Einrichtung: {done} von {total} erledigt",
        weekTitle: "Diese Woche",
        todayLabel: "heute",
        formTitle: "Form · letzte 10 Matches",
        wins: {
            one: "{count} Sieg",
            few: "{count} Siege",
            many: "{count} Siege",
            other: "{count} Siege",
        },
        formListLabel: "Ergebnisse, älteste zuerst",
        outcomeLetters: { victory: "S", defeat: "N", draw: "U" },
        outcomes: {
            victory: "Sieg",
            defeat: "Niederlage",
            draw: "Unentschieden",
        },
        outcomePending: "{outcome}, wartet auf Bestätigung",
        formLegend: "S = Sieg, N = Niederlage, U = Unentschieden.",
        formPendingLegend:
            "Ergebnisse mit gestricheltem Rahmen warten auf Bestätigung.",
        formEmptyTitle: "Noch keine Ergebnisse",
        formEmptyDescription:
            "Ergebnisse erscheinen hier, sobald ein Matchergebnis importiert oder eingetragen wurde.",
        formLastPendingLegend: "Das letzte Ergebnis wartet auf Bestätigung.",
        remind: {
            button: {
                one: "{count} Spieler erinnern",
                few: "{count} Spieler erinnern",
                many: "{count} Spieler erinnern",
                other: "{count} Spieler erinnern",
            },
            confirmTitle: "Erinnerung senden?",
            confirmDescription:
                "Der Bot schickt allen Mitgliedern, die sich noch nicht an- oder abgemeldet haben, eine Direktnachricht in Discord.",
            confirm: "Erinnerung senden",
            cancel: "Abbrechen",
            sent: {
                one: "Erinnerung an {count} Spieler gesendet.",
                few: "Erinnerung an {count} Spieler gesendet.",
                many: "Erinnerung an {count} Spieler gesendet.",
                other: "Erinnerung an {count} Spieler gesendet.",
            },
            nobody: "Alle haben schon geantwortet, eine Erinnerung war nicht nötig.",
            failed: "Die Erinnerung konnte nicht gesendet werden. Versuch es noch einmal.",
            rateLimited:
                "Vor Kurzem wurde schon erinnert. Versuch es später noch einmal.",
            done: "Erinnerung gesendet",
        },
        pointsTitle: "Meiste Anwesenheitspunkte · {month}",
        pointsEmpty:
            "Diesen Monat hat noch niemand Anwesenheitspunkte bekommen.",
        pointsUnknownMember: "Mitglied ohne Logi-Konto",
        statsTitle: "Clan-Statistiken",
    },
    clan: {
        overviewMeta: "Übersicht",
        adminAccess: "Admin-Zugriff",
        memberAccess: "Mitglieder-Zugriff",
        upcomingEvents: "Bevorstehende Events",
        publishedRosters: "Veröffentlichte Roster",
        members: "Mitglieder",
        presets: "Presets",
        recentGames: "Letzte Spiele",
        lastTenGames: "Letzte 10 Spiele",
        record: "Bilanz",
        winRate: "Siegquote",
        draw: "Unentschieden",
        noRecentGames: "Noch keine erfassten Match-Ergebnisse.",
        topPlayers: "Top-Spieler",
        matchesPlayed: "Matches gespielt",
        noPlayerStats: "Keine Spielerstatistiken für diese Matches importiert.",
        performanceTrend: "Clan-Leistungstrend",
        playerPerformanceTrend: "Leistungstrend",
        performanceLastMatches: "Letzte {count} erfasste Matches",
        performanceComparedWithPrevious:
            "{change} {metric} vs. vorherige {count}",
        performanceNoData:
            "Noch keine erfassten Match-Daten. Sie erscheinen nach dem nächsten Statistik-Import oder Refresh.",
        combat: "Kampf",
        combatEffectiveness: "Kampfeffektivität",
        offense: "Offense",
        support: "Support",
        supportEffectiveness: "Support-Effektivität",
        deaths: "Tode",
        points: "Punkte",
        kd: "K/D",
        kills: "Kills",
        topPlayersCalculation:
            "Spieler werden nach Gesamtkills der letzten 10 Spiele gerankt. Gespielte Matches entscheiden bei Gleichstand; K/D, Offense, Defense und Support fließen nicht ein.",
        membersAndGroups: "Mitglieder und Gruppen",
        joined: "Beigetreten",
        snapshot: "Clan-Schnappschuss",
        visibilityTitle: "Wer was sehen kann",
        visibilityBody:
            "Der Kalender ist für angemeldete Nutzer dieses Clans sichtbar. Events, Presets und unveröffentlichte Roster bleiben nur für Admins.",
        backendTitle: "Backend-Vorbereitung",
        backendBody:
            "Seiten sind um Mock-Daten verdrahtet und für Convex-Dokumente typisiert, sodass wir später echte Abfragen einhängen können.",
        languageTitle: "Sprache",
        languageBody:
            "Locale-Routing ist mit englischen Wörterbüchern aktiv, sodass weitere Sprachen ohne Umbau der Seitenstruktur ergänzt werden können.",
        importsTitle: "Importe",
        importsBody:
            "Massenimporte für Events, Spieler und Plattform-Identitäten liegen hier, damit reine Admin-Datenaufgaben an einem Ort bleiben.",
        helperDataTitle: "Hilfsdaten",
        helperDataBody:
            "Gruppen, Squad-Presets und Themen-Presets dienen nur als Kopiervorlagen. Das Zurücksetzen überschreibt niemals alte Events oder Roster.",
        systemTitle: "System",
        systemBody: "Clan-API-Schlüssel und Wartungswerkzeuge.",
        websiteApi: "Website-API",
        webhooksTitle: "Webhooks",
        webhooksBody:
            "Konfiguriere signierte Benachrichtigungen für Clan-Änderungen.",
        webhookDelivery: "Webhook-Zustellung",
        webhookDocumentation: "Webhook-Dokumentation lesen",
        webhookPayloadTitle: "Zustellungs-Payload und Header",
        webhookPayloadBody:
            "Logi sendet eine POST-Anfrage. Prüfe die Signatur über die unveränderten JSON-Bytes, bevor du den Body auswertest.",
        webhookHeadersBody:
            'Die Signatur ist HMAC-SHA256 aus X-Logi-Timestamp + "." + dem rohen Request-Body mit dem Webhook-Signaturgeheimnis. X-Logi-Delivery kennzeichnet den Zustellversuch und unterscheidet sich von der Body-ID.',
        webhookApiReference: "API-Schema",
        webhookEventsTitle: "Ereignisse, die dein Endpoint empfangen kann",
        webhookEventsBody:
            "Neue Abonnements erhalten alle unten aufgeführten Produktionsereignisse. Nutze diese Liste, um deinen Endpoint vor dem Aktivieren eines Webhooks vorzubereiten.",
        webhookEvents: {
            article: {
                created: "Ein Artikel wurde über die Website-API erstellt.",
                updated: "Ein Artikel wurde über die Website-API aktualisiert.",
                deleted: "Ein Artikel wurde über die Website-API gelöscht.",
            },
            event: {
                created: "Ein Event wurde über die Website-API erstellt.",
                updated:
                    "Ein Event wurde über die Website-API aktualisiert oder abgeschlossen.",
            },
            roster: {
                updated:
                    "Ein Roster wurde geändert, einschließlich API-Anmeldungen und rosterrelevanter Zuweisungsänderungen.",
            },
            settings: {
                updated:
                    "Sichere Clan- oder Discord-Einstellungen wurden über die Website-API aktualisiert.",
            },
            webhook: {
                test: "Ein Manager hat eine Testzustellung manuell gesendet.",
            },
        },
        webhookUi: {
            copySecret:
                "Kopiere dieses Signaturgeheimnis jetzt; es wird nicht erneut angezeigt:",
            url: "Webhook-URL",
            add: "Webhook hinzufügen",
            loading: "Webhooks werden geladen…",
            enabled: "Aktiv",
            disabled: "Deaktiviert",
            eventTypes: "Ereignistypen",
            lastDelivery: "Letzte Zustellung",
            lastFailure: "Letzter Fehler",
            never: "nie",
            enable: "Aktivieren",
            disable: "Deaktivieren",
            sendTest: "Test senden",
            rotate: "Geheimnis rotieren",
            history: "Verlauf",
            delete: "Löschen",
            historyTitle: "Zustellverlauf",
            noHistory: "Noch keine Zustellungen.",
            status: "Status",
            attempt: "Versuch",
            response: "Antwort",
            created: "Erstellt",
            error: "Fehler",
        },
    },
    workspacePages: {
        managersOnlyTitle: "Nur Manager können diese Seite öffnen",
        managersOnlyDescription:
            "Frag einen Clan-Manager, wenn du Zugriff brauchst. Alles, was du nutzen kannst, findest du im Menü.",
        backToOverview: "Zurück zur Übersicht",
    },
    stratmaps: {
        title: "Stratmaps",
        createTitle: "Stratmap erstellen",
        pageDescription:
            "Gespeicherte Echtzeit-Taktikkarten für die Spiel-Matchplanung.",
        createDescription:
            "Erstelle eine gespeicherte Echtzeit-Taktikskizze, die später an Match-Briefings angehängt werden kann.",
        detailDescription:
            "Echtzeit-Kollaboration auf Taktikkarten für die Matchplanung.",
        viewMap: "Interaktive Stratmap und Taktikplanung anzeigen.",
        searchPlaceholder: "Stratmaps suchen...",
        tableTitle: "Titel",
        tableMap: "Map",
        tableSlides: "Folien",
        tableUpdated: "Aktualisiert",
        titleLabel: "Titel",
        descriptionLabel: "Beschreibung",
        mapAndPoint: "Map und Punkt",
        baseMap: "Map",
        searchMap: "Map suchen",
        point: "Punkt",
        searchPoint: "Punkt suchen",
        side: "Seite",
        saveDetails: "Details speichern",
        detailsSaved: "Stratmap-Details gespeichert.",
        saveDetailsError: "Stratmap-Details konnten nicht gespeichert werden.",
        saveStateError: "Stratmap-Status konnte nicht gespeichert werden.",
        createError: "Stratmap konnte nicht erstellt werden.",
        titleRequired: "Titel ist erforderlich.",
        importLabel: "Aus Maps Let Loose importieren (optional)",
        importHint:
            "Lade die extrahierte mll_config.json aus einem Maps Let Loose-Export hoch. Wähle unten die Map-Details vor dem Erstellen.",
        importInvalid: "Dies ist kein gültiger Maps Let Loose-JSON-Export.",
        importSummary: "{slides} Folie(n) importiert{skipped}.",
        liveAccess:
            "Admins können diese Stratmap bearbeiten. Andere sehen Aktualisierungen live.",
        slides: "Folien",
        createSlideTitle: "Folie erstellen",
        createSlideDescription:
            "Füge einen Foliennamen hinzu und lade optional ein eigenes Hintergrundbild hoch.",
        createSlideAction: "Folie erstellen",
        slideNameLabel: "Folienname",
        customBackgroundLabel: "Eigenes Hintergrundbild",
        customBackgroundHint:
            "Leer lassen, um den Map-Hintergrund für diese Folie zu nutzen.",
        overlays: "Map-Overlays",
        board: "Board",
        toolProperties: "Werkzeugeigenschaften",
        selectedIcon: "Ausgewähltes Icon",
        selectedElement: "Ausgewähltes Element",
        deleteSelected: "Auswahl löschen",
        deleteTool: "Löschen",
        undo: "Rückgängig",
        redo: "Wiederholen",
        oneSelected: "1 Element ausgewählt",
        multipleSelected: "{count} Elemente ausgewählt",
        quickColors: "Schnellfarben",
        stroke: "Kontur",
        fill: "Füllung",
        strokeWidth: "Konturbreite",
        lineStyle: "Linienstil",
        solid: "Durchgezogen",
        dashed: "Gestrichelt",
        dotted: "Gepunktet",
        text: "Text",
        fontSize: "Schriftgröße",
        iconColor: "Icon-Farbe",
        iconLibrary: "Icon-Bibliothek",
        notes: "Notizen",
        notePlaceholder: "Kontext für diese Position hinzufügen.",
        images: "Bilder",
        imageDescription: "Bildbeschreibung",
        imageDescriptionPlaceholder: "Kontext für dieses Bild hinzufügen.",
        mainImage: "Hauptbild",
        attachImages: "Bilder anhängen",
        uploading: "Wird hochgeladen...",
        noImages: "Noch keine Bilder angehängt.",
        imagesAttached: "Bilder an Icon angehängt.",
        uploadImagesError: "Icon-Bilder konnten nicht hochgeladen werden.",
        selectedElementHint:
            "Nutze das Auswahl-Werkzeug, um dieses Element zu bewegen. Icon-spezifische Notizen und Bildanhänge erscheinen nur bei ausgewähltem Icon.",
        grid: "Gitter",
        allStrongpoints: "Alle Strongpoints",
        defaultGarrisons: "Standard-Garnisonen",
        artillery: "Artillerie",
        repairStations: "Reparaturstationen",
        spawnRanges: "Spawn-Radien",
        overlaySide: "Overlay-Seite",
        sideA: "Seite A",
        sideB: "Seite B",
        visibleStrongpoints: "Sichtbare Strongpoints",
        wardogsReferences: "WARDOGS-Referenzen",
        wardogsHqs: "Hauptquartiere",
        wardogsTowers: "Türme",
        selectTool: "Auswählen",
        drawTool: "Zeichnen",
        lineTool: "Linie",
        polygonTool: "Polygon",
        measureTool: "Messen",
        rectTool: "Rechteck",
        circleTool: "Kreis",
        pingTool: "Ping",
        iconLabel: "Icon",
        zoomIn: "Vergrößern",
        zoomOut: "Verkleinern",
        resetZoom: "Zoom zurücksetzen",
        lineStart: "Linienanfang",
        lineEnd: "Linienende",
        showDistance: "Distanz anzeigen",
        none: "Keine",
        arrow: "Pfeil",
        circleMarker: "Kreis",
        squareMarker: "Quadrat",
        color: "Farbe",
        size: "Größe",
        noResults: "Keine Ergebnisse.",
        variantLabel: "Variante",
        modeLabel: "Modus",
        importSkipped: "; {count} nicht unterstützte Elemente übersprungen",
        emptyTitle: "Noch keine Stratmaps",
        emptyDescription:
            "Eine Stratmap ist eine geteilte taktische Karte mit Folien. Hänge sie an ein Match-Briefing, damit der Trupp den Plan sieht.",
        emptyMemberDescription:
            "Taktische Karten für kommende Matches erscheinen hier, sobald ein Manager sie erstellt.",
        deleteAction: "Stratmap löschen",
        deleteTitle: "„{title}“ löschen?",
        deleteDescription:
            "Die Stratmap und alle Folien verschwinden für alle. Der öffentliche Link funktioniert nicht mehr, auch wo er schon in Discord gepostet wurde. Das lässt sich nicht rückgängig machen.",
        deleteLinkedEvents: "Sie wird auch aus diesen Events entfernt:",
        deleted: "Stratmap gelöscht.",
        deleteFailed:
            "Die Stratmap konnte nicht gelöscht werden. Versuch es noch einmal.",
        showLeftPanel: "Details und Folien anzeigen",
        hideLeftPanel: "Details und Folien ausblenden",
        showRightPanel: "Werkzeuge anzeigen",
        hideRightPanel: "Werkzeuge ausblenden",
    },
    onboarding: {
        step: "Schritt {current} von {total}",
        back: "Zurück",
        next: "Weiter",
        finish: "Fertig",
        skip: "Tour überspringen",
        saveError:
            "Der Fortschritt konnte nicht gespeichert werden. Bitte versuche es erneut.",
        setupWelcome: {
            title: "Willkommen in deiner Einsatzzentrale",
            description:
                "Diese kurze Einrichtungshilfe erscheint einmal. Wähle zuerst einen Workspace; danach zeigt Logi die für dich relevanten Menüs.",
        },
        setupWorkspace: {
            title: "Workspace auswählen",
            description:
                "Nutze den Workspace-Wechsler in der linken Seitenleiste. Jeder Workspace hat eigene Events, Mitglieder und Discord-Einstellungen.",
        },
        setupBot: {
            title: "Discord-Bot einladen",
            description:
                "Wenn du einen Workspace verwaltest und der Bot noch fehlt, nutze auf diesem Dashboard die Schaltfläche zum Einladen. Aktualisiere danach den Bot-Status.",
        },
        setupBotNote:
            "Der Bot benötigt die Berechtigungen der aktivierten Funktionen. Seine Discord-Rolle muss über allen Rollen liegen, die er verwalten soll.",
        setupNext: {
            title: "Workspace-Tour öffnen",
            description:
                "Nach der Workspace-Auswahl zeigt Logi eine kurze, auf deinen Zugriff zugeschnittene Tour.",
        },
        memberWelcome: {
            title: "Das ist dein Workspace",
            description:
                "Die Seitenleiste zeigt die Bereiche dieser Community. Mit dem Workspace-Wechsler wechselst du jederzeit die Community.",
        },
        memberOperations: {
            title: "Einsätze verfolgen",
            description:
                "In Events, Matches, Trainings, Rostern und Briefings prüfst du Termine, Meldungen, Aufstellungen und Pläne.",
        },
        memberAccount: {
            title: "Konto bereithalten",
            description:
                "Über dein Kontomenü aktualisierst du Avatar und Plattform-IDs. Eine Plattform-ID kann für Mitgliedsanträge erforderlich sein.",
        },
        managerWelcome: {
            title: "Du kannst diesen Workspace verwalten",
            description:
                "Deine Seitenleiste enthält Operations- und Konfigurationsbereiche. Änderungen gelten nur für diese Community.",
        },
        managerOperations: {
            title: "Einsätze planen und veröffentlichen",
            description:
                "Erstelle Events, Matches, Trainings, Roster, Vorlagen und Stratmaps. Prüfe zuerst die Discord-Konfiguration.",
        },
        managerConfiguration: {
            title: "Vor der Automatisierung konfigurieren",
            description:
                "Mitglieder, Anträge, Gruppen, Tickets und Server-Einstellungen bestimmen die Bot-Funktionen. Richte Kanäle und Rollen zuerst ein.",
        },
    },
    shared: {
        openColumn: "Öffnen",
        nothingCreatedYet: "In diesem Bereich wurde noch nichts erstellt.",
        notSet: "-",
        detectedPlatformId: "Erkannt: {platform}",
        platformSteam: "Steam",
        platformEpic: "Epic Games",
        platformXbox: "Xbox",
        platformPlayStation: "PlayStation",
        platformOther: "Xbox / PlayStation / Andere",
        createMode: "Erstellungsmodus startet direkt im Bearbeitungsmodus.",
        searchTable: "Diese Tabelle durchsuchen...",
        noMatchingResults: "Keine passenden Ergebnisse gefunden.",
        previousPage: "Vorherige",
        nextPage: "Nächste",
        pageLabel: "Seite {page} von {pages}",
        showingResults: "{from}-{to} von {total} angezeigt",
        rosterMetaDescription:
            "Roster-Board mit Reserven, Rollen-Slots, Veröffentlichungsstatus und Bestätigungen.",
        rosterPageDescription:
            "Inspiriert von kompetitiven Roster-Boards: gruppierte Squads, sichtbare Reserven, Zuweisungsstatus und zukunftsfähiger Bestätigungs-Flow.",
    },
    rosterPublish: {
        publishTitle: "Aufstellung veröffentlichen",
        republishTitle: "Erneut veröffentlichen",
        publishedAt: "veröffentlicht {time}",
        publishedToday: "heute um {time}",
        publishedYesterday: "gestern um {time}",
        publishedOn: "{date} um {time}",
        close: "Schließen",
        contentLabel: "Was an Discord geht",
        variantPhotoText: "Foto und Aufstellung als Text",
        variantPhotoTextDescription:
            "Das Aufstellungsbild und darunter die Squads als Text. Durchsuchbar und auch am Handy lesbar.",
        variantPhoto: "Nur Foto",
        variantPhotoDescription:
            "Nur das Aufstellungsbild, wie es der alte Bot geschickt hat.",
        defaultChip: "Standard",
        defaultNote: "Die Standardansicht legen Sie fest unter",
        defaultNoteLink: "Nachrichten und Panels → Aufstellung",
        channelLabel: "Kanal",
        channelFrom: "aus",
        channelFromLink: "Kanäle und Sprache",
        channelMissing: "kein Kanal festgelegt",
        mentionLabel: "Eingeteilte Spieler erwähnen",
        mentionFirstHint: {
            one: "Die Nachricht erwähnt den {count} Spieler der Aufstellung.",
            few: "Die Nachricht erwähnt alle {count} Spieler der Aufstellung.",
            many: "Die Nachricht erwähnt alle {count} Spieler der Aufstellung.",
            other: "Die Nachricht erwähnt alle {count} Spieler der Aufstellung.",
        },
        mentionRepeatHint: "Beim Wiederholen stört es nur; die DMs genügen.",
        laterNote:
            "DMs zu Änderungen und die Änderungsübersicht gibt es ab der nächsten Veröffentlichung.",
        dmLabel: "Spieler per DM über Änderungen informieren",
        dmHint: {
            one: "Nur {count} Spieler, den die Änderung betrifft.",
            few: "Nur {count} Spieler, die die Änderung betrifft.",
            many: "Nur {count} Spieler, die die Änderung betrifft.",
            other: "Nur {count} Spieler, die die Änderung betrifft.",
        },
        postLabel: "Änderungsübersicht in den Kanal posten",
        postHint: "Eine kurze Nachricht unter der Aufstellung.",
        rostered: "in der Aufstellung",
        reserves: {
            one: "Reserve",
            few: "Reserve",
            many: "Reserve",
            other: "Reserve",
        },
        notAttending: "nicht dabei",
        changesTitle: "Änderungen seit der letzten Version",
        changesMoved: "{count} verschoben",
        changesAgainst: "Gegenüber der Version, veröffentlicht {time}.",
        noChanges: "Seit der letzten Version hat sich kein Spieler geändert.",
        toReserves: "in die Reserve",
        previewTitle: "Vorschau in {channel}",
        previewCaption: "Vereinfachte Vorschau der Nachricht.",
        republishCaption:
            "Die Nachricht in {channel} wird bearbeitet, es entsteht keine neue. Die Änderungsübersicht folgt darunter.",
        photoPlaceholder: "Aufstellungsfoto (PNG)",
        cancel: "Abbrechen",
        publish: "Aufstellung veröffentlichen",
        republish: "Erneut veröffentlichen",
        published: "Aufstellung veröffentlicht",
        republished: "Aufstellung erneut veröffentlicht",
        dmFailed: {
            one: "Die DM hat {count} Spieler nicht erreicht: {names}. Direktnachrichten von Servermitgliedern sind ausgeschaltet.",
            few: "Die DM hat {count} Spieler nicht erreicht: {names}. Direktnachrichten von Servermitgliedern sind ausgeschaltet.",
            many: "Die DM hat {count} Spieler nicht erreicht: {names}. Direktnachrichten von Servermitgliedern sind ausgeschaltet.",
            other: "Die DM hat {count} Spieler nicht erreicht: {names}. Direktnachrichten von Servermitgliedern sind ausgeschaltet.",
        },
        requestFailed:
            "Die Aufstellung ist gespeichert, aber die Änderungen wurden nicht an Discord gesendet. Bitte versuchen Sie es erneut.",
    },
    reminderDelivery: {
        title: "Die Erinnerung hat {sent} von {total} Spielern erreicht",
        body: "{names} haben in Discord Direktnachrichten von Servermitgliedern ausgeschaltet. Erreiche sie auf anderem Weg oder bitte sie, Nachrichten vom Server {clan} zu erlauben.",
        bodyOne:
            "{names} hat in Discord Direktnachrichten von Servermitgliedern ausgeschaltet. Erreiche ihn auf anderem Weg oder bitte ihn, Nachrichten vom Server {clan} zu erlauben.",
        failedAll:
            "Die Erinnerung konnte nicht gesendet werden. Bitte versuchen Sie es gleich erneut.",
        copyNames: "Namen kopieren",
        copied: "Namen kopiert",
        howTo: "Nachrichten von einem Server erlauben",
        meta: "{kind} · gesendet {time} · von {name}",
        metaAutomatic: "{kind} · gesendet {time} · automatisch nach Plan",
        kindUnanswered: "Anmeldeerinnerung",
        kindUnconfirmed: "Anwesenheitserinnerung",
        unknownSender: "einem Admin",
        and: "und",
        sentAt: "{date} um {time}",
        unknownPlayer: "ein unbekannter Spieler",
    },
    discordPreview: {
        regionLabel: "Vorschau der Discord-Nachricht",
        appTag: "APP",
        edited: "(bearbeitet)",
        usedCommand: "{user} hat {command} verwendet",
        onlyYouCanSee: "Nur du kannst dies sehen",
        dismissMessage: "Nachricht verwerfen",
        buttons: "Schaltflächen der Nachricht",
        externalLink: "externer Link",
        unavailable: "nicht verfügbar",
        unknownUser: "Benutzer",
        unknownRole: "Rolle",
        unknownChannel: "Kanal",
    },
    joinPage: {
        metaTitle: "{name} beitreten",
        metaDescription: "Tritt dem Spielserver {name} bei.",
        opening: "Öffne {game}…",
        players: "{players} / {capacity} Spieler",
        queue: "Warteschlange {queue}",
        steamPrompt:
            "Steam fragt, ob der Link geöffnet werden soll. Bestätige Öffnen.",
        manualTitle: "Manuell beitreten",
        addressLabel: "Serveradresse",
        copy: "Kopieren",
        copied: "Kopiert",
        copyFailed:
            "Kopieren fehlgeschlagen. Markiere die Adresse und kopiere sie selbst.",
        steamInstructions:
            "In Steam: Ansicht → Spielserver → Favoriten → Server hinzufügen und die Adresse einfügen.",
        backToDiscord: "Zurück zu Discord",
        joinCodeTitle: "Beitrittscode",
        joinCodeLabel: "Code zum Beitreten des Spiels",
        joinCodeHelp:
            "Öffne im Spiel den Spielbeitritt und gib diesen Code ein.",
        noAddress:
            "Die Serveradresse ist noch nicht eingestellt. Frag einen Clan-Admin.",
        noJoinCode:
            "Der Beitrittscode ist noch nicht eingestellt. Frag einen Clan-Admin.",
        notFoundTitle: "Server nicht gefunden",
    },
    discordPanelStatus: {
        states: {
            published: "Veröffentlicht",
            error: "Fehler",
            waiting: "Wartet auf den Bot",
            unsent: "Nicht gesendet",
            paused: "Pausiert",
        },
        botOnline: "Bot online",
        botVersion: "Version {version} · letzter Kontakt {ago}",
        refreshEvery: "Panels werden alle 60 s aktualisiert",
        botOffline:
            "Der Bot antwortet nicht · letzter Kontakt {ago}. Panels werden nicht aktualisiert und neue nicht gesendet. Prüft, ob der Bot läuft; startet ihn nach einem Update neu.",
        botNeverSeen:
            "Der Bot hat sich noch nicht gemeldet. Panels werden erst aktualisiert und gesendet, wenn der Bot läuft.",
        botOutdated:
            "Der Bot läuft mit der älteren Version {version}. Discord-Panels brauchen Version {required} oder neuer. Starten Sie den Bot nach dem Update neu; solange die alte Version läuft, werden Panels nicht aktualisiert.",
        permissions: {
            view_channel: "Kanal ansehen",
            send_messages: "Nachrichten senden",
            embed_links: "Links einbetten",
            attach_files: "Dateien anhängen",
            read_message_history: "Nachrichtenverlauf lesen",
        },
        errors: {
            bot_not_in_server: {
                title: "Der Bot ist nicht auf dem Discord-Server.",
                past: "Der Bot war nicht auf dem Discord-Server.",
                fix: "Ladet den Logi-Bot erneut auf den Server ein und klickt dann Erneut versuchen.",
            },
            channel_missing: {
                title: "Der Kanal {channel} existiert nicht mehr oder der Bot sieht ihn nicht.",
                past: "Der Kanal {channel} existierte nicht oder der Bot sah ihn nicht.",
                fix: "Wählt im Editor einen anderen Kanal und speichert.",
            },
            channel_type: {
                title: "In {channel} können keine Nachrichten gesendet werden.",
                past: "In {channel} konnten keine Nachrichten gesendet werden.",
                fix: "Wählt im Editor einen Text- oder Ankündigungskanal.",
            },
            missing_permissions: {
                title: "Dem Bot fehlt die Berechtigung {permissions} in {channel}.",
                past: "Dem Bot fehlte die Berechtigung {permissions} in {channel}.",
                fix: "Öffnet in Discord Kanal bearbeiten → Berechtigungen → Logi und aktiviert {permissions}. Klickt dann Erneut versuchen.",
            },
            delivery_uncertain: {
                title: "Discord hat nicht bestätigt, ob die Nachricht angekommen ist.",
                past: "Discord hat nicht bestätigt, ob die Nachricht angekommen ist.",
                fix: "Der Bot findet die Nachricht bei der nächsten Aktualisierung oder sendet sie erneut. Nichts zu tun.",
            },
            discord_unavailable: {
                title: "Discord antwortet gerade nicht.",
                past: "Discord hat nicht rechtzeitig geantwortet.",
                fix: "Der Bot versucht es selbst erneut. Dauert es lange, klickt Erneut versuchen.",
            },
            source_missing: {
                title: "Der Spielserver des Panels ist nicht mehr in Logi.",
                past: "Der Spielserver des Panels war nicht in Logi.",
                fix: "Wählt im Editor einen anderen Server oder löscht das Panel.",
            },
            source_not_collecting: {
                title: "Logi sammelt keine Daten vom Spielserver.",
                past: "Logi hat keine Daten vom Spielserver gesammelt.",
                fix: "Aktiviert die Sammlung unter Spielserver und klickt dann Erneut versuchen.",
            },
            provider_unreachable: {
                title: "Der Spielserver antwortet nicht.",
                past: "Der Spielserver hat nicht geantwortet.",
                fix: "Das Panel zeigt die letzten Daten. Prüft Adresse und Schlüssel unter Spielserver.",
            },
            provider_rate_limited: {
                title: "Der Datenanbieter lehnt gerade weitere Anfragen ab.",
                past: "Der Datenanbieter hat weitere Anfragen abgelehnt.",
                fix: "Das Panel zeigt die letzten Daten und versucht es erneut. Dauert es über eine Stunde, erhöht das Limit des Schlüssels oder ersetzt ihn unter Spielserver.",
            },
            render_failed: {
                title: "Das Panel konnte nicht erstellt werden.",
                past: "Das Panel konnte nicht erstellt werden.",
                fix: "Kürzt Titel oder Beschreibung des Panels. Bleibt der Fehler, meldet ihn dem Logi-Support.",
            },
            unsupported_kind: {
                title: "Der Bot kann diese Panelart noch nicht.",
                past: "Der Bot konnte diese Panelart nicht.",
                fix: "Aktualisiert den Bot und startet ihn neu.",
            },
            competition_missing: {
                title: "Der Wettbewerb des Panels existiert nicht mehr.",
                past: "Der Wettbewerb des Panels existierte nicht.",
                fix: "Wählt im Editor einen anderen Wettbewerb oder löscht das Panel.",
            },
            league_disabled: {
                title: "Wardogs League ist in den Einstellungen ausgeschaltet, daher hat der Bot die Nachrichten des Panels gelöscht.",
                past: "Wardogs League war in den Einstellungen ausgeschaltet.",
                fix: "Schaltet Wardogs League unter Einstellungen → Wardogs League ein; der Bot sendet dann beide Nachrichten neu.",
            },
            unknown: {
                title: "Die Nachricht konnte nicht gesendet werden.",
                past: "Die Nachricht konnte nicht gesendet werden.",
                fix: "Klickt Erneut versuchen. Bleibt der Fehler, meldet ihn dem Logi-Support.",
            },
        },
        warnings: {
            password_hidden_public_channel:
                "Der Kanal ist jetzt öffentlich, deshalb wurde das Passwort aus dem Panel entfernt. Verschiebt das Panel in einen privaten Kanal, damit es wieder erscheint.",
            live_data_unavailable:
                "Live-Daten sind gerade nicht verfügbar; das Panel zeigt die zuletzt gesammelten Daten.",
            attach_files_missing:
                "Dem Bot fehlt die Berechtigung Dateien anhängen, daher hat das Panel kein Bild.",
        },
    },
    discordPanelsPage: {
        newPanel: "Neues Panel",
        time: {
            today: "heute um {time}",
            yesterday: "gestern um {time}",
            date: "{date} um {time}",
            now: "jetzt",
        },
        bot: {
            online: "Bot online",
            version: "Version {version} · letzter Kontakt {ago}",
            refreshEvery: "Panels werden alle 60 s aktualisiert",
            offlineTitle: "Der Bot antwortet nicht · letzter Kontakt {ago}.",
            offlineBody:
                "Panels werden gerade nicht aktualisiert und neue nicht gesendet. Prüfen Sie, ob der Bot läuft; starten Sie ihn nach einem Update neu.",
            outdatedTitle: "Der Bot läuft mit der älteren Version {version}.",
            outdatedBody:
                "Discord-Panels brauchen Version {required} oder neuer. Starten Sie den Bot nach dem Update neu; solange die alte Version läuft, werden Panels nicht aktualisiert.",
            unknownTitle: "Der Bot hat sich noch nicht gemeldet.",
            unknownBody:
                "Panels werden nicht aktualisiert und neue nicht gesendet, bis der Bot läuft. Starten Sie den Bot; sein Zustand erscheint hier innerhalb von 30 s.",
            notInServer:
                "Der Bot hat sich auf diesem Discord-Server seit über 3 Minuten nicht gemeldet. Prüfen Sie, ob der Logi-Bot auf den Server eingeladen ist; bis dahin werden keine Panels gesendet.",
        },
        sources: {
            title: "Datenquellen",
            link: "Spielserver",
            collecting: "Sammelt · letzte Daten {ago}",
            collectingNoData: "Sammelt · noch keine Daten",
            notCollecting:
                "Sammelt nicht · Sammeln unter Spielserver einschalten",
            stale: "Ältere Daten · letzte Daten {ago}",
            unavailable: "Antwortet nicht · letzte Daten {ago}",
            liveOk: "Live-Daten ✓",
            liveLimited: "Live-Daten gerade eingeschränkt",
            empty: "Es gibt noch keinen Spielserver. Fügen Sie ihn unter Spielserver hinzu.",
            providers: { hll_crcon: "CRCON", wardogs_warcon: "Warcon" },
        },
        games: { hell_let_loose: "HLL", wardogs: "Wardogs" },
        gameNames: { hell_let_loose: "Hell Let Loose", wardogs: "Wardogs" },
        list: {
            title: "Panels",
            count: {
                one: "{count} Panel",
                few: "{count} Panels",
                many: "{count} Panels",
                other: "{count} Panels",
            },
            states: {
                published: {
                    one: "{count} veröffentlicht",
                    few: "{count} veröffentlicht",
                    many: "{count} veröffentlicht",
                    other: "{count} veröffentlicht",
                },
                error: {
                    one: "{count} Fehler",
                    few: "{count} Fehler",
                    many: "{count} Fehler",
                    other: "{count} Fehler",
                },
                waiting: {
                    one: "{count} wartet auf den Bot",
                    few: "{count} warten auf den Bot",
                    many: "{count} warten auf den Bot",
                    other: "{count} warten auf den Bot",
                },
                unsent: {
                    one: "{count} nicht gesendet",
                    few: "{count} nicht gesendet",
                    many: "{count} nicht gesendet",
                    other: "{count} nicht gesendet",
                },
                paused: {
                    one: "{count} pausiert",
                    few: "{count} pausiert",
                    many: "{count} pausiert",
                    other: "{count} pausiert",
                },
            },
            empty: "Es gibt noch keine Panels. Beginnen Sie mit Neues Panel.",
            loading: "Panels werden geladen…",
            loadFailed:
                "Die Panels konnten nicht geladen werden. Prüfen Sie die Verbindung und laden Sie die Seite neu.",
            groups: {
                live: { title: "Live-Server", hint: "ein Panel pro Server" },
                combined: {
                    title: "Unsere Server",
                    hint: "mehrere Server in einer Nachricht",
                },
                control: {
                    title: "Serversteuerung",
                    hint: "privater Admin-Kanal",
                },
                results: { title: "Ergebnisse", hint: "" },
                league: {
                    title: "WD League",
                    hint: "zwei Nachrichten untereinander in einem Kanal",
                },
                calendar: { title: "Kalender", hint: "" },
                competition: {
                    title: "Wettbewerbe",
                    hint: "Tabelle nach jedem bestätigten Ergebnis",
                },
            },
            titles: {
                results: "Ergebnisse {game}",
                leagueTable: "WD League · Tabelle",
                leagueFixtures: "WD League · nächste Spiele",
                calendar: "Kalender",
                combined: "Unsere Server",
                control: "Serversteuerung",
                competition: "Wettbewerbstabelle",
                unknownServer: "Server ohne Namen",
            },
            meta: {
                publicChannel: "öffentlicher Kanal",
                privateChannel: "privater Kanal",
                privateWithPassword: "privater Kanal, mit Passwort",
                unknownChannel: "unbekannter Kanal",
                results: "bestätigte Spiele des Clans",
                leagueTable: "ganze Liga, Punkte nach den Ligaregeln",
                leagueFixtures: {
                    one: "{count} nächstes Spiel und letzte Ergebnisse",
                    few: "{count} nächste Spiele und letzte Ergebnisse",
                    many: "{count} nächste Spiele und letzte Ergebnisse",
                    other: "{count} nächste Spiele und letzte Ergebnisse",
                },
                leagueFixturesOnly: {
                    one: "{count} nächstes Spiel",
                    few: "{count} nächste Spiele",
                    many: "{count} nächste Spiele",
                    other: "{count} nächste Spiele",
                },
                leagueRecentOnly: "letzte Ergebnisse",
                calendarAll: "Clan-Events, alle Kategorien",
                calendarCategories: "Clan-Events, Kategorien {categories}",
                and: "und",
                control: "nur Logi-Admins",
                competition: "Wettbewerb {name}",
            },
            timing: {
                updated: "Aktualisiert {ago}",
                nextRefresh: "nächste Aktualisierung {in}",
                lastAttempt: "Letzter Versuch {ago}",
                nextRetry: "nächster Versuch {in}",
                notInDiscord: "die Nachricht ist noch nicht in Discord",
                requested: "Zur Veröffentlichung gesendet {ago}",
                pickup: "der Bot übernimmt es innerhalb von 15 s",
                firstPass:
                    "Der Bot übernimmt es beim nächsten Durchlauf, innerhalb von 15 s",
                saved: "Gespeichert {when}",
                notSentYet: "noch nicht an Discord gesendet",
                pausedBy: "Pausiert von {name} · {when}",
                pausedAt: "Pausiert {when}",
                pausedKeeps: "die Nachricht bleibt und wird nicht aktualisiert",
                lastResult: "Letztes Ergebnis {when}",
                noResultYet: "Noch kein bestätigtes Ergebnis",
                resultsInChannel: {
                    one: "{count} Ergebnis im Kanal",
                    few: "{count} Ergebnisse im Kanal",
                    many: "{count} Ergebnisse im Kanal",
                    other: "{count} Ergebnisse im Kanal",
                },
                resultsBackfill:
                    "hat beim Erstellen die letzten 5 bestätigten gesendet",
                controlButtons:
                    "Schaltflächen Seed, Aktualisieren und Pausieren",
                calendarSetting:
                    "Kanal aus der früheren Einstellung; Bearbeiten macht daraus ein Panel",
                leagueBoth: "Schaltflächen gelten für beide Liga-Nachrichten",
                open: "Nachricht öffnen",
            },
            buttons: {
                edit: "Bearbeiten",
                refresh: "Jetzt aktualisieren",
                pause: "Pausieren",
                resume: "Fortsetzen",
                publish: "In den Kanal senden",
                fix: "Beheben",
                retry: "Erneut versuchen",
            },
            rowActions: "Aktionen des Panels {name}",
        },
        actions: {
            accepted: {
                publish:
                    "Zur Veröffentlichung gesendet. Der Bot übernimmt es innerhalb von 15 s.",
                refresh:
                    "Aktualisierung angefordert. Der Bot zeichnet das Panel innerhalb von 15 s neu.",
                pause: "Das Panel ist pausiert. Die Nachricht bleibt und wird nicht aktualisiert.",
                resume: "Das Panel läuft wieder. Der Bot zeichnet es innerhalb von 15 s neu.",
                retry: "Wir versuchen es innerhalb von 15 s erneut.",
                delete: "Die Nachricht wird innerhalb von 15 s aus Discord entfernt. Das Panel bleibt als nicht gesendet gespeichert.",
                remove: "Das Panel wird mit seinen Discord-Nachrichten entfernt.",
                control:
                    "Der Bot zeichnet die Nachricht Serversteuerung innerhalb von 15 s neu.",
            },
            failed: "Die Aktion hat nicht funktioniert. Versuchen Sie es erneut.",
            notSent: "Das Panel ist noch nicht in Discord.",
            removing: "Das Panel wird gerade entfernt.",
            notFound: "Das Panel existiert nicht mehr.",
        },
        editor: {
            back: "Panels in Discord",
            newTitle: "Neues Panel",
            newStatus: "Neues Panel · noch nicht in Discord",
            statusChannel: "in {channel}",
            statusUpdated: "aktualisiert {ago}",
            statusNext: "nächste Aktualisierung {in}",
            openInDiscord: "Nachricht in Discord öffnen",
            notFound:
                "Panel nicht gefunden. Vielleicht wurde es inzwischen entfernt. Kehren Sie zur Panel-Liste zurück.",
            loading: "Panel wird geladen…",
            steps: {
                type: "Panel-Typ",
                server: "Server",
                servers: "Server",
                game: "Spiel",
                calendar: "Events",
                competition: "Wettbewerb",
                channel: "Kanal",
                content: "Inhalt",
                contentLeague: "Inhalt · WD League",
                look: "Aussehen",
                refresh: "Aktualisierung",
            },
            edit: "Bearbeiten",
            collapse: "Schließen",
            types: {
                server: {
                    title: "Live-Server",
                    text: "Ein Server: Karte, Spieler, Punktestand.",
                },
                servers: {
                    title: "Unsere Server",
                    text: "Mehrere Server in einer Nachricht.",
                },
                results: {
                    title: "Ergebnisse",
                    text: "Eine Karte nach jedem bestätigten Spiel.",
                },
                league: {
                    title: "WD League",
                    text: "Tabelle und nächste Spiele der Liga.",
                },
                calendar: {
                    title: "Kalender",
                    text: "Die nächsten Clan-Events.",
                },
                competition: {
                    title: "Wettbewerbstabelle",
                    text: "Gruppentabellen eines Logi-Wettbewerbs.",
                },
            },
            typeLocked:
                "Der Typ eines gesendeten Panels lässt sich nicht ändern. Erstellen Sie für einen anderen Typ ein neues Panel.",
            typeTaken:
                "Der Clan hat diesen Typ schon; bearbeiten Sie dieses Panel.",
            server: {
                label: "Spielserver",
                placeholder: "Server wählen",
                empty: "Es gibt noch keinen Spielserver. Fügen Sie ihn hinzu unter",
                emptyLink: "Spielserver",
                healthCollecting: "Sammelt · letzte Daten {ago}",
                healthNoData: "Sammelt · noch keine Daten",
                healthNotCollecting: "Sammelt nicht",
                liveOk: "Live-Daten ✓",
                liveLimited:
                    "Live-Daten gerade eingeschränkt, siehe Serverdaten",
            },
            servers: {
                order: "In dieser Reihenfolge in der Nachricht. Ziehen Sie, um die Reihenfolge zu ändern.",
                moveUp: "{server} nach oben",
                moveDown: "{server} nach unten",
                drag: "{server} ziehen",
            },
            game: {
                label: "Spiel",
                help: "Ergebnisse eines Spiels. Jedes Spiel hat höchstens ein Ergebnis-Panel; beim Erstellen sendet es die letzten 5 bestätigten.",
            },
            calendar: {
                label: "Event-Kategorien",
                help: "Ohne Auswahl zeigt das Panel alle Clan-Events.",
            },
            competition: {
                label: "Wettbewerb",
                placeholder: "Wettbewerb wählen",
                empty: "Der Clan spielt noch keinen Logi-Wettbewerb.",
            },
            channel: {
                label: "Panel-Kanal",
                placeholder: "Kanal wählen",
                verify: "Prüfen",
                verifying: "Wird geprüft…",
                has: "Hat:",
                missing: "Fehlt:",
                attachHint:
                    "Ohne sie sendet das Panel nur Text, ohne Kartenbilder.",
                public: "Alle (@everyone) sehen den Kanal. Das Serverpasswort kann hier nicht angezeigt werden.",
                private: "Der Kanal ist privat ✓",
                privateRoles: "· nur {roles} und Admins sehen ihn.",
                privateAdmins: "· nur Admins sehen ihn.",
                privatePassword:
                    "· @everyone sieht ihn nicht, das Passwort wird angezeigt.",
                role: "die Rolle {name}",
                unsupported:
                    "In diesen Kanal kann keine Nachricht gesendet werden. Wählen Sie einen Text- oder Ankündigungskanal.",
                timedOut:
                    "Der Bot hat auf dem Server ein Timeout und kann nicht schreiben. Heben Sie es in Discord auf.",
                failed: "Der Kanal konnte nicht geprüft werden. Versuchen Sie es erneut.",
                unverified:
                    "Wählen Sie Prüfen: Logi prüft die Berechtigungen des Bots und ob alle den Kanal sehen.",
            },
            content: {
                show: "Was angezeigt wird",
                compact: {
                    label: "Kompakte Ansicht",
                    help: "Eine kürzere Ergebniskarte: der Spielstand ohne die Zeile mit den Seiten; eine Korrektur sagt nur, wann und was vorher stand.",
                },
                score: {
                    label: "Punktestand",
                    help: "Alliierte : Achse nach Sektoren.",
                },
                leaders: {
                    label: "Beste Spieler",
                    help: "Kills; der ganze Kanal sieht die Namen.",
                },
                nextMap: { label: "Nächste Karte", help: "" },
                queue: {
                    label: "Warteschlange",
                    help: "Nur wenn der Server sie meldet.",
                },
                connection: "Beitreten",
                address: {
                    label: "IP:Port anzeigen",
                    help: "Das Panel zeigt {address}. Die Adresse geben Sie hier ein; sie gilt für alle Panels dieses Servers.",
                    helpCombined:
                        "Bei HLL-Servern. Die Adressen geben Sie hier ein; jede gilt für alle Panels ihres Servers.",
                    missing:
                        "Noch ist keine Serveradresse gespeichert. Geben Sie sie hier ein.",
                    field: "IP:Port · {server}",
                    placeholder: "203.0.113.24:7777",
                    clear: "Entfernen",
                    clearFor: "IP:Port entfernen · {server}",
                },
                joinCode: {
                    label: "Join-Code anzeigen",
                    help: "Bei Wardogs-Servern.",
                    field: "Join-Code · {server}",
                    clear: "Entfernen",
                    clearFor: "Join-Code entfernen · {server}",
                },
                joinButton: {
                    label: "Schaltfläche Beitreten (über Logi)",
                    help: "Öffnet {url}, die Steam startet.",
                    helpWardogs: "Öffnet {url} mit dem Join-Code.",
                    helpCombined:
                        "Bei HLL-Servern; Wardogs tritt mit einem Code bei.",
                },
                password: {
                    label: "Serverpasswort anzeigen",
                    field: "Serverpasswort",
                    fieldServer: "Passwort · {server}",
                    help: "Wird verschlüsselt gespeichert. Logi zeigt es nur in einem privaten Kanal.",
                    stored: "Ein Passwort ist verschlüsselt gespeichert. Ein neues ersetzt es.",
                    clear: "Gespeichertes Passwort löschen",
                    publicTitle:
                        "Alle sehen den Kanal, das Passwort kann nicht angezeigt werden.",
                    publicFix:
                        "Wählen Sie einen Kanal, den @everyone nicht sieht.",
                    unverified:
                        "Das Passwort kann nur in einem Kanal angezeigt werden, den @everyone nicht sieht. Wählen Sie beim Kanal Prüfen.",
                    combined:
                        "Die Nachricht Unsere Server zeigt das Passwort nie; nur das eigene Panel des Servers zeigt es in einem privaten Kanal.",
                },
                buttons: "Schaltflächen",
                players: {
                    label: "Spieler anzeigen",
                    help: "Die Spielerliste sieht nur, wer klickt.",
                },
                report: {
                    label: "Spieler melden",
                    help: "Öffnet einen privaten Thread für die Admins.",
                    category: "Ticket-Kategorie",
                    categoryPlaceholder: "Kategorie wählen",
                    note: "Kanal und Support stellen Sie ein unter",
                    noCategories:
                        "Tickets haben noch keine Kategorie mit privatem Kanal. Richten Sie sie ein unter",
                    provider:
                        "Meldungen gibt es nur bei CRCON- und Warcon-Servern.",
                },
                ticketsLink: "Tickets",
                seed: "Seed",
                seedProgress: {
                    label: "Seed-Fortschritt anzeigen",
                    help: "Während ein Seed läuft, zeigt das Panel die Spieler bis zum Live-Spiel.",
                    helpCombined: "Beim Server, auf dem gerade ein Seed läuft.",
                },
                seedNote:
                    "Die Schaltfläche Seed gibt es nur in der Nachricht Serversteuerung für Admins.",
                seedPlan: "Seed-Plan",
                noContent:
                    "Dieser Panel-Typ hat keine weiteren Inhaltsschalter.",
            },
            league: {
                table: {
                    label: "Tabelle",
                    help: "Rangliste aller Ligateams. Logi berechnet die Punkte aus den Ergebnissen nach den Ligaregeln.",
                },
                fixtures: {
                    label: "Nächste Spiele",
                    help: "Teams, Fraktionen, Karte, Gastgeber und wie weit die Vorbereitung ist.",
                },
                recent: {
                    label: "Letzte Ergebnisse",
                    help: "Unter den nächsten Spielen.",
                },
                count: {
                    label: "Anzahl der Spiele",
                    help: "Wie viele nächste Spiele die Nachricht zeigt.",
                },
                note: "Alle Spiele der Liga, nicht nur unsere. Tabelle und nächste Spiele sind zwei Nachrichten untereinander in {channel} und werden alle 60 s aktualisiert. Eigene Ligakarten pro Spiel gibt es nicht mehr.",
                channelFallback: "einem Kanal",
            },
            look: {
                title: {
                    label: "Name",
                    help: "Wird als Titel der Nachricht angezeigt.",
                },
                description: {
                    label: "Beschreibung",
                    help: "Optional. Ein kurzer Satz unter dem Titel.",
                },
                banner: {
                    label: "Banner",
                    upload: "Banner hochladen",
                    choose: "Hochgeladenes wählen",
                    hide: "Hochgeladene ausblenden",
                    remove: "Entfernen",
                    help: "Kein Banner. Es ersetzt das Kartenbild. PNG, JPEG oder WebP bis 2 MiB.",
                    set: "Eigenes Banner. Es ersetzt das Kartenbild. PNG, JPEG oder WebP bis 2 MiB.",
                    uploading: "Banner wird hochgeladen…",
                    uploaded: "Banner hochgeladen.",
                    selected: "Banner gewählt.",
                    libraryLoading: "Hochgeladene Banner werden geladen…",
                    libraryEmpty: "Es wurden noch keine Banner hochgeladen.",
                    libraryError:
                        "Die hochgeladenen Banner konnten nicht geladen werden.",
                    library: "Hochgeladene Banner",
                    libraryItem:
                        "Banner {width} × {height}, hochgeladen {date}",
                    preview: "Banner-Vorschau",
                },
                accent: {
                    label: "Balkenfarbe",
                    clan: "Clanfarbe",
                    custom: "Eigene Farbe",
                    customHelp: "Nur für dieses Panel",
                    picker: "Balkenfarbe wählen",
                    field: "Balkenfarbe des Panels",
                    invalid: "Geben Sie eine Farbe als #RRGGBB ein.",
                },
                style: {
                    label: "Panel-Stil",
                    clan: "Wie in Panel-Grafik",
                    clanHelp: "Jetzt {style}",
                    help: "Den Standardstil aller Panels stellen Sie ein unter",
                    link: "Panel-Grafik",
                },
                summary: {
                    title: "Name {title}",
                    titleDefault: "Name vom Server",
                    description: "Beschreibung ausgefüllt",
                    noDescription: "ohne Beschreibung",
                    banner: "eigenes Banner",
                    noBanner: "ohne Banner",
                    accentClan: "Clanfarbe",
                    accentCustom: "eigene Farbe {color}",
                    style: "{style}",
                },
            },
            refresh: {
                locked: "Alle 60 s · gleich für alle Panels",
                footer: {
                    label: "In der Fußzeile anzeigen",
                    help: "„Aktualisiert vor 6 s · wird alle 60 s aktualisiert“",
                },
                summaryFooter: "Alle 60 s · in der Fußzeile",
                summaryNoFooter: "Alle 60 s · ohne Fußzeile",
            },
            preview: {
                title: "Vorschau in {channel} · echte Daten von {server}",
                titleCombined:
                    "Vorschau in {channel} · echte Daten von {count} Servern",
                titleLeague:
                    "Vorschau in {channel} · zwei Nachrichten untereinander",
                titlePlain: "Vorschau in {channel}",
                noChannel: "dem Kanal",
                author: "heute um {time}",
                pending:
                    "Die Vorschau erscheint, sobald die Serverdaten geladen sind.",
                noServer:
                    "Wählen Sie einen Server, dann erscheint die Vorschau.",
                loading: "Serverdaten werden geladen…",
                leagueLoading: "Ligadaten werden geladen…",
                leagueFailed: "Die Ligadaten konnten nicht geladen werden.",
                resultsEmpty:
                    "Die Karte erscheint nach dem ersten bestätigten Ergebnis. Die Vorschau zeigt das letzte Spiel mit Ergebnis.",
                resultsNone: "Der Clan hat noch kein Spiel mit Ergebnis.",
                calendarNote:
                    "Vorschau aus den Events in Logi; die Links zu den Ankündigungen ergänzt der Bot.",
                competitionNote:
                    "Die Gruppentabellen erstellt der Bot nach dem Speichern.",
                noAttach:
                    "Dem Bot fehlt die Berechtigung {permission} in {channel}, daher sendet er das Panel nur als Text ohne Bilder, wie diese Vorschau.",
            },
            joinPage: {
                title: "Nach Klick auf Beitreten · Logi-Seite",
                players: "{game} · {map} · {players} / {capacity} Spieler",
                open: "In Steam öffnen",
                fallback:
                    "Steam hat sich nicht geöffnet? Wählen Sie im Spiel Über IP beitreten und geben Sie {address} ein.",
                joinCode:
                    "Öffnen Sie im Spiel den Beitritt und geben Sie den Code {code} ein.",
                noAddress:
                    "Ohne Adresse sagt die Seite nur, dass der Spieler einen Admin fragen soll.",
                noJoinCode:
                    "Ohne Beitrittscode sagt die Seite nur, dass der Spieler einen Admin fragen soll.",
                caption:
                    "Discord erlaubt in einer Schaltfläche nur http(s)-Links. Diese Seite öffnet sofort steam://connect und zeigt sonst die IP.",
                captionJoinCode:
                    "Discord erlaubt in einer Schaltfläche nur http(s)-Links. Diese Seite zeigt den Beitrittscode des Spiels und bietet an, ihn zu kopieren.",
            },
            data: {
                title: "Serverdaten",
                load: "Daten vom Server laden",
                loading: "Wird geladen…",
                help: "Derselbe Abruf, den der Bot macht.",
                loadedAgo: "Daten geladen {ago}.",
                result: "Daten geladen {ago} · {map} · {players}/{capacity}",
                perServer:
                    "{server} · geladen {ago} · {map} · {players}/{capacity}",
                score: "Punktestand {score}",
                timeLeft: "noch {minutes} min",
                queue: "Warteschlange {count}",
                inStats: "{count} Spieler in der Statistik",
                nextMap: "nächste Karte {map}",
                seed: "Seed läuft · {players} von {liveFrom}",
                stale: "Der Server hat ältere Daten gesendet.",
                unavailable:
                    "Der Server antwortet nicht. Das Panel zeigt die zuletzt gesammelten Daten.",
                busy: "Ein anderer Abruf des Servers läuft. Versuchen Sie es in {seconds} s erneut.",
                denied: "Der Schlüssel darf keine Live-Daten lesen. Ersetzen Sie ihn unter Spielserver.",
                failed: "Der Abruf ist fehlgeschlagen. Das Panel zeigt die zuletzt gesammelten Daten und versucht es erneut.",
                rateLimited:
                    "{server} · {provider} lehnt gerade weitere Anfragen ab (Limit 429).",
                rateLimitedBody:
                    "Das Panel zeigt die Daten von {ago} und versucht es in {seconds} s erneut. Dauert es über eine Stunde, erhöhen Sie das Limit des Schlüssels {providerIn} oder ersetzen Sie ihn unter Spielserver → {server}.",
                providerIn: {
                    hll_crcon: "in CRCON",
                    wardogs_warcon: "in Warcon",
                },
                snapshot:
                    "Dieser Server hat keinen Live-Abruf; gezeigt werden die gesammelten Daten.",
                notCollecting: "Logi sammelt von diesem Server keine Daten.",
                requestFailed:
                    "Die Daten konnten nicht geladen werden. Versuchen Sie es erneut.",
                notServerKind:
                    "Serverdaten werden nur bei Server-Panels gelesen.",
            },
            source: {
                title: "Quelle · {server}",
                link: "Spielserver",
                collection: "Datensammlung",
                live: "Live-Daten",
                liveOk: "✓ letzter Abruf {ago}",
                liveNone: "noch nicht gelesen",
                liveLimited: "eingeschränkt, siehe Serverdaten",
                key: "Schlüssel",
                keySet: "verschlüsselt gespeichert",
                keyVerified: "geprüft {date}",
                keyNotVerified: "nicht geprüft",
                keyMissing: "fehlt",
                keyNotRequired: "nicht nötig",
                keyEnvironment: "vom Logi-Betreiber gesetzt",
                address: "Adresse",
                addressValue: "{origin} · Server {id}",
            },
            delivery: {
                title: "Zustellung",
                saved: "Gespeichert",
                claimed: "Bot übernommen",
                sent: "Gesendet",
                lastRefresh: "Letzte Aktualisierung",
                notYet: "noch nicht",
                none: "—",
                savedBy: "{when} · {name}",
                sentIn: "Nachricht in {channel}",
                refreshValue: "{ago} · nächste {in}",
                hint: "Nach In den Kanal senden werden die Schritte abgehakt, meist innerhalb von 15 s. Die Seite aktualisiert sich selbst.",
                lastError: "Letzter Fehler:",
                recovered: "Der nächste Versuch {after} später ging durch.",
                recoveredAfter: {
                    second: {
                        one: "eine Sekunde",
                        few: "{count} Sekunden",
                        many: "{count} Sekunden",
                        other: "{count} Sekunden",
                    },
                    minute: {
                        one: "eine Minute",
                        few: "{count} Minuten",
                        many: "{count} Minuten",
                        other: "{count} Minuten",
                    },
                    hour: {
                        one: "eine Stunde",
                        few: "{count} Stunden",
                        many: "{count} Stunden",
                        other: "{count} Stunden",
                    },
                    day: {
                        one: "einen Tag",
                        few: "{count} Tage",
                        many: "{count} Tage",
                        other: "{count} Tage",
                    },
                },
                stuck: {
                    title: "Wenn die Zustellung hängt",
                    lead: "Senden nicht bestätigt.",
                    body: "Discord hat nicht bestätigt, dass es die Nachricht erhalten hat, und in {channel} haben wir sie nicht gefunden. Erneut versuchen sendet sie noch einmal.",
                },
            },
            bar: {
                adoptCalendar:
                    "Der Kalender ist schon in {channel}. Speichern übernimmt ihn: Die Nachricht wird bearbeitet, keine neue gesendet.",
                editsMessage:
                    "Speichern bearbeitet die Nachricht in {channel}; es wird keine neue gesendet.",
                notInDiscord: "Das Panel ist noch nicht in Discord.",
                pausedNote:
                    "Das Panel ist pausiert; Speichern setzt es nicht fort.",
                delete: "Nachricht löschen",
                deleteConfirm:
                    "Die Nachricht aus Discord löschen? Das Panel bleibt als nicht gesendet gespeichert.",
                removePanel: "Panel entfernen",
                removeConfirm:
                    "Panel entfernen? Seine Nachrichten verschwinden aus Discord und die Einstellungen werden gelöscht.",
                pause: "Pausieren",
                resume: "Fortsetzen",
                refresh: "Jetzt aktualisieren",
                save: "Speichern",
                publish: "In den Kanal senden",
                saving: "Wird gespeichert…",
                discard: "Verwerfen",
                actions: "Panel-Aktionen",
            },
            saved: "Gespeichert.",
            savedSent:
                "Gespeichert und zur Veröffentlichung gesendet. Der Bot übernimmt es innerhalb von 15 s.",
            problems: {
                channel: "Wählen Sie einen Kanal.",
                server: "Wählen Sie einen Spielserver.",
                servers: "Wählen Sie mindestens einen Server.",
                reportCategory: "Wählen Sie eine Ticket-Kategorie.",
                accentColor: "Geben Sie eine Farbe als #RRGGBB ein.",
                competition: "Wählen Sie einen Wettbewerb.",
                fixtureCount: "Die Anzahl der Spiele muss 1 bis 10 sein.",
            },
            errors: {
                not_found: "Das Panel existiert nicht mehr.",
                conflict:
                    "Jemand anderes hat das Panel inzwischen geändert. Laden Sie die Seite neu.",
                kind_locked:
                    "Der Typ eines gesendeten Panels lässt sich nicht ändern.",
                removing: "Das Panel wird gerade entfernt.",
                source_not_found: "Der Spielserver ist nicht mehr in Logi.",
                game_mismatch: "Der Server gehört nicht zum Spiel des Panels.",
                report_destination_missing:
                    "Die Ticket-Kategorie hat keinen privaten Kanal. Richten Sie sie unter Tickets ein.",
                report_provider:
                    "Meldungen gibt es nur bei CRCON- und Warcon-Servern.",
                duplicate_channel:
                    "Dieser Server hat in diesem Kanal schon ein Panel.",
                results_exists: "Dieses Spiel hat schon ein Ergebnis-Panel.",
                league_exists: "Der Clan hat schon ein WD-League-Panel.",
                calendar_exists: "Der Clan hat schon ein Kalender-Panel.",
                competition_not_found: "Der Wettbewerb existiert nicht mehr.",
                panel_limit: "Ein Clan kann höchstens 20 Panels haben.",
                asset_unavailable:
                    "Das Banner ist nicht mehr verfügbar. Laden Sie es erneut hoch.",
                invalid_settings: "Eine Einstellung ist ungültig.",
                unavailable:
                    "Das Speichern ist fehlgeschlagen. Versuchen Sie es erneut.",
                address:
                    "Die Adresse muss IP:Port sein, zum Beispiel 203.0.113.24:7777.",
                joinCode:
                    "Ein Join-Code darf nur Buchstaben, Ziffern und Bindestriche enthalten.",
                password:
                    "Ein Passwort hat 1 bis 64 Zeichen ohne Steuerzeichen.",
                encryption_unavailable:
                    "Das Passwort kann gerade nicht gespeichert werden: Die Verschlüsselung ist nicht aktiviert. Bitten Sie den Logi-Betreiber, den Schlüssel einzurichten.",
            },
        },
    },
    seedPage: {
        breadcrumbParent: "Panels in Discord",
        back: "Panels in Discord",
        title: "Server-Seeding",
        description:
            "Wenn ein Server leer ist, ruft Logi Spieler zusammen: Es sendet einen Aufruf, markiert die Rolle Seed und zeigt im Panel, wie viele Spieler fehlen. Starten dürfen ihn nur Logi-Admins.",
        serversLabel: "Die Spielserver des Clans",
        noServers:
            "Der Clan hat noch keinen Spielserver. Fügen Sie ihn unter Spielserver hinzu und richten Sie dann hier das Seeding ein.",
        gameServersLink: "Spielserver",
        unavailable:
            "Das Seeding konnte gerade nicht geladen werden. Laden Sie die Seite neu.",
        games: { hell_let_loose: "HLL", wardogs: "Wardogs" },
        status: {
            now: "Jetzt {players} / {capacity} Spieler",
            nowNoCapacity: "Jetzt {players} Spieler",
            noData: "Keine aktuellen Serverdaten",
            chips: {
                live: "Live",
                below_start: "Unter der Startgrenze",
                filling: "Füllt sich",
                offline: "Nicht erreichbar",
                unknown: "Keine Daten",
            },
            running: "Seed läuft",
            idle: "Kein Seed läuft",
            lastData: "letzte Daten {time}",
            nextSeed: "nächster geplanter Seed {time}",
            lastSeed: "letzter Seed {time}",
            progress: "{players} / {liveFrom} bis zum Live-Spiel",
            startNow: "Jetzt seeden",
            stopNow: "Seed beenden",
            busy: "Wird ausgeführt…",
            started: "Der Seed läuft. Der Aufruf steht in {channel}.",
            stopped: "Der Seed ist beendet.",
        },
        actionErrors: {
            cooldown:
                "Ein Seed kann jetzt nicht starten. Der nächste kann {time} starten.",
            running: "Ein Seed läuft bereits.",
            duplicate: "Dieser Seed läuft bereits.",
            not_configured:
                "Wählen Sie zuerst den Aufruf-Kanal und speichern Sie den Plan.",
            offline:
                "Der Server antwortet nicht. Starten Sie den Seed, sobald er online ist.",
            already_live:
                "Der Server ist bereits live, ein Seed ist nicht nötig.",
            not_running: "Gerade läuft kein Seed.",
            not_found: "Der Server wurde nicht gefunden.",
            forbidden: "Dafür fehlt Ihnen die Berechtigung.",
            unsaved: "Speichern Sie zuerst die Änderungen am Plan.",
            unavailable:
                "Das hat nicht geklappt. Bitte versuchen Sie es erneut.",
        },
        time: {
            today: "heute um {time}",
            yesterday: "gestern um {time}",
            tomorrow: "morgen um {time}",
            other: "{date} um {time}",
        },
        plan: {
            title: "Seed-Plan · {server}",
            enabled: "An",
            enabledLabel: "Seed-Plan an",
            liveFrom: "Der Server ist live ab",
            liveFromUnit: "Spielern",
            liveFromHint: "Dann endet der Seed.",
            startBelow: "Ein Seed startet unter",
            startBelowUnit: "Spielern",
            startBelowHint: "Darüber sendet der Plan nichts.",
            when: "Wann",
            manual: "Manuell",
            manualText:
                "mit Jetzt seeden hier oder in der Nachricht Serversteuerung. Immer möglich.",
            schedule: "Zeitplan",
            scheduleHint:
                "Nur wenn der Server in dem Moment unter der Startgrenze ist.",
            scheduleDays: "Tage des Zeitplans",
            at: "um",
            time: "Uhrzeit",
            addSlot: "Weitere Uhrzeit hinzufügen",
            removeSlot: "Uhrzeit entfernen",
            weekdays: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
            auto: "Automatisch",
            autoHint: "Wenn sich der Server im Laufe des Tages leert.",
            autoBelow: "wenn er unter",
            autoBetween: "Spieler fällt, zwischen",
            autoAnd: "und",
            seedChannel: "Aufruf-Kanal",
            seedChannelPlaceholder: "Kanal wählen",
            seedChannelOk: "Der Bot kann schreiben und {role} markieren.",
            seedChannelOkNoRole: "Der Bot kann in den Kanal schreiben.",
            role: "Rolle, die der Aufruf markiert",
            rolePlaceholder: "Keine Rollenmarkierung",
            createRole: "Rolle Seed erstellen",
            createRoleBusy: "Rolle wird erstellt…",
            createRoleHint:
                "Logi erstellt in Discord eine markierbare Rolle Seed und wählt sie aus. Sie können auch eine vorhandene Rolle wählen.",
            roleCreated: "Die Rolle @Seed wurde erstellt und ausgewählt.",
            roleReused:
                "Der Server hat bereits eine Rolle @Seed; sie ist jetzt ausgewählt.",
            rolePermission:
                "Die Rolle konnte nicht erstellt werden. Geben Sie der Logi-Rolle in Discord die Berechtigung Rollen verwalten.",
            roleUnavailable:
                "Discord antwortet gerade nicht. Versuchen Sie es gleich noch einmal.",
            roleMembers: {
                one: "{count} Mitglied",
                few: "{count} Mitglieder",
                many: "{count} Mitglieder",
                other: "{count} Mitglieder",
            },
            selfService: "Spieler schalten die Rolle selbst per Knopf ein",
            selfServiceHint:
                "Der Aufruf bekommt den Knopf Zum Seed einladen; ein weiterer Klick entfernt die Rolle wieder.",
            protection: "Schutz",
            pingWindow: "Höchstens 1 Rollenmarkierung pro",
            hoursUnit: "Std.",
            pingWindowHint:
                "Startet ein Seed früher, geht der Aufruf ohne Rollenmarkierung raus.",
            cooldown: "Mindestens zwischen Seeds",
            cooldownHint:
                "Früher startet weder der Knopf noch der Plan einen weiteren Seed.",
            template: "Aufruftext",
            insert: "Einfügen:",
            templateHint: "Titel, Fortschritt und Knöpfe ergänzt Logi selbst.",
            templateDefault:
                "Ein leeres Feld verwendet den Standardtext des Aufrufs.",
            atThreshold: "An der Grenze",
            endEdit:
                "Nachricht auf „Der Server ist live“ ändern und den Seed beenden",
            endEditHint:
                "Niemand weiteres wird markiert. Der Fortschritt verschwindet auch aus dem Serverpanel.",
            endDelete: "Nachricht löschen und den Seed beenden",
            maxDuration: "Höchstens",
            maxDurationHint:
                "Dann endet der Seed, auch wenn der Server die Grenze nicht erreicht.",
        },
        previews: {
            title: "Vorschau des Aufrufs",
            call: "Vorschau des Aufrufs in {channel} · live nach dem Text links",
            live: "Bei {count} Spielern · dieselbe Nachricht, bearbeitet",
            note: "Die Nachricht wird alle 60 s aktualisiert. Das Serverpanel zeigt währenddessen denselben Fortschritt.",
            control: "Vorschau in {channel} · die Nachricht für diesen Server",
            noChannel: "#kanal",
            author: "heute um {time}",
            deleted:
                "Bei {count} Spielern löscht Logi den Aufruf und beendet den Seed. Niemand wird mehr erwähnt.",
        },
        control: {
            title: "Steuerung in Discord",
            channel: "Steuerkanal",
            channelPlaceholder: "Privaten Kanal wählen",
            private: "Der Kanal ist privat ✓",
            privateHint: "nur Admins sehen ihn.",
            public: "Den Kanal sehen alle",
            publicHint:
                "der Bot sendet die Steuerung nicht dorthin. Wählen Sie einen privaten Kanal.",
            checking: "Kanäle werden in Discord geprüft…",
            note: "Die Knöpfe Seed, Aktualisieren und Pausieren dürfen nur Logi-Admins benutzen. Wer sonst klickt, bekommt eine private Antwort, dass er das nicht darf. Öffentliche Panels haben keinen Seed-Knopf.",
        },
        problems: {
            seed_channel_unpublishable:
                "Der Bot kann nicht in den Aufruf-Kanal schreiben. Geben Sie ihm dort Kanal ansehen, Nachrichten senden, Links einbetten, Dateien anhängen und Nachrichtenverlauf lesen.",
            seed_role_missing:
                "Die gewählte Rolle gibt es in Discord nicht mehr.",
            seed_role_not_mentionable:
                "Der Bot kann die Rolle nicht markieren. Schalten Sie „Jedem erlauben, diese Rolle zu @erwähnen“ ein oder geben Sie dem Bot @everyone erwähnen.",
            seed_role_unmanageable:
                "Der Bot kann die Rolle nicht vergeben. Geben Sie ihm Rollen verwalten und schieben Sie seine Rolle über die gewählte Rolle.",
            control_channel_unpublishable:
                "Der Bot kann nicht in den Steuerkanal schreiben. Geben Sie ihm dort Kanal ansehen, Nachrichten senden und Nachrichtenverlauf lesen.",
            control_channel_public:
                "Den Steuerkanal sehen alle. Wählen Sie einen Kanal, den @everyone nicht sieht.",
            verification_unavailable:
                "Discord antwortet nicht, die Kanäle lassen sich nicht prüfen. Versuchen Sie es gleich noch einmal.",
        },
        issues: {
            invalid: "Prüfen Sie diesen Wert.",
            start_below_not_under_live:
                "Die Startgrenze muss niedriger sein als die Live-Grenze.",
            auto_below_above_start:
                "Der automatische Start darf höchstens bei der Startgrenze liegen.",
            auto_window_empty:
                "Beginn und Ende des Fensters müssen verschieden sein.",
            schedule_without_slots:
                "Fügen Sie dem Zeitplan mindestens eine Uhrzeit hinzu.",
            duplicate_day: "Ein Tag steht zweimal im Zeitplan.",
            duplicate_slot:
                "Dieser Tag und diese Uhrzeit stehen schon im Zeitplan.",
            seed_channel_required:
                "Ein eingeschalteter Plan braucht einen Aufruf-Kanal.",
            control_channel_same_as_seed:
                "Der Steuerkanal muss sich vom Aufruf-Kanal unterscheiden.",
            unknown_placeholder:
                "Der Text enthält ein unbekanntes Feld in geschweiften Klammern.",
            live_above_capacity:
                "Der Server hat weniger Plätze als die Live-Grenze.",
        },
        save: {
            note: "Speichert den Plan {server} und den Steuerkanal.",
            unsaved: {
                one: "{count} ungespeicherte Änderung",
                few: "{count} ungespeicherte Änderungen",
                many: "{count} ungespeicherte Änderungen",
                other: "{count} ungespeicherte Änderungen",
            },
            discard: "Verwerfen",
            save: "Speichern",
            saving: "Wird gespeichert…",
            saved: "Der Plan ist gespeichert.",
            reload: "Neu laden",
            conflict:
                "Jemand anderes hat den Plan inzwischen geändert. Laden Sie die Seite neu und ändern Sie ihn erneut.",
            failed: "Der Plan konnte nicht gespeichert werden.",
        },
        history: {
            title: "Seed-Verlauf · {server}",
            summary:
                "Letzte {days} Tage · {count} · im Schnitt {average} bis zum Live-Spiel",
            summaryNoLive: "Letzte {days} Tage · {count}",
            seeds: {
                one: "{count} Seed",
                few: "{count} Seeds",
                many: "{count} Seeds",
                other: "{count} Seeds",
            },
            empty: "In den letzten 30 Tagen gab es hier keinen Seed.",
            columns: {
                start: "Beginn",
                trigger: "Gestartet von",
                players: "Spieler zu Beginn → am Ende",
                result: "Ergebnis",
                duration: "Dauer",
                pinged: "Markiert",
            },
            trigger: {
                schedule: "Plan {slot}",
                auto: "Automatisch · unter {count}",
                web: "{name} · manuell im Web",
                discord: "{name} · Knopf in {channel}",
                discordNoChannel: "{name} · Knopf in Discord",
            },
            outcome: {
                live: "Live",
                timeout: "Grenze nicht erreicht",
                admin: "Von einem Admin beendet",
                failed: "Fehlgeschlagen",
                running: "Läuft",
            },
            endedSuffix: "beendet",
            pinged: "{count} · {role}",
            silentWindow: "0 · Schutz {hours} Std.",
            silentNoRole: "0 · ohne Rolle",
            unknownRole: "@rolle",
            units: { hours: "Std.", minutes: "Min." },
        },
    },
    membershipApplication: {
        title: "Clan-Bewerbung",
        description:
            "Ein Formular in mehreren Fenstern, erst am Ende abgeschickt. Danach ein privater Thread, Rollen und die Entscheidung.",
        breadcrumbParent: "Mitgliedschaft",
        enabled: "Bewerbungen an",
        tabsLabel: "Bereiche der Bewerbung",
        tabs: {
            application: "Bewerbung",
            categories: "Kategorien",
            scores: "Punkte für Anwesenheit",
            roleChanges: "Rollenänderungen",
        },
        categoryCount: {
            one: "{count} Kategorie",
            few: "{count} Kategorien",
            many: "{count} Kategorien",
            other: "{count} Kategorien",
        },
        panel: {
            title: "Panel und Kanäle",
            channel: "Kanal mit dem Panel",
            threads: "Wo Bewerbungs-Threads entstehen",
            channelOk: "Der Bot kann hier schreiben und Bilder einbetten.",
            channelBlocked:
                "Der Bot kann hier nicht schreiben oder keine Bilder einbetten. Gib ihm im Kanal Kanal ansehen, Nachrichten senden, Links einbetten, Dateien anhängen und Nachrichtenverlauf lesen.",
            threadsOk: "Der Bot kann hier private Threads erstellen.",
            threadsBlocked:
                "Der Bot kann hier keine privaten Threads erstellen. Gib ihm im Kanal Kanal ansehen, Private Threads erstellen, Nachrichten in Threads senden und Threads verwalten.",
            checking: "Berechtigungen des Bots werden geprüft…",
            checkUnavailable:
                "Die Berechtigungen des Bots lassen sich gerade nicht prüfen. Versuche es gleich noch einmal.",
            heading: "Titel",
            text: "Text",
            textHelp:
                "Die Kategorien werden unter dem Text automatisch aufgelistet.",
            image: "Bild",
            upload: "Bild hochladen",
            uploading: "Wird hochgeladen…",
            pick: "Hochgeladenes wählen",
            pickTitle: "Hochgeladene Panel-Bilder",
            pickDescription:
                "Bilder, die der Clan schon für seine Discord-Panels hochgeladen hat.",
            pickEmpty: "Noch kein hochgeladenes Bild.",
            pickUnavailable:
                "Die hochgeladenen Bilder lassen sich gerade nicht laden.",
            pickImage: "Bild {number} verwenden",
            removeImage: "Bild entfernen",
            imageHelp:
                "Optional, über dem Panel-Titel. PNG, JPEG oder WebP bis 2 MiB.",
            color: "Panel-Farbe",
            colorHint: "Leer = Clan-Farbe. Hex, z. B. #E8A33D.",
            colorInvalid: "Die Farbe muss hex sein, z. B. #E8A33D.",
            imageAlt: "Bild des Bewerbungs-Panels",
            attachFailed:
                "Das Bild konnte nicht verwendet werden. Versuche es noch einmal.",
            uploadErrors: {
                unsupported_type:
                    "Nur PNG-, JPEG- und WebP-Bilder werden angenommen.",
                type_mismatch: "Der Dateiinhalt passt nicht zu seinem Bildtyp.",
                bad_dimensions:
                    "Das Bild muss mindestens 1×1 und höchstens 4096×4096 Pixel groß sein.",
                animated: "Animierte Bilder werden nicht unterstützt.",
                undecodable: "Das Bild konnte nicht gelesen werden.",
                invalid_kind:
                    "Diese Datei kann nicht als Panel-Bild verwendet werden.",
                invalid_asset:
                    "Das hochgeladene Bild konnte nicht gespeichert werden.",
                too_large: "Das Bild ist größer als 2 MiB.",
                upload_limited:
                    "Zu viele Uploads. Versuche es in {seconds} s noch einmal.",
                forbidden: "Du darfst hier keine Bilder hochladen.",
                unavailable: "Das Hochladen ist vorübergehend nicht verfügbar.",
            },
            preview: "Vorschau in #{channel}",
            previewNoChannel: "Vorschau des Panels",
            previewEmpty:
                "Das Panel erscheint, sobald der Clan mindestens eine Kategorie hat.",
        },
        form: {
            title: "Formular: Fenster und Fragen",
            intro: "Eine Bewerbung in mehreren Fenstern. Fragetypen: Kurzer Text, Langer Text, Auswahl, Mehrfachauswahl, Ja/Nein und Zahl.",
            note: "Die Bewerber gehen die Fenster nacheinander durch und schicken erst nach der Kontrolle ab. Zwischen den Fenstern zeigt der Bot den Button Weiter, weil Discord kein Fenster direkt aus einem Fenster öffnen lässt. Die Feldanzahl gilt für die Bewerbung mit den meisten Fragen.",
            window: "Fenster {number} · {name}",
            windowNames: {
                about: "Über dich",
                accounts: "Spielkonten",
                questions: "Fragen des Clans",
            },
            fieldCount: "{count} von 5 Feldern",
            inPreview: "in der Vorschau",
            fixed: "festes Feld",
            fixedFields: {
                games: "Spiel",
                category: "Kategorie",
                name: "Spielname",
                steam: "Steam",
                epic: "Epic",
                xbox: "Xbox",
                playstation: "PlayStation",
            },
            gamesNote: "nur wenn der Clan mehrere Spiele spielt",
            categoryNote: "Kategorien des gewählten Spiels",
            accountsNote:
                "Die Felder erscheinen nur für das Spiel, das sie braucht. Konten, die schon in Logi stehen, sind vorausgefüllt.",
            requireSteam: "Bestätigtes Steam verlangen",
            requireSteamHelp:
                "Für HLL. Vor Fenster 2 schickt der Bot den Link Mit Steam bestätigen; eine eingetippte Steam-ID geht dann nicht.",
            addQuestion: "Frage hinzufügen",
            newQuestion: "Neue Frage",
            option: "Option {number}",
            edit: "Bearbeiten",
            editAria: "Frage {name} bearbeiten",
            close: "Schließen",
            move: "Frage {name} verschieben",
            moveHint:
                "Mit der Maus ziehen oder mit den Pfeiltasten nach oben und unten.",
            remove: "Frage {name} löschen",
            windowFull: "Das Fenster ist voll.",
            windowFullText:
                "Discord erlaubt höchstens 5 Felder pro Fenster. Die nächste Frage gehört in ein neues Fenster.",
            addWindow: "Fenster hinzufügen",
            noMoreWindows:
                "Es geht kein weiteres Fenster: Die Bewerbung hat höchstens die Fenster 3, 3b und 3c.",
            windowEmpty: "Dieses Fenster hat noch keine Fragen.",
            removeWindow: "Fenster {number} entfernen",
            types: {
                short_text: "Kurzer Text",
                long_text: "Langer Text",
                select: "Auswahl",
                multi_select: "Mehrfachauswahl",
                yes_no: "Ja/Nein",
                number: "Zahl",
                member: "Clan-Mitglied",
            },
            required: "Pflicht",
            bothGames: "Beide Spiele",
            allGames: "Alle Spiele",
            specializationCategories: "Kategorien laut Kategorie-Einstellung",
            gameShort: {
                hell_let_loose: "HLL",
                hell_let_loose_vietnam: "HLL: Vietnam",
                wardogs: "Wardogs",
                world_of_warcraft_forever: "WoW:F",
            },
            editor: {
                title: "Frage {name} bearbeiten",
                type: "Typ",
                typeFixed: "Der Typ dieser Frage ist fest.",
                required: "Pflicht",
                label: "Beschriftung",
                labelCount:
                    "{count} / 45 Zeichen · mehr erlaubt Discord nicht.",
                help: "Hilfe",
                helpHint: "Unter der Beschriftung, höchstens 100 Zeichen.",
                placeholder: "Platzhalter",
                options: "Optionen",
                optionInput: "Option {number}",
                removeOption: "Option {name} entfernen",
                moveOption: "Option {name} verschieben",
                addOption: "Option hinzufügen",
                maxOptions: "Höchstens 25 Optionen.",
                selectFrom: "Wählen von",
                selectTo: "bis",
                game: "Nur für Spiel",
                gameBoth: "Beide",
                gameAll: "Alle",
                category: "Nur für Kategorie",
                categoryHint: "Nichts angehakt heißt jede Kategorie.",
                categoryOtherGame:
                    "{game} · die Frage ist nur für {questionGame}",
                specializationNote:
                    "Nach der Spezialisierung fragt der Bot nur in Kategorien, bei denen sie in der Tabelle Kategorien unten eingeschaltet ist. Nur für HLL.",
                aboutNoFilters:
                    "Fenster 1 sieht jede Bewerbung: Dort werden Spiel und Kategorie gewählt.",
                done: "Fertig",
            },
            issues: {
                "window-full":
                    "Das Fenster hat mehr als 5 Felder. Verschiebe eine Frage in ein anderes Fenster.",
                "too-many-windows":
                    "Die Bewerbung hat höchstens die Fenster 3, 3b und 3c.",
                "label-empty": "Die Frage braucht eine Beschriftung.",
                "label-too-long": "Die Beschriftung ist länger als 45 Zeichen.",
                "help-too-long": "Die Hilfe ist länger als 100 Zeichen.",
                "placeholder-too-long":
                    "Der Platzhalter ist länger als 100 Zeichen.",
                "options-missing":
                    "Eine Auswahl braucht mindestens eine Option.",
                "options-too-many": "Die Auswahl hat mehr als 25 Optionen.",
                "option-empty": "Jede Option braucht einen Text.",
                "option-too-long": "Eine Option ist länger als 100 Zeichen.",
                "option-duplicate": "Zwei Optionen heißen gleich.",
                "values-range":
                    "Der Bereich Wählen von–bis passt nicht zur Anzahl der Optionen.",
                "duplicate-id": "Die Frage steht zweimal im Formular.",
                "type-invalid": "Dieser Typ passt nicht zur Frage.",
                "category-unknown":
                    "Die Frage ist auf eine Kategorie beschränkt, die es nicht mehr gibt.",
                "specialization-duplicate":
                    "Die Frage Spezialisierung steht zweimal im Formular.",
            },
            issuesTitle: "Das Formular lässt sich noch nicht speichern",
            windowPreview:
                "Vorschau von Fenster {number} in Discord · Bewerbung für {game}, {category}",
            windowPreviewNoCategory: "Vorschau von Fenster {number} in Discord",
            previewWindowPick: "Fenster in der Vorschau",
            modalLabel: "Bewerbungsfenster in Discord",
            modalClose: "Fenster schließen",
            modalCancel: "Abbrechen",
            modalSubmit: "Absenden",
            reviewPreview:
                "Kontrolle vor dem Absenden · nur für die Bewerbung sichtbar",
            sample: {
                name: "Spieler 17",
                shortText: "Antwort aus der Bewerbung",
                longText: "Ich suche ein Team für regelmäßige Matches…",
            },
        },
        categories: {
            title: "Kategorien",
            intro: "Was in Fenster 1 zur Wahl steht. Die Details einer Kategorie bearbeitest du im Tab Kategorien.",
            columns: {
                category: "Kategorie",
                game: "Spiel",
                roles: "Rollen nach Aufnahme · Rekrut → endgültig",
                thread: "Thread sichtbar für",
                specialization: "Nach Spezialisierung fragen",
                actions: "Aktionen",
            },
            noRecruit: "ohne Rekrut",
            noRole: "keine Rolle",
            admins: "nur Logi-Admins",
            edit: "Bearbeiten",
            editAria: "Kategorie {name} bearbeiten",
            specializationAria: "Nach Spezialisierung fragen: {name}",
            add: "Kategorie hinzufügen",
            note: "@{role} bekommt jeder Aufgenommene; einstellen unter Rollen und Zugriff. Spezialisierung gibt es nur bei HLL.",
            noteNoRole:
                "Die Clan-Rolle für jeden Aufgenommenen stellst du unter Rollen und Zugriff ein. Spezialisierung gibt es nur bei HLL.",
            empty: "Noch keine Kategorie. Ohne sie kann sich niemand bewerben.",
            specializationMissing:
                "Die Frage Spezialisierung ist nicht im Formular, deshalb stellt der Bot sie nicht.",
            restoreSpecialization: "Frage Spezialisierung zurückholen",
        },
        after: {
            title: "Nach dem Absenden",
            thread: "Privaten Thread in #{channel} erstellen",
            threadNoChannel: "Privaten Thread erstellen",
            threadHelp:
                "Immer. Am Anfang stehen die Antworten und die Begrüßung unten.",
            mention: "Support-Rollen der Kategorie im Thread erwähnen",
            mentionHelp:
                "Zum Beispiel @Rekrutierung; sonst sieht niemand den Thread.",
            recruit: "Rolle Rekrut gleich nach dem Absenden geben",
            recruitHelp: "Nur bei Kategorien mit einer Rekrut-Rolle.",
            dm: "Der Bewerbung eine Bestätigung per DM schicken",
            dmHelp: "Mit Link zum Thread.",
            keep: "Unfertige Bewerbung 24 h aufbewahren",
            keepHelp:
                "Danach wird der Entwurf gelöscht und die Bewerbung beginnt neu.",
            welcome: "Begrüßung im Thread",
            welcomePlaceholder:
                "{applicant}, danke für deine Bewerbung. {support_roles} meldet sich bald.",
            welcomeHelp:
                "Möglich sind {applicant}, {support_roles} und {category}.",
            decisionPreview:
                "Entscheidung im Thread · Buttons statt /close_application",
            tableCaption: "Was die Buttons bei der Kategorie {category} tun",
            table: {
                button: "Button",
                roles: "Rollenänderung",
                applicant: "Die Bewerbung bekommt",
            },
            outcomes: {
                member: "Als Mitglied aufnehmen",
                recruit: "Als Rekrut aufnehmen",
                mercenary: "Als Söldner aufnehmen",
                denied: "Ablehnen…",
                pending: "Noch nicht entschieden",
            },
            gets: {
                result: "Ergebnis und DM",
                reason: "Fenster für den Grund, Ergebnis und DM",
                pending: "Notiz auf der Karte, keine DM",
            },
            noRoleChange: "keine Änderung",
            mercenaryMissing: "Keine Söldner-Kategorie",
            mercenaryMissingNote:
                "Der Button Als Söldner aufnehmen bleibt in Discord deaktiviert, bis der Clan eine Söldner-Kategorie hat. Leg eine Kategorie mit dem Ergebnis Söldner an.",
            mercenaryCategoryNote:
                "Als Söldner aufnehmen vergibt die Rollen der Kategorie {category}, nicht die der Kategorie, die der Bewerber gewählt hat.",
            roleSyncOff:
                "Die Rollen-Synchronisierung ist aus, deshalb ändert Logi keine Rollen.",
            decisionNote:
                "Entscheiden dürfen der Support der Kategorie und die Logi-Admins. Der Befehl /close_application funktioniert weiter.",
        },
        web: {
            title: "Variante B · Ausfüllen im Web",
            switch: "Auch Ausfüllen im Web anbieten",
            help: "Das Panel bekommt einen zweiten Button Im Web ausfüllen. Dasselbe Formular auf einer Logi-Seite, ohne das Limit von 5 Feldern pro Fenster, nach der Anmeldung mit Discord. Die Bewerbung landet im selben Thread mit denselben Rollen.",
            note: "Praktisch für lange Formulare oder Bewerbungen am Handy, wo sich die Discord-Fenster schlechter ausfüllen lassen.",
            address: "Adresse des Formulars",
        },
        save: {
            changes: {
                one: "{count} ungespeicherte Änderung",
                few: "{count} ungespeicherte Änderungen",
                many: "{count} ungespeicherte Änderungen",
                other: "{count} ungespeicherte Änderungen",
            },
            note: "Das Panel in #{channel} aktualisiert sich nach dem Speichern selbst.",
            noteNoChannel:
                "Das Panel aktualisiert sich nach dem Speichern selbst.",
            discard: "Verwerfen",
            save: "Speichern",
            saved: "Die Bewerbung ist gespeichert.",
            error: "Die Bewerbung konnte nicht gespeichert werden.",
            formInvalid:
                "Das Formular hat einen Fehler. Korrigiere die markierten Fragen und speichere erneut.",
        },
    },
    applicationWeb: {
        brand: "Logi · Clan {clan}",
        signedInAs: "Mit Discord angemeldet als {name}",
        title: "Bewerbung bei {clan}",
        stepsLabel: "Schritte der Bewerbung",
        review: "Kontrolle",
        autosave: "Was du ausfüllst, wird automatisch gespeichert.",
        next: "Nächster Schritt",
        back: "Zurück",
        saving: "Wird gespeichert…",
        submit: "Bewerbung absenden",
        submitting: "Wird gesendet…",
        edit: "Bearbeiten",
        required: "Pflicht",
        chooseUpTo: "Wähle {min} bis {max}.",
        reviewTitle: "Prüfe deine Bewerbung",
        reviewNote: "Eine unfertige Bewerbung bewahren wir 24 h auf.",
        queued: "Die Bewerbung ist abgeschickt. Der Bot erstellt jetzt einen privaten Thread…",
        done: "Die Bewerbung ist abgeschickt. Die Rekrutierung meldet sich im Thread.",
        openThread: "Thread in Discord öffnen",
        failed: "Die Bewerbung konnte nicht gesendet werden. Versuche es noch einmal.",
        retry: "Noch einmal versuchen",
        expired:
            "Die unfertige Bewerbung ist nach 24 Stunden abgelaufen. Bitte fülle sie neu aus.",
        busy: "Die Bewerbung wird gerade gesendet. Warte bitte einen Moment.",
        unavailable:
            "Das Formular geht gerade nicht. Versuche es gleich noch einmal.",
        disabled: "Der Clan nimmt gerade keine Bewerbungen im Web an.",
        alreadyOpen: "Du hast schon eine offene Clan-Bewerbung.",
        member: "Du bist schon im Clan. Eine Bewerbung brauchst du nicht.",
        steamLocked:
            "Steam kommt nur aus der Steam-Bestätigung auf der Logi-Website.",
        memberHint:
            "Die Discord-Konto-ID des Mitglieds, das dich eingeladen hat.",
        fixErrors: "Korrigiere bitte die markierten Felder.",
    },
} as const

export type AppMessages = typeof deMessages
