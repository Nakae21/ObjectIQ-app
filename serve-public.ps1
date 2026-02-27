# Require Administrator privileges
if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Elevating to Administrator to configure Firewall and HTTP bindings..."
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$port = 8080

Write-Host "Configuring Windows Firewall..."
New-NetFirewallRule -DisplayName "Object ID App Port $port" -Direction Inbound -LocalPort $port -Protocol TCP -Action Allow -ErrorAction SilentlyContinue | Out-Null

Write-Host "Configuring HTTP URL ACL..."
netsh http add urlacl url=http://+:$port/ user=Everyone | Out-Null

Write-Host "Starting Web Server..."
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$port/")
$listener.Start()

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Server successfully started securely!" -ForegroundColor Green
Write-Host "Listening on all network interfaces (Port $port)" -ForegroundColor Green
Write-Host "You can now access the app via your VM's Public IP address." -ForegroundColor Cyan
Write-Host "Example: http://[VM-PUBLIC-IP]:$port/" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop..."

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        # Security: restrict to the parent working directory
        $baseDir = "C:\Users\elkannahnichol\.gemini\antigravity\scratch\object-id"
        $localPath = $baseDir + $request.Url.LocalPath.Replace('/', '\')
        if ($localPath -match '\\$') { $localPath += "index.html" }
        
        if ($localPath.StartsWith($baseDir) -and (Test-Path $localPath -PathType Leaf)) {
            $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
            switch ($ext) {
                ".html" { $response.ContentType = "text/html" }
                ".css"  { $response.ContentType = "text/css" }
                ".js"   { $response.ContentType = "application/javascript" }
                default { $response.ContentType = "application/octet-stream" }
            }
            $content = [System.IO.File]::ReadAllBytes($localPath)
            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    }
} catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    Write-Host "Server stopped."
    Write-Host ""
    Read-Host -Prompt "Press Enter to exit"
}
