package main

import (
 "net/http"
 "time"
)

type DiagnosticCheck struct {
 ID string `json:"id"`
 Label string `json:"label"`
 State string `json:"state"` // ok, attention or manual
 Detail string `json:"detail"`
 Help string `json:"help"`
}
type Diagnostics struct {
 Checks []DiagnosticCheck `json:"checks"`
 CheckedAt string `json:"checkedAt"`
}

func (s *Store) diagnosticChecks(now time.Time) []DiagnosticCheck {
 status:=s.snapshot() // expires disconnected media tabs
 checks:=[]DiagnosticCheck{{
  ID:"server",Label:"Pink Bunny 서버",State:"ok",
  Detail:"송출 PC의 Pink Bunny 서버에 정상적으로 연결됐습니다.",
  Help:"서버가 종료되면 송출 PC에서 PinkBunny.exe를 다시 실행하세요.",
 }}
 recent:=!s.extensionLastSeen.IsZero()&&now.Sub(s.extensionLastSeen)<=12*time.Second
 extension:=DiagnosticCheck{
  ID:"extension",Label:"Chrome 확장 프로그램 통신",State:"attention",
  Detail:"최근 12초 동안 확장 프로그램 요청을 확인하지 못했습니다. 연결 여부는 확정할 수 없습니다.",
  Help:"Chrome 확장 프로그램의 연결 설정을 확인하고 유튜브 페이지를 새로고침하세요.",
 }
 if recent {
  extension.State="ok"
  extension.Detail="최근 12초 이내에 연결된 확장 프로그램의 요청을 받았습니다."
 }
 checks=append(checks,extension)
 youtube:=DiagnosticCheck{
  ID:"youtube",Label:"YouTube 영상 정보 수신",State:"attention",
  Detail:"최근 12초 동안 활성 YouTube 영상 정보를 받지 못했습니다.",
  Help:"음악 PC에서 YouTube/YouTube Music 영상을 열고 재생한 뒤 페이지를 새로고침하세요.",
 }
 if len(s.tabs)>0 {
  youtube.State="ok"
  if status.Connected {
   youtube.Detail="최근 영상 정보를 받고 있습니다: "+clip(status.Title,70)
  }else {
   youtube.Detail="영상 데이터는 받았지만, 필터 또는 숨김 설정으로 OBS에 표시할 영상은 없습니다."
   youtube.State="attention"
  }
 }
 checks=append(checks,youtube)
 checks=append(checks,
  DiagnosticCheck{ID:"obs",Label:"OBS 브라우저 소스",State:"manual",
   Detail:"이 진단에서는 OBS가 실행 중인지, 브라우저 소스가 실제로 연결됐는지 확인하지 않습니다.",
   Help:"OBS에서 Pink Bunny Player 소스와 URL http://127.0.0.1:38765, 크기 420 × 130을 확인하세요."},
  DiagnosticCheck{ID:"audio",Label:"방송 음악 오디오",State:"manual",
   Detail:"Pink Bunny는 음성 데이터를 전송하지 않으므로 OBS 오디오 상태를 확인할 수 없습니다.",
   Help:"OBS 오디오 믹서 또는 오디오 입력/출력 캡처에서 소리가 들어오는지 확인하세요."},
 )
 return checks
}
func registerDiagnostics(mux *http.ServeMux,s *Store) {
 mux.HandleFunc("/api/diagnostics",func(w http.ResponseWriter,r *http.Request){
  if r.Method!=http.MethodGet||!isLocal(r){http.Error(w,"Local access only",403);return}
  now:=time.Now()
  s.Lock();checks:=s.diagnosticChecks(now);s.Unlock()
  reply(w,200,Diagnostics{Checks:checks,CheckedAt:now.Format(time.RFC3339)})
 })
}
