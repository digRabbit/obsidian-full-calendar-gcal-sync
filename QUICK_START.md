# Quick Start Guide

## Installation (5 minutes)

### 1. Install the Modified Plugin

```bash
# From the project directory, copy files to your vault
cd /home/qotto/Work/obsidian-full-calendar-gcal-sync

# Copy the built plugin
cp main.js main.css manifest.json \
   "/home/qotto/Documents/Obsidian Vault/.obsidian/plugins/obsidian-full-calendar/"

# Reload Obsidian
```

Or install manually:
1. Copy `main.js`, `main.css`, and `manifest.json`
2. Paste into: `/home/qotto/Documents/Obsidian Vault/.obsidian/plugins/obsidian-full-calendar/`
3. Reload Obsidian (Ctrl+R or restart)

### 2. Get Google OAuth Credentials (10 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "Obsidian Calendar"
3. Enable "Google Calendar API"
4. Create OAuth consent screen:
   - Type: External
   - Add scope: `https://www.googleapis.com/auth/calendar`
   - Add your email as test user
5. Create credentials:
   - Type: OAuth Client ID
   - Application type: Desktop app
   - Save the **Client ID** and **Client Secret**

Detailed instructions: See `GOOGLE_CALENDAR_SYNC_SETUP.md`

### 3. Configure in Obsidian (2 minutes)

1. Open Obsidian Settings
2. Go to "Full Calendar"
3. Scroll to "Google Calendar OAuth"
4. Enter:
   - **Client ID**: [from step 2]
   - **Client Secret**: [from step 2]
5. Add Calendar Source:
   - Click "Add Calendar"
   - Select type: "Google Calendar"
   - Set **Directory**: "CalendarData" (your events folder)
   - Set **Calendar ID**: "primary"
   - Enable **Sync**: ON
   - Set **Sync Interval**: 5 minutes
6. Click "Authenticate with Google"
7. Sign in and grant permissions
8. Done! ✅

## Usage

### Create an Event

Just create a markdown file in your calendar directory:

```markdown
---
title: Team Meeting
date: 2025-11-10
allDay: false
startTime: 14:00
endTime: 15:00
---

Discussion topics:
- Project updates
- Q4 planning
```

**It will automatically sync to Google Calendar within 5 minutes!**

### Edit an Event

Just edit the markdown file - changes sync automatically.

### Delete an Event

Delete the markdown file - it will be removed from Google Calendar.

## Check if it's Working

1. Create a test event in Obsidian
2. Wait 5 minutes (or your sync interval)
3. Open Google Calendar in your browser
4. Your event should appear! 🎉

## Common Issues

| Issue | Solution |
|-------|----------|
| Plugin won't load | Check console (Ctrl+Shift+I) for errors |
| Can't authenticate | Verify Client ID/Secret are correct |
| Events not syncing | Check "Enable Sync" is ON |
| Sync errors | Look in console for error messages |

## Console Logs

Press `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac) to open developer console.

Look for messages like:
- "Starting Google Calendar auto-sync"
- "Google Calendar sync: Successfully synced N calendar(s)"
- Any error messages

## File Locations

```
Your Obsidian Vault/
├── .obsidian/
│   └── plugins/
│       └── obsidian-full-calendar/
│           ├── main.js          (modified plugin)
│           ├── main.css         (styles)
│           └── manifest.json    (plugin info)
└── CalendarData/               (your events)
    └── 2025-11-10 Meeting.md  (event files)
```

## Getting Help

- **Detailed Setup**: `GOOGLE_CALENDAR_SYNC_SETUP.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`
- **GitHub**: https://github.com/digRabbit/obsidian-full-calendar-gcal-sync
- **Original Plugin**: https://github.com/obsidian-community/obsidian-full-calendar

## What Next?

- Test with a few events
- Adjust sync interval if needed
- Set up multiple calendars (if desired)
- Enjoy seamless Obsidian + Google Calendar sync! 🚀

---

**Remember**: This is **one-way sync** (Obsidian → Google). Changes in Google Calendar won't sync back to Obsidian (yet).
