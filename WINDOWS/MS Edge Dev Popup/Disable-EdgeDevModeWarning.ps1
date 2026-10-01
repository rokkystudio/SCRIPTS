$ErrorActionPreference = 'Stop'

# Chromium stores Time in microseconds since 1601-01-01 UTC.
# A one-year expiry avoids an unusually large value.
$fileTime = [DateTime]::UtcNow.AddYears(1).ToFileTimeUtc()
[Int64]$remainder = 0
$snoozeEndTime = [string][Math]::DivRem([Int64]$fileTime, [Int64]10, [ref]$remainder)
$userDataPath = Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data'

if (-not (Test-Path -LiteralPath $userDataPath -PathType Container)) {
    Write-Error "Microsoft Edge user-data folder was not found: $userDataPath"
}

Write-Host 'Closing Microsoft Edge...'
& taskkill.exe /F /IM msedge.exe 2>$null | Out-Null
Start-Sleep -Seconds 1

$profiles = Get-ChildItem -LiteralPath $userDataPath -Directory |
    Where-Object {
        $_.Name -ne 'System Profile' -and
        (Test-Path -LiteralPath (Join-Path $_.FullName 'Preferences') -PathType Leaf)
    }

if (-not $profiles) {
    Write-Error "No Edge profile with a Preferences file was found in $userDataPath."
}

$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
$updatedProfiles = @()

foreach ($profile in $profiles) {
    $preferencesPath = Join-Path $profile.FullName 'Preferences'
    $backupPath = "$preferencesPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    $backupIndex = 1

    while (Test-Path -LiteralPath $backupPath) {
        $backupPath = "$preferencesPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')-$backupIndex"
        $backupIndex++
    }

    Copy-Item -LiteralPath $preferencesPath -Destination $backupPath

    $preferences = [System.IO.File]::ReadAllText($preferencesPath)
    $keyPattern = '(?s)("dev_mode_warning_snooze_end_time"\s*:\s*)(?:"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?|true|false|null)'

    if ([System.Text.RegularExpressions.Regex]::IsMatch($preferences, $keyPattern)) {
        $updatedPreferences = [System.Text.RegularExpressions.Regex]::Replace(
            $preferences,
            $keyPattern,
            ('${1}"' + $snoozeEndTime + '"'),
            1
        )
    }
    elseif ($preferences -match '^\s*\{\s*\}\s*$') {
        $updatedPreferences = '{"dev_mode_warning_snooze_end_time":"' + $snoozeEndTime + '"}'
    }
    else {
        $updatedPreferences = [System.Text.RegularExpressions.Regex]::Replace(
            $preferences,
            '^(\s*\{)',
            ('${1}' + "`r`n  " + '"dev_mode_warning_snooze_end_time":"' + $snoozeEndTime + '",'),
            1
        )
    }

    [System.IO.File]::WriteAllText($preferencesPath, $updatedPreferences, $utf8WithoutBom)
    $updatedProfiles += $profile.Name
    Write-Host "Updated profile '$($profile.Name)'. Backup: $backupPath"
}

Write-Host ''
Write-Host "The warning is snoozed until $([DateTime]::UtcNow.AddYears(1).ToLocalTime().ToString('yyyy-MM-dd HH:mm:ss zzz'))."
Write-Host "Updated profiles: $($updatedProfiles -join ', ')"
Write-Host 'Start Microsoft Edge and check the result.'
