@echo off
REM Start the server with increased memory allocation
node --max-old-space-size=8192 server.js