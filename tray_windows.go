//go:build windows

package main

import (
    "log"
    "os"
    "runtime"
    "syscall"
    "unsafe"
)

const (
    pbWMApp = 0x8001
    pbWMCommand = 0x0111
    pbWMClose = 0x0010
    pbWMDestroy = 0x0002
    pbWMNull = 0x0000
    pbWMContextMenu = 0x007B
    pbWMRButtonUp = 0x0205
    pbWMLButtonDoubleClick = 0x0203
    pbNIMAdd = 0
    pbNIMDelete = 2
    pbNIFMessage = 1
    pbNIFIcon = 2
    pbNIFTip = 4
    pbMFString = 0
    pbMFSeparator = 0x0800
    pbTPMRightButton = 0x0002
    pbTPMLeftAlign = 0x0000
    pbIDSettings = 1001
    pbIDPreview = 1002
    pbIDQuit = 1003
)

type pbPoint struct {X int32; Y int32}
type pbMSG struct {Hwnd uintptr; Message uint32; WParam uintptr; LParam uintptr; Time uint32; Pt pbPoint; Private uint32}
type pbWNDCLASSEX struct {
    Size uint32
    Style uint32
    WndProc uintptr
    ClsExtra int32
    WndExtra int32
    Instance uintptr
    Icon uintptr
    Cursor uintptr
    Background uintptr
    MenuName *uint16
    ClassName *uint16
    SmallIcon uintptr
}
type pbNOTIFYICONDATA struct {
    Size uint32
    Hwnd uintptr
    ID uint32
    Flags uint32
    Callback uint32
    Icon uintptr
    Tip [128]uint16
    State uint32
    StateMask uint32
    Info [256]uint16
    Timeout uint32
    InfoTitle [64]uint16
    InfoFlags uint32
    GUID [16]byte
    BalloonIcon uintptr
}

var pbUser32 = syscall.NewLazyDLL("user32.dll")
var pbShell32 = syscall.NewLazyDLL("shell32.dll")
var pbKernel32 = syscall.NewLazyDLL("kernel32.dll")
var pbRegisterClass = pbUser32.NewProc("RegisterClassExW")
var pbCreateWindow = pbUser32.NewProc("CreateWindowExW")
var pbDefWindowProc = pbUser32.NewProc("DefWindowProcW")
var pbDestroyWindow = pbUser32.NewProc("DestroyWindow")
var pbGetMessage = pbUser32.NewProc("GetMessageW")
var pbTranslateMessage = pbUser32.NewProc("TranslateMessage")
var pbDispatchMessage = pbUser32.NewProc("DispatchMessageW")
var pbPostQuit = pbUser32.NewProc("PostQuitMessage")
var pbCreatePopup = pbUser32.NewProc("CreatePopupMenu")
var pbAppendMenu = pbUser32.NewProc("AppendMenuW")
var pbDestroyMenu = pbUser32.NewProc("DestroyMenu")
var pbSetForeground = pbUser32.NewProc("SetForegroundWindow")
var pbTrackPopup = pbUser32.NewProc("TrackPopupMenu")
var pbGetCursorPos = pbUser32.NewProc("GetCursorPos")
var pbPostMessage = pbUser32.NewProc("PostMessageW")
var pbLoadIcon = pbUser32.NewProc("LoadIconW")
var pbGetModule = pbKernel32.NewProc("GetModuleHandleW")
var pbNotifyIcon = pbShell32.NewProc("Shell_NotifyIconW")

func pbUTF16(s string) *uint16 {return syscall.StringToUTF16Ptr(s)}

func pbMenu(hwnd uintptr) {
    menu, _, _ := pbCreatePopup.Call()
    if menu == 0 {return}
    defer pbDestroyMenu.Call(menu)
    pbAppendMenu.Call(menu, pbMFString, pbIDSettings, uintptr(unsafe.Pointer(pbUTF16("Pink Bunny 설정 열기"))))
    pbAppendMenu.Call(menu, pbMFString, pbIDPreview, uintptr(unsafe.Pointer(pbUTF16("OBS 플레이어 미리보기"))))
    pbAppendMenu.Call(menu, pbMFSeparator, 0, 0)
    pbAppendMenu.Call(menu, pbMFString, pbIDQuit, uintptr(unsafe.Pointer(pbUTF16("Pink Bunny 종료"))))
    var point pbPoint
    if ok, _, _ := pbGetCursorPos.Call(uintptr(unsafe.Pointer(&point))); ok == 0 {return}
    pbSetForeground.Call(hwnd)
    pbTrackPopup.Call(menu, pbTPMRightButton|pbTPMLeftAlign, uintptr(point.X), uintptr(point.Y), 0, hwnd, 0)
    pbPostMessage.Call(hwnd, pbWMNull, 0, 0)
}

func pbWindowProc(hwnd uintptr, msg uint32, wparam, lparam uintptr) uintptr {
    switch msg {
    case pbWMApp:
        switch uint32(lparam) {
        case pbWMRButtonUp, pbWMContextMenu: pbMenu(hwnd)
        case pbWMLButtonDoubleClick: openBrowser("http://127.0.0.1:38765/setup")
        }
        return 0
    case pbWMCommand:
        switch uint32(wparam & 0xffff) {
        case pbIDSettings: openBrowser("http://127.0.0.1:38765/setup")
        case pbIDPreview: openBrowser("http://127.0.0.1:38765/?demo")
        case pbIDQuit: pbDestroyWindow.Call(hwnd)
        }
        return 0
    case pbWMClose:
        pbDestroyWindow.Call(hwnd)
        return 0
    case pbWMDestroy:
        pbPostQuit.Call(0)
        return 0
    }
    result, _, _ := pbDefWindowProc.Call(hwnd, uintptr(msg), wparam, lparam)
    return result
}

func runTray() {
    go pbTrayLoop()
}

func pbTrayLoop() {
    runtime.LockOSThread()
    defer runtime.UnlockOSThread()
    module, _, _ := pbGetModule.Call(0)
    callback := syscall.NewCallback(pbWindowProc)
    className := pbUTF16("PinkBunnyNotificationWindow")
    cls := pbWNDCLASSEX{Size: uint32(unsafe.Sizeof(pbWNDCLASSEX{})), WndProc: callback, Instance: module, ClassName: className}
    if atom, _, err := pbRegisterClass.Call(uintptr(unsafe.Pointer(&cls))); atom == 0 {
        log.Printf("Pink Bunny tray registration error: %v", err)
        return
    }
    hwnd, _, err := pbCreateWindow.Call(
        0, uintptr(unsafe.Pointer(className)), uintptr(unsafe.Pointer(pbUTF16("Pink Bunny"))),
        0, 0, 0, 0, 0, 0, 0, module, 0,
    )
    if hwnd == 0 {
        log.Printf("Pink Bunny tray window error: %v", err)
        return
    }
    icon, _, _ := pbLoadIcon.Call(0, 32512) // IDI_APPLICATION
    data := pbNOTIFYICONDATA{Size:uint32(unsafe.Sizeof(pbNOTIFYICONDATA{})), Hwnd:hwnd, ID:1, Flags:pbNIFMessage|pbNIFIcon|pbNIFTip, Callback:pbWMApp, Icon:icon}
    copy(data.Tip[:], syscall.StringToUTF16("Pink Bunny · YouTube Now Playing"))
    if ok, _, err := pbNotifyIcon.Call(pbNIMAdd, uintptr(unsafe.Pointer(&data))); ok == 0 {
        log.Printf("Pink Bunny tray icon error: %v", err)
        pbDestroyWindow.Call(hwnd)
        return
    }
    var msg pbMSG
    for {
        status, _, _ := pbGetMessage.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
        if int32(status) <= 0 {break}
        pbTranslateMessage.Call(uintptr(unsafe.Pointer(&msg))
        pbDispatchMessage.Call(uintptr(unsafe.Pointer(&msg))
    }
    pbNotifyIcon.Call(pbNIMDelete, uintptr(unsafe.Pointer(&data)))
    runtime.KeepAlive(callback)
    os.Exit(0)
}
