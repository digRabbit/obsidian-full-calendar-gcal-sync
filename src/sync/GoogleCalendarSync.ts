import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { Notice } from "obsidian";
import { OFCEvent } from "src/types";
import { DateTime } from "luxon";

/**
 * Google Calendar OAuth configuration
 * Users will need to create their own OAuth credentials at:
 * https://console.cloud.google.com/apis/credentials
 */
export interface GoogleOAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

/**
 * Sync state for tracking what's been synced
 */
export interface SyncState {
    lastSyncTime: number;
    eventMapping: {
        [obsidianEventId: string]: string; // Maps Obsidian event ID to Google Calendar event ID
    };
}

/**
 * Service for syncing Obsidian Full Calendar events to Google Calendar
 */
export class GoogleCalendarSync {
    private oauth2Client: OAuth2Client;
    private calendar: any;
    private syncState: SyncState;

    constructor(
        private config: GoogleOAuthConfig,
        private calendarId: string,
        private accessToken?: string,
        private refreshToken?: string,
        private tokenExpiry?: number
    ) {
        this.oauth2Client = new google.auth.OAuth2(
            config.clientId,
            config.clientSecret,
            config.redirectUri
        );

        // Set credentials if we have them
        if (accessToken && refreshToken) {
            this.oauth2Client.setCredentials({
                access_token: accessToken,
                refresh_token: refreshToken,
                expiry_date: tokenExpiry,
            });
        }

        this.calendar = google.calendar({
            version: "v3",
            auth: this.oauth2Client,
        });
        this.syncState = { lastSyncTime: 0, eventMapping: {} };
    }

    /**
     * Generate OAuth URL for user authentication
     */
    getAuthUrl(): string {
        const scopes = ["https://www.googleapis.com/auth/calendar"];
        return this.oauth2Client.generateAuthUrl({
            access_type: "offline",
            scope: scopes,
            prompt: "consent", // Force consent to get refresh token
        });
    }

    /**
     * Exchange authorization code for tokens
     */
    async authenticateWithCode(code: string): Promise<{
        accessToken: string;
        refreshToken: string;
        tokenExpiry: number;
    }> {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);

            return {
                accessToken: tokens.access_token!,
                refreshToken: tokens.refresh_token!,
                tokenExpiry: tokens.expiry_date!,
            };
        } catch (error) {
            console.error("Error authenticating with Google:", error);
            throw new Error("Failed to authenticate with Google Calendar");
        }
    }

    /**
     * Check if we're authenticated
     */
    isAuthenticated(): boolean {
        return !!this.oauth2Client.credentials.access_token;
    }

    /**
     * Refresh access token if needed
     */
    private async refreshTokenIfNeeded(): Promise<void> {
        try {
            const credentials = this.oauth2Client.credentials;
            if (
                credentials.expiry_date &&
                Date.now() >= credentials.expiry_date - 60000
            ) {
                // Refresh if expires in less than 1 minute
                const { credentials: newCredentials } =
                    await this.oauth2Client.refreshAccessToken();
                this.oauth2Client.setCredentials(newCredentials);
            }
        } catch (error) {
            console.error("Error refreshing token:", error);
            throw new Error("Failed to refresh Google Calendar access token");
        }
    }

    /**
     * Convert Obsidian event to Google Calendar event format
     */
    private convertToGoogleEvent(event: OFCEvent): any {
        const googleEvent: any = {
            summary: event.title,
            id: event.id?.replace(/[^a-z0-9]/gi, "").toLowerCase(), // Google Calendar IDs must be alphanumeric
        };

        if (event.type === "single") {
            const date = DateTime.fromISO(event.date);

            if (event.allDay) {
                googleEvent.start = { date: date.toFormat("yyyy-MM-dd") };
                if (event.endDate) {
                    const endDate = DateTime.fromISO(event.endDate);
                    googleEvent.end = { date: endDate.toFormat("yyyy-MM-dd") };
                } else {
                    googleEvent.end = {
                        date: date.plus({ days: 1 }).toFormat("yyyy-MM-dd"),
                    };
                }
            } else {
                // Timed event
                const startTime = event.startTime;
                const endTime = event.endTime;

                if (startTime) {
                    const [hours, minutes] = startTime.split(":");
                    const startDateTime = date
                        .set({
                            hour: parseInt(hours),
                            minute: parseInt(minutes),
                        })
                        .toISO();
                    googleEvent.start = { dateTime: startDateTime };
                }

                if (endTime && startTime) {
                    const [hours, minutes] = endTime.split(":");
                    const endDateTime = date
                        .set({
                            hour: parseInt(hours),
                            minute: parseInt(minutes),
                        })
                        .toISO();
                    googleEvent.end = { dateTime: endDateTime };
                } else if (startTime) {
                    // Default to 1 hour duration
                    const [hours, minutes] = startTime.split(":");
                    const endDateTime = date
                        .set({
                            hour: parseInt(hours) + 1,
                            minute: parseInt(minutes),
                        })
                        .toISO();
                    googleEvent.end = { dateTime: endDateTime };
                }
            }
        }

        // Note: Recurring events would need additional handling with RRULE format
        // For now, we'll only sync single events

        return googleEvent;
    }

    /**
     * Sync a single event to Google Calendar
     */
    async syncEvent(event: OFCEvent): Promise<string | null> {
        if (!this.isAuthenticated()) {
            throw new Error("Not authenticated with Google Calendar");
        }

        if (event.type !== "single") {
            console.log("Skipping non-single event:", event.title);
            return null; // Only sync single events for now
        }

        try {
            await this.refreshTokenIfNeeded();

            const googleEvent = this.convertToGoogleEvent(event);
            const existingGoogleId = event.id
                ? this.syncState.eventMapping[event.id]
                : null;

            if (existingGoogleId) {
                // Update existing event
                const response = await this.calendar.events.update({
                    calendarId: this.calendarId,
                    eventId: existingGoogleId,
                    requestBody: googleEvent,
                });
                console.log(
                    "Updated event in Google Calendar:",
                    response.data.id
                );
                return response.data.id;
            } else {
                // Create new event
                const response = await this.calendar.events.insert({
                    calendarId: this.calendarId,
                    requestBody: googleEvent,
                });
                console.log(
                    "Created event in Google Calendar:",
                    response.data.id
                );

                // Track the mapping
                if (event.id) {
                    this.syncState.eventMapping[event.id] = response.data.id;
                }
                return response.data.id;
            }
        } catch (error: any) {
            console.error("Error syncing event to Google Calendar:", error);
            if (error.code === 401) {
                throw new Error(
                    "Google Calendar authentication expired. Please re-authenticate."
                );
            }
            throw error;
        }
    }

    /**
     * Delete an event from Google Calendar
     */
    async deleteEvent(obsidianEventId: string): Promise<void> {
        if (!this.isAuthenticated()) {
            throw new Error("Not authenticated with Google Calendar");
        }

        const googleEventId = this.syncState.eventMapping[obsidianEventId];
        if (!googleEventId) {
            console.log("No Google Calendar event found for:", obsidianEventId);
            return;
        }

        try {
            await this.refreshTokenIfNeeded();

            await this.calendar.events.delete({
                calendarId: this.calendarId,
                eventId: googleEventId,
            });

            console.log("Deleted event from Google Calendar:", googleEventId);
            delete this.syncState.eventMapping[obsidianEventId];
        } catch (error: any) {
            console.error("Error deleting event from Google Calendar:", error);
            if (error.code === 404) {
                // Event already deleted, just remove from mapping
                delete this.syncState.eventMapping[obsidianEventId];
            } else if (error.code === 401) {
                throw new Error(
                    "Google Calendar authentication expired. Please re-authenticate."
                );
            } else {
                throw error;
            }
        }
    }

    /**
     * Sync multiple events to Google Calendar
     */
    async syncEvents(events: OFCEvent[]): Promise<void> {
        if (!this.isAuthenticated()) {
            throw new Error("Not authenticated with Google Calendar");
        }

        const results = {
            synced: 0,
            skipped: 0,
            failed: 0,
        };

        for (const event of events) {
            try {
                const googleId = await this.syncEvent(event);
                if (googleId) {
                    results.synced++;
                } else {
                    results.skipped++;
                }
            } catch (error) {
                console.error("Failed to sync event:", event.title, error);
                results.failed++;
            }
        }

        this.syncState.lastSyncTime = Date.now();

        console.log("Sync complete:", results);
        new Notice(
            `Google Calendar sync: ${results.synced} synced, ${results.skipped} skipped, ${results.failed} failed`
        );
    }

    /**
     * Get current sync state
     */
    getSyncState(): SyncState {
        return this.syncState;
    }

    /**
     * Load sync state from storage
     */
    loadSyncState(state: SyncState): void {
        this.syncState = state;
    }

    /**
     * Get current credentials
     */
    getCredentials(): {
        accessToken?: string;
        refreshToken?: string;
        tokenExpiry?: number;
    } {
        const creds = this.oauth2Client.credentials;
        return {
            accessToken: creds.access_token || undefined,
            refreshToken: creds.refresh_token || undefined,
            tokenExpiry: creds.expiry_date || undefined,
        };
    }
}
