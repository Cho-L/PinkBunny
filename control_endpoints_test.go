package main

import (
 "bytes"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "testing"
 "time"
)

func TestCommandLifecycleAndAcknowledgement(t *testing.T){
 now:=time.Now()
 s:=&Store{
  tabs:map[int]Tab{7:{Update:Update{TabID:7,Title:"My Song",URL:"https://www.youtube.com/watch?v=abc123",Playing:true},Seen:now,Activated:now}},
  hidden:map[int]bool{},
  listeners:map[chan Status]struct{}{},
 }
 mux:=http.NewServeMux()
 registerPlayerControlEndpoints(mux,s,"AABBCCDD")
 registerDiagnostics(mux,s)
 handler:=secureHandler(mux)
 send:=func(method,path,body,remote,origin,key string)*httptest.ResponseRecorder{
  var b *bytes.Buffer
  if body==""{b=bytes.NewBuffer(nil)}else{b=bytes.NewBufferString(body)}
  req:=httptest.NewRequest(method,"http://192.168.1.21:38765"+path,b)
  req.RemoteAddr=remote
  if origin!=""{req.Header.Set("Origin",origin)}
  if key!=""{req.Header.Set("X-Bunny-Key",key);req.Header.Set("X-Bunny-Extension","1")}
  if method=="POST"&&remote=="127.0.0.1:1234"{req.Header.Set("X-PinkBunny-Action","1")}
  out:=httptest.NewRecorder();handler.ServeHTTP(out,req);return out
 }
 local:="127.0.0.1:1234"
 remote:="192.168.1.55:9001"
 accepted:=send("POST","/api/control",`{"action":"toggle"}`,local,"http://127.0.0.1:38765","")
 if accepted.Code!=202{t.Fatalf("enqueue expected 202: %d %s",accepted.Code,accepted.Body.String())}
 var queued struct{ID string `json:"id"`}
 if json.NewDecoder(accepted.Body).Decode(&queued)!=nil||len(queued.ID)!=24{t.Fatalf("missing command ID: %q",queued.ID)}
 query:="/api/control/result?id="+queued.ID
 initial:=send("GET",query,"",local,"","")
 var start CommandResult
 if initial.Code!=200||json.NewDecoder(initial.Body).Decode(&start)!=nil||start.State!="queued"{t.Fatalf("expected queued: %+v",start)}
 if refused:=send("GET","/api/commands","",remote,"","");refused.Code!=403{t.Fatalf("unpaired extension got %d",refused.Code)}
 delivered:=send("GET","/api/commands","",remote,"","AABBCCDD")
 var delivery struct{Command *PlayerCommand `json:"command"`}
 if delivered.Code!=200||json.NewDecoder(delivered.Body).Decode(&delivery)!=nil||delivery.Command==nil||delivery.Command.ID!=queued.ID {
  t.Fatalf("delivery failed: %d %s",delivered.Code,delivered.Body.String())
 }
 wrong:=send("POST","/api/command-result",`{"id":"`+queued.ID+`","tabId":8,"ok":true}`,remote,"","AABBCCDD")
 if wrong.Code!=409{t.Fatalf("wrong tab ack should be rejected: %d",wrong.Code)}
 unauthorized:=send("POST","/api/command-result",`{"id":"`+queued.ID+`","tabId":7,"ok":true}`,remote,"","BADKEY00")
 if unauthorized.Code!=403{t.Fatalf("unauth ack should be blocked: %d",unauthorized.Code)}
 ack:=send("POST","/api/command-result",`{"id":"`+queued.ID+`","tabId":7,"ok":true}`,remote,"","AABBCCDD")
 if ack.Code!=200{t.Fatalf("valid ack failed: %d %s",ack.Code,ack.Body.String())}
 final:=send("GET",query,"",local,"","")
 var finished CommandResult
 if final.Code!=200||json.NewDecoder(final.Body).Decode(&finished)!=nil||finished.State!="success" {
  t.Fatalf("expected success: %+v",finished)
 }
 duplicate:=send("POST","/api/command-result",`{"id":"`+queued.ID+`","tabId":7,"ok":true}`,remote,"","AABBCCDD")
 if duplicate.Code!=409{t.Fatalf("duplicate ack should be rejected: %d",duplicate.Code)}
 leak:=send("GET",query,"",remote,"","AABBCCDD")
 if leak.Code!=403{t.Fatalf("remote status lookup should be forbidden: %d",leak.Code)}
}

func TestCommandFailureTimeoutAndCleanup(t *testing.T){
 now:=time.Now()
 s:=&Store{}
 command,err:=s.enqueueCommand(4,"next",now)
 if err!=nil{t.Fatal(err)}
 if delivered:=s.nextCommand(now.Add(time.Second));delivered==nil||delivered.ID!=command.ID{t.Fatal("command not delivered")}
 outcome,err:=s.finishCommand(command.ID,4,false,"Playlist transport button not available",now.Add(2*time.Second))
 if err!=nil||outcome.State!="failed"||outcome.Error==""{t.Fatalf("failed result not recorded: %+v %v",outcome,err)}
 timed,err:=s.enqueueCommand(5,"toggle",now)
 if err!=nil{t.Fatal(err)}
 s.sweepCommands(now.Add(16*time.Second))
 if s.commandResults[timed.ID].State!="timeout"{t.Fatal("undelivered command must expire")}
 waited,err:=s.enqueueCommand(6,"toggle",now.Add(20*time.Second))
 if err!=nil{t.Fatal(err)}
 s.nextCommand(now.Add(21*time.Second))
 s.sweepCommands(now.Add(34*time.Second))
 if s.commandResults[waited.ID].State!="timeout"{t.Fatal("delivered command without ack must expire")}
 s.sweepCommands(now.Add(3*time.Minute))
 if len(s.commandResults)!=0{t.Fatalf("old results not cleaned: %+v",s.commandResults)}
}

func TestBroadcastDiagnosticsSeparateObservableAndManualChecks(t *testing.T){
 now:=time.Now()
 s:=&Store{tabs:map[int]Tab{},hidden:map[int]bool{},listeners:map[chan Status]struct{}{}}
 checks:=s.diagnosticChecks(now)
 if len(checks)!=5{t.Fatalf("expected five checks, got %d",len(checks))}
 if checks[0].State!="ok"||checks[1].State!="attention"||checks[2].State!="attention"||checks[3].State!="manual"||checks[4].State!="manual"{
  t.Fatalf("incorrect initial diagnostics: %+v",checks)
 }
 s.tabs[7]=Tab{Update:Update{TabID:7,Title:"Song",Playing:true},Seen:now,Activated:now}
 s.extensionLastSeen=now
 checks=s.diagnosticChecks(now)
 if checks[1].State!="ok"||checks[2].State!="ok"{t.Fatalf("healthy source not recognized: %+v",checks)}
 s.extensionLastSeen=now.Add(-20*time.Second)
 checks=s.diagnosticChecks(now)
 if checks[1].State!="attention"||checks[2].State!="ok"{t.Fatalf("stale extension check inaccurate: %+v",checks)}
 s.tabs[7]=Tab{Update:Update{TabID:7,Title:"Song",Suppressed:true},Seen:now}
 checks=s.diagnosticChecks(now)
 if checks[2].State!="attention"{t.Fatalf("filtered playback incorrectly marked visible: %+v",checks[2])}
}
