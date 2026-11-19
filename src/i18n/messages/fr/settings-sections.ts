export const settingsHub_sections = {
    profile: {
        title: "Profil du clan",
        description: "Nom, logo et description du clan.",
    },
    games: {
        title: "Jeux",
        description: "Les jeux pratiqués par le clan.",
    },
    "event-categories": {
        title: "Catégories d’événements",
        description:
            "Libellés et couleurs des matchs et entraînements, par exemple Amical ou Ligue.",
    },
    "match-templates": {
        title: "Modèles de match",
        description:
            "Valeurs préremplies à la création d’un match. Elles restent modifiables dans le match.",
    },
    presets: {
        title: "Modèles d’escouades et de sujets",
        description:
            "Structures de composition et sujets de briefing copiés dans les matchs.",
    },
    messages: {
        title: "Messages et panneaux",
        description:
            "Choisissez les messages envoyés par le bot et leur apparence.",
    },
    channels: {
        title: "Salons et langue",
        description:
            "Salons où le bot publie ses messages et langue qu’il utilise.",
    },
    "discord-panels": {
        title: "Panneaux Discord",
        description:
            "Messages tenus à jour par le bot : serveurs en direct, résultats, ligue, calendrier et commandes d’administration. Actualisation toutes les 60 s.",
    },
    "panel-graphics": {
        title: "Graphismes des panneaux",
        description:
            "Apparence des panneaux de serveur sur Discord : style, bannières et images des cartes. Les icônes de faction et d’état sont fixes.",
    },
    "discord-seed": {
        title: "Seeding",
        description:
            "Lorsqu’un serveur est vide, Logi appelle les joueurs : il publie un appel, mentionne le rôle Seed et affiche le nombre de joueurs manquants dans le panneau. Seuls les administrateurs Logi peuvent le lancer.",
    },
    roles: {
        title: "Rôles et accès",
        description:
            "Rôle du clan et rôle donnant accès au tableau de bord Logi.",
    },
    commands: {
        title: "Commandes",
        description:
            "Commandes proposées par le bot, personnes autorisées et salons où les utiliser. Le bot répond dans la langue du clan.",
    },
    membership: {
        title: "Adhésion",
        description:
            "Parcours d’adhésion au clan, personnes chargées des réponses et rôles attribués.",
    },
    tickets: {
        title: "Tickets",
        description:
            "Panneau permettant aux membres d’ouvrir un fil privé avec les administrateurs.",
    },
    "game-servers": {
        title: "Serveurs de jeu",
        description:
            "Sources des résultats et statistiques collectés par Logi. Les clés API sont stockées chiffrées et ne sont plus consultables.",
    },
    league: {
        title: "Global Wardogs League",
        description: "Matchs de ligue suivis et liens avec vos événements.",
    },
    website: {
        title: "Site du clan et connexion",
        description:
            "Pour un site de clan qui lit les données de Logi ou permet aux membres de se connecter via Logi. Les étapes se suivent et dépendent les unes des autres.",
    },
    calendar: {
        title: "Google Agenda",
        description:
            "Abonnez-vous au calendrier du clan depuis Google Agenda ou une autre application.",
    },
    webhooks: {
        title: "Webhooks",
        description: "Envoyez les événements de Logi à vos propres services.",
    },
    imports: {
        title: "Imports et corrections des données",
        description:
            "Import groupé d’événements, de joueurs et d’identifiants de plateforme, recalcul des statistiques.",
    },
    "helper-data": {
        title: "Données de référence",
        description:
            "Données de référence utilisées par Logi pour importer et identifier les joueurs.",
    },
} as const
