# Deploys the scan proxy (supabase/functions/scan) to the ENDURA Supabase project
# and sets its GEMINI_API_KEY secret, so the browser never holds a Google key.
#
# Needs a Supabase personal access token (starts with sbp_), created once at
#   https://supabase.com/dashboard/account/tokens
#
# Usage (from the project root):
#   $env:SUPABASE_ACCESS_TOKEN = 'sbp_...'
#   powershell -ExecutionPolicy Bypass -File tools\deploy-scan-proxy.ps1
#
# Or with the key inline (it is stored as a project secret, not in the repo):
#   powershell -ExecutionPolicy Bypass -File tools\deploy-scan-proxy.ps1 -GeminiKey 'AQ...'

param(
    [string]$Token = $env:SUPABASE_ACCESS_TOKEN,
    [string]$ProjectRef = 'npeinkgyioxlgotmwqea',
    [string]$GeminiKey = $env:GEMINI_API_KEY,
    [string]$Function = 'scan'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$src = Join-Path $root "supabase\functions\$Function\index.ts"

if (-not (Test-Path $src)) { throw "Function source not found: $src" }
if (-not $Token) {
    throw @"
No Supabase access token.

  1. Open https://supabase.com/dashboard/account/tokens
  2. Generate new token, copy it (starts with sbp_)
  3. `$env:SUPABASE_ACCESS_TOKEN = 'sbp_...'
  4. Run this script again
"@
}

Add-Type -AssemblyName System.Net.Http
$utf8 = New-Object System.Text.UTF8Encoding($false)
$http = [System.Net.Http.HttpClient]::new()
$http.Timeout = [TimeSpan]::FromMinutes(3)
$http.DefaultRequestHeaders.Authorization =
    [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Token)

function Send([string]$Method, [string]$Url, $Content) {
    $req = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), $Url)
    if ($Content) { $req.Content = $Content }
    $res = $http.SendAsync($req).Result
    $text = $res.Content.ReadAsStringAsync().Result
    return [pscustomobject]@{ Status = [int]$res.StatusCode; Body = $text }
}

Write-Host ''
Write-Host "Project : $ProjectRef" -ForegroundColor Cyan
Write-Host "Function: $Function" -ForegroundColor Cyan

# 1. The Google key, held as a project secret. Never leaves the server.
if ($GeminiKey) {
    $json = ConvertTo-Json -Compress -Depth 3 @(@{ name = 'GEMINI_API_KEY'; value = $GeminiKey })
    $r = Send 'POST' "https://api.supabase.com/v1/projects/$ProjectRef/secrets" `
        ([System.Net.Http.StringContent]::new($json, $utf8, 'application/json'))
    if ($r.Status -ge 400) { Write-Host "Secret failed ($($r.Status)): $($r.Body)" -ForegroundColor Red; exit 1 }
    Write-Host 'Secret  : GEMINI_API_KEY stored' -ForegroundColor Green
} else {
    Write-Host 'Secret  : unchanged (pass -GeminiKey to set GEMINI_API_KEY)' -ForegroundColor DarkGray
}

# 2. The function itself.
$form = [System.Net.Http.MultipartFormDataContent]::new()
$meta = ConvertTo-Json -Compress -Depth 3 @{
    name             = $Function
    verify_jwt       = $true
    entrypoint_path  = 'index.ts'
}
$form.Add([System.Net.Http.StringContent]::new($meta, $utf8, 'application/json'), 'metadata')
$bytes = [IO.File]::ReadAllBytes($src)
$file = [System.Net.Http.ByteArrayContent]::new($bytes)
$file.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('application/typescript')
$form.Add($file, 'file', 'index.ts')

$r = Send 'POST' "https://api.supabase.com/v1/projects/$ProjectRef/functions/deploy?slug=$Function" $form
if ($r.Status -ge 400) {
    Write-Host "Deploy failed ($($r.Status)): $($r.Body)" -ForegroundColor Red
    exit 1
}

$url = "https://$ProjectRef.supabase.co/functions/v1/$Function"
Write-Host 'Deploy  : ok' -ForegroundColor Green
Write-Host ''
Write-Host "Proxy URL: $url" -ForegroundColor Yellow
Write-Host 'The app picks it up on the next load — no rebuild, no key to paste.' -ForegroundColor DarkGray
Write-Host ''
