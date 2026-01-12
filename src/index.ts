#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { validateEnv, hasErrors } from './validator';
import { generateExample, fileExists, resolvePath } from './utils';
import { LintOptions } from './types';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function printBanner() {
  console.log(`${colors.cyan}${colors.bright}`);
  console.log('╔═══════════════════════════════════════╗');
  console.log('║           🔍 envlint v1.0.0           ║');
  console.log('║    .env Validator & Cleaner           ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(colors.reset);
}

function printHelp() {
  console.log(`
${colors.bright}Usage:${colors.reset}
  envlint [directory] [options]

${colors.bright}Options:${colors.reset}
  -g, --generate          Generate .env.example from .env
  -s, --strict            Strict mode (fail on any discrepancy)
  -e, --env <file>        Specify env file (default: .env)
  -x, --example <file>    Specify example file (default: .env.example)
  --fix                  Auto-fix issues (remove duplicates)
  --no-secrets           Skip secret detection
  -h, --help             Show this help message

${colors.bright}Examples:${colors.reset}
  envlint                              # Lint current directory
  envlint ./api                        # Lint specific directory
  envlint -g                           # Generate .env.example
  envlint --strict                     # Strict validation
  envlint --fix                        # Auto-fix duplicates
  envlint --env .env.local             # Check .env.local
  envlint -e .env.docker -x .env.example  # Check specific files

${colors.bright}What it checks:${colors.reset}
  ✓ Missing variables in .env
  ✓ Undocumented variables in .env.example
  ✓ Duplicate variable definitions
  ✓ Potential secrets accidentally committed
`);
}

function printSuccess(message: string) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function printError(message: string) {
  console.log(`${colors.red}✗${colors.reset} ${message}`);
}

function printWarning(message: string) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function printInfo(message: string) {
  console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

function printSection(title: string) {
  console.log(`\n${colors.bright}${title}${colors.reset}`);
  console.log(colors.gray + '─'.repeat(50) + colors.reset);
}

function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  if (args.includes('-h') || args.includes('--help')) {
    printBanner();
    printHelp();
    process.exit(0);
  }

  const generateMode = args.includes('-g') || args.includes('--generate');
  const strictMode = args.includes('-s') || args.includes('--strict');
  const checkSecrets = !args.includes('--no-secrets');
  const fixMode = args.includes('--fix');

  // Get custom file paths
  const envFileArg = args.find((arg, i) => (args[i - 1] === '--env' || args[i - 1] === '-e') && !arg.startsWith('-'));
  const exampleFileArg = args.find((arg, i) => (args[i - 1] === '--example' || args[i - 1] === '-x') && !arg.startsWith('-'));

  // Get directory (first non-flag argument or current directory)
  const dirArg = args.find(arg => !arg.startsWith('-') && arg !== envFileArg && arg !== exampleFileArg) || '.';
  const targetDir = resolvePath(dirArg);

  if (!fs.existsSync(targetDir)) {
    printError(`Directory not found: ${targetDir}`);
    process.exit(1);
  }

  let envPath = envFileArg ? path.join(targetDir, envFileArg) : path.join(targetDir, '.env');
  const examplePath = exampleFileArg ? path.join(targetDir, exampleFileArg) : path.join(targetDir, '.env.example');

  printBanner();

  // Generate mode
  if (generateMode) {
    if (!fileExists(envPath)) {
      printError('.env file not found');
      process.exit(1);
    }

    printInfo('Generating .env.example from .env...');
    const envVars = require('./utils').parseEnvFile(envPath);
    generateExample(envVars, examplePath);
    printSuccess(`.env.example generated at ${examplePath}`);
    process.exit(0);
  }

  // Validation mode
  console.log(`${colors.gray}Directory: ${targetDir}${colors.reset}\n`);

  // Detect all .env files
  const allEnvFiles = fs.readdirSync(targetDir)
    .filter(file => file.startsWith('.env') && !file.endsWith('.example') && !file.endsWith('.sample'))
    .sort();

  let envExists = fileExists(envPath);
  const exampleExists = fileExists(examplePath);

  // Auto-detect env file if .env doesn't exist
  if (!envExists && !envFileArg && allEnvFiles.length > 0) {
    // Priority order for auto-detection
    const priorityFiles = ['.env.local', '.env.development', '.env.dev', '.env.docker', '.env.prod', '.env.production'];
    let autoEnvFile = priorityFiles.find(f => allEnvFiles.includes(f)) || allEnvFiles[0];
    
    printInfo(`Found ${allEnvFiles.length} .env files: ${allEnvFiles.join(', ')}`);
    printInfo(`Auto-selecting: ${autoEnvFile}`);
    console.log(`${colors.gray}Checking: ${autoEnvFile} vs ${path.basename(examplePath)}${colors.reset}\n`);
    
    // Update envPath to use auto-detected file
    envPath = path.join(targetDir, autoEnvFile);
    envExists = true;
  } else if (allEnvFiles.length > 2) {
    printInfo(`Found ${allEnvFiles.length} .env files: ${allEnvFiles.join(', ')}`);
    const envFile = path.basename(envPath);
    const exampleFile = path.basename(examplePath);
    console.log(`${colors.gray}Checking: ${envFile} vs ${exampleFile}${colors.reset}\n`);
  }

  if (!envExists && !exampleExists) {
    printError('No .env files found');
    printInfo('Run with -g to generate .env.example');
    process.exit(1);
  }

  if (!envExists) {
    printWarning(`.env file not found`);
    if (allEnvFiles.length > 0) {
      printInfo(`Available files: ${allEnvFiles.join(', ')}`);
      printInfo(`Use: envlint --env ${allEnvFiles[0]}`);
    } else {
      printInfo('Create .env from .env.example template');
    }
    process.exit(1);
  }

  if (!exampleExists) {
    printWarning('.env.example not found');
    printInfo('Run with -g to generate it from .env');
    process.exit(1);
  }

  const options: LintOptions = {
    envPath,
    examplePath,
    generateExample: false,
    checkSecrets,
    strict: strictMode,
  };

  const result = validateEnv(options);

  // Fix mode - remove duplicates
  if (fixMode) {
    let fixedCount = 0;
    
    if (result.duplicatesInEnv.size > 0) {
      printSection('Fixing Issues');
      const { removed, duplicates } = require('./utils').removeDuplicates(envPath);
      if (removed > 0) {
        printSuccess(`Removed ${removed} duplicate variable(s) from ${path.basename(envPath)}`);
        duplicates.forEach((key: string) => {
          console.log(`  ${colors.gray}• ${key}${colors.reset}`);
        });
        fixedCount += removed;
      }
    }

    if (result.duplicatesInExample.size > 0) {
      const { removed, duplicates } = require('./utils').removeDuplicates(examplePath);
      if (removed > 0) {
        printSuccess(`Removed ${removed} duplicate variable(s) from ${path.basename(examplePath)}`);
        duplicates.forEach((key: string) => {
          console.log(`  ${colors.gray}• ${key}${colors.reset}`);
        });
        fixedCount += removed;
      }
    }

    if (fixedCount > 0) {
      console.log();
      printInfo('Re-run envlint to verify fixes');
      process.exit(0);
    } else {
      printInfo('No fixable issues found');
      console.log();
    }
  }

  // Print results
  let hasIssues = false;

  // Missing in .env (ERROR)
  if (result.missingInEnv.length > 0) {
    hasIssues = true;
    printSection(`Missing in ${result.envFileName}`);
    result.missingInEnv.forEach(key => {
      printError(`${key} (defined in ${result.exampleFileName} but missing in ${result.envFileName})`);
    });
  }

  // Duplicates in .env (ERROR)
  if (result.duplicatesInEnv.size > 0) {
    hasIssues = true;
    printSection(`Duplicate Variables in ${result.envFileName}`);
    result.duplicatesInEnv.forEach((lines, key) => {
      printError(`${key} (defined on lines: ${lines.join(', ')})`);
    });
  }

  // Duplicates in .env.example (ERROR)
  if (result.duplicatesInExample.size > 0) {
    hasIssues = true;
    printSection(`Duplicate Variables in ${result.exampleFileName}`);
    result.duplicatesInExample.forEach((lines, key) => {
      printError(`${key} (defined on lines: ${lines.join(', ')})`);
    });
  }

  // Potential secrets (WARNING)
  if (result.potentialSecrets.length > 0) {
    hasIssues = true;
    printSection('⚠️  Potential Secrets Detected');
    result.potentialSecrets.forEach(({ key, value, lineNumber, reason }) => {
      printWarning(`${key} = ${value}`);
      console.log(`   ${colors.gray}Line ${lineNumber}: ${reason}${colors.reset}`);
    });
    console.log(`\n${colors.yellow}${colors.bright}WARNING:${colors.reset} ${colors.yellow}Ensure these secrets are not committed to version control!${colors.reset}`);
  }

  // Missing in .env.example (INFO/WARNING)
  if (result.missingInExample.length > 0) {
    if (strictMode) {
      hasIssues = true;
      printSection(`Missing in ${result.exampleFileName} (Strict Mode)`);
      result.missingInExample.forEach(key => {
        printError(`${key} (exists in ${result.envFileName} but not documented in ${result.exampleFileName})`);
      });
    } else {
      printSection('Undocumented Variables');
      result.missingInExample.forEach(key => {
        printInfo(`${key} (exists in ${result.envFileName} but not in ${result.exampleFileName})`);
      });
    }
  }

  // Summary
  console.log();
  console.log(colors.gray + '═'.repeat(50) + colors.reset);
  
  if (!hasIssues) {
    printSuccess('All checks passed! Your .env files are clean.');
    process.exit(0);
  } else {
    const errorCount = 
      result.missingInEnv.length +
      result.duplicatesInEnv.size +
      result.duplicatesInExample.size +
      result.potentialSecrets.length +
      (strictMode ? result.missingInExample.length : 0);

    printError(`Found ${errorCount} issue(s)`);
    
    if (result.missingInExample.length > 0 && !strictMode) {
      printInfo('Run with --strict to enforce .env.example documentation');
    }
    
    process.exit(1);
  }
}

// Run CLI
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
