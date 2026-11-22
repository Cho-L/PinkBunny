package main

import (
 "testing"
 "time"
)

func TestSmartFiltersOnlyRemoveSuppressedFromOverlay(t *testing.T){
 now:=time.Now()
 s:=&Store{tabs:map[int]Tab{
  1:{Update:Update{TabID:1,Title:"Ad",Playing:true,Suppressed:true},Seen:now,Activated:now},
  2:{Update:Update{TabID:2,Title:"Music",Playing:true},Seen:now,Activated:now.Add(-time.Second)},
 },hidden:map[int]bool{},listeners:map[chan Status]struct{}{}}
 st:=s.snapshot()
 if !st.Connected||st.Title!="Music"{t.Fatalf("smart filter selected wrong track: %+v",st)}
 s.pinnedID=1
 st=s.snapshot()
 if st.Title!="Music"{t.Fatalf("pinned suppressed content leaked into overlay: %+v",st)}
 delete(s.tabs,2)
 st=s.snapshot()
 if st.Connected{t.Fatalf("all filtered content must show idle: %+v",st)}
}

func TestRemotePlayerActionAllowlist(t *testing.T){
 for _,action:=range []string{"toggle","next","previous","volumeUp","volumeDown"}{
  if !validPlayerAction(action){t.Fatalf("expected action allowed: %s",action)}
 }
 for _,action:=range []string{"","navigate","openUrl","delete","seek","quit","../../etc"}{
  if validPlayerAction(action){t.Fatalf("unexpected command allowed: %s",action)}
 }
}
