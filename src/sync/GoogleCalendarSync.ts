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
        // For desktop apps, use http://localhost (Google handles this automatically)
        const redirectUri = this.config.redirectUri || "http://localhost";
        return this.oauth2Client.generateAuthUrl({
            access_type: "offline",
            scope: scopes,
            prompt: "consent", // Force consent to get refresh token
            redirect_uri: redirectUri, // Explicitly include redirect URI
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
            // Explicitly include redirect_uri in token exchange
            // This is required even though it was in the auth URL
            const redirectUri = this.config.redirectUri || "http://localhost";
            const { tokens } = await this.oauth2Client.getToken({
                code: code,
                redirect_uri: redirectUri,
            });
            this.oauth2Client.setCredentials(tokens);

            if (!tokens.access_token) {
                throw new Error("No access token received from Google");
            }

            if (!tokens.refresh_token) {
                console.warn(
                    "No refresh token received. You may need to revoke access and re-authenticate."
                );
            }

            return {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token || "",
                tokenExpiry: tokens.expiry_date || Date.now() + 3600000, // Default 1 hour if not provided
            };
        } catch (error: any) {
            console.error("Error authenticating with Google:", error);

            // Extract more detailed error message
            let errorMessage = "Failed to authenticate with Google Calendar";
            if (error?.response?.data?.error_description) {
                errorMessage = error.response.data.error_description;
            } else if (error?.response?.data?.error) {
                errorMessage = `${error.response.data.error}: ${
                    error.response.data.error_description || ""
                }`;
            } else if (error?.message) {
                errorMessage = error.message;
            } else if (typeof error === "string") {
                errorMessage = error;
            }

            throw new Error(errorMessage);
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
            // Note: Don't set 'id' - Google Calendar generates its own IDs
            // We track the mapping in syncState.eventMapping instead
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
    async syncEvent(
        event: OFCEvent,
        filePath?: string
    ): Promise<string | null> {
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

            // Use event.id if available, otherwise use file path as stable identifier
            const eventKey = event.id || filePath || null;
            if (!eventKey) {
                console.warn(
                    "Event has no ID or file path, cannot track mapping:",
                    event.title
                );
                // Still sync it, but we can't track it
                const response = await this.calendar.events.insert({
                    calendarId: this.calendarId,
                    requestBody: googleEvent,
                });
                return response.data.id;
            }

            console.log("Syncing event:", {
                title: event.title,
                eventKey: eventKey,
                hasMapping: !!this.syncState.eventMapping[eventKey],
                mappingCount: Object.keys(this.syncState.eventMapping).length,
                allMappings: Object.keys(this.syncState.eventMapping),
            });

            const existingGoogleId = this.syncState.eventMapping[eventKey];

            if (existingGoogleId) {
                console.log(
                    "Found existing mapping, updating event:",
                    existingGoogleId
                );
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
                console.log("No existing mapping, creating new event");
                // Before creating, check if an event with the same title and date already exists in Google Calendar
                // This helps prevent duplicates if the mapping was lost
                try {
                    let timeMin: string | undefined;
                    let timeMax: string | undefined;

                    if (googleEvent.start?.dateTime) {
                        // Already in ISO format
                        timeMin = googleEvent.start.dateTime;
                    } else if (googleEvent.start?.date) {
                        // All-day event - convert to ISO format with time
                        timeMin = `${googleEvent.start.date}T00:00:00Z`;
                    }

                    if (googleEvent.end?.dateTime) {
                        timeMax = googleEvent.end.dateTime;
                    } else if (googleEvent.end?.date) {
                        timeMax = `${googleEvent.end.date}T23:59:59Z`;
                    }

                    if (timeMin) {
                        console.log(
                            "Querying Google Calendar for existing events:",
                            { timeMin, timeMax, title: event.title }
                        );
                        const listResponse = await this.calendar.events.list({
                            calendarId: this.calendarId,
                            timeMin: timeMin,
                            timeMax: timeMax,
                            maxResults: 10,
                            singleEvents: true,
                            orderBy: "startTime",
                        });

                        // Check if an event with the same title already exists
                        const existingEvent = listResponse.data.items?.find(
                            (item: any) => item.summary === event.title
                        );

                        if (existingEvent && existingEvent.id) {
                            console.log(
                                "Found existing event in Google Calendar with same title/date, updating:",
                                existingEvent.id
                            );
                            // Update the existing event and track the mapping
                            const response = await this.calendar.events.update({
                                calendarId: this.calendarId,
                                eventId: existingEvent.id,
                                requestBody: googleEvent,
                            });
                            this.syncState.eventMapping[eventKey] =
                                response.data.id;
                            console.log(
                                "Updated mapping for existing event. Total mappings:",
                                Object.keys(this.syncState.eventMapping).length
                            );
                            return response.data.id;
                        }
                    }
                } catch (error: any) {
                    console.warn(
                        "Error checking for existing events in Google Calendar:",
                        error?.message || error
                    );
                    // Continue with creating a new event
                }

                // Create new event
                const response = await this.calendar.events.insert({
                    calendarId: this.calendarId,
                    requestBody: googleEvent,
                });
                console.log(
                    "Created event in Google Calendar:",
                    response.data.id,
                    "Mapping key:",
                    eventKey
                );

                // Track the mapping using the stable identifier
                this.syncState.eventMapping[eventKey] = response.data.id;
                console.log(
                    "Updated mapping. Total mappings:",
                    Object.keys(this.syncState.eventMapping).length
                );
                return response.data.id;
            }
        } catch (error: any) {
            console.error("Error syncing event to Google Calendar:", error);

            // Extract detailed error message
            let errorMessage = "Failed to sync event to Google Calendar";
            if (error?.response?.data?.error?.message) {
                errorMessage = error.response.data.error.message;
            } else if (error?.message) {
                errorMessage = error.message;
            }

            if (error?.code === 401 || error?.response?.status === 401) {
                throw new Error(
                    "Google Calendar authentication expired. Please re-authenticate."
                );
            }
            if (error?.code === 403 || error?.response?.status === 403) {
                throw new Error(
                    "Permission denied. Please check that the calendar ID is correct and you have write access."
                );
            }
            if (error?.code === 404 || error?.response?.status === 404) {
                throw new Error(
                    "Calendar not found. Please check that the calendar ID is correct."
                );
            }

            throw new Error(errorMessage);
        }
    }

    /**
     * Find an event in Google Calendar by title and date
     * Returns the Google Calendar event ID if found
     */
    async findEventByTitleAndDate(
        title: string,
        dateStr: string
    ): Promise<string | null> {
        if (!this.isAuthenticated()) {
            return null;
        }

        try {
            await this.refreshTokenIfNeeded();

            // Parse the date string (YYYY-MM-DD)
            const date = new Date(dateStr + "T00:00:00Z");
            const startOfDay = new Date(date);
            startOfDay.setUTCHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setUTCHours(23, 59, 59, 999);

            const response = await this.calendar.events.list({
                calendarId: this.calendarId,
                timeMin: startOfDay.toISOString(),
                timeMax: endOfDay.toISOString(),
                q: title, // Search by title
                maxResults: 10,
                singleEvents: true,
                orderBy: "startTime",
            });

            const events = response.data.items || [];
            // Find exact or close match
            const match = events.find(
                (item: any) =>
                    item.summary === title ||
                    item.summary?.includes(title) ||
                    title.includes(item.summary || "")
            );

            return match?.id || null;
        } catch (error: any) {
            console.error("Error finding event in Google Calendar:", error);
            return null;
        }
    }

    /**
     * Delete an event from Google Calendar by its Google Calendar ID
     */
    async deleteEventByGoogleId(googleEventId: string): Promise<void> {
        if (!this.isAuthenticated()) {
            throw new Error("Not authenticated with Google Calendar");
        }

        try {
            await this.refreshTokenIfNeeded();

            await this.calendar.events.delete({
                calendarId: this.calendarId,
                eventId: googleEventId,
            });

            // Remove from mapping if it exists
            const mappingKey = Object.keys(this.syncState.eventMapping).find(
                (key) => this.syncState.eventMapping[key] === googleEventId
            );
            if (mappingKey) {
                delete this.syncState.eventMapping[mappingKey];
            }
        } catch (error: any) {
            console.error("Error deleting event from Google Calendar:", error);
            if (error.code === 404) {
                // Event already deleted, just remove from mapping if it exists
                const mappingKey = Object.keys(
                    this.syncState.eventMapping
                ).find(
                    (key) => this.syncState.eventMapping[key] === googleEventId
                );
                if (mappingKey) {
                    delete this.syncState.eventMapping[mappingKey];
                }
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
     * Delete an event from Google Calendar
     */
    async deleteEvent(obsidianEventId: string): Promise<void> {
        if (!this.isAuthenticated()) {
            throw new Error("Not authenticated with Google Calendar");
        }

        const googleEventId = this.syncState.eventMapping[obsidianEventId];
        if (!googleEventId) {
            // Try to find a matching key (case-insensitive or partial match)
            const matchingKey = Object.keys(this.syncState.eventMapping).find(
                (key) =>
                    key === obsidianEventId ||
                    key.toLowerCase() === obsidianEventId.toLowerCase() ||
                    key.endsWith(obsidianEventId) ||
                    obsidianEventId.endsWith(key)
            );

            if (matchingKey) {
                const matchedGoogleId =
                    this.syncState.eventMapping[matchingKey];
                await this.calendar.events.delete({
                    calendarId: this.calendarId,
                    eventId: matchedGoogleId,
                });
                delete this.syncState.eventMapping[matchingKey];
                return;
            }

            throw new Error(
                `No Google Calendar event found for: ${obsidianEventId}`
            );
        }

        try {
            await this.refreshTokenIfNeeded();

            await this.calendar.events.delete({
                calendarId: this.calendarId,
                eventId: googleEventId,
            });

            delete this.syncState.eventMapping[obsidianEventId];
        } catch (error: any) {
            if (error.code === 404) {
                // Event already deleted, just remove from mapping
                delete this.syncState.eventMapping[obsidianEventId];
            } else if (error.code === 401) {
                throw new Error(
                    "Google Calendar authentication expired. Please re-authenticate."
                );
            } else {
                console.error(
                    "Error deleting event from Google Calendar:",
                    error
                );
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
                const googleId = await this.syncEvent(event, undefined);
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
     * Sync multiple events with file paths for stable identification
     */
    async syncEventsWithPaths(
        eventsWithPaths: Array<{ event: OFCEvent; filePath?: string }>
    ): Promise<void> {
        if (!this.isAuthenticated()) {
            throw new Error("Not authenticated with Google Calendar");
        }

        const results = {
            synced: 0,
            skipped: 0,
            failed: 0,
        };

        for (const { event, filePath } of eventsWithPaths) {
            try {
                const googleId = await this.syncEvent(event, filePath);
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
        const mapping = state.eventMapping || {};
        console.log("Loading sync state:", {
            lastSyncTime: state.lastSyncTime,
            mappingCount: Object.keys(mapping).length,
            mappingKeys: Object.keys(mapping).slice(0, 10), // Show first 10 keys
        });
        // Deep copy to avoid reference issues
        this.syncState = {
            lastSyncTime: state.lastSyncTime || 0,
            eventMapping: { ...mapping }, // Create a new object to avoid reference issues
        };
        console.log(
            "Sync state loaded. Current mapping count:",
            Object.keys(this.syncState.eventMapping).length
        );
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
