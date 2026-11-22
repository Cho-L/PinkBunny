# 🧪 Pink Bunny 검증 보고서

현재 검증 대상: **v12.0.1 Beta · 2026-11-22**  
최신 Windows 검증 실행: [GitHub Actions #45025380401](https://github.com/Cho-L/PinkBunny/actions/runs/45025380401)

**검증 범위 구분:** Go 단위·API 보안 테스트, JavaScript 모의 브라우저 테스트, Windows 실행 파일·설치 패키지 자동 빌드는 확인했습니다. **실제 Windows Chrome + YouTube/YouTube Music + OBS 및 물리적인 두 PC 연결을 통한 통합 테스트는 수행되지 않았습니다.** 따라서 자동 빌드 성공을 실사용 환경에서의 모든 기능 정상 동작 보증으로 표현하지 않습니다.

| 구분 | 현재 자동 검증 | 별도 실제 환경 검증 |
| --- | --- | --- |
| 서버·보안·진단 API | 테스트 및 Windows 실행 파일 응답 확인 | 방화벽·백신·사설망 설정 |
| Chrome 확장 동작 | JavaScript 모의 환경 회귀 테스트 | Chrome 권한 요청·팝업·YouTube 실제 화면 |
| 원격 제어 실행 응답 | 명령 접수·전달·ACK·실패·시간 초과 검증 | 실제 유튜브 재생·이전/다음·탭 변경 |
| OBS 위젯·오디오 | 서버 URL·가이드 응답 스모크 테스트 | 브라우저 소스 렌더링·오디오 캡처·애니메이션 |
| 설치 및 배포 | Inno Setup 컴파일·ZIP·베타 릴리스 업로드 | 일반 사용자 설치·업데이트·제거 |

## v12.0.1 — Chrome 재생 제어 버튼 표시·볼륨 확인

- 이전에는 팝업에서 제어 오류가 하단 상태 영역에만 표시되어, 버튼 근처에서 결과를 확인하기 어려웠습니다. 버튼 바로 아래에 실제 처리 응답·실패 사유를 표시하도록 수정했습니다.
- 볼륨 +/−는 **유튜브 HTML 미디어 플레이어**의 음량만 변경합니다. 실제 volume 변경 결과·음소거 여부를 응답하고, 상한/하한에서는 성공으로 안내하지 않습니다.
- YouTube Music 재생 버튼 탐색 후보를 확장했습니다. 사이트 DOM이 변경된 실제 YouTube/YouTube Music 전체 버전에서 성공한다는 보장은 없습니다.
- JavaScript 모의 환경에서 볼륨 변경·음소거·최대/최소·다음 버튼 미발견·확장 팝업 메시지를 회귀 검증합니다. **실제 Chrome·YouTube 사이트를 조작한 테스트는 별도 검증이 필요합니다.**

## v12.0.0 — 방송 준비 진단 및 원격 명령 처리 결과 (2026-11-22)

- **Diagnostics:** The local setup page calls `GET /api/diagnostics` and distinguishes server readiness, fresh extension requests (last 12 seconds), and recent YouTube media data from **manual checks** for OBS browser source and broadcast audio. It never claims that an OBS source or its audio was validated without an actual OBS connection.
- **Command lifecycle:** Each queued `POST /api/control` returns a random ID; `GET /api/control/result?id=...` on the streaming PC observes `queued -> delivered -> success/failed/timeout`. Queued commands time out after 15 seconds; commands without an execution acknowledgement time out 12 seconds after delivery. Old results are evicted after two minutes.
- **Execution reports:** The music PC sends authenticated `POST /api/command-result` containing command ID, tab ID and execution outcome. Wrong-tab, duplicate, missing and unauthenticated results are rejected. The result endpoint is allowed across LAN only for paired Chrome extensions; reading results and diagnostics remains streaming-PC-local.
- **Browser play promise:** Playback start now waits for the YouTube video `play()` promise. Browser rejection returns failure instead of misleading success.
- **Limitations:** A success confirms the Chrome content script accepted/executed the request, not necessarily a visible player state transition, OBS audio reception or copyright permission. Network drops produce a timeout, not false success. Real Chrome/OBS/2-PC integration remains unverified.
- **Tests:** Go lifecycle/auth/timeout/diagnostics and remote-policy tests; Node extension send/ack and autoplay rejection tests; Windows EXE smoke test includes diagnostics and bundled guides.

---

## v11.3.0 security / connection stabilization (2026-11-22)

- **Default pairing:** New installations generate 32 hexadecimal characters (128 bits) with crypto/rand. **Existing 8-character pairing codes remain unchanged** to avoid disconnecting existing two-PC users; these legacy codes are weaker.
- **LAN isolation:** HTTP middleware rejects remote reads of OBS widget, SSE, current media status, artwork, theme, setup and guide. Remote music PCs may access only paired extension API endpoints.
- **DNS rebinding:** Rejects non-literal Host names other than localhost, requires port 38765.
- **Chrome manifest:** Required HTTP host access is limited to loopback; permissions for a 2-PC streaming IP are requested by the user in the extension popup during pairing.
- **Compatibility:** After upgrading Chrome extension, existing 2-PC setups may need to re-apply the pairing address to grant the specific streaming PC permission. 1-PC auto-connect remains available.
- **Known limitation:** A hostile program or Chrome extension already installed on the streaming PC may still access local pairing resources. This is not an endpoint authentication system against malware on the same computer.
- **Verification:** Regression tests cover pairing generation/preservation, local/remote HTTP access policy and extension permission prompts. Passing CI is **not** proof of real multi-PC or Chrome/OBS E2E success.

---

## 이전 검증 기록: v11.0.1 (2026-11-22)

> **과거 버전 기록입니다. 현재 사용 설명으로 적용하지 마세요.** 이후 v11.3의 LAN 접근 제한과 v12.0의 원격 명령 결과 회신으로 일부 제한이 변경됐습니다. 현재 안내는 위의 v12.0·v11.3 항목을 우선하세요.

## Scope and evidence

v11.0.1 당시의 Go 서버·설치 도우미·OBS 위젯·Chrome 확장 프로그램·연결·재생 제어 점검 기록입니다. 현재 자동화 테스트는 v12.0.0의 진단·ACK 항목까지 확장됐습니다.

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

## v11.0.1 당시의 제한 사항 (최신 버전과 다를 수 있음)

- Chrome's built-in extension popup closing on focus loss is normal browser behavior. Use the full-tab dashboard for a persistent UI.
- The next-track label is shown only when the next entry is detectable in the visible playlist/queue. Recommendations aren't guaranteed playback order.
- **v11.0.1 당시:** 로컬 필터는 OBS 표시에서만 정보를 숨겼고, LAN 상태 정보 노출 제한은 아직 도입되지 않았습니다. **현재 v12.0.0에서는 v11.3부터 송출 PC 외부의 상태·OBS 페이지 접근을 차단합니다.**
- **v11.0.1 당시:** 명령 접수만 확인하고 실행 결과를 받지 못했습니다. **현재 v12.0.0에서는 Chrome 명령 처리 결과를 회신합니다.** 단 실제 OBS 오디오 송출이나 YouTube 화면의 변화까지 보장하지는 않습니다.
- The app currently has no automatic updater and has not been code-signed.

## How to report bugs

Open a GitHub issue with: Windows/Chrome/OBS versions, one-PC or two-PC, precise action sequence, what appeared instead of the expected result, and a screenshot with private pairing tokens removed. Never post the pairing link or code publicly.
