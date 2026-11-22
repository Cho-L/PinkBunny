#define MyAppName "Pink Bunny"
#define MyAppVersion "11.2.0"
#define MyAppPublisher "Pink Bunny"
#define MyAppExeName "PinkBunny.exe"

[Setup]
AppId={{D1E40881-ED03-4622-BCDB-57A1CB768E99}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\PinkBunny
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=PinkBunny-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=Pink Bunny
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "바탕화면에 Pink Bunny 바로가기 만들기"; GroupDescription: "추가 옵션:"; Flags: unchecked

[Files]
Source: "..\PinkBunny.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\extension\*"; DestDir: "{app}\extension"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\INSTALL_KO.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\overlay\guide.html"; DestDir: "{app}\guide"; DestName: "index.html"; Flags: ignoreversion
Source: "..\overlay\guide-*.svg"; DestDir: "{app}\guide"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\Pink Bunny"; Filename: "{app}\{#MyAppExeName}"
Name: "{autoprograms}\Pink Bunny 그림 설치 가이드"; Filename: "{app}\guide\index.html"
Name: "{autodesktop}\Pink Bunny"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "설치 완료 후 Pink Bunny 실행"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: dirifempty; Name: "{app}"
