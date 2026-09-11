#Requires -Version 5.1
<#
.SYNOPSIS
  Build, package, and install Rust Call Graph into VS Code.
.PARAMETER Check
  Run typecheck and unit tests before packaging.
.PARAMETER SkipInstall
  Only produce the VSIX, do not install it.
#>
[CmdletBinding()]
param(
  [switch]$Check,
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Invoke-Native {
  param(
    [Parameter(Mandatory)][string]$FilePath,
    [Parameter(ValueFromRemainingArguments)][string[]]$ArgumentList
  )
  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath failed with exit code $LASTEXITCODE"
  }
}

function Resolve-RepoBin {
  param([Parameter(Mandatory)][string]$Name)
  foreach ($candidate in @("$Name.cmd", "$Name.exe", $Name)) {
    $path = Join-Path $Root "node_modules\.bin\$candidate"
    if (Test-Path $path) {
      return $path
    }
  }
  throw "Missing node_modules/.bin/$Name. Run pnpm install in the repo root first."
}

function Resolve-VSCodeCli {
  $command = Get-Command code -ErrorAction SilentlyContinue
  if ($null -ne $command) {
    return $command.Source
  }

  $localAppData = [Environment]::GetFolderPath('LocalApplicationData')
  $programFiles = [Environment]::GetFolderPath('ProgramFiles')
  $programFilesX86 = ${env:ProgramFiles(x86)}
  $candidates = @(
    (Join-Path $localAppData 'Programs\Microsoft VS Code\bin\code.cmd'),
    (Join-Path $programFiles 'Microsoft VS Code\bin\code.cmd')
  )
  if ($programFilesX86) {
    $candidates += Join-Path $programFilesX86 'Microsoft VS Code\bin\code.cmd'
  }

  foreach ($path in $candidates) {
    if (Test-Path $path) {
      return $path
    }
  }
  throw "Cannot find the VS Code CLI (code). In VS Code run: Shell Command: Install 'code' command in PATH"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Cannot find node. Install Node.js first.'
}
if (-not (Test-Path (Join-Path $Root 'node_modules'))) {
  throw 'Missing node_modules. Run pnpm install in the repo root first.'
}

$package = Get-Content (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json
$vsix = Join-Path $Root "$($package.name)-$($package.version).vsix"

Write-Host '1/4 Cleaning dist'
Invoke-Native node (Join-Path $Root 'scripts\clean.mjs')

if ($Check) {
  Write-Host 'Running typecheck and unit tests'
  Invoke-Native (Resolve-RepoBin 'tsc') -p tsconfig.extension.json --noEmit
  Invoke-Native (Resolve-RepoBin 'tsc') -p tsconfig.webview.json --noEmit
  Invoke-Native (Resolve-RepoBin 'tsc') -p tsconfig.integration.json --noEmit
  Invoke-Native (Resolve-RepoBin 'vitest') run
}

Write-Host '2/4 Building extension host and webview'
Invoke-Native (Resolve-RepoBin 'esbuild') `
  src/extension/extension.ts `
  --bundle `
  --platform=node `
  --format=cjs `
  --external:vscode `
  --outfile=dist/extension.cjs `
  --sourcemap
Invoke-Native (Resolve-RepoBin 'vite') build

Write-Host '3/4 Packaging VSIX'
Invoke-Native (Resolve-RepoBin 'vsce') package --no-dependencies --allow-missing-repository
if (-not (Test-Path $vsix)) {
  throw "Packaging finished but $vsix was not found"
}

if ($SkipInstall) {
  Write-Host "Wrote $vsix"
  return
}

Write-Host '4/4 Installing into VS Code'
$editor = Resolve-VSCodeCli
Write-Host "Using $editor"
Invoke-Native $editor --install-extension $vsix --force

Write-Host ''
Write-Host "Installed: $vsix"
Write-Host 'Reload VS Code: Command Palette -> Developer: Reload Window'
Write-Host 'Then right-click inside a Rust function -> Show Rust Call Graph'
