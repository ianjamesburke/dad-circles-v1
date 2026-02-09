#!/usr/bin/env node

/**
 * Version Bump Check Script
 * 
 * Ensures that every production deployment has a unique version number.
 * Compares current version.json with the last deployed version.
 * 
 * Usage:
 *   node scripts/check-version-bump.js
 * 
 * Exit codes:
 *   0 - Version check passed (version was bumped or first deployment)
 *   1 - Version check failed (user cancelled or error)
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const VERSION_FILE = path.join(__dirname, '..', 'version.json');
const LAST_DEPLOY_FILE = path.join(__dirname, '..', '.last-deploy-version');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function readVersionFile() {
  try {
    const content = fs.readFileSync(VERSION_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    log(`❌ Error reading version.json: ${error.message}`, 'red');
    process.exit(1);
  }
}

function readLastDeployVersion() {
  try {
    if (!fs.existsSync(LAST_DEPLOY_FILE)) {
      return null; // First deployment
    }
    return fs.readFileSync(LAST_DEPLOY_FILE, 'utf8').trim();
  } catch (error) {
    log(`⚠️  Warning: Could not read last deploy version: ${error.message}`, 'yellow');
    return null;
  }
}

function writeLastDeployVersion(version) {
  try {
    fs.writeFileSync(LAST_DEPLOY_FILE, version, 'utf8');
  } catch (error) {
    log(`⚠️  Warning: Could not write last deploy version: ${error.message}`, 'yellow');
  }
}

function bumpVersion(version, type) {
  const parts = version.split('.');
  if (parts.length !== 3) {
    log(`❌ Invalid version format: ${version}`, 'red');
    process.exit(1);
  }
  
  const [major, minor, patch] = parts.map(Number);
  
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      log(`❌ Invalid bump type: ${type}`, 'red');
      process.exit(1);
  }
}

function updateVersionFile(newVersion) {
  try {
    const versionData = readVersionFile();
    versionData.version = newVersion;
    versionData.releaseDate = new Date().toISOString().split('T')[0];
    
    fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2) + '\n', 'utf8');
    log(`✅ Updated version.json to ${newVersion}`, 'green');
    
    // Also update package.json files
    updatePackageJson(newVersion);
  } catch (error) {
    log(`❌ Error updating version files: ${error.message}`, 'red');
    process.exit(1);
  }
}

function updatePackageJson(newVersion) {
  const packageFiles = [
    path.join(__dirname, '..', 'package.json'),
    path.join(__dirname, '..', 'functions', 'package.json'),
  ];
  
  packageFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        pkg.version = newVersion;
        fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
        log(`✅ Updated ${path.relative(process.cwd(), filePath)}`, 'green');
      } catch (error) {
        log(`⚠️  Warning: Could not update ${filePath}: ${error.message}`, 'yellow');
      }
    }
  });
}

async function promptUser(question, options) {
  // Check if running in non-interactive environment (CI/CD)
  if (!process.stdin.isTTY) {
    log('🤖 Non-interactive environment detected, auto-bumping patch version...', 'cyan');
    return '1';
  }
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  log('🔍 Checking version before deployment...', 'cyan');
  
  const versionData = readVersionFile();
  const currentVersion = versionData.version;
  const lastDeployVersion = readLastDeployVersion();
  
  log(`Current version: ${currentVersion}`, 'blue');
  
  if (lastDeployVersion === null) {
    log('✅ First deployment detected, no version check needed', 'green');
    writeLastDeployVersion(currentVersion);
    process.exit(0);
  }
  
  log(`Last deployed:   ${lastDeployVersion}`, 'blue');
  
  if (currentVersion === lastDeployVersion) {
    log('', 'reset');
    log('⚠️  Version has not been bumped since last deployment!', 'yellow');
    log('', 'reset');
    log('Options:', 'cyan');
    log('1. Patch bump (1.0.0 → 1.0.1) [default]', 'green');
    log('2. Minor bump (1.0.0 → 1.1.0)', 'blue');
    log('3. Major bump (1.0.0 → 2.0.0)', 'yellow');
    log('4. Cancel deployment', 'red');
    log('', 'reset');
    
    const answer = await promptUser('Choose an option (1/2/3/4, default: 1): ', ['1', '2', '3', '4', '']);
    
    // Default to patch bump if no input
    const choice = answer === '' ? '1' : answer;
    
    switch (choice) {
      case '1': {
        const newVersion = bumpVersion(currentVersion, 'patch');
        log('', 'reset');
        log(`🔄 Bumping version (patch): ${currentVersion} → ${newVersion}`, 'cyan');
        updateVersionFile(newVersion);
        writeLastDeployVersion(newVersion);
        log('✅ Version bumped successfully, proceeding with deployment', 'green');
        process.exit(0);
      }
      case '2': {
        const newVersion = bumpVersion(currentVersion, 'minor');
        log('', 'reset');
        log(`🔄 Bumping version (minor): ${currentVersion} → ${newVersion}`, 'cyan');
        updateVersionFile(newVersion);
        writeLastDeployVersion(newVersion);
        log('✅ Version bumped successfully, proceeding with deployment', 'green');
        process.exit(0);
      }
      case '3': {
        const newVersion = bumpVersion(currentVersion, 'major');
        log('', 'reset');
        log(`🔄 Bumping version (major): ${currentVersion} → ${newVersion}`, 'cyan');
        updateVersionFile(newVersion);
        writeLastDeployVersion(newVersion);
        log('✅ Version bumped successfully, proceeding with deployment', 'green');
        process.exit(0);
      }
      case '4': {
        log('', 'reset');
        log('❌ Deployment cancelled', 'red');
        process.exit(1);
      }
      default: {
        log('', 'reset');
        log('❌ Invalid option, deployment cancelled', 'red');
        process.exit(1);
      }
    }
  } else {
    log('✅ Version has been bumped, proceeding with deployment', 'green');
    writeLastDeployVersion(currentVersion);
    process.exit(0);
  }
}

main().catch((error) => {
  log(`❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});
