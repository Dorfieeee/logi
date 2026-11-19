export const teamAdminMessages = {
    teamCatalogAdmin: {
        scrapeWardogs: "Teams aus der Global Wardogs League importieren",
        scrapeHll: "Teams aus HeLO synchronisieren (2024)",
        scrapingTeams: "Teams werden importiert…",
        scrapeDescription:
            "Ergänzt fehlende Teams und aktualisiert Logos vorhandener Teams. Fehlende oder nicht erreichbare Logos entfernen kein gespeichertes Logo. Teams separat zum Wettbewerb anmelden.",
        scrapeResult:
            "Erstellt: {created}. Logos aktualisiert: {updated}. Übersprungen: {skipped}. Fehlgeschlagen: {failed}. Erneuter Versuch möglich.",
        scrapeError: "Teamimport fehlgeschlagen. Bitte erneut versuchen.",

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
            guild_already_linked:
                "Dieser Discord-Server ist bereits mit einem Team verbunden.",
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
            guild_already_linked:
                "Dieser Discord-Server ist bereits mit einem Team verbunden.",
            invalid_merge:
                "Die Anfrage kann nicht mit diesem Team zusammengeführt werden.",
            game_disabled: "Dieses Spiel ist im Teamkatalog nicht verfügbar.",
            forbidden:
                "Nur globale Administratoren können über Teamanfragen entscheiden.",
            unavailable:
                "Teamanfragen sind gerade nicht verfügbar. Versuche es erneut.",
        },
    },
} as const
