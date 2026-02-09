#!/usr/bin/env node

/**
 * Version Bump Script
 * 
 * Manually bumps the version number in version.json and all package.json files.
 * 
 * Usage:
 *   node scripts/bump-version.js patch   # 1.0.0 → 1.0.1
 *   node scripts/bump-version.js minor   # 1.0.0 → 1.1.0
 *   node scripts/bump-version.js major   # 1.0.0 → 2.0.0
 *   node scripts/bump-version.js set 2.5.3
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const VERSION_FILE = path.join(__dirname, '..', 'version.json');
const PACKAGE_FILES = [
  path.join(__dirname, '..', 'package.json'),
  path.join(__dirname, '..', 'functions', 'package.json'),
];

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

function writeVersionFile(versionData) {
  try {
    fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2) + '\n', 'utf8');
  } catch (error) {
    log(`❌ Error writing version.json: ${error.message}`, 'red');
    process.exit(1);
  }
}

function updatePackageJson(version) {
  PACKAGE_FILES.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        pkg.version = version;
        fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
        log(`✅ Updated ${path.relative(process.cwd(), filePath)}`, 'green');
      } catch (error) {
        log(`⚠️  Warning: Could not update ${filePath}: ${error.message}`, 'yellow');
      }
    }
  });
}

function parseVersion(version) {
  const parts = version.split('.');
  if (parts.length !== 3) {
    log(`❌ Invalid version format: ${version}`, 'red');
    log('Version must be in format: major.minor.patch (e.g., 1.2.3)', 'yellow');
    process.exit(1);
  }
  
  const [major, minor, patch] = parts.map(Number);
  
  if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
    log(`❌ Invalid version format: ${version}`, 'red');
    log('Version parts must be numbers', 'yellow');
    process.exit(1);
  }
  
  return { major, minor, patch };
}

function bumpVersion(currentVersion, bumpType) {
  const { major, minor, patch } = parseVersion(currentVersion);
  
  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      log(`❌ Invalid bump type: ${bumpType}`, 'red');
      log('Valid types: major, minor, patch', 'yellow');
      process.exit(1);
  }
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    log('❌ Missing argument', 'red');
    log('', 'reset');
    log('Usage:', 'cyan');
    log('  node scripts/bump-version.js patch   # 1.0.0 → 1.0.1', 'blue');
    log('  node scripts/bump-version.js minor   # 1.0.0 → 1.1.0', 'blue');
    log('  node scripts/bump-version.js major   # 1.0.0 → 2.0.0', 'blue');
    log('  node scripts/bump-version.js set 2.5.3', 'blue');
    process.exit(1);
  }
  
  const command = args[0];
  const versionData = readVersionFile();
  const currentVersion = versionData.version;
  
  let newVersion;
  
  if (command === 'set') {
    if (args.length < 2) {
      log('❌ Missing version number for "set" command', 'red');
      log('Usage: node scripts/bump-version.js set 2.5.3', 'yellow');
      process.exit(1);
    }
    
    newVersion = args[1];
    // Validate format
    parseVersion(newVersion);
  } else {
    newVersion = bumpVersion(currentVersion, command);
  }
  
  log('', 'reset');
  log(`🔄 Version bump: ${currentVersion} → ${newVersion}`, 'cyan');
  log('', 'reset');
  
  // Update version.json
  versionData.version = newVersion;
  versionData.releaseDate = new Date().toISOString().split('T')[0];
  writeVersionFile(versionData);
  log(`✅ Updated version.json`, 'green');
  
  // Update package.json files
  updatePackageJson(newVersion);
  
  log('', 'reset');
  log('✅ Version bump complete!', 'green');
  log(`New version: ${newVersion}`, 'blue');
}

main();
