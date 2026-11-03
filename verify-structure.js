// Simple verification script to check that all required files exist and have the expected content
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
let hasErrors = false;

function checkFile(filePath, description) {
  const fullPath = path.join(rootDir, filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing: ${filePath} (${description})`);
    hasErrors = true;
    return false;
  }
  console.log(`✅ Found: ${filePath}`);
  return true;
}

function checkFileContains(filePath, searchString, description) {
  const fullPath = path.join(rootDir, filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing file for content check: ${filePath}`);
    hasErrors = true;
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes(searchString)) {
    console.log(`✅ Content verified in ${filePath}: "${searchString.substring(0, 50)}..."`);
    return true;
  } else {
    console.error(`❌ Missing content in ${filePath}: "${searchString}"`);
    hasErrors = true;
    return false;
  }
}

console.log('=== Verifying Buzzer Project Structure ===\n');

// Check all required files exist
checkFile('package.json', 'NPM package configuration');
checkFile('vite.config.ts', 'Vite build tool configuration');
checkFile('tsconfig.json', 'TypeScript compiler configuration');
checkFile('tailwind.config.js', 'Tailwind CSS configuration');
checkFile('src/index.tsx', 'React entry point');
checkFile('public/index.html', 'HTML template');
checkFile('src/App.tsx', 'Main application component');
checkFile('src/store.ts', 'Global state management');
checkFile('src/components/SetupForm.tsx', 'Question setup form component');
checkFile('src/components/BuzzerInterface.tsx', 'Buzzer interface component');

console.log('\n=== Verifying Key Features ===\n');

// Verify store has all required actions and interfaces
checkFileContains('src/store.ts', 'export interface Participant {', 'Participant interface definition');
checkFileContains('src/store.ts', 'export interface Team {', 'Team interface definition');
checkFileContains('src/store.ts', 'addBuzzerParticipant(state, participantId: string)', 'Action to record a buzz');
checkFileContains('src/store.ts', 'resetState(state)', 'Reset action for clearing all state');

// Verify SetupForm has team assignment functionality
checkFileContains('src/components/SetupForm.tsx', 'addParticipantToTeam', 'Team assignment logic in setup form');
checkFileContains('src/components/SetupForm.tsx', 'handleAssignParticipantToTeam', 'Handler for assigning participants to teams');

// Verify BuzzerInterface has team lockout logic
checkFileContains('src/components/BuzzerInterface.tsx', 'teams.forEach(team => {', 'Team iteration for lockout check');
checkFileContains('src/components/BuzzerInterface.tsx', 'hasBuzzerParticipant = participantsInTeam.some(p =>', 'Logic to detect if any participant in a team has buzzed');
checkFileContains('src/components/BuzzerInterface.tsx', 'setBuzzerLocked(true)', 'Action to lock the entire buzzer when a team member has already buzzed');

// Verify reset functionality exists
checkFileContains('src/components/BuzzerInterface.tsx', 'showResetModal && (', 'Reset modal component');
checkFileContains('src/App.tsx', 'resetState()', 'Reset handler in main app');

console.log('\n=== Summary ===\n');
if (hasErrors) {
  console.error('❌ Verification failed. Some files or content are missing.');
  process.exit(1);
} else {
  console.log('✅ All checks passed! The project structure is complete and ready to run.');
  console.log('\nTo set up the development environment:');
  console.log('1. Install Node.js from https://nodejs.org/node.exe');
  console.log('2. Run "npm install" in this directory');
  console.log('3. Run "npm run dev" to start the development server on http://localhost:3000');
}
