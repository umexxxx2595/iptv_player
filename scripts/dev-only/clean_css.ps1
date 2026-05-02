# ============================================================================
# FONEX IPTV - CSS Clean Script
# Description: Removes deprecated/unused CSS selectors from theme files
# Version: 2.0.0
# Author: FONEX Labs
# Date: 2026
# ============================================================================

param(
    [string]$CssPath = "styles\fonex-theme.css",
    [switch]$CreateBackup,
    [switch]$Verbose
)

# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------
$PatternsToRemove = @(
    '#global-loader',
    '#legacy-loader',
    '.deprecated-',
    '/* REMOVE */'
)

$Encoding = [System.Text.Encoding]::UTF8

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

# ----------------------------------------------------------------------------
# Main Execution
# ----------------------------------------------------------------------------

Write-Log "========================================" "INFO"
Write-Log "FONEX CSS Clean Script Started" "INFO"
Write-Log "========================================" "INFO"

# Validate file exists
if (-not (Test-Path $CssPath)) {
    Write-Log "CSS file not found: $CssPath" "ERROR"
    exit 1
}

# Check if file is locked
if (Test-FileLocked -Path $CssPath) {
    Write-Log "File is locked by another process: $CssPath" "ERROR"
    exit 1
}

# Create backup if requested
if ($CreateBackup) {
    $backupPath = New-CssBackup -Path $CssPath
}

# Read content
try {
    $content = Get-Content $CssPath -Encoding $Encoding -Raw
    Write-Log "File loaded: $CssPath ($(($content.Length / 1KB).ToString('F2')) KB)" "INFO"
} catch {
    Write-Log "Failed to read file: $_" "ERROR"
    exit 1
}

# Store original for comparison
$originalContent = $content
$removedCount = 0

# Remove patterns
foreach ($pattern in $PatternsToRemove) {
    $matches = [regex]::Matches($content, "(?m)^.*$pattern.*$\r?\n?")
    if ($matches.Count -gt 0) {
        $removedCount += $matches.Count
        $content = $content -replace "(?m)^.*$pattern.*$\r?\n?", ""
        Write-Log "Pattern '$pattern': $($matches.Count) lines removed" "WARN"
    }
}

# Check if changes were made
if ($content -eq $originalContent) {
    Write-Log "No changes needed. CSS is already clean." "INFO"
    exit 0
}

# Write updated content
try {
    $content | Set-Content $CssPath -Encoding $Encoding -NoNewline
    Write-Log "File updated successfully!" "SUCCESS"
    Write-Log "Total lines removed: $removedCount" "SUCCESS"
    
    # Calculate space saved
    $savedBytes = ($originalContent.Length - $content.Length)
    Write-Log "Space saved: $(($savedBytes / 1KB).ToString('F2')) KB" "INFO"
} catch {
    Write-Log "Failed to write file: $_" "ERROR"
    exit 1
}

Write-Log "========================================" "INFO"
Write-Log "FONEX CSS Clean Script Completed" "SUCCESS"
Write-Log "========================================" "INFO"
