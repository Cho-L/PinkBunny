package main

import (
 "net/http"
 "net/http/httptest"
 "testing"
)

func TestHTTPAccessIsolation(t *testing.T){
 mux:=http.NewServeMux()
 paths:=[]string{"/","/events","/api/status","/api/avatar","/api/avatar/info","/api/theme","/guide","/setup","/api/pair","/api/update","/api/tabs"}
 for _,path:=range paths {p:=path;mux.HandleFunc(p,func(w http.ResponseWriter,r *http.Request){w.WriteHeader(200)})}
 handler:=secureHandler(mux)
 cases:=[]struct{name,remote,host,origin,extHeader,path,method string;want int}{
  {"localhost OBS","127.0.0.1:1234","127.0.0.1:38765","","","/",http.MethodGet,200},
  {"localhost status","[::1]:1234","localhost:38765","","","/api/status",http.MethodGet,200},
  {"remote status denied","192.168.1.45:1234","192.168.1.20:38765","","","/api/status",http.MethodGet,403},
  {"remote SSE denied","192.168.1.45:1234","192.168.1.20:38765","","","/events",http.MethodGet,403},
  {"remote avatar denied","192.168.1.45:1234","192.168.1.20:38765","","","/api/avatar",http.MethodGet,403},
  {"remote theme denied","192.168.1.45:1234","192.168.1.20:38765","","","/api/theme",http.MethodGet,403},
  {"remote setup denied","192.168.1.45:1234","192.168.1.20:38765","","","/setup",http.MethodGet,403},
  {"remote guide denied","192.168.1.45:1234","192.168.1.20:38765","","","/guide",http.MethodGet,403},
  {"remote pairing denied","192.168.1.45:1234","192.168.1.20:38765","","","/api/pair",http.MethodGet,403},
  {"remote API origin allowed","192.168.1.45:1234","192.168.1.20:38765","chrome-extension://abcdefghijklmnopabcdefghijklmnop","","/api/update",http.MethodPost,200},
  {"remote API header allowed","192.168.1.45:1234","192.168.1.20:38765","","1","/api/update",http.MethodPost,200},
  {"remote API no extension denied","192.168.1.45:1234","192.168.1.20:38765","","","/api/update",http.MethodPost,403},
  {"remote API bad extension denied","192.168.1.45:1234","192.168.1.20:38765","chrome-extension://invalid","","/api/update",http.MethodPost,403},
  {"DNS rebinding local denied","127.0.0.1:1234","attacker.example:38765","","","/api/pair",http.MethodGet,403},
  {"wrong port denied","127.0.0.1:1234","127.0.0.1:8080","","","/api/status",http.MethodGet,403},
  {"external IP host denied","127.0.0.1:1234","8.8.8.8:38765","","","/api/pair",http.MethodGet,403},
  {"remote preflight allowed","192.168.1.45:1234","192.168.1.20:38765","chrome-extension://abcdefghijklmnopabcdefghijklmnop","","/api/tabs",http.MethodOptions,204},
 }
 for _,tc:=range cases {
  t.Run(tc.name,func(t *testing.T){
   req:=httptest.NewRequest(tc.method,"http://"+tc.host+tc.path,nil)
   req.RemoteAddr=tc.remote
   if tc.origin!=""{req.Header.Set("Origin",tc.origin)}
   if tc.extHeader!=""{req.Header.Set("X-Bunny-Extension",tc.extHeader)}
   r:=httptest.NewRecorder();handler.ServeHTTP(r,req)
   if r.Code!=tc.want{t.Fatalf("wanted %d, got %d: %s",tc.want,r.Code,r.Body.String())}
  })
 }
}

func TestHostAndRemoteAllowlist(t *testing.T){
 for _,host:=range []string{"localhost:38765","127.0.0.1:38765","192.168.1.8:38765","10.10.0.8:38765","172.20.0.1:38765","[::1]:38765"}{
  if !validServerHost(host){t.Fatalf("valid host blocked: %s",host)}
 }
 for _,host:=range []string{"evil.example:38765","localhost.evil.test:38765","8.8.8.8:38765","127.0.0.1:80",""}{
  if validServerHost(host){t.Fatalf("host should be blocked: %s",host)}
 }
 for _,path:=range []string{"/api/status","/events","/guide","/setup","/api/pair","/api/avatar"}{
  if remoteExtensionEndpoint(path){t.Fatalf("public LAN path must not be exposed: %s",path)}
 }
}
