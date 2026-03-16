@echo off
title LekhaFlow Dev Server
echo Starting LekhaFlow...
cd /d "%~dp0canvas"
call pnpm run dev
pause
