# 🐰 Pink Bunny · 유튜브 노래 제목을 OBS에 자동 표시

> **Pink Bunny는 무료 프로그램입니다.** Chrome에서 재생 중인 유튜브 영상 제목을 OBS의 귀여운 반투명 핑크 토끼 플레이어로 표시해 줍니다. **1컴/2컴** 지원, 회원가입 불필요, 별도 Node.js 설치 불필요.

## 💗 개발 지식 없이 설치하기

### [📥 Windows용 Pink Bunny 다운로드 (최신 베타)](https://github.com/Cho-L/PinkBunny/releases/tag/beta)

1. 위 링크 → **Assets** → **PinkBunny-Windows.zip** 다운로드.
2. ZIP을 압축 해제하고 **INSTALL_KO.txt**를 열어 안내에 따라 설치.
3. 설치 중 연결 코드나 IP가 필요하면 `PinkBunny.exe` 실행 창을 확인하세요.

**1컴:** Chrome + PinkBunny.exe + OBS를 같은 PC에서 사용.  
**2컴:** Chrome은 음악 PC, PinkBunny.exe와 OBS는 송출 PC에서 사용.

### 설치 핵심만 보기

- `PinkBunny.exe` 실행 (종료하지 않고 켜두기)
- Chrome 주소창 `chrome://extensions` → 개발자 모드 → **압축해제된 확장 프로그램 로드** → 압축을 푼 `extension` 폴더 선택
- 크롬 확장 프로그램 설정에서 주소 입력: 1컴 `127.0.0.1` / 2컴 **송출 PC IPv4**
- EXE 실행 창에 보이는 **연결 코드 8자리** 입력
- OBS → 소스 추가 → 브라우저 → URL `http://127.0.0.1:38765` / 크기 **420 × 130**
- Chrome 유튜브 영상을 새로고침하고 재생

## 🐰 특징

- 유튜브 영상 제목·채널명 자동 감지, 재생/일시정지 표시
- 투명 배경과 반투명 분홍 토끼 위젯
- 1컴 및 같은 로컬 네트워크의 2컴 지원
- 추가 서버 요금 없음. 사용자 PC 안에서 동작
- [디자인 미리보기](http://127.0.0.1:38765/?demo) (PinkBunny.exe 실행 후 확인 가능)

## ❓ 자주 묻는 질문

**ZIP 안에 manifest.json이 안 보여요.**  
`extension/manifest.json`에 있어요. Chrome에는 ZIP이 아니라 압축을 푼 **extension 폴더**를 선택하세요.

**2컴인데 제목이 나오지 않아요.**  
송출 PC의 IPv4, 코드, 같은 공유기 연결, 개인 네트워크 방화벽 허용을 확인하세요. 2컴의 음악 PC에서는 `127.0.0.1` 대신 **송출 PC의 IP**를 적어야 해요.

**크롬 웹 스토어에서 바로 설치할 수 있나요?**  
아니요. GitHub 무료 배포이므로 확장 프로그램을 수동으로 한 번 등록해야 해요.

**제목이 실제 노래와 다를 수도 있나요?**  
네. 실제 음원을 식별하지 않고 유튜브 **영상 제목**을 표시해요.

## 🔒 보안 및 개인정보

- 사용자의 유튜브 제목·채널·URL·재생 상태가 지정한 **로컬 서버**에 전달됩니다. 외부 중계 서버를 사용하지 않아요.
- 개인 연결 코드로 업데이트를 제한하지만, 상태 조회는 별도 인증이 없습니다. **신뢰할 수 있는 개인 네트워크에서만 사용**하세요.
- 인터넷 포트포워딩을 하지 마세요.
- 직접 빌드한 EXE는 코드 서명이 없어서 Windows SmartScreen 경고가 나타날 수 있습니다.

## 개발자용

```sh
go test ./...
go build -o PinkBunny.exe .
```

코드는 `main.go`(로컬 서버), `extension/`(크롬 확장), `overlay/`(OBS 위젯), `.github/workflows/`(Windows 자동 빌드)에 있습니다.

> **베타 안내:** GitHub Actions 빌드는 통과해도 실제 서로 다른 Windows 환경 및 OBS/Chrome 연동은 추가 검증이 필요합니다. 문제는 GitHub Issues에 알려 주세요.
