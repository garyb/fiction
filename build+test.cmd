@echo off

copy src\js\*.js bin\*.js /Y

node src/js/main.js src/fic/reader.fic bin/reader.js
IF %ERRORLEVEL% NEQ 0 GOTO readerrerror

node src/js/main.js test/test-reader.fic bin/test-reader.js
IF %ERRORLEVEL% NEQ 0 GOTO testerror

node src/js/test.js bin/test-reader.js
GOTO end

:compilerreader
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