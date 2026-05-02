@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d C:\Users\havuc\.gemini\antigravity\scratch\iptv-player

set "NVM_EXE=%LOCALAPPDATA%\nvm\nvm.exe"

echo.
echo ==========================================
echo FONEX webOS DEPLOY BASLIYOR
echo ==========================================

if not exist "%NVM_EXE%" (
    echo [HATA] nvm.exe bulunamadi: %NVM_EXE%
    pause
    exit /b 1
)

echo.
echo [1/7] Build icin Node 22 aktif ediliyor...
call "%NVM_EXE%" use 22.11.0
if errorlevel 1 (
    echo [HATA] Node 22 aktif edilemedi.
    pause
    exit /b 1
)

echo.
echo [2/7] npm yolu bulunuyor...
for /f "delims=" %%A in ('where npm.cmd 2^>nul') do (
    set "NPM_CMD=%%A"
    goto :npm_found
)

:npm_missing
echo [HATA] npm.cmd bulunamadi.
echo CMD'de sunu kontrol et:
echo where npm
pause
exit /b 1

:npm_found
echo [OK] npm: !NPM_CMD!

echo.
echo [3/7] webOS build aliniyor...
call "!NPM_CMD!" run build:webos
if errorlevel 1 (
    echo [HATA] build:webos basarisiz.
    pause
    exit /b 1
)

echo.
echo [4/7] Inline kontrolu yapiliyor...

findstr /i "assets/main.js" dist\index.html >nul
if not errorlevel 1 (
    echo [HATA] dist\index.html hala assets/main.js referans ediyor.
    pause
    exit /b 1
)

findstr /i "assets/main.css" dist\index.html >nul
if not errorlevel 1 (
    echo [HATA] dist\index.html hala assets/main.css referans ediyor.
    pause
    exit /b 1
)

findstr /i "assets/style.css" dist\index.html >nul
if not errorlevel 1 (
    echo [HATA] dist\index.html hala assets/style.css referans ediyor.
    pause
    exit /b 1
)

echo [OK] JS/CSS inline gorunuyor.

echo.
echo [5/7] webOS CLI icin Node 16 aktif ediliyor...
call "%NVM_EXE%" use 16.20.2
if errorlevel 1 (
    echo [HATA] Node 16 aktif edilemedi.
    pause
    exit /b 1
)

echo.
echo [6/7] ares komutlari bulunuyor...
for /f "delims=" %%A in ('where ares.cmd 2^>nul') do (
    set "ARES_CMD=%%A"
    goto :ares_found
)

:ares_missing
echo [HATA] ares.cmd bulunamadi.
echo Node 16 aktifken sunu calistir:
echo npm install -g @webos-tools/cli
pause
exit /b 1

:ares_found
echo [OK] ares: !ARES_CMD!

for /f "delims=" %%A in ('where ares-package.cmd 2^>nul') do (
    set "ARES_PACKAGE_CMD=%%A"
    goto :ares_package_found
)

echo [HATA] ares-package.cmd bulunamadi.
pause
exit /b 1

:ares_package_found
echo [OK] ares-package: !ARES_PACKAGE_CMD!

for /f "delims=" %%A in ('where ares-install.cmd 2^>nul') do (
    set "ARES_INSTALL_CMD=%%A"
    goto :ares_install_found
)

echo [HATA] ares-install.cmd bulunamadi.
pause
exit /b 1

:ares_install_found
echo [OK] ares-install: !ARES_INSTALL_CMD!

for /f "delims=" %%A in ('where ares-launch.cmd 2^>nul') do (
    set "ARES_LAUNCH_CMD=%%A"
    goto :ares_launch_found
)

echo [HATA] ares-launch.cmd bulunamadi.
pause
exit /b 1

:ares_launch_found
echo [OK] ares-launch: !ARES_LAUNCH_CMD!

call "!ARES_CMD!" -V
if errorlevel 1 (
    echo [HATA] ares calismadi.
    pause
    exit /b 1
)

echo.
echo [7/7] IPK paketleniyor...
if not exist packages mkdir packages

call "!ARES_PACKAGE_CMD!" dist -o ./packages
if errorlevel 1 (
    echo [HATA] ares-package basarisiz.
    pause
    exit /b 1
)

echo.
echo [8/9] Emulator'a kurulum yapiliyor...
call "!ARES_INSTALL_CMD!" --device emulator packages\com.fonex.iptv.player_2.5.0_all.ipk
if errorlevel 1 (
    echo [HATA] ares-install basarisiz.
    echo Emulator acik mi kontrol et:
    echo ares-device -i --device emulator
    pause
    exit /b 1
)

echo.
echo [9/9] Uygulama baslatiliyor...
call "!ARES_LAUNCH_CMD!" --device emulator com.fonex.iptv.player
if errorlevel 1 (
    echo [HATA] ares-launch basarisiz.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo FONEX webOS DEPLOY TAMAMLANDI
echo ==========================================
echo.
echo Inspect icin:
echo ares-inspect --device emulator com.fonex.iptv.player
echo.

pause
endlocal