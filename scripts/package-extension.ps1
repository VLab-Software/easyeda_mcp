$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$extensionRoot = Join-Path $repoRoot "extension"
$distRoot = Join-Path $repoRoot "build\dist"
$stagingRoot = Join-Path $repoRoot "build\extension-package"
$packagePath = Join-Path $distRoot "easyeda_mcp_bridge.eext"
$zipPath = Join-Path $distRoot "easyeda_mcp_bridge.zip"

if (Test-Path $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null
New-Item -ItemType Directory -Force -Path $distRoot | Out-Null

Copy-Item -LiteralPath (Join-Path $extensionRoot "extension.json") -Destination $stagingRoot
Copy-Item -LiteralPath (Join-Path $extensionRoot "README.md") -Destination $stagingRoot
Copy-Item -LiteralPath (Join-Path $extensionRoot "dist") -Destination (Join-Path $stagingRoot "dist") -Recurse

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}
if (Test-Path $packagePath) {
  Remove-Item -LiteralPath $packagePath -Force
}

Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $zipPath -Force
Move-Item -LiteralPath $zipPath -Destination $packagePath

Write-Host "Created $packagePath"
