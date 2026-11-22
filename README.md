# 🐰 Pink Bunny — YouTube Now Playing for OBS

Chrome에서 재생 중인 YouTube/YouTube Music의 제목·채널·재생 상태를 OBS에 표시하는 **반투명 핑크 토끼 위젯**입니다. Windows의 1컴/2컴 환경을 지원합니다. 외부 서버나 월 이용료는 없습니다.

## 설치 (Windows 10/11)
1. [Actions](https://github.com/Cho-L/PinkBunny/actions)에서 Windows 빌드의 아티팩트(PinkBunny-Windows)를 내려받거나, Go 1.22 이상에서 `go build -o PinkBunny.exe .`로 빌드합니다.
2. OBS 송출 PC에서 `PinkBunny.exe`를 실행하고 창에 표시된 **8자리 연결 코드**를 확인합니다.
3. Chrome 유튜브 재생 PC에서 이 저장소를 **Code → Download ZIP**으로 다운로드하고 압축을 풉니다.
4. `chrome://extensions` → 개발자 모드 → **압축해제된 확장 프로그램 로드** → `extension` 폴더 선택 (manifest.json이 들어 있는 폴더).
5. 확장 프로그램 아이콘 클릭 → **서버 PC IPv4 주소**와 **연결 코드** 입력. 1컴은 `127.0.0.1`, 2컴은 송출 PC의 IPv4 주소를 입력합니다.
6. 송출 PC의 OBS에서 브라우저 소스 추가: `http://127.0.0.1:38765`, 크기 **420 × 130**.
7. 유튜브 탭을 새로고침하고 영상을 재생하세요.

## 2컴
- 게임/음악 PC: Chrome + `extension/`
- 방송 PC: `PinkBunny.exe` + OBS
- 두 컴퓨터는 같은 사설망이어야 합니다. Windows 방화벽의 **개인 네트워크** 허용이 필요할 수 있습니다.
- 공유기 **포트포워딩은 하지 마세요**. 로컬 HTTP 서버입니다.

## 문제 해결
- **manifest.json 오류**: ZIP이 아니라 압축을 푼 `extension` 폴더를 선택하세요.
- **연결 실패**: EXE 실행 여부, 송출 PC의 IP, 8자리 연결 코드, 방화벽, 같은 공유기 여부를 확인하세요.
- **코드가 달라졌어요**: EXE를 재시작하면 새 코드가 발급됩니다. 확장 프로그램 설정을 다시 저장하세요.
- **영상 제목만 나오나요?** 예. 음원을 인식하는 기능은 아닙니다.
- **Windows 경고**: 자체 빌드된 서명 없는 실행 파일에는 SmartScreen 경고가 발생할 수 있습니다. 출처를 검증하고 사용하세요.

## 개인정보 및 보안
유튜브 제목, 채널, URL, 재생 여부를 사용자 지정 로컬 서버로 전송합니다. 외부 데이터 서버는 사용하지 않습니다. 같은 네트워크에서 상태 조회는 인증되지 않으므로 신뢰할 수 있는 사설망에서만 사용하세요.

> 초기 공개 베타. 실제 다른 PC/OBS 조합에서의 호환성은 별도 검증이 필요합니다.
