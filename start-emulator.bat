@echo off
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.9.10-hotspot
set PATH=%JAVA_HOME%\bin;%PATH%
echo Starting Firebase emulator with Java 21...
java -version
firebase emulators:start --only firestore