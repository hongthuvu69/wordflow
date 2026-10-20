@echo off
rem Build WordFlow (Release) bang MSVC 2022 + Qt 6.10.2, roi copy cac DLL Qt can thiet.
setlocal
set QTDIR=C:\Qt\6.10.2\msvc2022_64
set PATH=C:\Qt\Tools\CMake_64\bin;C:\Qt\Tools\Ninja;%QTDIR%\bin;%PATH%

call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul || exit /b 1

cd /d "%~dp0"
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_PREFIX_PATH=%QTDIR% || exit /b 1
cmake --build build || exit /b 1

windeployqt --release --qmldir qml --no-translations build\WordFlow.exe >nul || exit /b 1

rem Dong bo noi dung hoc sang web app (docs/content) cho iPhone
powershell -NoProfile -ExecutionPolicy Bypass -File tools\sync_web_content.ps1 || exit /b 1
echo.
echo Build OK: %~dp0build\WordFlow.exe
