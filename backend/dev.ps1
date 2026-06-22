# Mata cualquier proceso que use el puerto 3333 antes de arrancar
$port = 3333
$pids = (netstat -ano | Select-String ":$port\s.*LISTENING") -replace '.*LISTENING\s+', ''
foreach ($p in $pids) {
    if ($p -match '^\d+$') {
        Write-Host "Killing PID $p on port $port..."
        taskkill /PID $p /F | Out-Null
    }
}

# Arranca el servidor
node --import=tsx bin/server.ts
