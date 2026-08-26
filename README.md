# The Outsider — GM Dashboard

A small, private Game Master dashboard with a separate, safe public display. It is made with plain HTML, CSS, and JavaScript, so it can be published directly with GitHub Pages—no server, account, or database is needed.

## Start here

Open `index.html` to use **GM Mode**. It contains the handouts, music controls, dice roller, and public-screen controls.

Open `player.html` in a second browser window to use **Public Mode**. This is the only window to share in Discord, Zoom, Google Meet, or on a projector.

The public page deliberately has no controls, menu, dice results, music details, campaign library, or GM notes. It receives only the image the GM explicitly sends to it.

## Using it during a session

1. Open `index.html` in your private GM window.
2. Use **Open public window** at the top of the dashboard, or manually open `player.html` in a second window.
3. Move the public window to a second display if you have one, and share only that window.
4. In GM Mode, press **Show** on any handout. It appears in Public Mode immediately.
5. Press **Hide public screen**, **Black screen**, `H`, or `Escape` to make the public window completely black. The handout remains prepared privately so you can show it again quickly.

When nothing is selected, Public Mode displays the `THE OUTSIDER` opening screen. It never says “no handout selected.”

## GM controls

- **Handouts:** click a thumbnail to prepare it, then press **Show** to display it immediately. The small **Hide** button prepares that handout and blacks out Public Mode.
- **Music:** select a track, then press Play. The player is not interrupted when handouts change. Browsers require the Play button to be clicked before sound can begin.
- **Dice:** choose 1d6, 2d6, or 3d6, then press Roll. The last six rolls stay in the private GM history.
- **Quick actions:** the bottom panel keeps common actions one click away.

Keyboard shortcuts work only in GM Mode:

| Key | Action |
| --- | --- |
| `Space` | Play or pause music |
| `H` or `Escape` | Hide the public screen immediately |
| `1`, `2`, `3` | Roll 1d6, 2d6, or 3d6 |

## Add or rename handouts

1. Put an image in `assets/handouts/`. PNG, JPG, WebP, and SVG all work well.
2. Open `js/data.js` in a text editor.
3. Edit the `handouts` list. Each handout has an `id`, `name`, `image`, and `category`.

Example:

```js
{ 
  id: "ancient-bridge",
  name: "The Ancient Bridge",
  image: "assets/handouts/ancient-bridge.jpg",
  category: "Locations"
}
```

Keep each `id` unique. To rename a handout, change its `name`. To remove one, delete its whole `{ ... }` line. The included SVG handouts are editable starter art; replace them with your own images whenever you like.

If a handout image is missing, GM Mode shows a calm placeholder instead of a broken-image icon. Public Mode stays neutral and dark rather than showing an error.

## Add or replace music

1. Put your MP3, OGG, or WAV file in `assets/audio/`.
2. In `js/data.js`, update the `tracks` list so the `file` value matches your new file.

Example:

```js
{
  id: "underground-temple",
  name: "Underground Temple",
  file: "assets/audio/underground-temple.mp3"
}
```

Five short WAV ambience samples are included so the music player works immediately. They are simply safe starter cues—replace them with your campaign music. If a file is moved or missing, the dashboard says **Audio file unavailable** and everything else keeps working.

## Run locally

You can open the files directly in most modern browsers. For the most reliable two-window synchronization, serve this folder with a tiny local web server.

If you have Python installed, open a terminal in this folder and run:

```bash
python -m http.server 8000
```

Then open:

- GM Mode: `http://localhost:8000/`
- Public Mode: `http://localhost:8000/player.html`

The dashboard uses `BroadcastChannel` for instant same-browser communication and automatically falls back to browser storage events if it is unavailable. A newly opened Public Mode window also picks up the last safe public state.

## Publish with GitHub Pages

1. Create a new GitHub repository, for example `the-outsider-gm`.
2. Upload the contents of this project folder. Keep the folder structure intact.
3. On GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose the branch containing these files (usually `main`) and select **/(root)**.
6. Save. GitHub will show the site address after it publishes.

Your GM URL will be the published site address, and the public URL is the same address with `/player.html` added to the end. For example:

```text
https://your-name.github.io/the-outsider-gm/
https://your-name.github.io/the-outsider-gm/player.html
```

Keep both browser windows on the same published site address. The two pages must share the same website origin to communicate safely.

## Project layout

```text
├── index.html                 GM Mode
├── player.html                safe Public Mode
├── css/style.css              visual design and responsive layout
├── js/data.js                 easy-to-edit handouts and tracks
├── js/gm.js                   GM controls, dice, and music
├── js/player.js               public image display only
├── js/communication.js        private-to-public window sync
└── assets/
    ├── handouts/              handout artwork
    └── audio/                 music files
```

## Safety notes

Only show the `player.html` window to players. The public page does not load `data.js`, which means the handout library and audio list are not part of that page. It listens only for the explicitly selected image path and a simple show/hide state.

For the quickest emergency blackout, press `Escape` in the GM window.
