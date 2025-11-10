import { Notice } from "obsidian";
import GoogleCalendar from "../calendars/GoogleCalendar";

/**
 * Manages automatic periodic syncing of Google Calendar
 */
export class SyncScheduler {
    private intervalId: number | null = null;
    private intervalMinutes: number;
    private googleCalendars: GoogleCalendar[] = [];
    private isRunning: boolean = false;

    constructor(intervalMinutes: number = 5) {
        this.intervalMinutes = intervalMinutes;
    }

    /**
     * Register a Google Calendar for auto-sync
     */
    registerCalendar(calendar: GoogleCalendar): void {
        if (!this.googleCalendars.includes(calendar)) {
            this.googleCalendars.push(calendar);
        }
    }

    /**
     * Unregister a Google Calendar from auto-sync
     */
    unregisterCalendar(calendar: GoogleCalendar): void {
        const index = this.googleCalendars.indexOf(calendar);
        if (index > -1) {
            this.googleCalendars.splice(index, 1);
        }
    }

    /**
     * Update sync interval
     */
    setInterval(minutes: number): void {
        this.intervalMinutes = minutes;
        if (this.isRunning) {
            // Restart with new interval
            this.stop();
            this.start();
        }
    }

    /**
     * Start automatic syncing
     */
    start(): void {
        if (this.isRunning) {
            console.log("Sync scheduler is already running");
            return;
        }

        console.log(
            `Starting Google Calendar auto-sync (every ${this.intervalMinutes} minutes)`
        );
        this.isRunning = true;

        // Run initial sync
        this.syncAll();

        // Schedule periodic syncs
        this.intervalId = window.setInterval(
            () => {
                this.syncAll();
            },
            this.intervalMinutes * 60 * 1000 // Convert minutes to milliseconds
        );
    }

    /**
     * Stop automatic syncing
     */
    stop(): void {
        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log("Stopped Google Calendar auto-sync");
    }

    /**
     * Manually trigger sync for all registered calendars
     */
    async syncAll(): Promise<void> {
        const calendarsToSync = this.googleCalendars.filter((cal) =>
            cal.isSyncReady()
        );

        if (calendarsToSync.length === 0) {
            console.log("No Google Calendars ready for sync");
            return;
        }

        console.log(`Syncing ${calendarsToSync.length} Google Calendar(s)...`);

        const results = await Promise.allSettled(
            calendarsToSync.map((calendar) => calendar.syncAllEvents())
        );

        const succeeded = results.filter(
            (r) => r.status === "fulfilled"
        ).length;
        const failed = results.filter((r) => r.status === "rejected").length;

        if (failed > 0) {
            console.error(
                `Google Calendar sync: ${succeeded} succeeded, ${failed} failed`
            );
            results.forEach((result, index) => {
                if (result.status === "rejected") {
                    console.error(
                        `Calendar ${calendarsToSync[index].name} sync failed:`,
                        result.reason
                    );
                }
            });

            // Show error notice if any syncs failed
            new Notice(
                `Google Calendar sync: ${failed} calendar(s) failed to sync`
            );
        } else {
            console.log(
                `Google Calendar sync: Successfully synced ${succeeded} calendar(s)`
            );
        }
    }

    /**
     * Check if scheduler is running
     */
    get running(): boolean {
        return this.isRunning;
    }

    /**
     * Get number of registered calendars
     */
    get calendarCount(): number {
        return this.googleCalendars.length;
    }
}
