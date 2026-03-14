# ⚡ FlashPoint

> Browser-to-browser P2P file transfer via WebRTC. Zero uploads. Zero servers. Zero tracking.

![License](https://img.shields.io/badge/license-CC%20BY--NC--ND%204.0-blue)
![Made with](https://img.shields.io/badge/made%20with-React%20%2B%20Vite-61dafb)
![WebRTC](https://img.shields.io/badge/transport-WebRTC%20DataChannel-00d4ff)

---

## How it works

```
Browser A  ──────────────────────────────────  Browser B
    │                                               │
    │   1. exchange Peer IDs (copy/paste/chat)      │
    │ ◄─────────── PeerJS signal server ──────────► │
    │                                               │
    │   2. WebRTC DataChannel established           │
    │ ◄═══════════ direct P2P tunnel ══════════════►│
    │                                               │
    │   3. file chunks fly peer-to-peer             │
    └──────────────── 64 KB chunks ────────────────►│
```

The PeerJS signaling server is only used to help two browsers discover each other.
All file data flows **directly browser-to-browser** — nothing touches any server.

---

## Quick Start

### Requirements

- [Node.js](https://nodejs.org/) version 18 or higher
- npm (comes with Node.js)

### Run locally

```bash
# 1. Clone the repo
git clone https://github.com/eqwom/flashpoint.git

# 2. Enter the project folder
cd flashpoint

# 3. Install dependencies
npm install

# 4. Start the dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

To test P2P between two people, both run `npm run dev` and share their Peer IDs with each other.
Or open two tabs in the same browser — each tab gets its own unique ID.

### Build for production

```bash
npm run build
npm run preview
```

This produces a `dist/` folder of static files you can host anywhere
(any static host: Netlify, Vercel, Cloudflare Pages, your own VPS, etc).

---

## Usage

```
1. Open the app                →  you receive a unique Peer ID
2. Share your ID               →  send it via Telegram, Discord, SMS, anything
3. Your peer pastes your ID    →  clicks "Connect"
4. Select a file               →  click "Transmit File"
5. Peer downloads              →  file assembles in their browser, no server involved
```

Both users must be online at the same time — this is a live transfer, not async.

---

## Stack

| Layer | Technology |
|---|---|
| UI framework | React 18 |
| Build tool | Vite 5 |
| P2P transport | PeerJS 1.5 (WebRTC DataChannel) |
| Styling | Pure CSS — OLED dark, glassmorphism |
| Font | JetBrains Mono + Outfit |

---

## Technical details

**Chunking** — RTCDataChannel has a ~256 KB message size limit that varies by browser.
FlashPoint slices every file into **64 KB chunks** (`ArrayBuffer.slice`), streams them in order,
then reassembles via `Blob` on the receiver side.

**Protocol** — three message types over the DataChannel:
```
{ type: 'meta',  name, size, mimeType, totalChunks }
{ type: 'chunk', index, data: ArrayBuffer }
{ type: 'done'  }
```

**Security** — files never touch a server. The PeerJS public signaling server
(`0.peerjs.com`) only exchanges ICE candidates. For maximum privacy, self-host
[PeerServer](https://github.com/peers/peerjs-server).

---

## License

Copyright (c) 2026 Creator eqwom

This work is licensed under the
[Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License](LICENSE).

You are free to share — copy and redistribute the material in any medium or format,
under the following terms:

- **Attribution** — You must give appropriate credit to Creator eqwom.
- **NonCommercial** — You may not use the material for commercial purposes.
- **NoDerivatives** — You may not distribute modified versions of this material.


