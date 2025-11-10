import { Notice } from "obsidian";
import * as React from "react";
import { SetStateAction, useState } from "react";

import { CalendarInfo } from "../../types";
import FullCalendarPlugin from "../../main";

type SourceWith<T extends Partial<CalendarInfo>, K> = T extends K ? T : never;

interface BasicProps<T extends Partial<CalendarInfo>> {
    source: T;
}

function DirectorySetting<T extends Partial<CalendarInfo>>({
    source,
}: BasicProps<T>) {
    let sourceWithDirectory = source as SourceWith<T, { directory: undefined }>;
    return (
        <div className="setting-item-control">
            <input
                disabled
                type="text"
                value={sourceWithDirectory.directory}
                style={{
                    width: "100%",
                    marginLeft: 4,
                    marginRight: 4,
                }}
            />
        </div>
    );
}

function HeadingSetting<T extends Partial<CalendarInfo>>({
    source,
}: BasicProps<T>) {
    let sourceWithHeading = source as SourceWith<T, { heading: undefined }>;
    return (
        <div
            className="setting-item-control"
            style={{ display: "block", textAlign: "center" }}
        >
            <span>Under heading</span>{" "}
            <input
                disabled
                type="text"
                value={sourceWithHeading.heading}
                style={{
                    marginLeft: 4,
                    marginRight: 4,
                }}
            />{" "}
            <span style={{ paddingRight: ".5rem" }}>in daily notes</span>
        </div>
    );
}

function UrlSetting<T extends Partial<CalendarInfo>>({
    source,
}: BasicProps<T>) {
    let sourceWithUrl = source as SourceWith<T, { url: undefined }>;
    return (
        <div className="setting-item-control">
            <input
                disabled
                type="text"
                value={sourceWithUrl.url}
                style={{
                    width: "100%",
                    marginLeft: 4,
                    marginRight: 4,
                }}
            />
        </div>
    );
}

function NameSetting<T extends Partial<CalendarInfo>>({
    source,
}: BasicProps<T>) {
    let sourceWithName = source as SourceWith<T, { name: undefined }>;
    return (
        <div className="setting-item-control">
            <input
                disabled
                type="text"
                value={sourceWithName.name}
                style={{
                    width: "100%",
                    marginLeft: 4,
                    marginRight: 4,
                }}
            />
        </div>
    );
}

function Username<T extends Partial<CalendarInfo>>({ source }: BasicProps<T>) {
    let sourceWithUsername = source as SourceWith<T, { username: undefined }>;
    return (
        <div className="setting-item-control">
            <input
                disabled
                type="text"
                value={sourceWithUsername.username}
                style={{
                    width: "100%",
                    marginLeft: 4,
                    marginRight: 4,
                }}
            />
        </div>
    );
}

function CalendarIdSetting<T extends Partial<CalendarInfo>>({
    source,
}: BasicProps<T>) {
    let sourceWithCalendarId = source as SourceWith<
        T,
        { calendarId: undefined }
    >;
    return (
        <div className="setting-item-control">
            <input
                disabled
                type="text"
                value={sourceWithCalendarId.calendarId || ""}
                style={{
                    width: "100%",
                    marginLeft: 4,
                    marginRight: 4,
                }}
            />
        </div>
    );
}

function SyncStatusSetting<T extends Partial<CalendarInfo>>({
    source,
}: BasicProps<T>) {
    let sourceWithSync = source as SourceWith<T, { syncEnabled: undefined }>;
    const isAuthenticated =
        sourceWithSync.type === "google" &&
        !!(sourceWithSync.accessToken || sourceWithSync.refreshToken);
    const syncEnabled = sourceWithSync.syncEnabled || false;

    return (
        <div className="setting-item-control">
            <span
                style={{
                    marginLeft: 4,
                    marginRight: 4,
                    fontSize: "0.9em",
                    color: isAuthenticated
                        ? "var(--text-success)"
                        : "var(--text-muted)",
                }}
            >
                {isAuthenticated
                    ? syncEnabled
                        ? "✓ Authenticated & Syncing"
                        : "✓ Authenticated (Sync Disabled)"
                    : "⚠ Not Authenticated"}
            </span>
        </div>
    );
}

interface CalendarSettingsProps {
    setting: Partial<CalendarInfo>;
    onColorChange: (s: string) => void;
    deleteCalendar: () => void;
    plugin?: FullCalendarPlugin;
    onAuthenticate?: () => void;
}

export const CalendarSettingRow = ({
    setting,
    onColorChange,
    deleteCalendar,
    plugin,
    onAuthenticate,
}: CalendarSettingsProps) => {
    const isCalDAV = setting.type === "caldav";
    const isGoogle = setting.type === "google";
    const isAuthenticated =
        isGoogle && !!(setting.accessToken || setting.refreshToken);

    return (
        <div className="setting-item">
            <button
                type="button"
                onClick={deleteCalendar}
                style={{ maxWidth: "15%" }}
            >
                ✕
            </button>
            {setting.type === "local" ? (
                <DirectorySetting source={setting} />
            ) : setting.type === "dailynote" ? (
                <HeadingSetting source={setting} />
            ) : setting.type === "google" ? (
                <DirectorySetting source={setting} />
            ) : (
                <UrlSetting source={setting} />
            )}
            {isGoogle && <CalendarIdSetting source={setting} />}
            {isGoogle && <SyncStatusSetting source={setting} />}
            {isCalDAV && <NameSetting source={setting} />}
            {isCalDAV && <Username source={setting} />}
            {isGoogle && !isAuthenticated && onAuthenticate && (
                <div className="setting-item-control">
                    <button
                        type="button"
                        onClick={onAuthenticate}
                        style={{
                            marginLeft: 4,
                            marginRight: 4,
                            padding: "4px 8px",
                        }}
                    >
                        Authenticate with Google
                    </button>
                </div>
            )}
            <input
                style={{ maxWidth: "25%", minWidth: "3rem" }}
                type="color"
                value={setting.color}
                onChange={(e) => onColorChange(e.target.value)}
            />
        </div>
    );
};

interface CalendarSettingProps {
    sources: CalendarInfo[];
    submit: (payload: CalendarInfo[]) => void;
    plugin?: FullCalendarPlugin;
}
type CalendarSettingState = {
    sources: CalendarInfo[];
    dirty: boolean;
};
export class CalendarSettings extends React.Component<
    CalendarSettingProps,
    CalendarSettingState
> {
    constructor(props: CalendarSettingProps) {
        super(props);
        this.state = { sources: props.sources, dirty: false };
    }

    addSource(source: CalendarInfo) {
        this.setState((state, props) => ({
            sources: [...state.sources, source],
            dirty: true,
        }));
    }

    render() {
        return (
            <div style={{ width: "100%" }}>
                {this.state.sources.map((s, idx) => (
                    <CalendarSettingRow
                        key={idx}
                        setting={s}
                        plugin={this.props.plugin}
                        onColorChange={(color) =>
                            this.setState((state, props) => ({
                                sources: [
                                    ...state.sources.slice(0, idx),
                                    { ...state.sources[idx], color },
                                    ...state.sources.slice(idx + 1),
                                ],
                                dirty: true,
                            }))
                        }
                        deleteCalendar={() =>
                            this.setState((state, props) => ({
                                sources: [
                                    ...state.sources.slice(0, idx),
                                    ...state.sources.slice(idx + 1),
                                ],
                                dirty: true,
                            }))
                        }
                        onAuthenticate={async () => {
                            if (s.type !== "google" || !this.props.plugin) {
                                return;
                            }

                            const oauthConfig =
                                this.props.plugin.settings.googleOAuth;
                            if (
                                !oauthConfig ||
                                !oauthConfig.clientId ||
                                !oauthConfig.clientSecret
                            ) {
                                new Notice(
                                    "Please configure Google OAuth credentials in settings first."
                                );
                                return;
                            }

                            try {
                                // Import GoogleCalendar dynamically
                                const GoogleCalendar = (
                                    await import(
                                        "../../calendars/GoogleCalendar"
                                    )
                                ).default;
                                const ObsidianIO = (
                                    await import("../../ObsidianAdapter")
                                ).ObsidianIO;

                                // Create a temporary calendar instance for authentication
                                const tempCalendar = new GoogleCalendar(
                                    new ObsidianIO(this.props.plugin.app),
                                    s.color,
                                    s.directory,
                                    s.calendarId || "primary",
                                    s.syncEnabled || false,
                                    oauthConfig,
                                    s.accessToken,
                                    s.refreshToken,
                                    s.tokenExpiry
                                );

                                const authUrl = tempCalendar.getAuthUrl();
                                // Open in browser
                                window.open(authUrl, "_blank");
                                new Notice(
                                    "Please complete authentication in the browser, then paste the authorization code here."
                                );

                                // Prompt for authorization code
                                const code = prompt(
                                    "After authorizing, copy the 'code' parameter from the redirect URL and paste it here:"
                                );
                                if (code) {
                                    const tokens =
                                        await tempCalendar.authenticateWithCode(
                                            code
                                        );

                                    // Update the calendar source with tokens
                                    const updatedSources = [
                                        ...this.state.sources.slice(0, idx),
                                        {
                                            ...this.state.sources[idx],
                                            accessToken: tokens.accessToken,
                                            refreshToken: tokens.refreshToken,
                                            tokenExpiry: tokens.tokenExpiry,
                                        },
                                        ...this.state.sources.slice(idx + 1),
                                    ];
                                    this.setState({
                                        sources: updatedSources,
                                        dirty: true,
                                    });
                                    this.props.submit(updatedSources);
                                    new Notice(
                                        "Successfully authenticated with Google Calendar!"
                                    );
                                }
                            } catch (error) {
                                console.error("Authentication error:", error);
                                new Notice(
                                    `Authentication failed: ${
                                        error instanceof Error
                                            ? error.message
                                            : "Unknown error"
                                    }`
                                );
                            }
                        }}
                    />
                ))}
                <div className="setting-item-control">
                    {this.state.dirty && (
                        <button
                            onClick={() => {
                                if (
                                    this.state.sources.filter(
                                        (s) => s.type === "dailynote"
                                    ).length > 1
                                ) {
                                    new Notice(
                                        "Only one daily note calendar is allowed."
                                    );
                                    return;
                                }
                                this.props.submit(
                                    this.state.sources.map(
                                        (elt) => elt as CalendarInfo
                                    )
                                );
                                this.setState({ dirty: false });
                            }}
                            style={{
                                backgroundColor: this.state.dirty
                                    ? "var(--interactive-accent)"
                                    : undefined,
                                color: this.state.dirty
                                    ? "var(--text-on-accent)"
                                    : undefined,
                            }}
                        >
                            {this.state.dirty ? "Save" : "Settings Saved"}
                        </button>
                    )}
                </div>
            </div>
        );
    }
}
