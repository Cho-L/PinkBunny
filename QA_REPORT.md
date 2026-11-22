## v11.3.0 security / connection stabilization (2026-11-22)

- **Default pairing:** New installations generate 32 hexadecimal characters (128 bits) with crypto/rand. **Existing 8-character pairing codes remain unchanged** to avoid disconnecting existing two-PC users; these legacy codes are weaker.
- **LAN isolation:** HTTP middleware rejects remote reads of OBS widget, SSE, current media status, artwork, theme, setup and guide. Remote music PCs may access only paired extension API endpoints.
- **DNS rebinding:** Rejects non-literal Host names other than localhost, requires port 38765.
- **Chrome manifest:** Required HTTP host access is limited to loopback; permissions for a 2-PC streaming IP are requested by the user in the extension popup during pairing.
- **Compatibility:** After upgrading Chrome extension, existing 2-PC setups may need to re-apply the pairing address to grant the specific streaming PC permission. 1-PC auto-connect remains available.
- **Known limitation:** A hostile program or Chrome extension already installed on the streaming PC may still access local pairing resources. This is not an endpoint authentication system against malware on the same computer.
- **Verification:** Regression tests cover pairing generation/preservation, local/remote HTTP access policy and extension permission prompts. Passing CI is **not** proof of real multi-PC or Chrome/OBS E2E success.

---

# Pink Bunny QA report — v11.0.1 (2026-11-22)

## Scope and evidence

This pass reviews the Windows Go server, setup wizard, OBS browser source, Chrome Manifest V3 extension, media filtering, player commands, pairing and image settings. GitHub Actions runs the automated checks on every main-branch push.

## Issues fixed in this pass

| Area | Severity | Finding | Fix |
| --- | --- | --- | --- |
| Extension popup | UX/high | Chrome action popup can close when it loses focus, making dropdown selection frustrating | Added **큰 화면에서 설정**, opening the same controls in a persistent full-size browser tab |
| Full-page controls | UX/medium | With dashboard tab focused, the former current-tab logic would not find YouTube | Fall back to a recent YouTube tab or selected tab |
| Pairing | medium | A failed two-PC connection cleared the pasted pairing link | Retain link until confirmed successful |
| Network host validation | high | A double-escaped regexp could reject legitimate IPv4 addresses | Correct IPv4 syntax and octet validation |
| Upcoming track metadata | low | Double-escaped whitespace regex failed to normalize multi-space song labels | Fixed regexp |
| Avatar upload feedback | low | Some oversized uploads still displayed the old 2 MB warning | Updated to 4 MB |

## Automated tests included

- Go: existing theme validation, avatar format/size, persistent pairing, hidden and pinned tab selection, media filtering, remote action allowlist, upcoming-track propagation
- JavaScript: syntax checks for extension/OBS scripts and functional browser mocks for media extraction, next-item selection, ad/Shorts filtering, transport controls, popup full-tab mode, tab selection and failed pairing
- Windows executable smoke test: start the GUI EXE silently, query `/api/status`, `/api/theme`, `/api/avatar/info` and `/setup`; then stop the process
- Installer: compile the Windows installer and publish the zipped build when all steps pass

## Actual-browser / physical setup checks still required

These tests **cannot be called passed** based solely on code review or a GitHub Actions run:

1. Chrome on Windows: click the toolbar popup, select the YouTube tab dropdown, and open **큰 화면에서 설정**. Confirm the large tab stays open during dropdown interactions.
2. One-PC: launch Pink Bunny, load/reload extension, play/pause videos, verify OBS title, timeline, cover image and reconnect behavior.
3. Two-PC: connect music and streaming PCs, test firewall access, tab ID selection, remote play/pause and next/previous commands.
4. Real YouTube and YouTube Music: confirm current selectors for playlists/queue, ad-filter states, Shorts and transport buttons; site markup changes can break them.
5. OBS: verify layout dimensions, animated GIF/WebP, avatar position, song-transition animation, and appropriate behavior when streams disconnect.
6. Windows: check native notification icon, clean exit, auto-start, installer upgrade and uninstall with existing settings.

## Known limitations

- Chrome's built-in extension popup closing on focus loss is normal browser behavior. Use the full-tab dashboard for a persistent UI.
- The next-track label is shown only when the next entry is detectable in the visible playlist/queue. Recommendations aren't guaranteed playback order.
- Local filtering hides information from the OBS widget but does not erase browser history or secure the LAN status endpoint from other local-network devices.
- Remote-control enqueue success does not guarantee the target YouTube player executed the command. That acknowledgement remains future work.
- The app currently has no automatic updater and has not been code-signed.

## How to report bugs

Open a GitHub issue with: Windows/Chrome/OBS versions, one-PC or two-PC, precise action sequence, what appeared instead of the expected result, and a screenshot with private pairing tokens removed. Never post the pairing link or code publicly.
