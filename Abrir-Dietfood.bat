@echo off
chcp 65001 >nul
title Dietfood
cd /d "%~dp0"
echo ==============================================
echo   Dietfood - preparando o app para o celular
echo ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [1/4] Node.js nao encontrado. Instalando Node.js LTS pelo winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  set "PATH=%PATH%;%ProgramFiles%\nodejs"
  where node >nul 2>nul
  if errorlevel 1 (
    echo.
    echo Nao foi possivel instalar o Node.js automaticamente.
    echo Instale pelo site https://nodejs.org (versao LTS^) e rode este arquivo de novo.
    pause
    exit /b 1
  )
) else (
  echo [1/4] Node.js encontrado.
)
node -v

echo.
echo [2/4] Baixando as dependencias (pode levar alguns minutos)...
call npm install
if errorlevel 1 goto erro

echo.
echo [3/4] Ajustando para a versao do Expo Go da Play Store...
call npx --yes expo install expo@latest
if errorlevel 1 goto erro
call npx --yes expo install --fix
if errorlevel 1 goto erro

echo.
echo [4/4] Iniciando o Dietfood. Abra o app Expo Go no celular e leia o QR code abaixo.
echo       (computador e celular no mesmo Wi-Fi; para parar, feche esta janela)
echo.
call npx expo start
goto fim

:erro
echo.
echo Algo deu errado na etapa acima. Copie a mensagem de erro e envie para o Claude.
pause
exit /b 1

:fim
pause
