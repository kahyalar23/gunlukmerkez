const fs = require('fs');

let c = fs.readFileSync('server/i18n.js', 'utf8');

// Replace all for EN
c = c.replace(/siteName:\s*'DASHBOARD\.EXE'/g, "siteName: 'Daily Hub'");
c = c.replace(/title:\s*'NETWORK_FEED::LATEST_UPDATES'/g, "title: 'News'");
c = c.replace(/title:\s*'TASK_QUEUE\.BAT'/g, "title: 'To-Do'");
c = c.replace(/title:\s*'SCRATCHPAD\.TXT'/g, "title: 'Notes'");
c = c.replace(/title:\s*'REMINDER\.LOG'/g, "title: 'Reminders'");
c = c.replace(/title:\s*'BOOKMARKS\.INI'/g, "title: 'Bookmarks'");
c = c.replace(/title:\s*'CALC\.EXE'/g, "title: 'Calculator'");
c = c.replace(/title:\s*'WEATHER\.SYS'/g, "title: 'Weather'");
c = c.replace(/programs:\s*'PROGRAMS\.DIR'/g, "programs: 'Programs'");
c = c.replace(/paint:\s*'PAINT\.EXE'/g, "paint: 'Paint'");
c = c.replace(/scanner:\s*'SCANNER\.SYS'/g, "scanner: 'Scanner'");
c = c.replace(/paperTldr:\s*'PAPER_TLDR\.BAT'/g, "paperTldr: 'Paper TLDR'");
c = c.replace(/title:\s*'TRANSLATOR\.EXE'/g, "title: 'Translate'");
c = c.replace(/title:\s*'CONTROL_PANEL\.CPL'/g, "title: 'Settings'");
c = c.replace(/rssSection:\s*'RSS_FEEDS\.CFG'/g, "rssSection: 'RSS Feeds'");
c = c.replace(/ytSection:\s*'YOUTUBE_TRACKER\.CFG'/g, "ytSection: 'YouTube Channels'");
c = c.replace(/prefsSection:\s*'SYSTEM_PREFS\.INI'/g, "prefsSection: 'Preferences'");
c = c.replace(/recentMedia:\s*\{\s*title:\s*'RECENT_MEDIA\.LOG'\s*\}/g, "recentMedia: { title: 'Recent Media' }");
c = c.replace(/sysResources:\s*\{\s*title:\s*'SYS_RESOURCES'/g, "sysResources: { title: 'System Resources'");

fs.writeFileSync('server/i18n.js', c);

// TR requires another pass for the exact TR matches since the generic replace replaced everything with English.
// Let's just require the file, rewrite the TR object, and write it out properly? No, let's just use string replace.
// Let's do it cleanly by doing an eval and then writing out the module.exports... Wait, no, functions might be lost (though there are none).
