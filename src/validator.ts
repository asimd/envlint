import { ValidationResult, EnvVar, LintOptions } from './types';
import { parseEnvFile, detectSecrets, findDuplicates } from './utils';

/**
 * Validate .env against .env.example
 */
export function validateEnv(options: LintOptions): ValidationResult {
  const envVars = parseEnvFile(options.envPath);
  const exampleVars = parseEnvFile(options.examplePath);

  const envKeys = new Set(envVars.map(v => v.key));
  const exampleKeys = new Set(exampleVars.map(v => v.key));

  // Find missing variables
  const missingInEnv = Array.from(exampleKeys).filter(key => !envKeys.has(key));
  const missingInExample = Array.from(envKeys).filter(key => !exampleKeys.has(key));

  // Find duplicates
  const duplicatesInEnv = findDuplicates(envVars);
  const duplicatesInExample = findDuplicates(exampleVars);

  // Detect potential secrets
  const potentialSecrets = options.checkSecrets ? detectSecrets(envVars) : [];

  // Unused variables (in example but not documented anywhere)
  const unusedInExample: string[] = [];

  return {
    missingInEnv,
    missingInExample,
    duplicatesInEnv,
    duplicatesInExample,
    potentialSecrets,
    unusedInExample,
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
