$ErrorActionPreference='Stop'
$summerProject=Split-Path $PSScriptRoot -Parent
if(!$env:NODE_PATH -or !$env:WATCH_SDK_HOME -or !$env:WATCH_ADB_PATH){throw 'Set NODE_PATH, WATCH_SDK_HOME and WATCH_ADB_PATH to your installed Vela tool paths'}
if(!$env:STARRY_EMULATOR_HOME){$env:STARRY_EMULATOR_HOME=Join-Path (Split-Path $summerProject -Parent) 'summer-ui-environment'}
$env:WATCH_VVD_NAME='SummerUI20261025'
$env:WATCH_SERIAL_PORT='5584'
$env:WATCH_GRPC_PORT='8584'
$env:WATCH_DEBUG_PORT='10084'
$env:WATCH_HTTP_PORT='43168'
try{$summerExisting=Invoke-RestMethod 'http://127.0.0.1:43168/info' -TimeoutSec 3}catch{$summerExisting=$null}
if($summerExisting){if($summerExisting.name -ne $env:WATCH_VVD_NAME){throw 'Port belongs to another device'};Write-Output 'Existing preview: http://127.0.0.1:43168/';exit 0}
$summerHost=Start-Process -FilePath (Get-Command node).Source -ArgumentList @('tools/emulator-server.cjs') -WorkingDirectory $summerProject -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $env:STARRY_EMULATOR_HOME 'controller.log') -RedirectStandardError (Join-Path $env:STARRY_EMULATOR_HOME 'controller-error.log')
Write-Output ('Summer preview PID '+$summerHost.Id+'; http://127.0.0.1:43168/')
