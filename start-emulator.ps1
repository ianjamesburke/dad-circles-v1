$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.9.10-hotspot"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
Write-Host "Starting Firebase emulator with Java 21..."
java -version
firebase emulators:start --only firestore