@echo off
setlocal enabledelayedexpansion
title Gunluk Merkezi VLC Oynatici

echo ==============================================
echo Gunluk Merkezi - VLC YouTube Oynatici
echo Lutfen bekleyin, video hazirlaniyor...
echo ==============================================

set "INPUT_URL=%~1"
if "%INPUT_URL%"=="" (
    echo Hata: Video baglantisi bulunamadi.
    pause
    exit /b
)

:: Remove gunlukvlc:// prefix and trailing slashes
set "VIDEO_ID=%INPUT_URL:gunlukvlc://=%"
set "VIDEO_ID=%VIDEO_ID:/=%"

echo Video ID: %VIDEO_ID%
echo Youtube'dan dogrudan yayin adresi cekiliyor...
echo (Bu islem birkac saniye surebilir)

:: Locate VLC
set "VLC_PATH="
if exist "C:\Program Files\VideoLAN\VLC\vlc.exe" (
    set "VLC_PATH=C:\Program Files\VideoLAN\VLC\vlc.exe"
) else if exist "C:\Program Files (x86)\VideoLAN\VLC\vlc.exe" (
    set "VLC_PATH=C:\Program Files (x86)\VideoLAN\VLC\vlc.exe"
)

if "%VLC_PATH%"=="" (
    echo.
    echo HATA: VLC Player bilgisayarinizda bulunamadi!
    echo Lutfen videolan.org adresinden VLC'yi indirip kurun.
    pause
    exit /b
)

:: Get direct URL using yt-dlp
set "STREAM_URL="
for /f "tokens=*" %%a in ('"%~dp0yt-dlp.exe" -g -f "best" --no-warnings "https://www.youtube.com/watch?v=%VIDEO_ID%"') do (
    set "STREAM_URL=%%a"
)

if "%STREAM_URL%"=="" (
    echo.
    echo HATA: Video adresi cekilemedi. 
    echo Video kaldirilmis, gizli veya yas kisitlamali olabilir.
    pause
    exit /b
)

echo.
echo Yayin bulundu, VLC aciliyor...
start "" "%VLC_PATH%" "%STREAM_URL%"
exit /b
