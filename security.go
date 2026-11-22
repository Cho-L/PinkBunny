package main

import (
 "net"
 "net/http"
 "strings"
)

// Browser Host validation prevents DNS rebinding (a third-party hostname that
// resolves to localhost) from exposing pairing/configuration endpoints.
// Pink Bunny only uses loopback or literal private IPv4 addresses on port 38765.
func validServerHost(hostport string) bool {
 host,port,err:=net.SplitHostPort(hostport)
 if err!=nil||port!="38765" {return false}
 if host=="localhost" {return true}
 ip:=net.ParseIP(host)
 return ip!=nil&&(ip.IsLoopback()||ip.IsPrivate())
}

// Remote music PCs only need authenticated extension API traffic. Never expose
// OBS status, media artwork, SSE, setup, or local settings to the LAN.
func remoteExtensionEndpoint(path string)bool {
 switch path {
 case "/api/update","/api/remove","/api/tabs","/api/select","/api/visibility","/api/commands","/api/command-result":
  return true
 }
 return false
}

func permittedClient(r *http.Request)bool {
 if !validServerHost(r.Host){return false}
 if isLocal(r){return true}
 return remoteExtensionEndpoint(r.URL.Path)&&extensionOrigin(r)
}

func secureHandler(next http.Handler)http.Handler {
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if !permittedClient(r){http.Error(w,"Local access or paired extension required",http.StatusForbidden);return}
  if origin:=r.Header.Get("Origin");extensionOrigin(r)&&strings.HasPrefix(origin,"chrome-extension://")&&
   (remoteExtensionEndpoint(r.URL.Path)||r.URL.Path=="/api/pair"){
   w.Header().Set("Access-Control-Allow-Origin",origin)
   w.Header().Set("Vary","Origin")
   w.Header().Set("Access-Control-Allow-Headers","Content-Type, X-Bunny-Key, X-Bunny-Extension")
   w.Header().Set("Access-Control-Allow-Methods","GET, POST, OPTIONS")
  }
  if r.Method=="OPTIONS"{w.WriteHeader(http.StatusNoContent);return}
  next.ServeHTTP(w,r)
 })
}
