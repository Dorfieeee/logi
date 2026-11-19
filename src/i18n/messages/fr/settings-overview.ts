export const settingsHub_overview = {
    title: "Paramètres",
    description: "Profil du clan, paramètres Discord et intégrations.",
    searchLabel: "Rechercher un paramètre",
    searchPlaceholder: "Rechercher : salon, rôle, clé API…",
    noResults: "Aucun résultat",
    noResultsDescription: "Essayez un autre mot, comme salon, rôle ou clé.",
    groupHints: {
        clan: "S’applique à tous les jeux",
        matches: "Valeurs par défaut des nouveaux matchs et de leurs messages",
        discord: "Bot, salons, rôles et panneaux",
        gameData: "Serveurs dont Logi récupère les résultats",
        web: "Facultatif : site du clan, connexion et autres services",
        maintenance: "Outils ponctuels",
    },
    badges: {
        done: "Terminé",
        notSet: "Non défini",
        on: "Activé",
        off: "Désactivé",
        collecting: {
            one: "{count} en cours de collecte",
            few: "{count} en cours de collecte",
            many: "{count} en cours de collecte",
            other: "{count} en cours de collecte",
        },
        failing: {
            one: "{count} en erreur",
            few: "{count} en erreur",
            many: "{count} en erreur",
            other: "{count} en erreur",
        },
        missingChannels: {
            one: "{count} salon manquant",
            few: "{count} salons manquants",
            many: "{count} salons manquants",
            other: "{count} salons manquants",
        },
        gamesOn: {
            one: "{count} activés",
            few: "{count} activés",
            many: "{count} activés",
            other: "{count} activés",
        },
        templates: {
            one: "{count} modèle",
            few: "{count} modèles",
            many: "{count} modèles",
            other: "{count} modèles",
        },
    },
    tiles: {
        profile: {
            title: "Profil du clan",
            description: "Nom, logo et description du clan.",
        },
        games: {
            title: "Jeux",
            description:
                "Les jeux pratiqués par le clan. Logi propose des options supplémentaires en fonction de ces jeux.",
        },
        "event-categories": {
            title: "Catégories d’événements",
            description:
                "Couleurs et émojis des types d’événements dans le calendrier.",
        },
        "match-templates": {
            title: "Modèles de match",
            description:
                "Horaires, inscriptions, mention et composition par défaut d’un nouveau match.",
        },
        presets: {
            title: "Modèles d’escouades et de sujets",
            description:
                "Structures des escouades et des rôles dans les compositions, sujets du forum de match.",
        },
        messages: {
            title: "Messages et panneaux",
            description:
                "Apparence des messages du bot, contenu envoyé et aperçu des panneaux.",
        },
        channels: {
            title: "Salons et langue",
            description:
                "Salons utilisés par le bot pour les annonces, événements et erreurs. Fuseau horaire et langue.",
        },
        "discord-panels": {
            title: "Panneaux Discord",
            description:
                "Serveurs en direct, résultats, ligue et calendrier mis à jour par le bot.",
        },
        "panel-graphics": {
            title: "Graphismes des panneaux",
            description:
                "Style des panneaux de serveur, bannières de serveur et images des cartes.",
        },
        "discord-seed": {
            title: "Seeding des serveurs",
            description:
                "Appel au seeding, rôle Seed, horaires et historique du seeding.",
        },
        roles: {
            title: "Rôles et accès",
            description: "Rôle du clan et rôle autorisé à gérer Logi.",
        },
        commands: {
            title: "Commandes",
            description:
                "Commandes proposées par le bot, personnes autorisées et salons où les utiliser.",
        },
        membership: {
            title: "Adhésion",
            description:
                "Rôles de recrue et de membre, règles du score de sélection.",
        },
        tickets: {
            title: "Tickets",
            description: "Panneau de tickets, catégories et salons.",
        },
        "game-servers": {
            title: "Serveurs de jeu",
            description:
                "Serveurs CRCON et Warcon, clés API et collecte des données.",
        },
        history: {
            title: "Conservation de l’historique",
            description: "Durée de conservation des parties jouées dans Logi.",
        },
        league: {
            title: "Global Wardogs League",
            description:
                "Suivi des matchs de ligue et fiches Discord. Wardogs uniquement.",
        },
        apiKeys: {
            title: "Clés API",
            description:
                "Clés pour le site du clan et les autres applications.",
        },
        login: {
            title: "Connexion au site",
            description:
                "Votre propre page de connexion et applications de connexion unique (SSO).",
        },
        webAccess: {
            title: "Autorisations du site",
            description:
                "Rôles dont le site peut consulter l’adhésion et avec lesquels il peut créer des événements. Nécessite une clé API et le SSO.",
        },
        calendar: {
            title: "Google Agenda",
            description: "Lien d’abonnement au calendrier du clan.",
        },
        webhooks: {
            title: "Webhooks",
            description:
                "Notifications envoyées à d’autres services lors d’un changement dans Logi.",
        },
        imports: {
            title: "Imports et corrections des données",
            description:
                "Import groupé d’événements, de joueurs et d’identifiants de plateforme, recalcul des statistiques.",
        },
        "helper-data": {
            title: "Données de référence",
            description: "Modèles par défaut et restauration.",
        },
    },
    setup: {
        title: "Configuration de l’espace de travail",
        description:
            "Terminez les étapes obligatoires pour que le bot puisse annoncer les événements et contrôler les accès.",
        progress: "{done} sur {total} terminées",
        progressLabel: "Progression de la configuration",
        continue: "Poursuivre la configuration",
        continueHelp: "Ouvre la première étape inachevée.",
        optional: "facultatif",
        fix: "Corriger",
        setUp: "Configurer",
        steps: {
            bot: {
                title: "Bot sur Discord",
                done: "Le bot est présent sur le serveur et peut voir les salons.",
                missing: "Le bot n’est pas encore sur le serveur.",
            },
            games: {
                title: "Jeux",
                missing: "Choisissez les jeux du clan",
            },
            profile: {
                title: "Profil du clan",
                detail: "Nom, logo et description",
            },
            channels: {
                title: "Salons",
                done: "Le salon d’annonces est défini",
                missing: "Le salon d’annonces n’est pas défini",
            },
            roles: {
                title: "Rôles et accès",
                detail: "Qui peut gérer Logi",
            },
            gameServers: {
                title: "Serveurs de jeu",
                done: {
                    one: "{count} serveur collecte des données",
                    few: "{count} serveurs collectent des données",
                    many: "{count} serveurs collectent des données",
                    other: "{count} serveurs collectent des données",
                },
                missing: "Résultats et statistiques du serveur",
            },
        },
    },
} as const
