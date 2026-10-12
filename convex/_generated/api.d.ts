/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apiHousekeeping from "../apiHousekeeping.js";
import type * as apiIdempotency from "../apiIdempotency.js";
import type * as apiKeyAuth from "../apiKeyAuth.js";
import type * as apiKeyValidators from "../apiKeyValidators.js";
import type * as articles from "../articles.js";
import type * as calendarFeed from "../calendarFeed.js";
import type * as clanMeta from "../clanMeta.js";
import type * as clanPlayerHistory from "../clanPlayerHistory.js";
import type * as clanPublicPage from "../clanPublicPage.js";
import type * as clanSettingsReads from "../clanSettingsReads.js";
import type * as clanSettingsStores from "../clanSettingsStores.js";
import type * as clanTeamStore from "../clanTeamStore.js";
import type * as clanTeams from "../clanTeams.js";
import type * as clientGrants from "../clientGrants.js";
import type * as competitionMigrations from "../competitionMigrations.js";
import type * as competitions from "../competitions.js";
import type * as crons from "../crons.js";
import type * as dashboardActor from "../dashboardActor.js";
import type * as dashboardSessionStore from "../dashboardSessionStore.js";
import type * as dashboardSessions from "../dashboardSessions.js";
import type * as discordCommandTable from "../discordCommandTable.js";
import type * as discordCommands from "../discordCommands.js";
import type * as discordConfig from "../discordConfig.js";
import type * as discordErrorReports from "../discordErrorReports.js";
import type * as discordGameAccounts from "../discordGameAccounts.js";
import type * as discordMatchForum from "../discordMatchForum.js";
import type * as discordMemberAccessStore from "../discordMemberAccessStore.js";
import type * as discordMembership from "../discordMembership.js";
import type * as discordMessageSettings from "../discordMessageSettings.js";
import type * as discordPanelBot from "../discordPanelBot.js";
import type * as discordPanelBotWrites from "../discordPanelBotWrites.js";
import type * as discordPanelGraphics from "../discordPanelGraphics.js";
import type * as discordPanelGraphicsStore from "../discordPanelGraphicsStore.js";
import type * as discordPanelGraphicsTable from "../discordPanelGraphicsTable.js";
import type * as discordPanelGraphicsWrites from "../discordPanelGraphicsWrites.js";
import type * as discordPanelSecrets from "../discordPanelSecrets.js";
import type * as discordPanelStore from "../discordPanelStore.js";
import type * as discordPanels from "../discordPanels.js";
import type * as discordPlayerStats from "../discordPlayerStats.js";
import type * as discordPublicPanels from "../discordPublicPanels.js";
import type * as discordPublicPanelsAdmin from "../discordPublicPanelsAdmin.js";
import type * as discordPublicationTable from "../discordPublicationTable.js";
import type * as discordPublications from "../discordPublications.js";
import type * as discordRosters from "../discordRosters.js";
import type * as discordSeed from "../discordSeed.js";
import type * as discordSeedApiStore from "../discordSeedApiStore.js";
import type * as discordSeedBot from "../discordSeedBot.js";
import type * as discordSeedStore from "../discordSeedStore.js";
import type * as discordSeedTable from "../discordSeedTable.js";
import type * as discordSeedTick from "../discordSeedTick.js";
import type * as discordSync from "../discordSync.js";
import type * as discord_shared from "../discord_shared.js";
import type * as eventAnnouncements from "../eventAnnouncements.js";
import type * as eventAttendance from "../eventAttendance.js";
import type * as eventDeletion from "../eventDeletion.js";
import type * as eventDeletionQueue from "../eventDeletionQueue.js";
import type * as eventDeletionStore from "../eventDeletionStore.js";
import type * as eventDrafts from "../eventDrafts.js";
import type * as eventRecurrence from "../eventRecurrence.js";
import type * as eventReminders from "../eventReminders.js";
import type * as eventResultStore from "../eventResultStore.js";
import type * as eventResults from "../eventResults.js";
import type * as eventValidators from "../eventValidators.js";
import type * as events from "../events.js";
import type * as externalRegistration from "../externalRegistration.js";
import type * as gameCatalog from "../gameCatalog.js";
import type * as gameData from "../gameData.js";
import type * as gameDataCatalog from "../gameDataCatalog.js";
import type * as gameDataCollector from "../gameDataCollector.js";
import type * as gameDataCredentialActions from "../gameDataCredentialActions.js";
import type * as gameDataCredentialMigration from "../gameDataCredentialMigration.js";
import type * as gameDataCredentials from "../gameDataCredentials.js";
import type * as gameDataHistory from "../gameDataHistory.js";
import type * as gameDataRunCredential from "../gameDataRunCredential.js";
import type * as gameDataSources from "../gameDataSources.js";
import type * as gameDataValidators from "../gameDataValidators.js";
import type * as gameHistoryReads from "../gameHistoryReads.js";
import type * as gameHistoryRetention from "../gameHistoryRetention.js";
import type * as gameHistoryStore from "../gameHistoryStore.js";
import type * as groups from "../groups.js";
import type * as guildGames from "../guildGames.js";
import type * as guilds from "../guilds.js";
import type * as hllLiveData from "../hllLiveData.js";
import type * as hllLiveReads from "../hllLiveReads.js";
import type * as housekeeping from "../housekeeping.js";
import type * as identity from "../identity.js";
import type * as imageAssetStore from "../imageAssetStore.js";
import type * as imageAssets from "../imageAssets.js";
import type * as integrationChangeLog from "../integrationChangeLog.js";
import type * as integrationChanges from "../integrationChanges.js";
import type * as integrationMutation from "../integrationMutation.js";
import type * as integrationProjection from "../integrationProjection.js";
import type * as leagueDiscovery from "../leagueDiscovery.js";
import type * as leagueDiscoveryFixtureJobs from "../leagueDiscoveryFixtureJobs.js";
import type * as leagueDiscoveryFixtureTable from "../leagueDiscoveryFixtureTable.js";
import type * as leagueDiscoveryFixtures from "../leagueDiscoveryFixtures.js";
import type * as leagueDiscoveryJobs from "../leagueDiscoveryJobs.js";
import type * as leagueDiscoveryPanels from "../leagueDiscoveryPanels.js";
import type * as leagueDiscoveryQueue from "../leagueDiscoveryQueue.js";
import type * as leagueDiscoveryTable from "../leagueDiscoveryTable.js";
import type * as leagueFixtureReads from "../leagueFixtureReads.js";
import type * as leagueMatchData from "../leagueMatchData.js";
import type * as leagueMatches from "../leagueMatches.js";
import type * as leagueTrackingReads from "../leagueTrackingReads.js";
import type * as leagueTrackingStore from "../leagueTrackingStore.js";
import type * as liveReadPayloads from "../liveReadPayloads.js";
import type * as matchRecaps from "../matchRecaps.js";
import type * as matchStats from "../matchStats.js";
import type * as matchTeams from "../matchTeams.js";
import type * as matchTemplateValidators from "../matchTemplateValidators.js";
import type * as matchTemplates from "../matchTemplates.js";
import type * as meetingAttendance from "../meetingAttendance.js";
import type * as memberObservations from "../memberObservations.js";
import type * as memberRoleOperations from "../memberRoleOperations.js";
import type * as membershipAccess from "../membershipAccess.js";
import type * as membershipApplicationValidators from "../membershipApplicationValidators.js";
import type * as membershipApplications from "../membershipApplications.js";
import type * as membershipSubject from "../membershipSubject.js";
import type * as membership_shared from "../membership_shared.js";
import type * as migrations from "../migrations.js";
import type * as peopleChanges from "../peopleChanges.js";
import type * as peopleProjection from "../peopleProjection.js";
import type * as peopleSummaries from "../peopleSummaries.js";
import type * as performanceHistory from "../performanceHistory.js";
import type * as platformAdmin from "../platformAdmin.js";
import type * as platformIdentityLinks from "../platformIdentityLinks.js";
import type * as platformIdentityStore from "../platformIdentityStore.js";
import type * as platformLinkStore from "../platformLinkStore.js";
import type * as platformSettings from "../platformSettings.js";
import type * as playerReportAccess from "../playerReportAccess.js";
import type * as playerReportDrafts from "../playerReportDrafts.js";
import type * as playerReports from "../playerReports.js";
import type * as playerStats from "../playerStats.js";
import type * as players from "../players.js";
import type * as privacy from "../privacy.js";
import type * as publicApi from "../publicApi.js";
import type * as publicApiReads from "../publicApiReads.js";
import type * as publicApiShared from "../publicApiShared.js";
import type * as publicPreviews from "../publicPreviews.js";
import type * as publicProfiles from "../publicProfiles.js";
import type * as publicStats from "../publicStats.js";
import type * as resultValidators from "../resultValidators.js";
import type * as roleAccess from "../roleAccess.js";
import type * as rosterChanges from "../rosterChanges.js";
import type * as rosterSync from "../rosterSync.js";
import type * as rosterWriterAccess from "../rosterWriterAccess.js";
import type * as rosters from "../rosters.js";
import type * as scheduledJobs from "../scheduledJobs.js";
import type * as serverContext from "../serverContext.js";
import type * as serverDashboard from "../serverDashboard.js";
import type * as serverMetadata from "../serverMetadata.js";
import type * as serverRosters from "../serverRosters.js";
import type * as serverSetup from "../serverSetup.js";
import type * as signupActivity from "../signupActivity.js";
import type * as squadPresets from "../squadPresets.js";
import type * as sso from "../sso.js";
import type * as ssoTokenStore from "../ssoTokenStore.js";
import type * as stratmaps from "../stratmaps.js";
import type * as tacticalPlanValidator from "../tacticalPlanValidator.js";
import type * as teamMigrations from "../teamMigrations.js";
import type * as teamReads from "../teamReads.js";
import type * as teamRequests from "../teamRequests.js";
import type * as teamValidators from "../teamValidators.js";
import type * as teams from "../teams.js";
import type * as topicPresets from "../topicPresets.js";
import type * as uploads from "../uploads.js";
import type * as userAssignments from "../userAssignments.js";
import type * as users from "../users.js";
import type * as warconData from "../warconData.js";
import type * as warconReads from "../warconReads.js";
import type * as webhookDeliveryCleanup from "../webhookDeliveryCleanup.js";
import type * as webhookDispatcher from "../webhookDispatcher.js";
import type * as webhookQueue from "../webhookQueue.js";
import type * as webhooks from "../webhooks.js";
import type * as websiteEventCommands from "../websiteEventCommands.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apiHousekeeping: typeof apiHousekeeping;
  apiIdempotency: typeof apiIdempotency;
  apiKeyAuth: typeof apiKeyAuth;
  apiKeyValidators: typeof apiKeyValidators;
  articles: typeof articles;
  calendarFeed: typeof calendarFeed;
  clanMeta: typeof clanMeta;
  clanPlayerHistory: typeof clanPlayerHistory;
  clanPublicPage: typeof clanPublicPage;
  clanSettingsReads: typeof clanSettingsReads;
  clanSettingsStores: typeof clanSettingsStores;
  clanTeamStore: typeof clanTeamStore;
  clanTeams: typeof clanTeams;
  clientGrants: typeof clientGrants;
  competitionMigrations: typeof competitionMigrations;
  competitions: typeof competitions;
  crons: typeof crons;
  dashboardActor: typeof dashboardActor;
  dashboardSessionStore: typeof dashboardSessionStore;
  dashboardSessions: typeof dashboardSessions;
  discordCommandTable: typeof discordCommandTable;
  discordCommands: typeof discordCommands;
  discordConfig: typeof discordConfig;
  discordErrorReports: typeof discordErrorReports;
  discordGameAccounts: typeof discordGameAccounts;
  discordMatchForum: typeof discordMatchForum;
  discordMemberAccessStore: typeof discordMemberAccessStore;
  discordMembership: typeof discordMembership;
  discordMessageSettings: typeof discordMessageSettings;
  discordPanelBot: typeof discordPanelBot;
  discordPanelBotWrites: typeof discordPanelBotWrites;
  discordPanelGraphics: typeof discordPanelGraphics;
  discordPanelGraphicsStore: typeof discordPanelGraphicsStore;
  discordPanelGraphicsTable: typeof discordPanelGraphicsTable;
  discordPanelGraphicsWrites: typeof discordPanelGraphicsWrites;
  discordPanelSecrets: typeof discordPanelSecrets;
  discordPanelStore: typeof discordPanelStore;
  discordPanels: typeof discordPanels;
  discordPlayerStats: typeof discordPlayerStats;
  discordPublicPanels: typeof discordPublicPanels;
  discordPublicPanelsAdmin: typeof discordPublicPanelsAdmin;
  discordPublicationTable: typeof discordPublicationTable;
  discordPublications: typeof discordPublications;
  discordRosters: typeof discordRosters;
  discordSeed: typeof discordSeed;
  discordSeedApiStore: typeof discordSeedApiStore;
  discordSeedBot: typeof discordSeedBot;
  discordSeedStore: typeof discordSeedStore;
  discordSeedTable: typeof discordSeedTable;
  discordSeedTick: typeof discordSeedTick;
  discordSync: typeof discordSync;
  discord_shared: typeof discord_shared;
  eventAnnouncements: typeof eventAnnouncements;
  eventAttendance: typeof eventAttendance;
  eventDeletion: typeof eventDeletion;
  eventDeletionQueue: typeof eventDeletionQueue;
  eventDeletionStore: typeof eventDeletionStore;
  eventDrafts: typeof eventDrafts;
  eventRecurrence: typeof eventRecurrence;
  eventReminders: typeof eventReminders;
  eventResultStore: typeof eventResultStore;
  eventResults: typeof eventResults;
  eventValidators: typeof eventValidators;
  events: typeof events;
  externalRegistration: typeof externalRegistration;
  gameCatalog: typeof gameCatalog;
  gameData: typeof gameData;
  gameDataCatalog: typeof gameDataCatalog;
  gameDataCollector: typeof gameDataCollector;
  gameDataCredentialActions: typeof gameDataCredentialActions;
  gameDataCredentialMigration: typeof gameDataCredentialMigration;
  gameDataCredentials: typeof gameDataCredentials;
  gameDataHistory: typeof gameDataHistory;
  gameDataRunCredential: typeof gameDataRunCredential;
  gameDataSources: typeof gameDataSources;
  gameDataValidators: typeof gameDataValidators;
  gameHistoryReads: typeof gameHistoryReads;
  gameHistoryRetention: typeof gameHistoryRetention;
  gameHistoryStore: typeof gameHistoryStore;
  groups: typeof groups;
  guildGames: typeof guildGames;
  guilds: typeof guilds;
  hllLiveData: typeof hllLiveData;
  hllLiveReads: typeof hllLiveReads;
  housekeeping: typeof housekeeping;
  identity: typeof identity;
  imageAssetStore: typeof imageAssetStore;
  imageAssets: typeof imageAssets;
  integrationChangeLog: typeof integrationChangeLog;
  integrationChanges: typeof integrationChanges;
  integrationMutation: typeof integrationMutation;
  integrationProjection: typeof integrationProjection;
  leagueDiscovery: typeof leagueDiscovery;
  leagueDiscoveryFixtureJobs: typeof leagueDiscoveryFixtureJobs;
  leagueDiscoveryFixtureTable: typeof leagueDiscoveryFixtureTable;
  leagueDiscoveryFixtures: typeof leagueDiscoveryFixtures;
  leagueDiscoveryJobs: typeof leagueDiscoveryJobs;
  leagueDiscoveryPanels: typeof leagueDiscoveryPanels;
  leagueDiscoveryQueue: typeof leagueDiscoveryQueue;
  leagueDiscoveryTable: typeof leagueDiscoveryTable;
  leagueFixtureReads: typeof leagueFixtureReads;
  leagueMatchData: typeof leagueMatchData;
  leagueMatches: typeof leagueMatches;
  leagueTrackingReads: typeof leagueTrackingReads;
  leagueTrackingStore: typeof leagueTrackingStore;
  liveReadPayloads: typeof liveReadPayloads;
  matchRecaps: typeof matchRecaps;
  matchStats: typeof matchStats;
  matchTeams: typeof matchTeams;
  matchTemplateValidators: typeof matchTemplateValidators;
  matchTemplates: typeof matchTemplates;
  meetingAttendance: typeof meetingAttendance;
  memberObservations: typeof memberObservations;
  memberRoleOperations: typeof memberRoleOperations;
  membershipAccess: typeof membershipAccess;
  membershipApplicationValidators: typeof membershipApplicationValidators;
  membershipApplications: typeof membershipApplications;
  membershipSubject: typeof membershipSubject;
  membership_shared: typeof membership_shared;
  migrations: typeof migrations;
  peopleChanges: typeof peopleChanges;
  peopleProjection: typeof peopleProjection;
  peopleSummaries: typeof peopleSummaries;
  performanceHistory: typeof performanceHistory;
  platformAdmin: typeof platformAdmin;
  platformIdentityLinks: typeof platformIdentityLinks;
  platformIdentityStore: typeof platformIdentityStore;
  platformLinkStore: typeof platformLinkStore;
  platformSettings: typeof platformSettings;
  playerReportAccess: typeof playerReportAccess;
  playerReportDrafts: typeof playerReportDrafts;
  playerReports: typeof playerReports;
  playerStats: typeof playerStats;
  players: typeof players;
  privacy: typeof privacy;
  publicApi: typeof publicApi;
  publicApiReads: typeof publicApiReads;
  publicApiShared: typeof publicApiShared;
  publicPreviews: typeof publicPreviews;
  publicProfiles: typeof publicProfiles;
  publicStats: typeof publicStats;
  resultValidators: typeof resultValidators;
  roleAccess: typeof roleAccess;
  rosterChanges: typeof rosterChanges;
  rosterSync: typeof rosterSync;
  rosterWriterAccess: typeof rosterWriterAccess;
  rosters: typeof rosters;
  scheduledJobs: typeof scheduledJobs;
  serverContext: typeof serverContext;
  serverDashboard: typeof serverDashboard;
  serverMetadata: typeof serverMetadata;
  serverRosters: typeof serverRosters;
  serverSetup: typeof serverSetup;
  signupActivity: typeof signupActivity;
  squadPresets: typeof squadPresets;
  sso: typeof sso;
  ssoTokenStore: typeof ssoTokenStore;
  stratmaps: typeof stratmaps;
  tacticalPlanValidator: typeof tacticalPlanValidator;
  teamMigrations: typeof teamMigrations;
  teamReads: typeof teamReads;
  teamRequests: typeof teamRequests;
  teamValidators: typeof teamValidators;
  teams: typeof teams;
  topicPresets: typeof topicPresets;
  uploads: typeof uploads;
  userAssignments: typeof userAssignments;
  users: typeof users;
  warconData: typeof warconData;
  warconReads: typeof warconReads;
  webhookDeliveryCleanup: typeof webhookDeliveryCleanup;
  webhookDispatcher: typeof webhookDispatcher;
  webhookQueue: typeof webhookQueue;
  webhooks: typeof webhooks;
  websiteEventCommands: typeof websiteEventCommands;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
