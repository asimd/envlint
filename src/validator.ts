import * as path from 'path';
import { ValidationResult, EnvVar, LintOptions } from './types';
import { parseEnvFile, detectSecrets, findDuplicates, filterVariables } from './utils';

/**
 * Validate .env against .env.example
 */
export function validateEnv(options: LintOptions): ValidationResult {
  const envVars = parseEnvFile(options.envPath);
  const exampleVars = parseEnvFile(options.examplePath);

  let envKeys = new Set(envVars.map(v => v.key));
  let exampleKeys = new Set(exampleVars.map(v => v.key));

  // Apply filters (exclude/only) to the comparison
  const filterOpts = {
    exclude: options.exclude,
    excludePattern: options.excludePattern,
    only: options.only,
  };

  const filteredEnvKeys = filterVariables(Array.from(envKeys), filterOpts);
  const filteredExampleKeys = filterVariables(Array.from(exampleKeys), filterOpts);

  // Find missing variables (after filtering)
  const missingInEnv = filteredExampleKeys.filter(key => !envKeys.has(key));
  const missingInExample = filteredEnvKeys.filter(key => !exampleKeys.has(key));

  // Find duplicates (check all variables, not just filtered ones)
  const duplicatesInEnv = findDuplicates(envVars);
  const duplicatesInExample = findDuplicates(exampleVars);

  // Detect potential secrets (only on filtered variables if compareMode)
  let potentialSecrets: Array<{ key: string; value: string; lineNumber: number; reason: string; confidence: number }> = [];
  if (options.checkSecrets) {
    const varsToCheck = options.compareMode 
      ? envVars.filter(v => filteredEnvKeys.includes(v.key))
      : envVars;
    potentialSecrets = detectSecrets(varsToCheck, {
      whitelist: options.secretWhitelist,
      minConfidence: options.minSecretConfidence,
    });
  }

  // Unused variables (in example but not documented anywhere)
  const unusedInExample: string[] = [];

  return {
    missingInEnv,
    missingInExample,
    duplicatesInEnv,
    duplicatesInExample,
    potentialSecrets,
    unusedInExample,
    envFileName: path.basename(options.envPath),
    exampleFileName: path.basename(options.examplePath),
  };
}

/**
 * Check if validation passed (no errors)
 */
export function hasErrors(result: ValidationResult, strict: boolean): boolean {
  const hasIssues = 
    result.missingInEnv.length > 0 ||
    result.duplicatesInEnv.size > 0 ||
    result.duplicatesInExample.size > 0 ||
    result.potentialSecrets.length > 0;

  if (strict) {
    return hasIssues || result.missingInExample.length > 0;
  }

  return hasIssues;
}
