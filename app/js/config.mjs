// Paste the published Google Sheet CSV URL here after the sheet is ready.
// Leave it empty to use local sample data while previewing the site.
export const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRkdbsG06sCRQIiiBAcTM7imos4MrtgGeA-R568we0lDMGz1w9eihQPhV5CLz-8oq4XT4pTVtEFmGy4/pub?gid=0&single=true&output=csv";

// Student page refresh interval. 3 minutes keeps the page current without
// repeatedly hitting Google Sheet too aggressively.
export const AUTO_REFRESH_INTERVAL_MS = 3 * 60 * 1000;
