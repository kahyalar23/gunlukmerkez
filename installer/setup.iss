[Setup]
AppName=Gunluk Merkezi VLC Entegrasyonu
AppVersion=1.0
DefaultDirName={localappdata}\GunlukMerkezVLC
DisableDirPage=yes
DefaultGroupName=Gunluk Merkezi
DisableProgramGroupPage=yes
OutputBaseFilename=GunlukVLC-Setup
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest

[Files]
Source: "yt-dlp.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "play_vlc.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "vlc-installer.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall ignoreversion

[Run]
Filename: "{tmp}\vlc-installer.exe"; Parameters: "/S"; Check: VlcNotInstalled; Flags: waituntilterminated shellexec; StatusMsg: "VLC Player Eksik - Kuruluyor (UAC onayi istenebilir)..."

[Registry]
Root: HKCU; Subkey: "Software\Classes\gunlukvlc"; ValueType: string; ValueName: ""; ValueData: "URL:Gunluk VLC Protocol"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\gunlukvlc"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\gunlukvlc\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\play_vlc.bat"" ""%1"""

[Icons]
Name: "{group}\Kaldir Gunluk VLC"; Filename: "{uninstallexe}"

[Code]
function VlcNotInstalled: Boolean;
begin
  Result := not FileExists(ExpandConstant('{commonpf}\VideoLAN\VLC\vlc.exe')) and not FileExists(ExpandConstant('{commonpf32}\VideoLAN\VLC\vlc.exe')) and not FileExists(ExpandConstant('{localappdata}\Programs\VideoLAN\VLC\vlc.exe'));
end;
