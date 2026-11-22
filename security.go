package main

import (
 "net"
 "net/http"
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
 case "/api/update","/api/remove","/api/tabs","/api/select","/api/visibility","/api/commands":
  return true
 }
 return false
}

func permittedClient(r *http.Request)bool {
 if !validServerHost(r.Host){return false}
 if isLocal(r){return true}
 return remoteExtensionEndpoint(r.URL.Path)&&extensionOrigin(r)
}
