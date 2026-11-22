package main

import (
 "testing"
 "time"
)

func TestExtensionHideAndPinSelection(t *testing.T) {
 now:=time.Now()
 s:=&Store{
  tabs:map[int]Tab{
   11:{Update:Update{TabID:11,Title:"Private video",Playing:true},Seen:now,Activated:now},
   12:{Update:Update{TabID:12,Title:"Public music",Playing:true},Seen:now,Activated:now.Add(-time.Second)},
  },
  hidden:map[int]bool{},
  listeners:map[chan Status]struct{}{},
 }
 if got:=s.snapshot().Title;got!="Private video"{t.Fatalf("auto expected newest playing video: %s",got)}
 s.hidden[11]=true
 if got:=s.snapshot().Title;got!="Public music"{t.Fatalf("hidden tab exposed in overlay: %s",got)}
 s.pinnedID=12
 if got:=s.snapshot().Title;got!="Public music"{t.Fatalf("pinned video not displayed: %s",got)}
 delete(s.hidden,11)
 if got:=s.snapshot().Title;got!="Public music"{t.Fatalf("pin not preferred over playing: %s",got)}
 s.pinnedID=11
 if got:=s.snapshot().Title;got!="Private video"{t.Fatalf("pin newly selected tab failed: %s",got)}
 s.hidden[11]=true
 if got:=s.snapshot().Title;got!="Public music"{t.Fatalf("hidden pin must not show: %s",got)}
 s.hidden[12]=true
 if got:=s.snapshot();got.Connected{t.Fatalf("all hidden tabs should show idle, got %+v",got)}
 delete(s.hidden,12)
 delete(s.tabs,12)
 s.pinnedID=0
 if got:=s.snapshot();got.Connected{t.Fatalf("hidden-only status must be idle, got %+v",got)}
}
