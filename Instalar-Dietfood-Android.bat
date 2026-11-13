@echo off
setlocal EnableExtensions
title Dietfood - instalar no celular Android
cd /d "%~dp0"

set "APP_ID=com.dietfood.app"
set "ROOT=%~dp0"
set "APK=%ROOT%dist\Dietfood.apk"
if not exist "%ROOT%dist" mkdir "%ROOT%dist"
if not exist "%ROOT%tools" mkdir "%ROOT%tools"

echo ==========================================================
echo   DIETFOOD - gerar e instalar o app no celular Android
echo ==========================================================
echo   Antes de continuar, no celular:
echo     1. Configuracoes - Sobre o telefone - toque 7 vezes em
echo        "Numero da versao" para liberar as Opcoes do desenvolvedor.
echo     2. Opcoes do desenvolvedor - ative "Depuracao USB".
echo        Em Xiaomi/Redmi ative tambem "Instalar via USB".
echo     3. Conecte o celular ao PC com cabo USB de dados e, quando
echo        aparecer "Permitir depuracao USB?", toque em Permitir.
echo ==========================================================
echo.

rem ---------------------------------------------------------------
call :titulo "1/6 Verificando o Node.js"
where node >nul 2>nul
if errorlevel 1 call :instalar_node
where node >nul 2>nul
if errorlevel 1 (
  call :erro "Node.js nao encontrado. Instale a versao LTS em https://nodejs.org e rode este arquivo de novo."
  goto sair_erro
)
for /f "delims=" %%v in ('node -v') do echo   Node.js %%v ... OK

rem ---------------------------------------------------------------
call :titulo "2/6 Instalando as dependencias do projeto"
rem Sempre sincroniza package.json e package-lock.json (o EAS usa o lock na nuvem)
call npm install
if errorlevel 1 (
  call :erro "Falha ao baixar as dependencias - npm install. Verifique a internet e tente de novo."
  goto sair_erro
)
call npx --yes expo install --fix
echo   Dependencias ... OK

rem ---------------------------------------------------------------
call :titulo "3/6 Localizando o ADB - Android Platform Tools"
set "SDK="
if defined ANDROID_HOME if exist "%ANDROID_HOME%\platform-tools\adb.exe" set "SDK=%ANDROID_HOME%"
if not defined SDK if defined ANDROID_SDK_ROOT if exist "%ANDROID_SDK_ROOT%\platform-tools\adb.exe" set "SDK=%ANDROID_SDK_ROOT%"
if not defined SDK if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" set "SDK=%LOCALAPPDATA%\Android\Sdk"
set "ADB="
if defined SDK set "ADB=%SDK%\platform-tools\adb.exe"
if not defined ADB if exist "%ROOT%tools\platform-tools\adb.exe" set "ADB=%ROOT%tools\platform-tools\adb.exe"
if not defined ADB call :baixar_adb
if not defined ADB (
  call :erro "Nao foi possivel obter o ADB. Instale o Android Studio ou o Platform Tools e rode de novo."
  goto sair_erro
)
echo   ADB: %ADB% ... OK

rem ---------------------------------------------------------------
call :titulo "4/6 Procurando o celular conectado"
call :verificar_aparelho
if errorlevel 1 goto sair_erro

rem ---------------------------------------------------------------
call :titulo "5/6 Gerando o APK do Dietfood"
if not exist "%APK%" goto gerar
echo   Ja existe um APK gerado em dist\Dietfood.apk.
choice /c UN /m "  Usar o existente [U] ou gerar um Novo [N]"
if errorlevel 2 goto gerar
goto instalar

:gerar
if exist "%APK%" del /q "%APK%"
call :detectar_build_local
if defined LOCAL_OK call :build_local
if exist "%APK%" goto instalar
if defined LOCAL_OK echo   O build local nao gerou o APK. Tentando pela nuvem da Expo...
call :build_eas
if not exist "%APK%" (
  call :erro "O APK nao foi gerado. Veja as mensagens acima."
  goto sair_erro
)

rem ---------------------------------------------------------------
:instalar
call :titulo "6/6 Instalando no celular"
call :verificar_aparelho
if errorlevel 1 goto sair_erro
echo   Instalando dist\Dietfood.apk em %MODEL% ...
"%ADB%" -s %DEV% install -r "%APK%" > "%TEMP%\dietfood_install.txt" 2>&1
type "%TEMP%\dietfood_install.txt"
findstr /c:"Success" "%TEMP%\dietfood_install.txt" >nul
if errorlevel 1 goto falha_instalar

"%ADB%" -s %DEV% shell monkey -p %APP_ID% -c android.intent.category.LAUNCHER 1 >nul 2>nul
echo.
echo ==========================================================
echo   SUCESSO: o Dietfood foi instalado em %MODEL%
echo   e deve estar abrindo agora. O icone "Dietfood" fica na
echo   lista de apps. Ja pode desconectar o cabo.
echo   Primeira vez: toque em "Carregar meu plano (3500 kcal)".
echo ==========================================================
pause
exit /b 0

:falha_instalar
echo.
findstr /c:"INSTALL_FAILED_UPDATE_INCOMPATIBLE" "%TEMP%\dietfood_install.txt" >nul
if not errorlevel 1 goto assinatura_diferente
findstr /c:"INSTALL_FAILED_USER_RESTRICTED" "%TEMP%\dietfood_install.txt" >nul
if not errorlevel 1 (
  call :erro "O celular bloqueou a instalacao. Ative Instalar via USB nas Opcoes do desenvolvedor e aceite o aviso na tela do celular."
  goto sair_erro
)
call :erro "A instalacao falhou. A mensagem do Android esta acima."
goto sair_erro

:assinatura_diferente
echo   Ja existe um Dietfood instalado com outra assinatura.
echo   Para instalar esta versao e preciso desinstalar a anterior,
echo   o que APAGA os dados dela. Antes, no app antigo, use
echo   Ajustes - Exportar para guardar uma copia de seguranca.
choice /c DC /m "  Desinstalar e instalar [D] ou Cancelar [C]"
if errorlevel 2 goto sair_erro
"%ADB%" -s %DEV% uninstall %APP_ID%
goto instalar

rem ===============================================================
rem Sub-rotinas
rem ===============================================================

:titulo
echo.
echo [%~1]
exit /b 0

:erro
echo.
echo   ERRO: %~1
exit /b 0

:sair_erro
echo.
echo   Nada foi instalado. Corrija o problema indicado e rode este arquivo de novo.
pause
exit /b 1

:instalar_node
echo   Node.js nao encontrado. Instalando pelo winget...
where winget >nul 2>nul
if errorlevel 1 exit /b 0
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
set "PATH=%PATH%;%ProgramFiles%\nodejs"
exit /b 0

:baixar_adb
echo   ADB nao encontrado. Baixando o Android Platform Tools do site do Google...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -Uri 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip' -OutFile '%ROOT%tools\platform-tools.zip'; Expand-Archive -Force '%ROOT%tools\platform-tools.zip' '%ROOT%tools'"
if exist "%ROOT%tools\platform-tools\adb.exe" set "ADB=%ROOT%tools\platform-tools\adb.exe"
exit /b 0

:verificar_aparelho
"%ADB%" start-server >nul 2>nul
set "DEV="
set "UNAUTH="
set "COUNT=0"
for /f "skip=1 tokens=1,2" %%a in ('"%ADB%" devices') do call :registrar_aparelho %%a %%b
if defined DEV goto aparelho_ok
echo.
if defined UNAUTH (
  echo   Celular encontrado, mas a depuracao USB ainda nao foi autorizada.
  echo   Desbloqueie o celular e toque em Permitir no aviso "Permitir depuracao USB?".
) else (
  echo   Nenhum celular encontrado. Confira:
  echo     - cabo USB de dados, nao apenas de carga;
  echo     - Depuracao USB ativada nas Opcoes do desenvolvedor;
  echo     - no aviso de USB do celular, escolha "Transferencia de arquivos".
)
choice /c TS /m "  Tentar de novo [T] ou Sair [S]"
if errorlevel 2 exit /b 1
goto verificar_aparelho

:registrar_aparelho
if "%~2"=="device" (
  set /a COUNT+=1
  if not defined DEV set "DEV=%~1"
)
if "%~2"=="unauthorized" set "UNAUTH=%~1"
exit /b 0

:aparelho_ok
set "MODEL=%DEV%"
for /f "delims=" %%m in ('"%ADB%" -s %DEV% shell getprop ro.product.model') do set "MODEL=%%m"
for /f "delims=" %%r in ('"%ADB%" -s %DEV% shell getprop ro.build.version.release') do set "ANDROID_VER=%%r"
echo   Celular conectado: %MODEL% - Android %ANDROID_VER% - serie %DEV% ... OK
if %COUNT% GTR 1 echo   Atencao: ha %COUNT% aparelhos conectados; sera usado %DEV%.
exit /b 0

:detectar_build_local
set "LOCAL_OK="
set "JDK="
if not defined SDK exit /b 0
if not exist "%SDK%\build-tools" exit /b 0
if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" set "JDK=%ProgramFiles%\Android\Android Studio\jbr"
if not defined JDK if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" set "JDK=%JAVA_HOME%"
if not defined JDK exit /b 0
set "LOCAL_OK=1"
exit /b 0

:build_local
echo   Android SDK encontrado: %SDK%
echo   Java: %JDK%
echo   Gerando o APK neste computador. A primeira vez pode levar de 10 a 30 minutos.
set "ANDROID_HOME=%SDK%"
set "JAVA_HOME=%JDK%"
set "CI=1"
call npx --yes expo prebuild --platform android --no-install
set "CI="
if errorlevel 1 exit /b 0
pushd "%ROOT%android"
call gradlew.bat assembleRelease
set "RC=%errorlevel%"
popd
if not "%RC%"=="0" exit /b 0
if exist "%ROOT%android\app\build\outputs\apk\release\app-release.apk" copy /y "%ROOT%android\app\build\outputs\apk\release\app-release.apk" "%APK%" >nul
exit /b 0

:build_eas
echo.
echo   O APK sera gerado na nuvem da Expo - gratis, precisa de uma conta
echo   em https://expo.dev. O e-mail e a senha sao digitados por voce.
echo   Se o EAS perguntar sobre criar projeto ou keystore, responda Y.
call npx --yes eas-cli@latest whoami >nul 2>nul
if errorlevel 1 call npx --yes eas-cli@latest login
call npx --yes eas-cli@latest whoami >nul 2>nul
if errorlevel 1 (
  call :erro "Nao foi possivel entrar na conta Expo."
  exit /b 0
)
call npx --yes eas-cli@latest init
rem Sem Git instalado: o EAS envia a pasta usando o .easignore
set "EAS_NO_VCS=1"
call npx --yes eas-cli@latest build -p android --profile preview --wait
if errorlevel 1 exit /b 0
call npx --yes eas-cli@latest build:list --platform android --status finished --limit 1 --json --non-interactive > "%ROOT%dist\build.json"
echo   Baixando o APK gerado...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $b = Get-Content -Raw '%ROOT%dist\build.json' | ConvertFrom-Json; $u = @($b)[0].artifacts.buildUrl; if (-not $u) { throw 'URL do APK nao encontrada' }; Invoke-WebRequest -Uri $u -OutFile '%APK%'"
exit /b 0
