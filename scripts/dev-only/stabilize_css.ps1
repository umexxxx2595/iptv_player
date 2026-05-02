# ============================================================================
# FONEX IPTV - CSS Stabilize Script
# Description: Appends critical UI stabilizer rules to CSS files
# Version: 2.0.0
# Author: FONEX Labs
# Date: 2026
# ============================================================================

param(
    [string]$CssPath = "styles\fonex-theme.css",
    [string]$StabilizerPath = "temp_stabilizer.css",
    [switch]$CreateBackup,
    [switch]$DryRun,
    [switch]$Force
)

# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------
$Encoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$StabilizerCSS = @"
/* ============================================================================
   FONEX UI STABILIZER - CRITICAL RULES
   Version: 2.5.0
   Purpose: Ensure consistent UI state across all webOS TV models
   ============================================================================ */

/* ──────────────────────────────────────────────────────────────────────────
   Body & Root Stabilization
   ────────────────────────────────────────────────────────────────────────── */
body {
    background-color: #0f0f1a !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    width: 100vw !important;
    height: 100vh !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif !important;
    -webkit-font-smoothing: antialiased !important;
    -moz-osx-font-smoothing: grayscale !important;
}

html {
    box-sizing: border-box !important;
    overflow: hidden !important;
}

*, *::before, *::after {
    box-sizing: inherit !important;
}

/* ──────────────────────────────────────────────────────────────────────────
   Main Layout Elements
   ────────────────────────────────────────────────────────────────────────── */
#main-sidebar, 
#main-content, 
#app-shell {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    position: relative !important;
    z-index: 1 !important;
}

#main-content {
    min-height: 100vh !important;
    width: 100% !important;
}

/* ──────────────────────────────────────────────────────────────────────────
   Loader Management
   ────────────────────────────────────────────────────────────────────────── */
#app-loader,
#global-loader,
#legacy-loader {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
    z-index: -1 !important;
}

#app-loader.hidden,
#global-loader.hidden {
    display: none !important;
}

/* ──────────────────────────────────────────────────────────────────────────
   Overlay Management
   ────────────────────────────────────────────────────────────────────────── */
#modal-overlay,
#player-overlay,
#search-overlay {
    position: fixed !important;
    inset: 0 !important;
    z-index: 1000 !important;
}

#modal-overlay[aria-hidden="true"],
#player-overlay[aria-hidden="true"],
#search-overlay[hidden] {
    display: none !important;
    pointer-events: none !important;
}

/* ──────────────────────────────────────────────────────────────────────────
   Toast & Notifications
   ────────────────────────────────────────────────────────────────────────── */
#toast-container {
    position: fixed !important;
    bottom: 24px !important;
    right: 24px !important;
    z-index: 9999 !important;
    pointer-events: none !important;
}

#toast-container > * {
    pointer-events: auto !important;
}

/* ──────────────────────────────────────────────────────────────────────────
   Focus & Navigation (webOS TV)
   ────────────────────────────────────────────────────────────────────────── */
:focus {
    outline: 2px solid #6464ff !important;
    outline-offset: 2px !important;
}

:focus:not(:focus-visible) {
    outline: none !important;
}

:focus-visible {
    outline: 2px solid #6464ff !important;
    outline-offset: 2px !important;
}

/* ──────────────────────────────────────────────────────────────────────────
   Performance Optimizations
   ────────────────────────────────────────────────────────────────────────── */
.will-animate {
    will-change: transform, opacity !important;
}

.no-transition {
    transition: none !important;
    animation: none !important;
}

/* ──────────────────────────────────────────────────────────────────────────
   webOS TV Specific Fixes
   ────────────────────────────────────────────────────────────────────────── */
@media (-webkit-min-device-pixel-ratio: 1) {
    body {
        image-rendering: -webkit-optimize-contrast !important;
    }
}

/* ──────────────────────────────────────────────────────────────────────────
   Print & Media Queries
   ────────────────────────────────────────────────────────────────────────── */
@media print {
    body {
        display: none !important;
    }
}

/* ============================================================================
   END OF STABILIZER
   ============================================================================ */
"@

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

function Test-CssValid {
    param([string]$Content)
    $openBraces = ([regex]::Matches($Content, '\{')).Count
    $closeBraces = ([regex]::Matches($Content, '\}')).Count
    return $openBraces -eq $closeBraces
}

function Get-FileStats {
    param([string]$Path)
    $content = Get-Content $Path -Encoding $Encoding -Raw
    $lines = ($content -split "`r?`n").Count
    $size = (Get-Item $Path).Length
    return @{
        Lines = $lines
        Size = $size
        SizeKB = [math]::Round($size / 1KB, 2)
    }
}

# ----------------------------------------------------------------------------
# Main Execution
# ----------------------------------------------------------------------------

Write-Log "========================================" "INFO"
Write-Log "FONEX CSS Stabilize Script Started" "INFO"
Write-Log "========================================" "INFO"

# Validate CSS file exists
if (-not (Test-Path $CssPath)) {
    Write-Log "CSS file not found: $CssPath" "ERROR"
    exit 1
}

# Check if file is locked
if (Test-FileLocked -Path $CssPath) {
    Write-Log "CSS file is locked by another process: $CssPath" "ERROR"
    exit 1
}

# Get original file stats
$originalStats = Get-FileStats -Path $CssPath
Write-Log "Original file: $($originalStats.Lines) lines, $($originalStats.SizeKB) KB" "INFO"

# Create backup if requested
if ($CreateBackup) {
    $backupPath = New-CssBackup -Path $CssPath
}

# Read current content
try {
    $content = Get-Content $CssPath -Encoding $Encoding -Raw
    Write-Log "CSS file loaded successfully" "INFO"
} catch {
    Write-Log "Failed to read file: $_" "ERROR"
    exit 1
}

# Check if stabilizer already exists
if ($content -match "FONEX UI STABILIZER") {
    Write-Log "Stabilizer already exists in CSS file!" "WARN"
    
    if (-not $Force) {
        Write-Log "Use -Force to overwrite existing stabilizer" "INFO"
        exit 0
    }
    
    Write-Log "Force mode: Overwriting existing stabilizer..." "WARN"
    # Remove existing stabilizer
    $content = $content -replace "(?s)/\*.*?FONEX UI STABILIZER.*?END OF STABILIZER.*?\*/", ""
}

# Dry run mode
if ($DryRun) {
    Write-Log "DRY RUN - No changes will be made" "WARN"
    $stabilizerLines = ($StabilizerCSS -split "`r?`n").Count
    Write-Log "Stabilizer size: $stabilizerLines lines" "INFO"
    Write-Log "New total would be: $($originalStats.Lines + $stabilizerLines) lines" "INFO"
    exit 0
}

# Combine content
$newContent = $content.TrimEnd() + "`n`n" + $StabilizerCSS

# Validate CSS before saving
if (-not (Test-CssValid -Content $newContent)) {
    Write-Log "CSS validation failed! Unbalanced braces detected." "ERROR"
    exit 1
}

# Save result
try {
    $newContent | Set-Content $CssPath -Encoding $Encoding -NoNewline
    Write-Log "CSS file updated successfully!" "SUCCESS"
    
    # Get new file stats
    $newStats = Get-FileStats -Path $CssPath
    $lineDiff = $newStats.Lines - $originalStats.Lines
    $sizeDiff = $newStats.Size - $originalStats.Size
    
    Write-Log "New file: $($newStats.Lines) lines, $($newStats.SizeKB) KB" "INFO"
    Write-Log "Added: +$lineDiff lines, +$([math]::Round($sizeDiff / 1KB, 2)) KB" "SUCCESS"
} catch {
    Write-Log "Failed to write file: $_" "ERROR"
    exit 1
}

Write-Log "========================================" "INFO"
Write-Log "FONEX CSS Stabilize Script Completed" "SUCCESS"
Write-Log "========================================" "INFO"
