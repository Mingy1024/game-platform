@echo off
rem Run JS with the Windows Node (node_modules are Windows builds).
rem Set GAME_NODE_DIR to override the Node folder.
if "%GAME_NODE_DIR%"=="" set "GAME_NODE_DIR=C:\Users\user\AppData\Local\Author Software\nvm\installs\v26.13.1"
set "PATH=%GAME_NODE_DIR%;%PATH%"
node.exe %*
