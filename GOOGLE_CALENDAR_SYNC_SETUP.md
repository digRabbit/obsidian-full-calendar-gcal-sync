# Google Calendar Sync Setup Guide

This guide will help you set up Google Calendar synchronization with Obsidian Full Calendar.

## Overview

The Google Calendar sync feature allows you to:
- **Automatically sync events** from Obsidian to your Google Calendar
- **One-way sync**: Changes made in Obsidian are pushed to Google Calendar (Obsidian → Google)
- **Automatic periodic sync**: Events are synced every N minutes in the background
- **Local-first storage**: Events remain stored as markdown files in your Obsidian vault

## Prerequisites

1. A Google account
2. Access to the Google Cloud Console
3. Obsidian with the Full Calendar plugin installed

## Step 1: Create Google OAuth Credentials

### 1.1 Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" at the top
3. Click "New Project"
4. Enter a project name (e.g., "Obsidian Full Calendar")
5. Click "Create"

### 1.2 Enable Google Calendar API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Calendar API"
3. Click on it and then click "Enable"

### 1.3 Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" user type (unless you have a Google Workspace account)
3. Click "Create"
4. Fill in the required fields:
   - **App name**: "Obsidian Full Calendar"
   - **User support email**: Your email
   - **Developer contact information**: Your email
5. Click "Save and Continue"
6. On the "Scopes" page, click "Add or Remove Scopes"
7. Add the scope: `https://www.googleapis.com/auth/calendar`
8. Click "Update" then "Save and Continue"
9. On "Test users", add your Google email address
10. Click "Save and Continue"

### 1.4 Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Select "Desktop app" as the application type
4. Name it "Obsidian Full Calendar"
5. Click "Create"
6. **Important**: Save the "Client ID" and "Client Secret" - you'll need these!

## Step 2: Configure Obsidian Full Calendar

### 2.1 Add Google OAuth Settings

1. Open Obsidian Settings
2. Go to "Full Calendar" plugin settings
3. Find the "Google Calendar OAuth" section
4. Enter your **Client ID** and **Client Secret** from Step 1.4
5. The **Redirect URI** should be pre-filled as: `obsidian://google-calendar-callback`

### 2.2 Add Google Calendar as a Calendar Source

1. In Full Calendar settings, click "Add Calendar"
2. Select "Google Calendar" from the dropdown
3. Configure the calendar:
   - **Directory**: The folder where events will be stored (e.g., "CalendarData")
   - **Calendar ID**: Use "primary" for your main calendar, or the specific calendar ID
   - **Color**: Choose a color for events from this calendar
   - **Enable Sync**: Toggle this on
   - **Sync Interval**: How often to sync (in minutes, default is 5)

### 2.3 Authenticate with Google

1. After adding the Google Calendar, click "Authenticate with Google"
2. A browser window will open asking you to sign in to Google
3. Sign in with your Google account
4. Grant the requested permissions (Calendar access)
5. You'll see a success message in Obsidian

## Step 3: Using Google Calendar Sync

### Automatic Sync

Once configured, your events will automatically sync from Obsidian to Google Calendar:

- **New events** created in Obsidian will be created in Google Calendar
- **Modified events** in Obsidian will be updated in Google Calendar
- **Deleted events** in Obsidian will be deleted from Google Calendar
- Sync happens automatically every N minutes (based on your sync interval setting)

### Manual Sync

You can also trigger a manual sync:
1. Open Full Calendar view
2. Run the command "Full Calendar: Sync Google Calendar" (if available)

### Viewing Sync Status

Check the console (Ctrl+Shift+I / Cmd+Option+I) for sync logs:
- Successful syncs will show: "Google Calendar sync: Successfully synced N calendar(s)"
- Failed syncs will show error messages

## Troubleshooting

### "Not authenticated with Google Calendar"

- Re-authenticate by going to Full Calendar settings
- Click "Authenticate with Google" again
- Make sure you grant all requested permissions

### "Authentication expired"

- The access token has expired
- The plugin should automatically refresh it
- If issues persist, re-authenticate

### Events not syncing

1. Check that "Enable Sync" is toggled on
2. Verify your OAuth credentials are correct
3. Check the console for error messages
4. Ensure your calendar directory exists and contains valid event files

### "Calendar API not enabled"

- Go to Google Cloud Console
- Enable the Google Calendar API (see Step 1.2)

## Limitations

- **One-way sync only**: Changes in Google Calendar are NOT synced back to Obsidian
- **Single events only**: Currently only syncs single events, not recurring events
- **No conflict resolution**: The latest change in Obsidian overwrites Google Calendar

## Security Notes

- Your OAuth credentials are stored in Obsidian's plugin data
- The Client Secret is sensitive - don't share it
- You can revoke access anytime from your [Google Account](https://myaccount.google.com/permissions)

## Privacy

This plugin:
- Only accesses your Google Calendar data
- Does not send data to any third-party servers
- Communicates directly with Google's servers
- Stores credentials locally in Obsidian

## Support

For issues or questions:
- Check the [GitHub repository](https://github.com/digRabbit/obsidian-full-calendar-gcal-sync)
- Report bugs in the Issues section

---

**Note**: This is a fork of the original obsidian-full-calendar plugin with Google Calendar sync functionality added.
