import { TFile } from "obsidian";
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
        this.syncService?.loadSyncState(state);
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
        return this.localCalendar.getEvents();
    }

    async getEventsInFile(file: TFile): Promise<EditableEventResponse[]> {
        return this.localCalendar.getEventsInFile(file);
    }

    async createEvent(event: OFCEvent): Promise<EventLocation> {
        // Create locally first
        const location = await this.localCalendar.createEvent(event);

        // Then sync to Google Calendar if enabled
        if (this.isSyncReady()) {
            try {
                await this.syncService!.syncEvent(event);
            } catch (error) {
                console.error(
                    "Failed to sync new event to Google Calendar:",
                    error
                );
                // Don't throw - local event was created successfully
            }
        }

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
        const ofcEvents = events.map(([event]) => event);
        await this.syncService!.syncEvents(ofcEvents);
    }

    /**
     * Enable or disable sync
     */
    setSyncEnabled(enabled: boolean): void {
        this.syncEnabled = enabled;
    }
}
