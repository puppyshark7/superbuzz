# Simple verification script to check that all required files exist and have the expected content
$rootDir = $env:PWD

function Test-File {
    param($filePath, $description)
    $fullPath = Join-Path $rootDir $filePath
    if (Test-Path $fullPath) {
        Write-Host "✅ Found: $filePath" -ForegroundColor Green
        return true
    } else {
        Write-Host "❌ Missing: $filePath ($description)" -ForegroundColor Red
        return false
    }
}

function Test-FileContains {
    param($filePath, $searchString, $description)
    $fullPath = Join-Path $rootDir $filePath
    if (Test-Path $fullPath) {
        $content = Get-Content $fullPath -Raw
        if ($content.Contains($searchString)) {
            Write-Host "✅ Content verified in $filePath" -ForegroundColor Green
            return true
        } else {
            Write-Host ("❌ Missing content in {0}: '{1}'" -f $filePath, $searchString) -ForegroundColor Red
            return false
        }
    } else {
        Write-Host "❌ Missing file for content check: $filePath" -ForegroundColor Red
        return false
    }
}

Write-Host "=== Verifying Buzzer Project Structure ===`n" -ForegroundColor Cyan

$hasErrors = false

# Check all required files exist
if (!(Test-File 'package.json' 'NPM package configuration')) { $hasErrors = true }
if (!(Test-File 'vite.config.ts' 'Vite build tool configuration')) { $hasErrors = true }
if (!(Test-File 'tsconfig.json' 'TypeScript compiler configuration')) { $hasErrors = true }
if (!(Test-File 'tailwind.config.js' 'Tailwind CSS configuration')) { $hasErrors = true }
if (!(Test-File 'src/index.tsx' 'React entry point')) { $hasErrors = true }
if (!(Test-File 'public/index.html' 'HTML template')) { $hasErrors = true }
if (!(Test-File 'src/App.tsx' 'Main application component')) { $hasErrors = true }
if (!(Test-File 'src/store.ts' 'Global state management')) { $hasErrors = true }
if (!(Test-File 'src/components/SetupForm.tsx' 'Question setup form component')) { $hasErrors = true }
if (!(Test-File 'src/components/BuzzerInterface.tsx' 'Buzzer interface component')) { $hasErrors = true }

Write-Host "`n=== Verifying Key Features ===`n" -ForegroundColor Cyan

# Verify store has all required actions and interfaces
if (!(Test-FileContains 'src/store.ts' 'export interface Participant {' 'Participant interface definition')) { $hasErrors = true }
if (!(Test-FileContains 'src/store.ts' 'addBuzzerParticipant(state, participantId: string)' 'Action to record a buzz')) { $hasErrors = true }
if (!(Test-FileContains 'src/store.ts' 'resetState(state)' 'Reset action for clearing all state')) { $hasErrors = true }

# Verify SetupForm has team assignment functionality
if (!(Test-FileContains 'src/components/SetupForm.tsx' 'addParticipantToTeam' 'Team assignment logic in setup form')) { $hasErrors = true }
if (!(Test-FileContains 'src/components/SetupForm.tsx' 'handleAssignParticipantToTeam' 'Handler for assigning participants to teams')) { $hasErrors = true }

# Verify BuzzerInterface has team lockout logic
if (!(Test-FileContains 'src/components/BuzzerInterface.tsx' 'teams.forEach(team => {' 'Team iteration for lockout check')) { $hasErrors = true }
if (!(Test-FileContains 'src/components/BuzzerInterface.tsx' 'setBuzzerLocked(true)' 'Action to lock the entire buzzer when a team member has already buzzed')) { $hasErrors = true }

# Verify reset functionality exists
if (!(Test-FileContains 'src/components/BuzzerInterface.tsx' 'showResetModal && (' 'Reset modal component')) { $hasErrors = true }
if (!(Test-FileContains 'src/App.tsx' 'resetState()' 'Reset handler in main app')) { $hasErrors = true }

Write-Host "`n=== Summary ===`n" -ForegroundColor Cyan
if ($hasErrors) {
    Write-Host "❌ Verification failed. Some files or content are missing." -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ All checks passed! The project structure is complete and ready to run." -ForegroundColor Green
    Write-Host "`nTo set up the development environment:" -ForegroundColor Cyan
    Write-Host "1. Install Node.js from https://nodejs.org/node.exe"
    Write-Host "2. Run 'npm install' in this directory"
    Write-Host "3. Run 'npm run dev' to start the development server on http://localhost:3000" -ForegroundColor Cyan
}
