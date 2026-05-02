# ============================================================================
# FONEX IPTV - CSS Fix Script
# Description: Injects CSS blocks at specific markers with safety checks
# Version: 2.0.0
# Author: FONEX Labs
# Date: 2026
# ============================================================================

param(
    [string]$CssPath = "styles\fonex-theme.css",
    [string]$TempPath = "temp_settings.css",
    [string]$StartMarker = "/* FONEX_SETTINGS_START */",
    [string]$EndMarker = "/* FONEX_SETTINGS_END */",
    [switch]$CreateBackup,
    [switch]$DryRun
)

# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------
$Encoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

# ----------------------------------------------------------------------------
# Functions
# ----------------------------------------------------------------------------

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "INFO" { "Green" }
        "WARN" { "Yellow" }
        "ERROR" { "Red" }
        "SUCCESS" { "Cyan" }
    }
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
}

function Test-FileLocked {
    param([string]$Path)
    try {
        $stream = [System.IO.File]::Open($Path, 'Open', 'Read', 'None')
        $stream.Close()
        return $false
    } catch {
        return $true
    }
}

function New-CssBackup {
    param([string]$Path)
    $backupPath = "$Path.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item -Path $Path -Destination $backupPath -Force
    Write-Log "Backup created: $backupPath" "INFO"
    return $backupPath
}

function Find-MarkerLine {
    param(
        [string[]]$Content,
        [string]$Marker
    )
    for ($i = 0; $i -lt $Content.Count; $i++) {
        if ($Content[$i] -match [regex]::Escape($Marker)) {
            return $i
        }
    }
    return -1
}

function Test-CssValid {
    param([string]$Content)
    # Basic CSS validation - check for balanced braces
    $openBraces = ([regex]::Matches($Content, '\{')).Count
    $closeBraces = ([regex]::Matches($Content, '\}')).Count
    return $openBraces -eq $closeBraces
}

# ----------------------------------------------------------------------------
# Main Execution
# ----------------------------------------------------------------------------

Write-Log "========================================" "INFO"
Write-Log "FONEX CSS Fix Script Started" "INFO"
Write-Log "========================================" "INFO"

# Validate files exist
if (-not (Test-Path $CssPath)) {
    Write-Log "CSS file not found: $CssPath" "ERROR"
    exit 1
}

if (-not (Test-Path $TempPath)) {
    Write-Log "Temp file not found: $TempPath" "ERROR"
    exit 1
}

# Check if files are locked
if (Test-FileLocked -Path $CssPath) {
    Write-Log "CSS file is locked by another process: $CssPath" "ERROR"
    exit 1
}

# Create backup if requested
if ($CreateBackup) {
    $backupPath = New-CssBackup -Path $CssPath
}

# Read files
try {
    $cssContent = Get-Content $CssPath -Encoding $Encoding -Raw
    $newBlock = Get-Content $TempPath -Encoding $Encoding -Raw
    Write-Log "Files loaded successfully" "INFO"
    Write-Log "CSS Size: $(($cssContent.Length / 1KB).ToString('F2')) KB" "INFO"
    Write-Log "New Block Size: $(($newBlock.Length / 1KB).ToString('F2')) KB" "INFO"
} catch {
    Write-Log "Failed to read files: $_" "ERROR"
    exit 1
}

# Convert to array for line manipulation
$cssLines = $cssContent -split "`r?`n"
$newBlockLines = $newBlock -split "`r?`n"

# Find markers
$startLine = Find-MarkerLine -Content $cssLines -Marker $StartMarker
$endLine = Find-MarkerLine -Content $cssLines -Marker $EndMarker

Write-Log "Start marker found at line: $($startLine + 1)" "INFO"
Write-Log "End marker found at line: $($endLine + 1)" "INFO"

# Validate markers
if ($startLine -eq -1 -or $endLine -eq -1) {
    Write-Log "Markers not found in CSS file!" "ERROR"
    Write-Log "Add these markers to your CSS:" "WARN"
    Write-Log "  $StartMarker" "WARN"
    Write-Log "  $EndMarker" "WARN"
    exit 1
}

if ($startLine -ge $endLine) {
    Write-Log "Invalid marker positions! Start must be before End." "ERROR"
    exit 1
}

# Dry run mode
if ($DryRun) {
    Write-Log "DRY RUN - No changes will be made" "WARN"
    Write-Log "Lines to replace: $($endLine - $startLine - 1)" "INFO"
    Write-Log "New lines count: $($newBlockLines.Count)" "INFO"
    exit 0
}

# Build result
$resultLines = @()
$resultLines += $cssLines[0..$startLine]
$resultLines += $newBlockLines
$resultLines += $cssLines[($endLine)..($cssLines.Count - 1)]

# Join lines
$result = $resultLines -join "`n"

# Validate CSS before saving
if (-not (Test-CssValid -Content $result)) {
    Write-Log "CSS validation failed! Unbalanced braces detected." "ERROR"
    exit 1
}

# Save result
try {
    $result | Set-Content $CssPath -Encoding $Encoding -NoNewline
    Write-Log "CSS file updated successfully!" "SUCCESS"
    
    # Calculate stats
    $originalLines = $cssLines.Count
    $newLines = $resultLines.Count
    $lineDiff = $newLines - $originalLines
    
    Write-Log "Original lines: $originalLines" "INFO"
    Write-Log "New lines: $newLines" "INFO"
    Write-Log "Line difference: $(if ($lineDiff -gt 0) { "+$lineDiff" } else { "$lineDiff" })" "INFO"
} catch {
    Write-Log "Failed to write file: $_" "ERROR"
    exit 1
}

Write-Log "========================================" "INFO"
Write-Log "FONEX CSS Fix Script Completed" "SUCCESS"
Write-Log "========================================" "INFO"
