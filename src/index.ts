#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { validateEnv, hasErrors } from './validator';
import { generateExample, fileExists, resolvePath, checkGitignore, addToGitignore, loadConfig, createDefaultConfig } from './utils';
import { LintOptions, EnvLintConfig } from './types';

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
  console.log(`${colors.cyan}${colors.bright}envlint${colors.reset} ${colors.gray}v1.2.0${colors.reset}\n`);
}

function printHelp() {
  console.log(`
${colors.bright}envlint${colors.reset} - Validate your .env files

${colors.bright}QUICK START:${colors.reset}
  ${colors.green}npx @asimdelal/envlint${colors.reset}              Just run it - that's it!
  ${colors.green}npx @asimdelal/envlint --init${colors.reset}       Create config file (optional)

${colors.bright}COMMON COMMANDS:${colors.reset}
  envlint                            Check .env vs .env.example
  envlint -g                         Generate .env.example from .env
  envlint -g .env.docker             Generate from specific env file
  envlint -c .env.staging .env.prod  Compare two environments
  envlint --fix                      Auto-fix duplicates
  envlint --protect                  Add .env to .gitignore

${colors.bright}OPTIONS:${colors.reset}
  -g, --generate [file]       Generate .env.example (from .env or specified file)
  -s, --strict                Fail on undocumented variables
  -c, --compare <file1,file2> Compare two files (comma or space separated)
  --fix                       Auto-fix issues
  --protect                   Add to .gitignore
  --init                      Create config file
  -h, --help                  Show this help

${colors.bright}ADVANCED:${colors.reset}
  -e, --env <file>            Use different env file
  -x, --example <file>        Use different example file
  --exclude <vars>            Skip variables (comma-separated)
  --no-secrets                Skip secret detection
  --min-confidence <0-1>      Secret detection threshold (default: 0.7)

${colors.bright}EXAMPLES:${colors.reset}
  ${colors.gray}# Just validate${colors.reset}
  envlint

  ${colors.gray}# Generate from .env.docker${colors.reset}
  envlint -g .env.docker

  ${colors.gray}# Compare staging vs production (space-separated)${colors.reset}
  envlint -c .env.staging .env.production --exclude NODE_ENV,PORT

  ${colors.gray}# Use config file for team consistency${colors.reset}
  envlint --init
  envlint

${colors.bright}MORE INFO:${colors.reset}
  Docs: https://github.com/asimd/envlint
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

/**
 * Simple yes/no prompt for interactive mode
 */
async function prompt(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(`${question} ${colors.gray}(y/n)${colors.reset} `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  if (args.includes('-h') || args.includes('--help')) {
    printBanner();
    printHelp();
    process.exit(0);
  }
  
  // Get directory first (needed for config loading and --init)
  const envFileArg = args.find((arg, i) => (args[i - 1] === '--env' || args[i - 1] === '-e') && !arg.startsWith('-'));
  const exampleFileArg = args.find((arg, i) => (args[i - 1] === '--example' || args[i - 1] === '-x') && !arg.startsWith('-'));
  
  // Support source file for generate mode: envlint -g .env.docker
  const generateIndex = args.findIndex(arg => arg === '-g' || arg === '--generate');
  const generateSourceArg = generateIndex !== -1 ? args[generateIndex + 1] : undefined;
  const isGenerateSource = generateSourceArg && !generateSourceArg.startsWith('-');
  
  // Handle compare args - support both comma-separated and space-separated
  let compareArg: string | undefined;
  let compareArg2: string | undefined;
  const compareIndex = args.findIndex(arg => arg === '--compare' || arg === '-c');
  if (compareIndex !== -1) {
    const firstArg = args[compareIndex + 1];
    if (firstArg && !firstArg.startsWith('-')) {
      compareArg = firstArg;
      // Check if it's comma-separated or if there's a second space-separated arg
      if (!firstArg.includes(',')) {
        const secondArg = args[compareIndex + 2];
        if (secondArg && !secondArg.startsWith('-')) {
          compareArg2 = secondArg;
        }
      }
    }
  }
  
  const excludeArg = args.find((arg, i) => args[i - 1] === '--exclude' && !arg.startsWith('-'));
  const excludePatternArg = args.find((arg, i) => args[i - 1] === '--exclude-pattern' && !arg.startsWith('-'));
  const onlyArg = args.find((arg, i) => args[i - 1] === '--only' && !arg.startsWith('-'));
  const secretWhitelistArg = args.find((arg, i) => args[i - 1] === '--secret-whitelist' && !arg.startsWith('-'));
  const minConfidenceArg = args.find((arg, i) => args[i - 1] === '--min-confidence' && !arg.startsWith('-'));
  
  const dirArg = args.find(arg => !arg.startsWith('-') && arg !== envFileArg && arg !== exampleFileArg && arg !== compareArg && arg !== compareArg2 && arg !== excludeArg && arg !== excludePatternArg && arg !== onlyArg && arg !== secretWhitelistArg && arg !== minConfidenceArg && arg !== generateSourceArg) || '.';
  const targetDir = resolvePath(dirArg);

  if (!fs.existsSync(targetDir)) {
    printError(`Directory not found: ${targetDir}`);
    process.exit(1);
  }

  // Handle --init command
  if (args.includes('--init')) {
    printBanner();
    const configPath = path.join(targetDir, '.envlintrc.json');
    
    if (fs.existsSync(configPath)) {
      printWarning('.envlintrc.json already exists');
      const shouldOverwrite = await prompt('Overwrite existing config?');
      if (!shouldOverwrite) {
        printInfo('Cancelled');
        process.exit(0);
      }
    }
    
    createDefaultConfig(targetDir);
    printSuccess(`.envlintrc.json created at ${configPath}`);
    console.log();
    printInfo('Edit .envlintrc.json to customize your settings');
    printInfo('Run "envlint" to validate with your config');
    process.exit(0);
  }
  
  // Load config file if it exists
  const config = loadConfig(targetDir) || {};

  // Parse modes and options
  const generateMode = args.includes('-g') || args.includes('--generate');
  const fixMode = args.includes('--fix');
  const protectMode = args.includes('--protect');
  const protectInteractiveMode = args.includes('--protect-interactive');
  const checkGitignoreMode = args.includes('--check-gitignore');
  const compareMode = !!compareArg;

  // Merge config with CLI args (CLI args take precedence)
  const strictMode = args.includes('-s') || args.includes('--strict') || config.strict || false;
  const checkSecrets = args.includes('--no-secrets') ? false : (config.checkSecrets !== false);
  
  // Parse filter options from CLI or config
  const excludeVars = excludeArg 
    ? excludeArg.split(',').map(v => v.trim()) 
    : (config.exclude || undefined);
    
  const excludePattern = excludePatternArg 
    ? new RegExp(excludePatternArg) 
    : (config.excludePattern ? new RegExp(config.excludePattern) : undefined);
    
  const onlyVars = onlyArg 
    ? onlyArg.split(',').map(v => v.trim()) 
    : (config.only || undefined);
    
  const secretWhitelist = secretWhitelistArg 
    ? secretWhitelistArg.split(',').map(v => v.trim()) 
    : (config.secretWhitelist || undefined);
    
  const minSecretConfidence = minConfidenceArg 
    ? parseFloat(minConfidenceArg) 
    : (config.minSecretConfidence || undefined);

  let envPath: string;
  let examplePath: string;

  // Handle compare mode
  if (compareMode && compareArg) {
    let files: string[];
    
    // Support both comma-separated and space-separated formats
    if (compareArg.includes(',')) {
      // Comma-separated: --compare .env.staging,.env.production
      files = compareArg.split(',').map(f => f.trim());
    } else if (compareArg2) {
      // Space-separated: --compare .env.staging .env.production
      files = [compareArg, compareArg2];
    } else {
      // Only one file provided
      files = [compareArg];
    }
    
    if (files.length !== 2) {
      printError('--compare requires exactly 2 files');
      printInfo('Usage: --compare .env.staging,.env.production  (comma-separated)');
      printInfo('   or: --compare .env.staging .env.production  (space-separated)');
      process.exit(1);
    }
    envPath = path.isAbsolute(files[0]) ? files[0] : path.join(targetDir, files[0]);
    examplePath = path.isAbsolute(files[1]) ? files[1] : path.join(targetDir, files[1]);
  } else {
    envPath = envFileArg ? path.join(targetDir, envFileArg) : path.join(targetDir, '.env');
    examplePath = exampleFileArg ? path.join(targetDir, exampleFileArg) : path.join(targetDir, '.env.example');
  }

  printBanner();
  
  // Show config status
  if (config && Object.keys(config).length > 0) {
    printInfo('Using .envlintrc.json configuration');
  }

  // Generate mode
  if (generateMode) {
    // If source file specified via -g argument (e.g., envlint -g .env.docker)
    let sourceEnvPath = envPath;
    if (isGenerateSource && generateSourceArg) {
      sourceEnvPath = path.isAbsolute(generateSourceArg) 
        ? generateSourceArg 
        : path.join(targetDir, generateSourceArg);
    }
    
    // If source doesn't exist, try to find an available env file
    if (!fileExists(sourceEnvPath)) {
      const allEnvFiles = fs.readdirSync(targetDir)
        .filter(file => file.startsWith('.env') && !file.endsWith('.example') && !file.endsWith('.sample'))
        .sort();
      
      if (allEnvFiles.length === 0) {
        printError('No .env files found to generate from');
        printInfo('Create a .env file first, or specify a source file:');
        printInfo('  envlint -g .env.docker');
        process.exit(1);
      }
      
      // Auto-select first available env file
      const autoSelected = allEnvFiles[0];
      printInfo(`Found ${allEnvFiles.length} .env file(s): ${allEnvFiles.join(', ')}`);
      printInfo(`Auto-selecting: ${autoSelected}`);
      sourceEnvPath = path.join(targetDir, autoSelected);
    }

    const sourceFileName = path.basename(sourceEnvPath);
    printInfo(`Generating .env.example from ${sourceFileName}...`);
    const envVars = require('./utils').parseEnvFile(sourceEnvPath);
    generateExample(envVars, examplePath);
    printSuccess(`.env.example generated at ${examplePath}`);
    process.exit(0);
  }

  // Protect mode - add to .gitignore
  if (protectMode || protectInteractiveMode || checkGitignoreMode) {
    const gitignoreCheck = checkGitignore(targetDir);
    
    printSection('.gitignore Protection Status');
    
    if (!gitignoreCheck.hasGitignore) {
      printWarning('.gitignore file not found');
      if (protectMode || protectInteractiveMode) {
        printInfo('Creating .gitignore with env file patterns...');
      }
    } else {
      if (gitignoreCheck.protectedPatterns.length > 0) {
        printSuccess('.gitignore exists with env protection');
        console.log(`  ${colors.gray}Protected patterns: ${gitignoreCheck.protectedPatterns.join(', ')}${colors.reset}`);
      } else {
        printWarning('.gitignore exists but env files are NOT protected');
      }
    }

    if (gitignoreCheck.actualEnvFiles.length > 0) {
      console.log(`\n  ${colors.cyan}Found env files:${colors.reset}`);
      gitignoreCheck.actualEnvFiles.forEach(file => {
        console.log(`    ${colors.gray}• ${file}${colors.reset}`);
      });
    }

    if (gitignoreCheck.missingPatterns.length > 0) {
      console.log(`\n  ${colors.yellow}Missing patterns:${colors.reset}`);
      gitignoreCheck.missingPatterns.forEach(pattern => {
        console.log(`    ${colors.gray}• ${pattern}${colors.reset}`);
      });
    }

    // Interactive mode - ask user which patterns to add
    if (protectInteractiveMode && gitignoreCheck.missingPatterns.length > 0) {
      console.log();
      printInfo('Select patterns to add to .gitignore:');
      
      const patternsToAdd: string[] = [];
      for (const pattern of gitignoreCheck.missingPatterns) {
        const shouldAdd = await prompt(`  Add "${pattern}"?`);
        if (shouldAdd) {
          patternsToAdd.push(pattern);
        }
      }
      
      if (patternsToAdd.length > 0) {
        console.log();
        const result = addToGitignore(targetDir, patternsToAdd);
        
        if (result.created) {
          printSuccess('Created .gitignore');
        }
        
        if (result.added.length > 0) {
          printSuccess(`Added ${result.added.length} pattern(s) to .gitignore`);
          result.added.forEach(pattern => {
            console.log(`  ${colors.gray}• ${pattern}${colors.reset}`);
          });
        }
        
        console.log();
        printSuccess('Your selected env files are now protected!');
      } else {
        printInfo('No patterns selected');
      }
    } 
    // Auto mode - add all patterns
    else if (protectMode && gitignoreCheck.missingPatterns.length > 0) {
      console.log();
      printInfo('Adding env file patterns to .gitignore...');
      const result = addToGitignore(targetDir, gitignoreCheck.missingPatterns);
      
      if (result.created) {
        printSuccess('Created .gitignore');
      }
      
      if (result.added.length > 0) {
        printSuccess(`Added ${result.added.length} pattern(s) to .gitignore`);
        result.added.forEach(pattern => {
          console.log(`  ${colors.gray}• ${pattern}${colors.reset}`);
        });
      } else {
        printInfo('All patterns already in .gitignore');
      }
      
      console.log();
      printSuccess('Your env files are now protected!');
    } else if (checkGitignoreMode) {
      console.log();
      if (gitignoreCheck.missingPatterns.length === 0) {
        printSuccess('All env files are protected in .gitignore');
      } else {
        printWarning('Some env file patterns are missing from .gitignore');
        printInfo('Run with --protect to add them automatically');
        printInfo('Or use --protect-interactive to choose which patterns to add');
      }
    }
    
    process.exit(gitignoreCheck.missingPatterns.length > 0 && checkGitignoreMode ? 1 : 0);
  }

  // Validation mode
  console.log(`${colors.gray}Directory: ${targetDir}${colors.reset}\n`);

  // Show filter info if active
  if (compareMode) {
    printInfo(`Compare mode: ${path.basename(envPath)} ↔ ${path.basename(examplePath)}`);
  }
  if (excludeVars && excludeVars.length > 0) {
    printInfo(`Excluding variables: ${excludeVars.join(', ')}`);
  }
  if (excludePattern) {
    printInfo(`Excluding pattern: ${excludePattern.source}`);
  }
  if (onlyVars && onlyVars.length > 0) {
    printInfo(`Only checking: ${onlyVars.join(', ')}`);
  }
  if (secretWhitelist && secretWhitelist.length > 0) {
    printInfo(`Secret detection whitelist: ${secretWhitelist.join(', ')}`);
  }
  if (minSecretConfidence !== undefined) {
    printInfo(`Secret detection confidence threshold: ${Math.round(minSecretConfidence * 100)}%`);
  }
  if (excludeVars || excludePattern || onlyVars || secretWhitelist || minSecretConfidence !== undefined) {
    console.log();
  }

  // Detect all .env files (skip in compare mode)
  let envExists = fileExists(envPath);
  let exampleExists = fileExists(examplePath);

  if (!compareMode) {
    const allEnvFiles = fs.readdirSync(targetDir)
      .filter(file => file.startsWith('.env') && !file.endsWith('.example') && !file.endsWith('.sample'))
      .sort();

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
  } else {
    // In compare mode, just update the existence flags
    envExists = fileExists(envPath);
    exampleExists = fileExists(examplePath);
  }

  if (!envExists && !exampleExists) {
    if (compareMode) {
      printError('Both comparison files not found');
      printInfo(`File 1: ${envPath}`);
      printInfo(`File 2: ${examplePath}`);
    } else {
      printError('No .env files found');
      printInfo('Run with -g to generate .env.example');
    }
    process.exit(1);
  }

  if (!envExists) {
    if (compareMode) {
      printError(`File not found: ${envPath}`);
    } else {
      printWarning(`.env file not found`);
      if (!compareMode) {
        const allEnvFiles = fs.readdirSync(targetDir)
          .filter(file => file.startsWith('.env') && !file.endsWith('.example') && !file.endsWith('.sample'))
          .sort();
        if (allEnvFiles.length > 0) {
          printInfo(`Available files: ${allEnvFiles.join(', ')}`);
          printInfo(`Use: envlint --env ${allEnvFiles[0]}`);
        } else {
          printInfo('Create .env from .env.example template');
        }
      }
    }
    process.exit(1);
  }

  if (!exampleExists) {
    if (compareMode) {
      printError(`File not found: ${examplePath}`);
    } else {
      printWarning('.env.example not found');
      printInfo('Run with -g to generate it from .env');
    }
    process.exit(1);
  }

  const options: LintOptions = {
    envPath,
    examplePath,
    generateExample: false,
    checkSecrets,
    strict: strictMode,
    exclude: excludeVars,
    excludePattern,
    only: onlyVars,
    compareMode,
    secretWhitelist,
    minSecretConfidence,
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
    result.potentialSecrets.forEach(({ key, value, lineNumber, reason, confidence }) => {
      const confidencePercent = Math.round(confidence * 100);
      const confidenceColor = confidence >= 0.9 ? colors.red : confidence >= 0.8 ? colors.yellow : colors.gray;
      printWarning(`${key} = ${value}`);
      console.log(`   ${colors.gray}Line ${lineNumber}: ${reason}${colors.reset}`);
      console.log(`   ${confidenceColor}Confidence: ${confidencePercent}%${colors.reset}`);
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

  // Check .gitignore protection (only in non-compare mode)
  if (!compareMode) {
    const gitignoreCheck = checkGitignore(targetDir);
    if (gitignoreCheck.actualEnvFiles.length > 0 && gitignoreCheck.missingPatterns.length > 0) {
      console.log();
      printWarning('Some env files may not be protected by .gitignore');
      printInfo('Run with --check-gitignore to see details, or --protect to fix automatically');
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
  main().catch((error) => {
    console.error(`${colors.red}Error:${colors.reset}`, error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
