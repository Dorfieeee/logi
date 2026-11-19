export const teamAdminMessages = {
    teamCatalogAdmin: {
        scrapeWardogs: "Importer les équipes de Global Wardogs League",
        scrapeHll: "Synchroniser les équipes de HeLO (2024)",
        scrapingTeams: "Importation des équipes…",
        scrapeDescription:
            "Ajoute les équipes manquantes et actualise les logos des équipes existantes correspondantes. Un logo fournisseur manquant ou inaccessible ne supprime jamais un logo enregistré. Inscrivez séparément les équipes importées à la compétition.",
        scrapeResult:
            "Créées : {created}. Logos actualisés : {updated}. Ignorées : {skipped}. Échecs : {failed}. Vous pouvez relancer l’import des équipes en échec.",
        scrapeError: "Échec de l’importation des équipes. Réessayez.",

        searchLabel: "Rechercher des équipes",
        statesLabel: "Statut",
        states: {
            active: "Active",
            archived: "Archivée",
            merged: "Fusionnée",
        },
        listLabel: "Équipes",
        detailLabel: "Informations de l’équipe",
        rowLinked: "clan sur Logi",
        rowCompetitions: {
            one: "{count} compétition",
            few: "{count} compétitions",
            many: "{count} compétitions",
            other: "{count} compétitions",
        },
        rowPendingChange: "modification en attente",
        requestBadge: "Demande",
        requestBadgeLabel: "Une demande de modification est en attente",
        updatedOn: "{game} · mise à jour le {date}",
        changeLogo: "Changer le logo",
        requestBanner: "Un clan propose une modification de cette équipe",
        openRequest: "Ouvrir la demande",
        usageTitle: "Utilisation de l’équipe",
        usageFixtures: {
            one: "{count} match",
            few: "{count} matchs",
            many: "{count} matchs",
            other: "{count} matchs",
        },
        usageWithdrawn: "retirée",
        usageNone: "Aucune participation à une compétition pour le moment.",
        usageMore: "et {count} autres compétitions",
        usageSnapshots:
            "Les matchs de clan conservent le nom et le logo enregistrés à leur création.",
        usageUnavailable: "Impossible de charger les utilisations de l’équipe.",
        moreDetails: "Description et liens",
        saveShort: "Enregistrer",
        endTitle: "Doublon ou fin d’activité de l’équipe",
        mergeIntoOther: "Fusionner avec une autre équipe",
        endHelp:
            "Les deux actions demandent une confirmation et expliquent ce qui changera.",
        selectTeam:
            "Sélectionnez une équipe dans la liste pour voir ses informations.",
        archivedHelp:
            "Une équipe archivée n’est plus proposée aux clans ni aux compétitions. La restaurer permet de la sélectionner à nouveau.",
        mergedHelp:
            "Cette équipe a été fusionnée avec {name}. Une fusion est irréversible.",
        mergedTargetUnknown: "une autre équipe",
        title: "Catalogue des équipes",
        description:
            "Un catalogue d’équipes commun à tout Logi. Les clans y choisissent leurs adversaires et les compétitions y inscrivent leurs équipes.",
        gamesLabel: "Jeu",
        search: "Nom ou tag",
        showArchived: "Afficher les équipes archivées et fusionnées",
        add: "Ajouter une équipe",
        loadMore: "Charger la suite",
        loading: "Chargement des équipes…",
        empty: "Aucune équipe pour ce jeu pour le moment.",
        emptySearch: "Aucune équipe ne correspond à cette recherche.",
        retry: "Réessayer",
        archivedBadge: "Archivée",
        mergedBadge: "Fusionnée",
        linkedBadge: "Associée : {workspace}",
        edit: "Modifier",
        archive: "Archiver",
        restore: "Restaurer",
        merge: "Fusionner",
        editTeam: "Modifier {name}",
        archiveTeam: "Archiver {name}",
        restoreTeam: "Restaurer {name}",
        mergeTeam: "Fusionner {name} avec une autre équipe",
        createTitle: "Nouvelle équipe du catalogue",
        editTitle: "Modifier une équipe du catalogue",
        name: "Nom",
        shortCode: "Tag",
        shortCodeHelp:
            "Facultatif, 16 caractères maximum ; affiché lorsque l’espace est limité.",
        descriptionField: "Description",
        descriptionHelp: "Facultatif, 500 caractères maximum.",
        links: "Liens",
        linkLabel: "Lien {number}",
        linksHelp:
            "Jusqu’à trois liens HTTPS, comme le site de l’équipe ou une invitation Discord.",
        linkedWorkspace: "Clan sur Logi",
        linkedWorkspaceNone: "Aucun · l’équipe n’utilise pas Logi",
        linkedWorkspaceUnknown: "Espace de travail {id}",
        linkedWorkspaceHelp:
            "Indique que cette équipe représente le clan de cet espace de travail Logi. L’association n’accorde aucune permission.",
        logo: "Logo",
        logoHelp:
            "PNG, JPEG ou WebP jusqu’à 2 Mio, normalisé en carré de 512 × 512. Les logos du catalogue appartiennent à la plateforme.",
        upload: "Importer un logo",
        uploading: "Importation…",
        removeLogo: "Retirer le logo",
        save: "Enregistrer l’équipe",
        saving: "Enregistrement…",
        cancel: "Annuler",
        saved: "Équipe enregistrée.",
        archivedNotice:
            "Équipe archivée. Les matchs enregistrés conservent leurs informations d’équipe.",
        archiveConfirmTitle: "Archiver {name} ?",
        archiveConfirmDescription:
            "L’archivage prend effet immédiatement. Ce qui change :",
        archiveConsequenceSelection:
            "{name} ne sera plus proposée aux clans et aux compétitions.",
        archiveConsequenceSnapshots:
            "Les matchs enregistrés conservent leur nom et leur logo d’origine.",
        archiveConsequenceRestore:
            "Vous pourrez restaurer l’équipe plus tard, sauf si une autre équipe active reprend son nom.",
        restoredNotice: "Équipe restaurée.",
        mergedNotice: "{source} a été fusionnée avec {target}.",
        conflictReloaded:
            "Cette équipe a changé entre-temps. La dernière version est affichée et vos modifications sont conservées ; vérifiez-les et enregistrez à nouveau.",
        conflictReloadFailed:
            "Cette équipe a changé entre-temps et sa dernière version n’a pas pu être chargée. Fermez la fenêtre et réessayez.",
        staleRow:
            "Cette équipe a changé entre-temps ; sa dernière version est désormais affichée. Réessayez si l’action est toujours nécessaire.",
        mergeTitle: "Fusionner {name}",
        mergeDescription:
            "Choisissez l’équipe à conserver. {name} sera archivée et renverra vers elle.",
        mergeTarget: "Équipe à conserver",
        mergeSearch: "Rechercher des équipes actives…",
        mergeSearchHint:
            "Saisissez du texte pour rechercher les équipes actives de ce jeu.",
        mergeNoResults:
            "Aucune autre équipe active ne correspond à cette recherche.",
        mergeLoading: "Recherche…",
        mergeChooseTarget: "Choisissez l’équipe à conserver.",
        mergeMovesTitle: "Conséquences",
        mergeMovesRegistrations:
            "Les inscriptions aux compétitions et les rencontres de {source} sont transférées à {target}.",
        mergeMovesRequests:
            "Les demandes d’équipes en attente pour {source} sont transférées à {target}.",
        mergeMovesArchive:
            "{source} est archivée et enregistrée comme fusionnée avec {target}. La fusion est irréversible.",
        mergeMovesSnapshots:
            "Les informations d’équipe des matchs enregistrés ne sont pas réécrites ; elles conservent leur nom et leur logo d’origine.",
        mergeConfirm: "Fusionner les équipes",
        merging: "Fusion…",
        fieldErrors: {
            name: "Saisissez un nom de 120 caractères maximum, sans caractères de contrôle.",
            shortCode: "16 caractères maximum, sans caractères de contrôle.",
            description: "500 caractères maximum.",
            links: "Chaque lien doit être une URL HTTPS distincte.",
            linkedGuildId: "Choisissez un espace de travail dans la liste.",
        },
        errors: {
            invalid_team: "Vérifiez les informations de l’équipe et réessayez.",
            invalid_query: "Impossible de lire le catalogue avec ces filtres.",
            game_disabled:
                "Ce jeu n’est pas disponible dans le catalogue des équipes.",
            duplicate_name:
                "Une autre équipe de ce jeu utilise déjà ce nom. Recherchez-la dans le catalogue, y compris parmi les équipes archivées, puis modifiez-la, restaurez-la ou fusionnez-la.",
            revision_conflict:
                "Cette équipe a changé entre-temps. Rechargez-la et réessayez.",
            idempotency_conflict:
                "Cet enregistrement a déjà été utilisé pour d’autres valeurs. Fermez la fenêtre et réessayez.",
            not_found: "Cette équipe n’existe plus.",
            archived:
                "Cette équipe est archivée. Restaurez-la avant de la modifier.",
            not_archived: "Cette équipe n’est pas archivée.",
            asset_unavailable:
                "Le logo n’est plus disponible. Importez-le à nouveau.",
            limit_reached: "Le catalogue de ce jeu est complet.",
            guild_already_linked:
                "Ce serveur Discord est déjà associé à une équipe.",
            invalid_merge:
                "Ces équipes ne peuvent pas être fusionnées. Choisissez une équipe active du même jeu qui n’a jamais affronté celle-ci en compétition ; une équipe fusionnée ne peut être ni restaurée ni fusionnée à nouveau.",
            forbidden:
                "Seuls les administrateurs globaux peuvent gérer le catalogue des équipes.",
            unavailable:
                "Le catalogue des équipes est actuellement indisponible. Réessayez.",
        },
        uploadErrors: {
            unsupported_type:
                "Seules les images PNG, JPEG et WebP sont acceptées.",
            type_mismatch:
                "Le contenu du fichier ne correspond pas à son type d’image.",
            bad_dimensions:
                "L’image doit mesurer entre 1 × 1 et 4 096 × 4 096 pixels.",
            animated: "Les images animées ne sont pas prises en charge.",
            undecodable: "Impossible de lire l’image.",
            invalid_kind: "Ce fichier importé n’est pas un logo d’équipe.",
            invalid_asset: "Impossible de stocker l’image importée.",
            too_large: "L’image dépasse 2 Mio.",
            upload_limited: "Trop d’importations. Réessayez dans {seconds} s.",
            forbidden:
                "Seuls les administrateurs globaux peuvent importer les logos du catalogue.",
            unavailable: "Les importations sont temporairement indisponibles.",
        },
    },
    teamRequestAdmin: {
        changeSummary: "Modifie {fields}",
        changeFields: {
            logo: "logo",
            name: "nom",
            shortCode: "tag",
            links: "liens",
            description: "description",
        },
        listAnd: " et ",
        kindBadges: {
            create: "Nouveau",
            update: "Modification",
        },
        similarExists: "Une équipe similaire existe déjà : {name}",
        usageIn: "L’équipe participe à {competitions}.",
        usageNone: "L’équipe ne participe encore à aucune compétition.",
        snapshotsKept: "Les matchs enregistrés conservent l’ancien logo.",
        approveDirectTitle: "Approuver la demande pour {name} ?",
        approveDirectCreate: "{name} est ajoutée au catalogue {game}.",
        approveDirectUpdate:
            "Les informations proposées sont appliquées à {name}.",
        approveDirectDm:
            "L’auteur reçoit la décision en message privé Discord.",
        discordUser: "Discord {id}",
        mergeShort: "Fusionner avec une équipe existante",
        title: "Demandes d’équipes",
        description:
            "Les clans demandent l’ajout d’une équipe ou la modification d’une équipe existante. L’auteur reçoit votre décision en message privé Discord.",
        statusFilter: "Statut",
        statuses: {
            pending: "En attente",
            approved: "Approuvée",
            merged: "Fusionnée",
            rejected: "Refusée",
            cancelled: "Annulé",
        },
        kinds: {
            create: "Nouvelle équipe",
            update: "Demande de modification",
        },
        loading: "Chargement des demandes…",
        empty: "Aucune demande avec ce statut.",
        loadMore: "Charger la suite",
        tabsLabel: "Statut de la demande",
        tabPending: "En attente · {count}",
        tabPendingEmpty: "En attente",
        tabDecided: "Traitée",
        gameFilter: "Jeu",
        clanFilter: "Clan",
        allClans: "Tous les clans",
        listLabel: "Demandes",
        fromClan: "de {clan}",
        titleCreate: "Nouvelle équipe {name}",
        titleUpdate: "Modification de l’équipe {name}",
        requestedBy: "{requester} de {clan}",
        field: "Champ",
        now: "Actuel",
        proposed: "Proposé",
        unchanged: "inchangé",
        emptyValue: "vide",
        comparisonHint: "Les modifications sont surlignées en vert.",
        rejectWithReason: "Refuser avec un motif",
        reviewAndApprove: "Vérifier et approuver",
        selectRequest: "Sélectionnez une demande pour voir ses informations.",
        emptyPendingTitle: "Aucune demande en attente",
        emptyPendingDescription:
            "Les administrateurs des clans envoient des demandes depuis leurs pages d’équipes. Les nouvelles apparaissent ici et leur auteur reçoit votre décision en message privé Discord.",
        emptyFiltered: "Aucune demande chargée ne correspond à ces filtres.",
        retry: "Réessayer",
        requestFor: "Demande pour {name}",
        workspace: "Espace de travail",
        unknownWorkspace: "Espace de travail inconnu ({id})",
        requester: "Auteur (identifiant Discord)",
        hiddenRequester: "Non affiché",
        game: "Jeu",
        kind: "Type",
        submitted: "Envoyé",
        decided: "Traitée",
        note: "Note de l’auteur",
        proposal: "Équipe proposée",
        currentTeam: "Équipe actuelle",
        currentTeamLoading: "Chargement de l’équipe actuelle…",
        currentTeamMissing: "L’équipe visée par cette demande n’existe plus.",
        currentTeamArchived:
            "L’équipe visée par cette demande est archivée. Restaurez-la dans le catalogue avant d’approuver.",
        currentTeamUnavailable: "Impossible de charger l’équipe actuelle.",
        changed: "Modifié",
        resultTeam: "Équipe retenue",
        reason: "Motif",
        notification: "Message privé à l’auteur",
        notifications: {
            none: "Non envoyé",
            pending: "En file d’attente",
            sent: "Envoyé",
            failed: "Envoi impossible",
        },
        none: "Aucun",
        approve: "Approuver",
        approveRequest: "Approuver la demande pour {name}",
        approveTitle: "Approuver la demande",
        approveDescription:
            "Vérifiez et ajustez les champs proposés. L’approbation crée l’équipe ou applique les champs à l’équipe actuelle.",
        approveConfirm: "Approuver la demande",
        approving: "Approbation…",
        merge: "Fusionner avec une équipe existante",
        mergeRequest:
            "Fusionner la demande pour {name} avec une équipe existante",
        mergeTitle: "Fusionner avec une équipe existante",
        mergeDescription:
            "Aucune nouvelle équipe n’est créée. L’auteur est informé de l’équipe {game} existante à utiliser.",
        mergeConfirm: "Fusionner la demande",
        merging: "Fusion…",
        mergeInto: "Fusionner plutôt avec {name}",
        reject: "Refuser",
        rejectRequest: "Refuser la demande pour {name}",
        rejectTitle: "Refuser la demande",
        rejectDescription: "L’auteur reçoit le motif en message privé Discord.",
        rejectReason: "Motif",
        rejectReasonHelp: "Obligatoire, 500 caractères maximum.",
        rejectConfirm: "Refuser la demande",
        rejecting: "Refus en cours…",
        cancel: "Annuler",
        reasonRequired: "Saisissez un motif de 500 caractères maximum.",
        decidedNotice: {
            approved: "Demande approuvée. L’auteur sera informé.",
            merged: "Demande fusionnée avec une équipe existante. L’auteur sera informé.",
            rejected: "Demande refusée. L’auteur sera informé.",
        },
        conflictReloaded:
            "L’équipe a changé depuis l’ouverture de cette demande. Les valeurs actuelles sont affichées ; vérifiez-les et approuvez à nouveau.",
        duplicateFound:
            "{name} utilise déjà ce nom. Fusionnez la demande avec cette équipe ou modifiez le nom.",
        staleRequest:
            "Cette demande a déjà été traitée ou retirée ; la liste a été actualisée.",
        errors: {
            invalid_request: "Cette demande est invalide.",
            invalid_decision: "Vérifiez la décision et réessayez.",
            invalid_query:
                "Impossible de lire la file d’attente avec ces filtres.",
            not_found: "Cette demande ou cette équipe n’existe plus.",
            not_pending: "Cette demande a déjà été traitée ou retirée.",
            limit_reached: "Le catalogue de ce jeu est complet.",
            idempotency_conflict:
                "Cette décision entre en conflit avec une précédente. Rechargez et réessayez.",
            team_archived:
                "L’équipe choisie est archivée. Choisissez une équipe active.",
            team_game_mismatch: "Choisissez une équipe du même jeu.",
            duplicate_name: "Une autre équipe de ce jeu utilise déjà ce nom.",
            revision_conflict:
                "L’équipe a changé entre-temps. Vérifiez-la et réessayez.",
            archived: "L’équipe est archivée. Restaurez-la avant d’approuver.",
            not_archived: "L’équipe n’est pas archivée.",
            asset_unavailable:
                "Le logo n’est plus disponible. Importez-le à nouveau ou retirez-le.",
            invalid_team: "Vérifiez les informations de l’équipe et réessayez.",
            guild_already_linked:
                "Ce serveur Discord est déjà associé à une équipe.",
            invalid_merge:
                "La demande ne peut pas être fusionnée avec cette équipe.",
            game_disabled:
                "Ce jeu n’est pas disponible dans le catalogue des équipes.",
            forbidden:
                "Seuls les administrateurs globaux peuvent statuer sur les demandes d’équipes.",
            unavailable:
                "Les demandes d’équipes sont actuellement indisponibles. Réessayez.",
        },
    },
} as const
