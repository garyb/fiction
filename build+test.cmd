@echo off

copy src\js\*.js bin\*.js /Y

echo Compiling reader...
node src/js/main.js src/fic/reader.fic bin/reader.js
IF %ERRORLEVEL% NEQ 0 GOTO error

echo Compiling expander...
node src/js/main.js src/fic/expander.fic bin/expander.js
IF %ERRORLEVEL% NEQ 0 GOTO error

echo Compiling tests...
node src/js/main.js test/test-all.fic bin/test-all.js
IF %ERRORLEVEL% NEQ 0 GOTO error

node src/js/test.js bin/test-all.js
GOTO end

:error
echo.
echo Error compiling
echo.
GOTO end

:end