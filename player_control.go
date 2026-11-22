package main

import "time"

// PlayerCommand is consumed by the connected Chrome extension. Commands expire
// if the music PC is offline; no external relay is used.
type PlayerCommand struct {
 TabID int `json:"tabId"`
 Action string `json:"action"`
 Created time.Time `json:"-"`
}
func validPlayerAction(action string)bool{
 switch action{
 case "toggle","previous","next","volumeUp","volumeDown":return true
 default:return false
 }
}
