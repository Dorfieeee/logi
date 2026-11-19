import type { GwlSaveFailure } from "@/domain/gwl/save-feedback"
const messages = {
    en: {
        missing_scope:
            "The GWL key is missing permission: {scope}. Enable it in GWL Team Settings → API access, then try again.",
        key_rejected:
            "GWL rejected the key. Check that it is active, has not expired, and its creator still has team access.",
        wrong_key_type:
            "Use a team API key for clan synchronization. A personal API key cannot be used here.",
        test_key_cannot_sync_live_data:
            "A test key cannot enable live synchronization. Turn synchronization off to test it, or use a live team key.",
        team_change_requires_unlinking:
            "This key belongs to a different GWL team. Existing linked matches must be reviewed before changing teams.",
        encryption_unavailable:
            "Secure credential storage is not configured on the server. Ask the Logi administrator to enable it.",
        invalid_settings:
            "Check the selected template, registration hours and required Discord channels.",
        registration_timing:
            "Registration must open before it closes. Increase the hours before kickoff or adjust the template’s timing.",
        channel_access:
            "Logi cannot publish in one of the selected Discord channels. Check the bot’s channel permissions or choose another channel.",
        rate_limited: "GWL’s rate limit was reached. Wait before trying again.",
        provider_unavailable:
            "Could not validate the connection with GWL. It may be unavailable or returning an unexpected response. Try again later.",
        save_failed:
            "Could not save the GWL connection. Try again or contact the Logi administrator.",
    },
    cs: {
        missing_scope:
            "Klíči GWL chybí oprávnění: {scope}. Zapněte ho v GWL Team Settings → API access a zkuste to znovu.",
        key_rejected:
            "GWL klíč odmítlo. Zkontrolujte platnost klíče a přístup jeho tvůrce k týmu.",
        wrong_key_type:
            "Pro synchronizaci klanu použijte týmový API klíč. Osobní klíč zde nelze použít.",
        test_key_cannot_sync_live_data:
            "Testovací klíč nemůže zapnout živou synchronizaci. Vypněte synchronizaci nebo použijte živý týmový klíč.",
        team_change_requires_unlinking:
            "Klíč patří jinému týmu GWL. Před změnou týmu zkontrolujte propojené zápasy.",
        encryption_unavailable:
            "Na serveru není nastavené bezpečné ukládání klíčů. Obraťte se na správce Logi.",
        invalid_settings:
            "Zkontrolujte šablonu, počet hodin do registrace a povinné kanály Discordu.",
        registration_timing:
            "Registrace se musí otevřít před uzavřením. Zvyšte počet hodin před začátkem nebo upravte časy šablony.",
        channel_access:
            "Logi nemůže publikovat v některém vybraném kanálu. Zkontrolujte oprávnění bota nebo vyberte jiný kanál.",
        rate_limited: "Byl dosažen limit GWL. Před dalším pokusem počkejte.",
        provider_unavailable:
            "Spojení s GWL nelze ověřit. Služba může být nedostupná nebo vrací neočekávaná data. Zkuste to později.",
        save_failed:
            "Připojení GWL se nepodařilo uložit. Zkuste to znovu nebo kontaktujte správce Logi.",
    },
    de: {
        missing_scope:
            "Dem GWL-Schlüssel fehlt die Berechtigung: {scope}. In GWL Team Settings → API access aktivieren und erneut versuchen.",
        key_rejected:
            "GWL hat den Schlüssel abgelehnt. Gültigkeit und Teamzugriff des Erstellers prüfen.",
        wrong_key_type:
            "Für die Clan-Synchronisierung einen Team-API-Schlüssel verwenden. Persönliche Schlüssel funktionieren hier nicht.",
        test_key_cannot_sync_live_data:
            "Ein Testschlüssel kann keine Live-Synchronisierung aktivieren. Synchronisierung deaktivieren oder einen Live-Team-Schlüssel verwenden.",
        team_change_requires_unlinking:
            "Dieser Schlüssel gehört zu einem anderen GWL-Team. Verknüpfte Spiele vor einem Teamwechsel prüfen.",
        encryption_unavailable:
            "Die sichere Schlüsselspeicherung ist auf dem Server nicht eingerichtet. Den Logi-Administrator kontaktieren.",
        invalid_settings:
            "Vorlage, Anmeldezeiten und erforderliche Discord-Kanäle prüfen.",
        registration_timing:
            "Die Anmeldung muss vor ihrem Ende öffnen. Mehr Stunden vor Spielbeginn wählen oder die Vorlagenzeiten anpassen.",
        channel_access:
            "Logi kann in einem ausgewählten Discord-Kanal nicht veröffentlichen. Bot-Berechtigungen prüfen oder einen anderen Kanal wählen.",
        rate_limited:
            "Das GWL-Anfragelimit wurde erreicht. Vor dem nächsten Versuch warten.",
        provider_unavailable:
            "Die Verbindung mit GWL konnte nicht geprüft werden. Der Dienst ist möglicherweise nicht erreichbar oder liefert unerwartete Daten. Später erneut versuchen.",
        save_failed:
            "Die GWL-Verbindung konnte nicht gespeichert werden. Erneut versuchen oder den Logi-Administrator kontaktieren.",
    },
    fr: {
        missing_scope:
            "Il manque au jeton GWL le droit : {scope}. Activez-le dans GWL Team Settings → API access, puis réessayez.",
        key_rejected:
            "GWL a refusé la clé. Vérifiez sa validité et les droits de son créateur dans l’équipe.",
        wrong_key_type:
            "Utilisez une clé API d’équipe pour synchroniser le clan. Une clé personnelle ne fonctionne pas ici.",
        test_key_cannot_sync_live_data:
            "Une clé de test ne peut pas activer la synchronisation réelle. Désactivez-la ou utilisez une clé d’équipe réelle.",
        team_change_requires_unlinking:
            "Cette clé appartient à une autre équipe GWL. Vérifiez les matchs liés avant de changer d’équipe.",
        encryption_unavailable:
            "Le stockage sécurisé des clés n’est pas configuré sur le serveur. Contactez l’administrateur Logi.",
        invalid_settings:
            "Vérifiez le modèle, les horaires d’inscription et les salons Discord requis.",
        registration_timing:
            "Les inscriptions doivent ouvrir avant leur fermeture. Augmentez le délai avant le match ou ajustez le modèle.",
        channel_access:
            "Logi ne peut pas publier dans un salon sélectionné. Vérifiez les droits du bot ou choisissez un autre salon.",
        rate_limited:
            "La limite de requêtes GWL est atteinte. Patientez avant de réessayer.",
        provider_unavailable:
            "Impossible de vérifier la connexion GWL. Le service est peut-être indisponible ou renvoie des données inattendues. Réessayez plus tard.",
        save_failed:
            "Impossible d’enregistrer la connexion GWL. Réessayez ou contactez l’administrateur Logi.",
    },
    pl: {
        missing_scope:
            "Klucz GWL nie ma uprawnienia: {scope}. Włącz je w GWL Team Settings → API access i spróbuj ponownie.",
        key_rejected:
            "GWL odrzuciło klucz. Sprawdź jego ważność i dostęp twórcy do zespołu.",
        wrong_key_type:
            "Do synchronizacji klanu użyj klucza API zespołu. Klucz osobisty nie działa tutaj.",
        test_key_cannot_sync_live_data:
            "Klucz testowy nie może włączyć rzeczywistej synchronizacji. Wyłącz ją lub użyj rzeczywistego klucza zespołu.",
        team_change_requires_unlinking:
            "Ten klucz należy do innego zespołu GWL. Przejrzyj połączone mecze przed zmianą zespołu.",
        encryption_unavailable:
            "Bezpieczne przechowywanie kluczy nie jest skonfigurowane na serwerze. Skontaktuj się z administratorem Logi.",
        invalid_settings:
            "Sprawdź szablon, godziny zapisów i wymagane kanały Discorda.",
        registration_timing:
            "Zapisy muszą otworzyć się przed ich zamknięciem. Zwiększ wyprzedzenie lub zmień godziny szablonu.",
        channel_access:
            "Logi nie może publikować w wybranym kanale Discorda. Sprawdź uprawnienia bota lub wybierz inny kanał.",
        rate_limited:
            "Osiągnięto limit żądań GWL. Poczekaj przed ponowną próbą.",
        provider_unavailable:
            "Nie można zweryfikować połączenia GWL. Usługa może być niedostępna lub zwraca nieoczekiwane dane. Spróbuj później.",
        save_failed:
            "Nie można zapisać połączenia GWL. Spróbuj ponownie lub skontaktuj się z administratorem Logi.",
    },
}
export function gwlSaveErrorMessage(locale: string, failure: GwlSaveFailure) {
    const t = messages[locale as keyof typeof messages] ?? messages.en
    return t[failure.error].replace(
        "{scope}",
        failure.scope ??
            "team.read, matches.read, matches.file, events.read, slots.read"
    )
}
