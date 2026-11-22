package main

import (
 "testing"
 "time"
)

func TestSnapshotPinnedTabAndTimeline(t *testing.T) {
 now:=time.Now()
 s:=&Store{tabs:map[int]Tab{
  1:{Update:Update{TabID:1,Title:"First",Playing:true,Position:30,Duration:100,NextTitle:"Next 1",NextChannel:"Channel One"},Seen:now,Activated:now.Add(-time.Second)},
  2:{Update:Update{TabID:2,Title:"Second",Playing:true,Position:42,Duration:80,NextTitle:"Next 2"},Seen:now,Activated:now},
 },listeners:map[chan Status]struct{}{}}
 st:=s.snapshot()
 if st.Title!="Second" || st.Position!=42 || st.Duration!=80 || st.NextTitle!="Next 2" {t.Fatalf("auto selection returned %+v",st)}
 s.pinnedID=1
 st=s.snapshot()
 if st.Title!="First" || st.Position!=30 || st.Duration!=100 || st.NextTitle!="Next 1" || st.NextChannel!="Channel One" {t.Fatalf("pinned selection returned %+v",st)}
 s.pinnedID=0
 st=s.snapshot()
 if st.Title!="Second" {t.Fatalf("automatic selection after unpin: %+v",st)}
}

func TestExpiredTabsAreRemoved(t *testing.T) {
 s:=&Store{tabs:map[int]Tab{
  3:{Update:Update{TabID:3,Title:"Stale",Playing:true},Seen:time.Now().Add(-20*time.Second)},
 },listeners:map[chan Status]struct{}{}}
 st:=s.snapshot()
 if st.Connected || len(s.tabs)!=0 {t.Fatalf("stale media remains: %+v",st)}
}
