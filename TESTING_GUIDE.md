# Testing Guide: Modified Full Calendar Plugin

This guide will help you replace the original Full Calendar plugin with this modified version that includes Google Calendar sync.

## Prerequisites

- Node.js and npm installed
- Obsidian installed with the original "Full Calendar" plugin
- Your Obsidian vault path (we'll find it in the steps below)

## Step 1: Build the Modified Plugin

1. Open a terminal in the project directory:
   ```bash
   cd /home/qotto/Work/obsidian-full-calendar-gcal-sync
   ```

2. Install dependencies (if not already done):
   ```bash
   npm install --legacy-peer-deps
   ```
   
   **Note:** The `--legacy-peer-deps` flag is needed due to a peer dependency conflict between `fast-check` versions. This is safe and won't affect the build.

3. Build the plugin:
   ```bash
   npm run build
   ```

   This will:
   - Check TypeScript types
   - Bundle everything into `main.js`
   - The output files will be: `main.js`, `main.css`, and `manifest.json`

## Step 2: Find Your Obsidian Plugin Directory

The plugin files are located in:
```
[YOUR_VAULT_PATH]/.obsidian/plugins/obsidian-full-calendar/
```

To find your vault path:
1. Open Obsidian
2. Go to Settings → About
3. Look for "Vault location" or check the path shown in the status bar

Common locations:
- **Windows**: `C:\Users\[USERNAME]\Documents\Obsidian Vaults\[VAULT_NAME]`
- **macOS**: `~/Documents/Obsidian Vaults/[VAULT_NAME]` or `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/[VAULT_NAME]`
- **Linux**: `~/Documents/Obsidian Vaults/[VAULT_NAME]` or wherever you created your vault

## Step 3: Backup the Original Plugin (Optional but Recommended)

Before replacing, you might want to backup the original plugin:

```bash
# Replace [YOUR_VAULT_PATH] with your actual vault path
cp -r "[YOUR_VAULT_PATH]/.obsidian/plugins/obsidian-full-calendar" \
     "[YOUR_VAULT_PATH]/.obsidian/plugins/obsidian-full-calendar.backup"
```

Or on Windows (PowerShell):
```powershell
Copy-Item "[YOUR_VAULT_PATH]\.obsidian\plugins\obsidian-full-calendar" `
          "[YOUR_VAULT_PATH]\.obsidian\plugins\obsidian-full-calendar.backup" -Recurse
```

## Step 4: Replace Plugin Files

Copy the newly built files to your Obsidian plugin directory:

```bash
# Replace [YOUR_VAULT_PATH] with your actual vault path
cp main.js main.css manifest.json \
   "[YOUR_VAULT_PATH]/.obsidian/plugins/obsidian-full-calendar/"
```

Or on Windows (PowerShell):
```powershell
Copy-Item main.js, main.css, manifest.json `
          "[YOUR_VAULT_PATH]\.obsidian\plugins\obsidian-full-calendar\" -Force
```

Or manually:
1. Navigate to: `[YOUR_VAULT_PATH]/.obsidian/plugins/obsidian-full-calendar/`
2. Replace these 3 files:
   - `main.js` (the plugin code)
   - `main.css` (styles - should be the same)
   - `manifest.json` (plugin metadata - should be the same)

## Step 5: Reload Obsidian

1. In Obsidian, press `Ctrl+R` (or `Cmd+R` on Mac) to reload
2. Or go to Settings → Community plugins → Toggle "Full Calendar" off and on
3. Or restart Obsidian completely

## Step 6: Verify the Plugin Loaded

1. Open the Developer Console: `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac)
2. Look for any error messages
3. You should see the plugin loading without errors

## Step 7: Test the New Features

### 7.1 Check for Google Calendar OAuth Settings

1. Go to Settings → Full Calendar
2. Scroll down - you should now see a new section: **"Google Calendar OAuth"**
3. This section should have:
   - Client ID field
   - Client Secret field (password field)
   - Redirect URI field

### 7.2 Check for Google Calendar in Calendar Types

1. In Full Calendar settings, look for "Manage Calendars"
2. Click "Add Calendar" (the + button)
3. In the dropdown, you should see **"Google Calendar"** as an option

### 7.3 Test Adding a Google Calendar (Without Authentication First)

1. Select "Google Calendar" from the dropdown
2. Click the + button to add
3. You should see a form with:
   - Color picker
   - Directory selector
   - Calendar ID field
   - Enable Sync toggle
   - Sync Interval field (when sync is enabled)
4. Fill in the fields:
   - Directory: Choose or create a folder (e.g., "CalendarData")
   - Calendar ID: "primary" (for your main calendar)
   - Enable Sync: Toggle ON
   - Sync Interval: 5 (minutes)
5. Click "Add Calendar"
6. Save the settings

### 7.4 Configure Google OAuth Credentials

Before authenticating, you need Google OAuth credentials:

1. Follow the instructions in `GOOGLE_CALENDAR_SYNC_SETUP.md` to:
   - Create a Google Cloud project
   - Enable Google Calendar API
   - Create OAuth credentials
   - Get your Client ID and Client Secret

2. In Obsidian Full Calendar settings:
   - Scroll to "Google Calendar OAuth"
   - Enter your **Client ID**
   - Enter your **Client Secret**
   - Redirect URI should be: `obsidian://google-calendar-callback`

### 7.5 Test Authentication

1. In the calendar list, find your Google Calendar entry
2. You should see:
   - Directory name
   - Calendar ID
   - Status: "⚠ Not Authenticated"
   - An "Authenticate with Google" button
3. Click "Authenticate with Google"
4. A browser window should open with Google's OAuth consent screen
5. Sign in and grant permissions
6. After authorization, you'll be redirected to a URL with a `code` parameter
7. Copy the `code` value from the URL
8. Paste it into the prompt in Obsidian
9. You should see: "Successfully authenticated with Google Calendar!"
10. The status should change to: "✓ Authenticated & Syncing"

### 7.6 Test Event Sync

1. Create a test event in Obsidian:
   - In your calendar directory (e.g., "CalendarData"), create a new markdown file
   - Add frontmatter:
     ```markdown
     ---
     title: Test Event
     date: 2025-11-10
     allDay: false
     startTime: 14:00
     endTime: 15:00
     ---
     
     This is a test event!
     ```
2. Wait for the sync interval (default 5 minutes)
3. Check Google Calendar - your event should appear!

## Troubleshooting

### Plugin Won't Load

1. Check the Developer Console (`Ctrl+Shift+I`) for errors
2. Verify all 3 files were copied correctly
3. Check file permissions
4. Try disabling and re-enabling the plugin

### Can't See Google Calendar OAuth Section

- Make sure you copied the new `main.js` file
- Try a hard reload: disable plugin, restart Obsidian, enable plugin
- Check console for errors

### Authentication Fails

- Verify Client ID and Client Secret are correct
- Check that Google Calendar API is enabled in Google Cloud Console
- Ensure redirect URI matches exactly: `obsidian://google-calendar-callback`
- Check console for detailed error messages

### Events Not Syncing

- Verify "Enable Sync" is toggled ON
- Check that authentication was successful (status shows "✓ Authenticated & Syncing")
- Look in console for sync messages or errors
- Verify event format is correct (valid frontmatter)

## Reverting to Original Plugin

If you need to go back to the original plugin:

1. **If you made a backup:**
   ```bash
   # Remove modified version
   rm -r "[YOUR_VAULT_PATH]/.obsidian/plugins/obsidian-full-calendar"
   # Restore backup
   mv "[YOUR_VAULT_PATH]/.obsidian/plugins/obsidian-full-calendar.backup" \
      "[YOUR_VAULT_PATH]/.obsidian/plugins/obsidian-full-calendar"
   ```

2. **Or reinstall from Community Plugins:**
   - Settings → Community plugins
   - Find "Full Calendar"
   - Click the gear icon → Uninstall
   - Then reinstall from Community plugins

## Quick Reference

**Build command:**
```bash
npm run build
```

**Plugin directory:**
```
[YOUR_VAULT_PATH]/.obsidian/plugins/obsidian-full-calendar/
```

**Files to copy:**
- `main.js`
- `main.css`
- `manifest.json`

**Reload Obsidian:**
- `Ctrl+R` (or `Cmd+R` on Mac)

**Developer Console:**
- `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac)

---

**Note:** This modified plugin is a fork with additional features. It should be compatible with your existing calendar data, but always backup your vault before testing!

