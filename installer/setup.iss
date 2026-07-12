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

[Registry]
Root: HKCU; Subkey: "Software\Classes\gunlukvlc"; ValueType: string; ValueName: ""; ValueData: "URL:Gunluk VLC Protocol"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\gunlukvlc"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\gunlukvlc\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\play_vlc.bat"" ""%1"""

[Icons]
Name: "{group}\Kaldir Gunluk VLC"; Filename: "{uninstallexe}"
