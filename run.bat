@echo off
start "Backend" py main.py
start "Frontend" cmd /k "cd /d frontend && npm run dev"