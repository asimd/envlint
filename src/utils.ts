import * as fs from 'fs';
import * as path from 'path';
import { EnvVar } from './types';

/**
 * Parse .env file and extract variables
 */
export function parseEnvFile(filePath: string): EnvVar[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const vars: EnvVar[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    // Parse KEY=VALUE format
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1];
      let value = match[2];

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      vars.push({
        key,
        value,
        lineNumber: index + 1,
      });
    }
  });

  return vars;
}

/**
 * Detect potential secrets in environment variables
 */
export function detectSecrets(envVars: EnvVar[]): Array<{ key: string; value: string; lineNumber: number; reason: string }> {
  const secrets: Array<{ key: string; value: string; lineNumber: number; reason: string }> = [];

  // Patterns that indicate secrets
  const secretKeyPatterns = [
    /password/i,
    /secret/i,
    /api[_-]?key/i,
    /private[_-]?key/i,
    /token/i,
    /auth/i,
    /credential/i,
    /jwt/i,
    /bearer/i,
  ];

  // Patterns that look like secret values
  const secretValuePatterns = [
    { pattern: /^sk-[a-zA-Z0-9]{20,}$/, reason: 'OpenAI API key format' },
    { pattern: /^xox[baprs]-[a-zA-Z0-9-]+$/, reason: 'Slack token format' },
    { pattern: /^gh[ps]_[a-zA-Z0-9]{36,}$/, reason: 'GitHub token format' },
    { pattern: /^[A-Za-z0-9+/]{40,}={0,2}$/, reason: 'Base64-encoded secret (40+ chars)' },
    { pattern: /^[0-9a-f]{32,}$/i, reason: 'Hex-encoded secret (32+ chars)' },
    { pattern: /-----BEGIN (RSA |DSA )?PRIVATE KEY-----/, reason: 'Private key detected' },
  ];

  for (const envVar of envVars) {
    const { key, value, lineNumber } = envVar;

    // Skip empty values
    if (!value || value.length === 0) {
      continue;
    }

    // Check if key name suggests it's a secret
    const keyLooksLikeSecret = secretKeyPatterns.some(pattern => pattern.test(key));

    // Check if value looks like a secret
    for (const { pattern, reason } of secretValuePatterns) {
      if (pattern.test(value)) {
        secrets.push({ key, value: maskSecret(value), lineNumber, reason });
        break;
      }
    }

    // If key suggests secret but value doesn't match patterns, still flag if value is long enough
    if (keyLooksLikeSecret && value.length > 20 && !secrets.some(s => s.key === key)) {
      secrets.push({ 
        key, 
        value: maskSecret(value), 
        lineNumber, 
        reason: 'Key name suggests secret value' 
      });
    }
  }

  return secrets;
}

/**
 * Mask secret value for display
 */
function maskSecret(value: string): string {
  if (value.length <= 8) {
    return '***';
  }
  return value.substring(0, 4) + '***' + value.substring(value.length - 4);
}

/**
 * Find duplicates in array and return map of key to line numbers
 */
export function findDuplicates(envVars: EnvVar[]): Map<string, number[]> {
  const keyMap = new Map<string, number[]>();

  for (const { key, lineNumber } of envVars) {
    if (!keyMap.has(key)) {
      keyMap.set(key, []);
    }
    keyMap.get(key)!.push(lineNumber);
  }

  // Filter to only duplicates
  const duplicates = new Map<string, number[]>();
  for (const [key, lineNumbers] of keyMap.entries()) {
    if (lineNumbers.length > 1) {
      duplicates.set(key, lineNumbers);
    }
  }

  return duplicates;
}

/**
 * Generate .env.example from .env file
 */
export function generateExample(envVars: EnvVar[], outputPath: string): void {
  const lines: string[] = [
    '# Environment Variables Example',
    '# Copy this file to .env and fill in your values',
    '',
  ];

  for (const { key, value } of envVars) {
    // Create example value
    let exampleValue = '';
    
    // If it looks like a URL, keep the structure
    if (value.startsWith('http://') || value.startsWith('https://')) {
      exampleValue = value.replace(/\/\/[^/]+/, '//your-domain-here');
    } else if (value.includes('@') && value.includes('.')) {
      // Looks like an email
      exampleValue = 'your-email@example.com';
    } else if (!isNaN(Number(value))) {
      // Numeric value
      exampleValue = '0';
    } else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
      // Boolean
      exampleValue = 'false';
    } else {
      // Generic placeholder
      exampleValue = '';
    }

    lines.push(`${key}=${exampleValue}`);
  }

  fs.writeFileSync(outputPath, lines.join('\n') + '\n');
}

/**
 * Check if file exists
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Resolve path relative to current directory
 */
export function resolvePath(inputPath: string): string {
  return path.resolve(process.cwd(), inputPath);
}
