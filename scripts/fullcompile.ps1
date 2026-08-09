Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$distPath = Join-Path $repositoryRoot 'dist'
$archivePath = Join-Path $repositoryRoot 'monitor.zip'
$runtimePath = Join-Path $repositoryRoot '.runtime'
$stagingPath = Join-Path $runtimePath "fullcompile-$PID"
$stagedMonitorPath = Join-Path $stagingPath 'monitor'
$temporaryArchivePath = Join-Path $runtimePath "monitor-fullcompile-$PID.zip"
$hadGithubRef = Test-Path Env:GITHUB_REF
$originalGithubRef = $env:GITHUB_REF

Push-Location $repositoryRoot
try {
    if ([string]::IsNullOrWhiteSpace($env:GITHUB_REF)) {
        $packageMetadata = Get-Content -LiteralPath (Join-Path $repositoryRoot 'package.json') -Raw | ConvertFrom-Json
        if ([string]::IsNullOrWhiteSpace($packageMetadata.version)) {
            throw 'The root package version is missing.'
        }

        $env:GITHUB_REF = "refs/tags/v$($packageMetadata.version)"
        Write-Host "Using local build version $($packageMetadata.version)."
    }

    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
        throw "The production build failed with exit code $LASTEXITCODE."
    }

    if (-not (Test-Path -LiteralPath $distPath -PathType Container)) {
        throw 'The production build did not create the dist directory.'
    }

    New-Item -Path $stagingPath -ItemType Directory -Force | Out-Null
    Copy-Item -LiteralPath $distPath -Destination $stagedMonitorPath -Recurse

    & tar.exe -a -c -f $temporaryArchivePath -C $stagingPath monitor
    if ($LASTEXITCODE -ne 0) {
        throw "Archive creation failed with exit code $LASTEXITCODE."
    }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($temporaryArchivePath)
    try {
        $entryNames = @($archive.Entries | ForEach-Object FullName)
        $unexpectedEntries = @($entryNames | Where-Object { -not $_.StartsWith('monitor/') })
        if ($entryNames.Count -eq 0 -or $unexpectedEntries.Count -gt 0) {
            throw 'The generated archive contains an invalid top-level path.'
        }

        $requiredEntries = @(
            'monitor/.yarn.installed',
            'monitor/core/index.js',
            'monitor/nui/index.html',
            'monitor/panel/index.html',
            'monitor/THIRD-PARTY-LICENSES.txt'
        )
        foreach ($requiredEntry in $requiredEntries) {
            if ($entryNames -notcontains $requiredEntry) {
                throw "The generated archive is missing $requiredEntry."
            }
        }
    }
    finally {
        $archive.Dispose()
    }

    if (Test-Path -LiteralPath $archivePath) {
        Remove-Item -LiteralPath $archivePath -Force
    }
    Move-Item -LiteralPath $temporaryArchivePath -Destination $archivePath

    Write-Host 'Created monitor.zip with the complete build under monitor/.'
}
finally {
    if (Test-Path -LiteralPath $stagingPath) {
        Remove-Item -LiteralPath $stagingPath -Recurse -Force
    }
    if (Test-Path -LiteralPath $temporaryArchivePath) {
        Remove-Item -LiteralPath $temporaryArchivePath -Force
    }

    if ($hadGithubRef) {
        $env:GITHUB_REF = $originalGithubRef
    }
    else {
        Remove-Item Env:GITHUB_REF -ErrorAction SilentlyContinue
    }

    Pop-Location
}
