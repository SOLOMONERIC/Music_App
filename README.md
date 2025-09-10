## Retro Player (Vanilla JS)

A fast, framework-free music web app with a retro look and smooth UX. It supports Deezer search (30s previews), full local file playback, a proper light/dark theme toggle, a realtime waveform visualizer (Web Audio API), and a lyrics panel with synced LRC (via LRCLIB) and plain-text fallback.

### Features
- Retro UI/UX with light/dark theme toggle (persists)
- Deezer search (via JSONP) for songs, artists, and albums
  - Queue or play results instantly (plays 30s Deezer previews)
- Local files playback from your device (multiple selection)
  - Queue and drag-to-reorder
- Full player controls: play/pause, next/prev, seek, volume/mute, shuffle, repeat
- Waveform visualization using the Web Audio API
- Lyrics panel
  - Auto-fetch synced LRC when available (LRCLIB)
  - Fallback to plain lyrics
  - Auto-scroll to current line
- Keyboard shortcuts and accessible controls
- State persistence (theme, volume, last queue & position)

### Project structure
```
Music_App/
├── index.html     # App layout and components
├── styles.css     # Retro theme, layouts, animations, responsiveness
├── app.js         # Player logic, Deezer search, queue, local files, lyrics, waveform
└── README.md      # This file
```

### Getting started

#### Run locally
Since this is a static site, you can open it directly or serve it locally:

- Option A: Double-click `index.html`
  - Works for most features. Some browsers restrict `fetch()` from `file://` for lyrics; if lyrics don’t load, use a local server.

- Option B: Serve with a simple static server
  - Python 3: `python -m http.server 8000`
  - Node (npx): `npx serve -p 8000`
  - Then open `http://localhost:8000` in your browser.

#### Deploy to GitHub Pages
1. Commit the files to a repo (e.g., `music-app`).
2. Push to GitHub.
3. In your repo, open Settings → Pages → Source: select `main` branch, `/ (root)`.
4. Save. Your site will be live at `https://<username>.github.io/<repo>/`.

No build step needed—pure HTML/CSS/JS.

### Usage guide
- Search Deezer: type in the search bar and press Enter. Use Queue/Play buttons on results.
- Add local files: click “Add Local” and choose audio files. They appear in Your Library; queue or play them.
- Player controls: use the bottom bar to play/pause, seek, change volume, mute, shuffle, repeat, and navigate tracks.
- Queue: drag items by the handle to reorder; click an item to play; Remove to delete.
- Theme: click the toggle in the header (state persists across reloads).
- Lyrics: press the Lyrics button; close with ✖; Refresh to try again or after metadata changes.

### Keyboard shortcuts
- /: focus search
- Space: play/pause
- K: previous
- L: next
- M: mute
- S: shuffle toggle
- R: repeat toggle
- T: theme toggle

### Technical notes

#### Deezer API (JSONP)
- The app uses Deezer’s public search endpoint with `output=jsonp` to avoid CORS issues without a backend.
- Deezer provides 30-second `preview` MP3 URLs for tracks; full-track streaming is not available without proper auth/SDK/licenses.

#### Lyrics (LRCLIB)
- The app queries LRCLIB’s public API (`https://lrclib.net/api/search`) by track title and artist.
- If synced lyrics are found, they are parsed and auto-scrolled. If not, plain lyrics (when available) are shown.
- Accuracy depends on metadata (title/artist) and catalog coverage.

#### Waveform (Web Audio API)
- Built using an `AudioContext` + `AnalyserNode` connected to the `<audio>` element.
- Renders a real-time time-domain waveform to a `<canvas>`.
- Visualization works for both previews and local files.

#### Persistence
- `localStorage` keys: `rp_theme`, `rp_volume`, `rp_queue`, `rp_queueIndex`, `rp_repeat`.
- Local files are stored as object URLs in memory for the session; metadata (file name) is persisted to list, but object URLs are recreated per session when re-added.

### Accessibility
- Theme toggle uses proper switch semantics and `aria-checked`.
- Buttons include labels and keyboard shortcuts.
- Live regions and focus states are considered for a smooth, accessible experience.

### Browser support
Modern Chromium, Firefox, and Safari. If lyrics fail on `file://`, run via a local server.

### Troubleshooting
- No audio when clicking Play on Deezer results:
  - Deezer previews are 30s clips; some tracks may not have a preview. Try another result.
- Lyrics not found:
  - Try Refresh; ensure the title/artist are accurate. Not all tracks have lyrics in LRCLIB.
- Nothing happens on Space/keyboard shortcuts:
  - Ensure you’re not typing in an input field.
- Waveform doesn’t animate:
  - Some browsers require user interaction before audio contexts start. Click Play first.

### Customization
- Colors: update CSS variables in `:root` and `:root.light`.
- Branding: edit the badge/title in the header (`index.html`).
- Toggle look-and-feel: tweak `.toggle` styles in `styles.css`.

### License
This project is provided as-is for educational and personal use. Ensure you comply with third-party API terms (Deezer, LRCLIB) and local regulations when deploying.


<!-- Live site link -->
https://solomoneric.github.io/Music_App/