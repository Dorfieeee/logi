const fr = {
    title: "Matchs Wardogs automatiques",
    ambiguous_game_start:
        "Plusieurs matchs commencent à cet horaire ; associez la rencontre manuellement.",
    kickoff_already_linked:
        "Le match à cet horaire est associé à une autre rencontre.",
    matching_scan_limit:
        "Trop de matchs à vérifier de manière fiable ; associez la rencontre manuellement.",
    configure: "Configurer les imports automatiques",
    enabled: "Créer automatiquement les rencontres de mon équipe",
    intro: "Connectez la clé API Global Wardogs League de votre équipe. Les prochaines rencontres programmées deviennent des matchs Logi ; par défaut, les inscriptions ouvrent 7 jours avant le début.",
    key: "Clé API Wardogs",
    keySaved:
        "Clé enregistrée. Laissez vide pour la conserver ; saisissez une nouvelle clé pour la remplacer.",
    teamCode: "Code de votre équipe dans Global Wardogs League",
    team_not_in_fixture:
        "Le code d’équipe configuré ne figure pas dans cette rencontre",
    template: "Modèle de match par défaut",
    noTemplates:
        "Créez d’abord un modèle de match Wardogs dans Paramètres → Modèles de match.",
    hours: "Ouvrir les inscriptions avant le début (heures)",
    announcement: "Salon d’annonces",
    info: "Salon d’informations / de composition",
    results: "Salon des résultats (facultatif)",
    server: "Nom du serveur de jeu (facultatif)",
    save: "Enregistrer",
    saving: "Enregistrement…",
    failed: "Impossible d’enregistrer. Vérifiez la clé API, le modèle, les horaires d’inscription, l’accès aux salons et la configuration du chiffrement des identifiants.",
    loadFailed: "Impossible de charger les paramètres d’import.",
    saved: "Paramètres d’import enregistrés.",
    select: "Sélectionner…",
    never: "Aucun import réussi pour le moment",
    last: "Dernier import réussi",
    importFailed:
        "Le dernier import a échoué. Vérifiez la clé et le modèle ; Logi réessaiera automatiquement.",
    sync: "GWL contrôle les détails liés. Les résultats confirmés sont finalisés automatiquement ; les litiges retirent résultats et totaux jusqu’à confirmation. Les statistiques serveur sont prioritaires. Annulations et retraits nécessitent une vérification. Contrôle toutes les 15 minutes, rapprochement toutes les trois heures, avec décalage des tâches.",
    templateDetails:
        "Le modèle fournit le rassemblement, la clôture des inscriptions, la durée, les groupes, rappels, mentions et paramètres de forum et de salons vocaux. Les changements des valeurs par défaut s’appliquent aux nouveaux imports.",
    issues: "Rencontres à vérifier",
    match: "Ouvrir le match",
    team_matching_required: "Associer les équipes de l’API au catalogue",
    cancelled_or_postponed: "Annulé ou reporté — vérifiez le match",
    missing_kickoff: "En attente de l’horaire de début",
    manually_managed: "Géré manuellement ou ignoré",
    match_deleted: "Le match importé a été supprimé ; il ne sera pas recréé",
}

const en = {
    title: "Automatic Wardogs matches",
    ambiguous_game_start:
        "Multiple matches have this kickoff time; link the fixture manually.",
    kickoff_already_linked:
        "The match at this kickoff is linked to another fixture.",
    matching_scan_limit:
        "Too many matches to check safely; link the fixture manually.",
    configure: "Configure automatic imports",
    enabled: "Automatically create my team's fixtures",
    intro: "Connect your Global Wardogs League team API key. Upcoming scheduled fixtures become Logi matches; registration opens 7 days before kickoff by default.",
    key: "GWL API key",
    keySaved:
        "Key saved. Leave blank to keep it; enter a new key to replace it.",
    teamCode: "Your team code in Global Wardogs League",
    team_not_in_fixture: "Configured team code is missing from this fixture",
    template: "Default match template",
    noTemplates:
        "Create a Wardogs match template in Settings → Match templates first.",
    hours: "Open registration before kickoff (hours)",
    announcement: "Announcement channel",
    info: "Event information / roster channel",
    results: "Results channel (optional)",
    server: "Game server name (optional)",
    save: "Save",
    saving: "Saving…",
    failed: "Could not save. Check the API key, template, registration timing, channel access and credential encryption configuration.",
    loadFailed: "Could not load import settings.",
    saved: "Import settings saved.",
    select: "Select…",
    never: "No successful import yet",
    last: "Last successful import",
    importFailed:
        "The last import failed. Check the key and template; Logi will retry automatically.",
    sync: "GWL controls linked match details. Confirmed results finalize automatically; disputes retract results and totals until reconfirmed. Direct server stats take precedence. Cancellations and withdrawals need review. Changes are checked every 15 minutes, with three-hour reconciliation and staggered scheduling.",
    templateDetails:
        "The template supplies meeting time, registration deadline, duration, signup groups, reminders, pings, forum and voice-channel settings. Changes to defaults apply to new imports.",
    issues: "Fixtures needing review",
    match: "Open match",
    team_matching_required: "Match API teams to the catalogue",
    cancelled_or_postponed: "Cancelled or postponed — review the match",
    missing_kickoff: "Waiting for kickoff time",
    manually_managed: "Managed manually or ignored",
    match_deleted: "Imported match was deleted; it will not be recreated",
}
export type AutoImportCopy = typeof en
const cs: AutoImportCopy = {
    title: "Automatické zápasy Wardogs",
    ambiguous_game_start:
        "Stejný začátek má více zápasů; propojte utkání ručně.",
    kickoff_already_linked:
        "Zápas s tímto začátkem je propojen s jiným utkáním.",
    matching_scan_limit:
        "Příliš mnoho zápasů pro bezpečné ověření; propojte utkání ručně.",
    configure: "Nastavit automatický import",
    enabled: "Automaticky vytvářet zápasy mého týmu",
    intro: "Připojte API klíč týmu z Global Wardogs League. Z plánovaných zápasů vzniknou zápasy v Logi; registrace se standardně otevře 7 dní před začátkem.",
    key: "API klíč Wardogs",
    keySaved:
        "Klíč je uložen. Prázdné pole jej ponechá; nový klíč jej nahradí.",
    teamCode: "Kód vašeho týmu ve Global Wardogs League",
    team_not_in_fixture: "Nastavený kód týmu není v tomto zápase",
    template: "Výchozí šablona zápasu",
    noTemplates:
        "Nejprve vytvořte šablonu zápasu Wardogs v Nastavení → Šablony zápasů.",
    hours: "Otevřít registraci před začátkem (hodiny)",
    announcement: "Kanál oznámení",
    info: "Kanál informací o zápase / sestavy",
    results: "Kanál výsledků (volitelné)",
    server: "Název herního serveru (volitelné)",
    save: "Uložit",
    saving: "Ukládání…",
    failed: "Uložení se nezdařilo. Zkontrolujte API klíč, šablonu, časy registrace, přístup ke kanálům a nastavení šifrování přihlašovacích údajů.",
    loadFailed: "Nastavení importu se nepodařilo načíst.",
    saved: "Nastavení importu uloženo.",
    select: "Vyberte…",
    never: "Zatím žádný úspěšný import",
    last: "Poslední úspěšný import",
    importFailed:
        "Poslední import selhal. Zkontrolujte klíč a šablonu; Logi jej automaticky zopakuje.",
    sync: "GWL řídí údaje propojených zápasů. Potvrzené výsledky se automaticky uzavřou; spory stáhnou výsledky i součty do nového potvrzení. Přednost mají statistiky serveru. Zrušení a odstoupení vyžadují kontrolu. Kontrola každých 15 minut, úplná synchronizace každé tři hodiny, s rozloženým spouštěním.",
    templateDetails:
        "Šablona určuje sraz, konec registrace, délku zápasu, skupiny, připomínky, zmínky, fórum a hlasové kanály. Změny výchozího nastavení platí pro nové importy.",
    issues: "Zápasy ke kontrole",
    match: "Otevřít zápas",
    team_matching_required: "Přiřaďte týmy z API ke katalogu",
    cancelled_or_postponed: "Zrušeno nebo odloženo — zkontrolujte zápas",
    missing_kickoff: "Čeká na čas začátku",
    manually_managed: "Spravováno ručně nebo ignorováno",
    match_deleted: "Importovaný zápas byl smazán; nebude znovu vytvořen",
}
const de: AutoImportCopy = {
    ...en,
    title: "Automatische Wardogs-Spiele",
    ambiguous_game_start:
        "Mehrere Spiele beginnen gleichzeitig; Begegnung manuell verknüpfen.",
    kickoff_already_linked:
        "Das Spiel zu dieser Zeit ist mit einer anderen Begegnung verknüpft.",
    matching_scan_limit:
        "Zu viele Spiele für eine sichere Prüfung; manuell verknüpfen.",
    configure: "Automatischen Import einrichten",
    enabled: "Spiele meines Teams automatisch erstellen",
    intro: "Verbinde den API-Schlüssel deines Wardogs-League-Teams. Geplante Begegnungen werden zu Logi-Spielen; die Anmeldung öffnet standardmäßig 7 Tage vor Spielbeginn.",
    key: "Wardogs-API-Schlüssel",
    keySaved:
        "Schlüssel gespeichert. Leer lassen zum Beibehalten; ein neuer Schlüssel ersetzt ihn.",
    teamCode: "Dein Teamcode in Global Wardogs League",
    team_not_in_fixture: "Der konfigurierte Teamcode fehlt in dieser Begegnung",
    template: "Standard-Spielvorlage",
    noTemplates:
        "Erstelle zuerst eine Wardogs-Spielvorlage unter Einstellungen → Spielvorlagen.",
    hours: "Anmeldung vor Spielbeginn öffnen (Stunden)",
    announcement: "Ankündigungskanal",
    info: "Spielinformationen / Aufstellung",
    results: "Ergebniskanal (optional)",
    server: "Spielservername (optional)",
    save: "Speichern",
    saving: "Wird gespeichert…",
    failed: "Speichern fehlgeschlagen. Prüfe API-Schlüssel, Vorlage, Anmeldezeiten, Kanalzugriff und die Verschlüsselungskonfiguration.",
    loadFailed: "Importeinstellungen konnten nicht geladen werden.",
    saved: "Importeinstellungen gespeichert.",
    select: "Auswählen…",
    never: "Noch kein erfolgreicher Import",
    last: "Letzter erfolgreicher Import",
    importFailed:
        "Der letzte Import ist fehlgeschlagen. Prüfe Schlüssel und Vorlage; Logi versucht es automatisch erneut.",
    sync: "GWL steuert verknüpfte Spieldaten. Bestätigte Ergebnisse schließen automatisch ab; bei Streit werden Ergebnis und Summen bis zur Bestätigung zurückgezogen. Serverstatistiken haben Vorrang. Absagen und Rückzüge erfordern Prüfung. Prüfung alle 15 Minuten, Abgleich alle drei Stunden, zeitversetzt.",
    templateDetails:
        "Die Vorlage bestimmt Treffpunktzeit, Anmeldeschluss, Dauer, Gruppen, Erinnerungen, Erwähnungen, Forum und Sprachkanäle. Geänderte Standardwerte gelten für neue Importe.",
    issues: "Spiele zur Prüfung",
    match: "Spiel öffnen",
    team_matching_required: "API-Teams dem Katalog zuordnen",
    cancelled_or_postponed: "Abgesagt oder verschoben — Spiel prüfen",
    missing_kickoff: "Wartet auf Spielbeginn",
    manually_managed: "Manuell verwaltet oder ignoriert",
    match_deleted: "Importiertes Spiel gelöscht; wird nicht erneut erstellt",
}
const pl: AutoImportCopy = {
    ...en,
    title: "Automatyczne mecze Wardogs",
    ambiguous_game_start:
        "Kilka meczów zaczyna się jednocześnie; połącz spotkanie ręcznie.",
    kickoff_already_linked:
        "Mecz o tej godzinie jest połączony z innym spotkaniem.",
    matching_scan_limit:
        "Za dużo meczów do bezpiecznego sprawdzenia; połącz spotkanie ręcznie.",
    configure: "Skonfiguruj automatyczny import",
    enabled: "Automatycznie twórz mecze mojego zespołu",
    intro: "Połącz klucz API zespołu Global Wardogs League. Zaplanowane spotkania staną się meczami Logi; zapisy domyślnie otwierają się 7 dni przed rozpoczęciem.",
    key: "Klucz API Wardogs",
    keySaved: "Klucz zapisany. Puste pole zachowa go; nowy klucz go zastąpi.",
    teamCode: "Kod twojego zespołu w Global Wardogs League",
    team_not_in_fixture: "Skonfigurowanego kodu zespołu nie ma w tym spotkaniu",
    template: "Domyślny szablon meczu",
    noTemplates:
        "Najpierw utwórz szablon meczu Wardogs w Ustawienia → Szablony meczów.",
    hours: "Otwórz zapisy przed rozpoczęciem (godziny)",
    announcement: "Kanał ogłoszeń",
    info: "Kanał informacji o meczu / składu",
    results: "Kanał wyników (opcjonalnie)",
    server: "Nazwa serwera gry (opcjonalnie)",
    save: "Zapisz",
    saving: "Zapisywanie…",
    failed: "Nie udało się zapisać. Sprawdź klucz API, szablon, terminy zapisów, dostęp do kanałów i konfigurację szyfrowania danych dostępowych.",
    loadFailed: "Nie udało się wczytać ustawień importu.",
    saved: "Ustawienia importu zapisane.",
    select: "Wybierz…",
    never: "Brak udanego importu",
    last: "Ostatni udany import",
    importFailed:
        "Ostatni import nie powiódł się. Sprawdź klucz i szablon; Logi spróbuje ponownie automatycznie.",
    sync: "GWL zarządza danymi połączonych meczów. Potwierdzone wyniki kończą mecz automatycznie; spór wycofuje wynik i sumy do ponownego potwierdzenia. Statystyki serwera mają pierwszeństwo. Anulowanie i wycofanie wymagają przeglądu. Kontrola co 15 minut, uzgadnianie co trzy godziny, z rozłożonym startem.",
    templateDetails:
        "Szablon określa zbiórkę, zamknięcie zapisów, czas trwania, grupy, przypomnienia, wzmianki, forum i kanały głosowe. Zmiany ustawień domyślnych dotyczą nowych importów.",
    issues: "Mecze do sprawdzenia",
    match: "Otwórz mecz",
    team_matching_required: "Przypisz zespoły z API do katalogu",
    cancelled_or_postponed: "Odwołany lub przełożony — sprawdź mecz",
    missing_kickoff: "Oczekiwanie na termin",
    manually_managed: "Zarządzany ręcznie lub ignorowany",
    match_deleted:
        "Zaimportowany mecz został usunięty; nie zostanie odtworzony",
}
export function autoImportCopy(locale: string): AutoImportCopy {
    return (
        ({ en, cs, de, pl, fr } as Record<string, AutoImportCopy>)[locale] ?? en
    )
}
