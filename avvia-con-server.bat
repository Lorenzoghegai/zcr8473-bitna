@echo off
rem Avvia il server locale per sviluppo e test (richiede Python 3).
cd /d "%~dp0"
python tools\serve.py --open
if errorlevel 1 py tools\serve.py --open
pause
