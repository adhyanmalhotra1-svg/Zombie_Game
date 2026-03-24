# Minimal static file server (no Python/Node required). Run: powershell -ExecutionPolicy Bypass -File serve.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8080
$prefix = "http://127.0.0.1:$port/"

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
  ".woff"  = "font/woff"
  ".woff2" = "font/woff2"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Could not bind $prefix - try another port or run: netsh http add urlacl url=$prefix user=$env:USERNAME"
  throw
}

Write-Host "Serving: $root"
Write-Host "Open in browser: $prefix"
Write-Host "Press Ctrl+C to stop."

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $isHead = $req.HttpMethod -eq "HEAD"
    $path = [Uri]::UnescapeDataString($req.Url.LocalPath)
    if ($path -eq "/" -or $path -eq "") { $path = "/index.html" }
    $rel = $path.TrimStart("/") -replace "/", [IO.Path]::DirectorySeparatorChar
    $candidate = [IO.Path]::GetFullPath((Join-Path $root $rel))
    if (-not $candidate.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403
      $buf = [Text.Encoding]::UTF8.GetBytes("403")
      $res.ContentLength64 = $buf.Length
      if (-not $isHead) { $res.OutputStream.Write($buf, 0, $buf.Length) }
    } elseif (Test-Path $candidate -PathType Leaf) {
      $bytes = [IO.File]::ReadAllBytes($candidate)
      $ext = [IO.Path]::GetExtension($candidate).ToLowerInvariant()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
      $res.ContentLength64 = $bytes.Length
      if (-not $isHead) { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
    } else {
      $res.StatusCode = 404
      $buf = [Text.Encoding]::UTF8.GetBytes('404 Not Found')
      $res.ContentLength64 = $buf.Length
      if (-not $isHead) { $res.OutputStream.Write($buf, 0, $buf.Length) }
    }
  } finally {
    $res.Close()
  }
}
