package main

import (
 "crypto/rand"
 "encoding/hex"
 "errors"
 "time"
)

// A command is queued on the streaming PC and delivered only once. The music
// PC reports the content script's execution result using its pairing token.
type PlayerCommand struct {
 ID string `json:"id"`
 TabID int `json:"tabId"`
 Action string `json:"action"`
 Created time.Time `json:"-"`
}

type CommandResult struct {
 ID string `json:"id"`
 TabID int `json:"tabId"`
 Action string `json:"action"`
 State string `json:"state"` // queued, delivered, success, failed, timeout
 Error string `json:"error,omitempty"`
 Created time.Time `json:"-"`
 Updated time.Time `json:"-"`
}

func validPlayerAction(action string) bool {
 switch action {
 case "toggle","previous","next","volumeUp","volumeDown":return true
 }
 return false
}

func newCommandID()(string,error){
 b:=make([]byte,12)
 if _,err:=rand.Read(b);err!=nil{return "",err}
 return hex.EncodeToString(b),nil
}

func (s *Store) ensureCommandResults(){
 if s.commandResults==nil{s.commandResults=make(map[string]CommandResult)}
}
func (s *Store) sweepCommands(now time.Time) {
 s.ensureCommandResults()
 queue:=s.commands[:0]
 for _,cmd:=range s.commands {
  if now.Sub(cmd.Created)>15*time.Second {
   if result,ok:=s.commandResults[cmd.ID];ok&&result.State=="queued" {
    result.State="timeout";result.Error="음악 PC가 명령을 가져가지 않았습니다."
    result.Updated=now;s.commandResults[cmd.ID]=result
   }
  }else{queue=append(queue,cmd)}
 }
 s.commands=queue
 for id,result:=range s.commandResults {
  if result.State=="delivered"&&now.Sub(result.Updated)>12*time.Second{
   result.State="timeout"
   result.Error="음악 PC에서 실행 결과가 돌아오지 않았습니다."
   result.Updated=now;s.commandResults[id]=result
  }
  if now.Sub(result.Created)>2*time.Minute{delete(s.commandResults,id)}
 }
}
func (s *Store) enqueueCommand(tabID int,action string,now time.Time)(PlayerCommand,error){
 s.sweepCommands(now)
 if len(s.commands)>=10{return PlayerCommand{},errors.New("too many pending commands")}
 id,err:=newCommandID();if err!=nil{return PlayerCommand{},err}
 for _,exists:=s.commandResults[id];exists;_,exists=s.commandResults[id]{id,err=newCommandID();if err!=nil{return PlayerCommand{},err}}
 cmd:=PlayerCommand{ID:id,TabID:tabID,Action:action,Created:now}
 s.commands=append(s.commands,cmd)
 s.commandResults[id]=CommandResult{ID:id,TabID:tabID,Action:action,State:"queued",Created:now,Updated:now}
 return cmd,nil
}
func (s *Store) nextCommand(now time.Time)*PlayerCommand{
 s.sweepCommands(now)
 if len(s.commands)==0{return nil}
 cmd:=s.commands[0]
 s.commands=s.commands[1:]
 if result,ok:=s.commandResults[cmd.ID];ok{
  result.State="delivered";result.Updated=now;s.commandResults[cmd.ID]=result
 }
 return &cmd
}
func (s *Store) finishCommand(id string,tabID int,ok bool,detail string,now time.Time) (CommandResult,error) {
 s.sweepCommands(now)
 result,found:=s.commandResults[id]
 if !found||result.TabID!=tabID{return CommandResult{},errors.New("command not found or tab mismatch")}
 if result.State!="delivered"{return CommandResult{},errors.New("command is not awaiting acknowledgement")}
 if ok{result.State="success";result.Error=""}else{
  result.State="failed"
  result.Error=clip(detail,160)
  if result.Error==""{result.Error="유튜브에서 명령을 실행하지 못했습니다."}
 }
 result.Updated=now;s.commandResults[id]=result
 return result,nil
}
