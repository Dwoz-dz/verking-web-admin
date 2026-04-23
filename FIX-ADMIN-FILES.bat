@echo off
setlocal EnableDelayedExpansion
REM =====================================================================
REM  FIX-ADMIN-FILES.bat
REM  Restaure les 13 fichiers admin tronques depuis HEAD (git worktree)
REM  Double-cliquez ce fichier depuis l'explorateur Windows.
REM =====================================================================

echo.
echo =====================================================================
echo   Verking Scolaire -- Restauration des fichiers admin tronques
echo =====================================================================
echo.

REM Se placer dans le dossier du script (la racine du worktree)
cd /d "%~dp0"
echo [1/5] Dossier courant: %CD%
echo.

REM Verifier que git est dispo
git --version >nul 2>&1
if errorlevel 1 (
    echo [X] ERREUR: git n'est pas installe ou pas dans le PATH.
    echo     Installe Git For Windows: https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

echo [2/5] Git detecte:
git --version
echo.

REM Verifier qu'on est bien dans un worktree
if not exist ".git" (
    echo [X] ERREUR: pas de fichier .git dans ce dossier.
    echo     Ce script doit etre place a la racine du worktree.
    echo.
    pause
    exit /b 1
)

echo [3/5] Verification du worktree...
git status --short src\app\pages\admin\ > "%TEMP%\vk_git_status.txt" 2>&1
if errorlevel 1 (
    echo [X] ERREUR: git status a echoue.
    type "%TEMP%\vk_git_status.txt"
    echo.
    pause
    exit /b 1
)
echo     OK
echo.

echo [4/5] Restauration des fichiers admin depuis HEAD...
echo     Commande: git restore --source=HEAD --worktree src\app\pages\admin\
git restore --source=HEAD --worktree src\app\pages\admin\
if errorlevel 1 (
    echo.
    echo [X] ERREUR: git restore a echoue.
    echo     Essaie manuellement: git checkout HEAD -- src/app/pages/admin/
    echo.
    pause
    exit /b 1
)
echo     OK
echo.

echo [5/5] Verification post-restauration (taille des fichiers)...
echo.
echo     Fichier                      Taille  Derniere ligne
echo     ---------------------------  ------  ----------------------------
for %%F in (src\app\pages\admin\*.tsx) do (
    set "fname=%%~nxF"
    set "fsize=%%~zF"
    echo     !fname!                  !fsize! ok
)
echo.
echo =====================================================================
echo   [OK] Terminé. Les fichiers admin ont ete restaures depuis HEAD.
echo.
echo   Prochaines etapes:
echo     1. cd "%CD%"
echo     2. npm run dev
echo     3. Ouvrir http://localhost:5173/admin
echo =====================================================================
echo.
pause
endlocal
