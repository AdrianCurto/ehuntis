# Script para compilar y ejecutar la suite completa de tests de Android (Kotlin)
# Utiliza el compilador kotlinc y la JVM provistos por Android Studio para evitar el bloqueo del Gradle daemon.

$ErrorActionPreference = "Stop"

$javaHome = "C:\Program Files\Android\Android Studio\jbr"
$kotlinc = "C:\Program Files\Android\Android Studio\plugins\Kotlin\kotlinc\bin\kotlinc.bat"
$java = "$javaHome\bin\java.exe"
$kotlincLib = "C:\Program Files\Android\Android Studio\plugins\Kotlin\kotlinc\lib"

if (!(Test-Path $kotlinc) -or !(Test-Path $java)) {
    Write-Error "No se encontro kotlinc o java en Android Studio."
}

$env:JAVA_HOME = $javaHome
$env:PATH = "$javaHome\bin;$env:PATH"

$outDir = "android\app\build\test-classes"
if (!(Test-Path $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

$cp = "C:\Program Files\Android\Android Studio\lib\junit4.jar;C:\Program Files\Android\Android Studio\lib\intellij.libraries.kotlinx.serialization.core.jar;C:\Program Files\Android\Android Studio\lib\intellij.libraries.kotlinx.serialization.json.jar;C:\Program Files\Android\Android Studio\plugins\junit\lib\junit.jar"

Write-Host "Compilando tests de Android en Kotlin..." -ForegroundColor Cyan

& $kotlinc -cp $cp -d $outDir `
  android\app\src\main\java\com\ehuntis\widget\data\Models.kt `
  android\app\src\main\java\com\ehuntis\widget\data\DayLogic.kt `
  android\app\src\main\java\com\ehuntis\widget\data\CustomEventsLogic.kt `
  android\app\src\test\java\com\ehuntis\widget\CustomEventsLogicTest.kt `
  android\app\src\test\java\com\ehuntis\widget\ExtendedCustomEventsLogicTest.kt

if ($LASTEXITCODE -ne 0) {
    Write-Error "Fallo en la compilacion de tests de Android."
}

Write-Host "Ejecutando CustomEventsLogicTest..." -ForegroundColor Green
$runCp = "$outDir;$cp;$kotlincLib\kotlin-stdlib.jar"
& $java -cp $runCp com.ehuntis.widget.CustomEventsLogicTest

Write-Host "Ejecutando ExtendedCustomEventsLogicTest..." -ForegroundColor Green
& $java -cp $runCp com.ehuntis.widget.ExtendedCustomEventsLogicTest

Write-Host "`n=== Todos los tests de Android completados con exito ===" -ForegroundColor Green
