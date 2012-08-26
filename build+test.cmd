@echo off

copy src\js\*.js bin\*.js /Y

node src/js/main.js src/fic/reader.fic bin/reader.js
IF %ERRORLEVEL% NEQ 0 GOTO readerrerror

node src/js/main.js test/test-all.fic bin/test-all.js
IF %ERRORLEVEL% NEQ 0 GOTO testerror

node src/js/test.js bin/test-all.js
GOTO end

:readerrerror
echo.
echo Error compiling reader
echo.
GOTO end

:testerror
echo.
echo Error compiling tests
echo.
GOTO end

:end