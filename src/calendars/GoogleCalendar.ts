import { TFile, TFolder } from "obsidian";
import { EventPathLocation } from "../core/EventStore";
import { ObsidianInterface } from "../ObsidianAdapter";
import { EventLocation, OFCEvent } from "../types";
import { EditableCalendar, EditableEventResponse } from "./EditableCalendar";
import FullNoteCalendar from "./FullNoteCalendar";
import {
    GoogleCalendarSync,
    GoogleOAuthConfig,
    SyncState,
} from "../sync/GoogleCalendarSync";

/**
 * Google Calendar implementation that extends EditableCalendar.
 *
 * This calendar stores events locally in markdown files (using FullNoteCalendar)
 * and syncs changes to Google Calendar automatically.
 */
export default class GoogleCalendar extends EditableCalendar {
    private localCalendar: FullNoteCalendar;
    private syncService: GoogleCalendarSync | null = null;
    private syncEnabled: boolean;
    private calendarId: string;
    private oauthConfig: GoogleOAuthConfig;

    constructor(
        app: ObsidianInterface,
        color: string,
        directory: string,
        calendarId: string,
        syncEnabled: boolean,
        oauthConfig: GoogleOAuthConfig,
        accessToken?: string,
        refreshToken?: string,
        tokenExpiry?: number
    ) {
        super(color);

        // Use FullNoteCalendar internally for local storage
        this.localCalendar = new FullNoteCalendar(app, color, directory);
        this.calendarId = calendarId;
        this.syncEnabled = syncEnabled;
        this.oauthConfig = oauthConfig;

        // Initialize sync service if we have credentials
        if (syncEnabled && accessToken && refreshToken) {
            this.syncService = new GoogleCalendarSync(
                oauthConfig,
                calendarId,
                accessToken,
                refreshToken,
                tokenExpiry
            );
            console.log(
                "GoogleCalendar initialized with sync service for directory:",
                directory
            );
        } else {
            console.log(
                "GoogleCalendar initialized without sync service (syncEnabled:",
                syncEnabled,
                "hasTokens:",
                !!(accessToken && refreshToken),
                ")"
            );
        }
    }

    get type(): "google" {
        return "google";
    }

    get identifier(): string {
        return this.directory;
    }

    get name(): string {
        return `${this.directory} (Google)`;
    }

    get directory(): string {
        return this.localCalendar.directory;
    }

    /**
     * Initialize sync service with OAuth credentials
     */
    initializeSync(
        accessToken: string,
        refreshToken: string,
        tokenExpiry?: number
    ): void {
        this.syncService = new GoogleCalendarSync(
            this.oauthConfig,
            this.calendarId,
            accessToken,
            refreshToken,
            tokenExpiry
        );
        this.syncEnabled = true;
    }

    /**
     * Get OAuth URL for authentication
     */
    getAuthUrl(): string {
        if (!this.syncService) {
            // Create temporary sync service just to get auth URL
            const tempSync = new GoogleCalendarSync(
                this.oauthConfig,
                this.calendarId
            );
            return tempSync.getAuthUrl();
        }
        return this.syncService.getAuthUrl();
    }

    /**
     * Complete OAuth flow with authorization code
     */
    async authenticateWithCode(code: string): Promise<{
        accessToken: string;
        refreshToken: string;
        tokenExpiry: number;
    }> {
        if (!this.syncService) {
            // Create temporary sync service for authentication
            this.syncService = new GoogleCalendarSync(
                this.oauthConfig,
                this.calendarId
            );
        }
        const tokens = await this.syncService.authenticateWithCode(code);
        this.syncEnabled = true;
        return tokens;
    }

    /**
     * Check if sync is properly configured and authenticated
     */
    isSyncReady(): boolean {
        return (
            this.syncEnabled &&
            !!this.syncService &&
            this.syncService.isAuthenticated()
        );
    }

    /**
     * Get current sync state
     */
    getSyncState(): SyncState | null {
        return this.syncService?.getSyncState() || null;
    }

    /**
     * Load sync state
     */
    loadSyncState(state: SyncState): void {
        if (this.syncService) {
            console.log(
                "Loading sync state into GoogleCalendar for directory:",
                this.directory
            );
            this.syncService.loadSyncState(state);
        } else {
            console.warn(
                "Cannot load sync state: sync service not initialized for directory:",
                this.directory
            );
        }
    }

    /**
     * Get updated credentials (in case token was refreshed)
     */
    getCredentials(): {
        accessToken?: string;
        refreshToken?: string;
        tokenExpiry?: number;
    } {
        return this.syncService?.getCredentials() || {};
    }

    // EditableCalendar implementation

    async getEvents(): Promise<EditableEventResponse[]> {
        // Ensure directory exists before getting events
        const directory = this.directory;
        let folder = this.localCalendar.app.getAbstractFileByPath(directory);

        if (!folder || !(folder instanceof TFolder)) {
            // Directory doesn't exist, create it
            try {
                await this.localCalendar.app.createFolder(directory);
            } catch (error: any) {
                // Ignore "folder already exists" errors (race condition)
                // If the error is something else, we'll let it propagate
                if (
                    error?.message &&
                    !error.message.includes("already exists")
                ) {
                    throw error;
                }
            }

            // Wait for Obsidian to update its cache, then verify
            // Retry multiple times with increasing delays in case of timing issues
            for (let i = 0; i < 10; i++) {
                folder =
                    this.localCalendar.app.getAbstractFileByPath(directory);
                if (folder && folder instanceof TFolder) {
                    break;
                }
                // Wait with exponential backoff: 50ms, 100ms, 150ms, etc.
                await new Promise((resolve) =>
                    setTimeout(resolve, 50 + i * 50)
                );
            }

            // Final check - if folder still doesn't exist, return empty array
            // This prevents the error from propagating and allows sync to continue
            folder = this.localCalendar.app.getAbstractFileByPath(directory);
            if (!folder || !(folder instanceof TFolder)) {
                console.warn(
                    `Directory ${directory} still not available after creation, returning empty events`
                );
                return [];
            }
        }

        return this.localCalendar.getEvents();
    }

    async getEventsInFile(file: TFile): Promise<EditableEventResponse[]> {
        return this.localCalendar.getEventsInFile(file);
    }

    async createEvent(event: OFCEvent): Promise<EventLocation> {
        // Create locally first
        const location = await this.localCalendar.createEvent(event);

        // Don't sync immediately - let the periodic sync handle it
        // This prevents duplicate events because:
        // 1. The event might not have an ID yet when created
        // 2. The periodic sync will pick it up once it has an ID and proper mapping
        // If immediate sync is needed, it should happen after the event has an ID
        // and the file system has been updated

        return location;
    }

    async deleteEvent(location: EventPathLocation): Promise<void> {
        // Get the event before deletion to find its ID for Google Calendar sync
        let eventId: string | undefined;
        if (this.isSyncReady()) {
            try {
                // Try to get the event to find its ID
                // We'll need to read the file to get the event data
                // For now, we'll rely on the sync state mapping
                // The EventStore should handle this mapping
            } catch (error) {
                console.error(
                    "Could not retrieve event ID for Google Calendar deletion:",
                    error
                );
            }
        }

        // Delete locally first
        await this.localCalendar.deleteEvent(location);

        // Note: For proper deletion tracking, events should have IDs
        // The sync state mapping will help track deletions
    }

    async modifyEvent(
        location: EventPathLocation,
        newEvent: OFCEvent,
        updateCacheWithLocation: (loc: EventLocation) => void
    ): Promise<void> {
        // Modify locally first
        await this.localCalendar.modifyEvent(
            location,
            newEvent,
            updateCacheWithLocation
        );

        // Then sync to Google Calendar if enabled
        if (this.isSyncReady()) {
            try {
                await this.syncService!.syncEvent(newEvent);
            } catch (error) {
                console.error(
                    "Failed to sync modified event to Google Calendar:",
                    error
                );
                // Don't throw - local event was modified successfully
            }
        }
    }

    /**
     * Manually trigger a full sync of all events
     */
    async syncAllEvents(): Promise<void> {
        if (!this.isSyncReady()) {
            throw new Error("Sync is not enabled or authenticated");
        }

        const events = await this.getEvents();
        // Pass events with their file paths for stable identification
        const eventsWithPaths = events.map(([event, location]) => ({
            event,
            filePath: location?.file?.path,
        }));
        await this.syncService!.syncEventsWithPaths(eventsWithPaths);
    }

    /**
     * Enable or disable sync
     */
    setSyncEnabled(enabled: boolean): void {
        this.syncEnabled = enabled;
    }
}
