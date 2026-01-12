import * as fs from 'fs';
import * as path from 'path';
import { EnvVar, EnvLintConfig } from './types';

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
 * Calculate Shannon entropy of a string
 * High entropy (>4.5) suggests random/secret data
 */
function calculateEntropy(str: string): number {
  if (!str || str.length === 0) return 0;
  
  const freq: { [key: string]: number } = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  
  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  
  return entropy;
}

/**
 * Infer the type of value to avoid false positives
 */
function inferValueType(value: string): {
  type: 'url' | 'uuid' | 'boolean' | 'number' | 'email' | 'path' | 'public_key' | 'color' | 'unknown';
  confidence: number;
} {
  // URLs (very high confidence)
  if (/^https?:\/\//i.test(value) || /^wss?:\/\//i.test(value) || /^ftp:\/\//i.test(value)) {
    return { type: 'url', confidence: 0.99 };
  }
  
  // UUIDs (high confidence) - standard format
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return { type: 'uuid', confidence: 0.98 };
  }
  
  // Public keys (PEM format)
  if (/-----BEGIN (RSA |EC )?PUBLIC KEY-----/.test(value)) {
    return { type: 'public_key', confidence: 0.99 };
  }
  
  // Booleans
  if (/^(true|false|yes|no|on|off|enabled?|disabled?)$/i.test(value)) {
    return { type: 'boolean', confidence: 0.95 };
  }
  
  // Numbers (including floats, negative)
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return { type: 'number', confidence: 0.95 };
  }
  
  // Email addresses
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
    return { type: 'email', confidence: 0.9 };
  }
  
  // File paths (unix or windows)
  if (/^(\/|\.\/|\.\.\/|[A-Z]:\\)/i.test(value) && value.includes('/') || value.includes('\\')) {
    return { type: 'path', confidence: 0.85 };
  }
  
  // Hex color codes
  if (/^#[0-9a-f]{3,8}$/i.test(value)) {
    return { type: 'color', confidence: 0.95 };
  }
  
  return { type: 'unknown', confidence: 0 };
}

/**
 * Check if value matches known service-specific secret patterns
 * Returns confidence level: 1.0 = definitely a secret, 0 = not a secret
 */
function checkServiceSecretPatterns(value: string): { isSecret: boolean; reason: string; confidence: number } | null {
    // Airtable
  if (/^key[a-zA-Z0-9]{14}$/.test(value)) {
    return { isSecret: true, reason: 'Airtable API Key', confidence: 0.95 };
  }
  if (/^pat[a-zA-Z0-9]{14}\.[a-zA-Z0-9]{64}$/.test(value)) {
    return { isSecret: true, reason: 'Airtable Personal Access Token', confidence: 0.99 };
  }
  
  // Anthropic (Claude AI)
  if (/^sk-ant-[a-zA-Z0-9_-]{95,}$/.test(value)) {
    return { isSecret: true, reason: 'Anthropic API Key', confidence: 0.99 };
  }
  
  // Asana
  if (/^[0-9]\/[0-9]{16}:[a-f0-9]{32}$/.test(value)) {
    return { isSecret: true, reason: 'Asana Personal Access Token', confidence: 0.99 };
  }
  
  // AWS
  if (/^AKIA[0-9A-Z]{16}$/.test(value)) {
    return { isSecret: true, reason: 'AWS Access Key ID', confidence: 0.99 };
  }
  if (/^ASIA[0-9A-Z]{16}$/.test(value)) {
    return { isSecret: true, reason: 'AWS Session Token', confidence: 0.99 };
  }
  
  // Azure
  if (/DefaultEndpointsProtocol=https;.*AccountKey=[a-zA-Z0-9+/]{86}==/.test(value)) {
    return { isSecret: true, reason: 'Azure Storage Account Key', confidence: 0.99 };
  }
  
  
  // Databricks
  if (/^dapi[a-f0-9]{32}$/.test(value)) {
    return { isSecret: true, reason: 'Databricks Access Token', confidence: 0.99 };
  }
  
  
  // DigitalOcean
  if (/^dop_v1_[a-f0-9]{64}$/.test(value)) {
    return { isSecret: true, reason: 'DigitalOcean Personal Access Token', confidence: 0.99 };
  }
  if (/^doo_v1_[a-f0-9]{64}$/.test(value)) {
    return { isSecret: true, reason: 'DigitalOcean OAuth Token', confidence: 0.99 };
  }
  if (/^dor_v1_[a-f0-9]{64}$/.test(value)) {
    return { isSecret: true, reason: 'DigitalOcean Refresh Token', confidence: 0.99 };
  }
  
  // Docker Hub
  if (/^dckr_pat_[a-zA-Z0-9_-]{20,}$/.test(value)) {
    return { isSecret: true, reason: 'Docker Hub Personal Access Token', confidence: 0.99 };
  }
  
  // Dropbox
  if (/^sl\.[a-zA-Z0-9_-]{135,}$/.test(value)) {
    return { isSecret: true, reason: 'Dropbox Access Token', confidence: 0.99 };
  }
  
  
  
  // Figma
  if (/^figd_[a-zA-Z0-9_-]{30,}$/.test(value)) {
    return { isSecret: true, reason: 'Figma Personal Access Token', confidence: 0.99 };
  }
  
  // GitHub (multiple formats)
  if (/^gh[ps]_[a-zA-Z0-9]{36,}$/.test(value)) {
    return { isSecret: true, reason: 'GitHub Personal Access Token', confidence: 0.99 };
  }
  if (/^github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}$/.test(value)) {
    return { isSecret: true, reason: 'GitHub Fine-grained PAT', confidence: 0.99 };
  }
  if (/^gho_[a-zA-Z0-9]{36,}$/.test(value)) {
    return { isSecret: true, reason: 'GitHub OAuth Token', confidence: 0.99 };
  }
  if (/^ghu_[a-zA-Z0-9]{36,}$/.test(value)) {
    return { isSecret: true, reason: 'GitHub User Token', confidence: 0.99 };
  }
  if (/^ghr_[a-zA-Z0-9]{36,}$/.test(value)) {
    return { isSecret: true, reason: 'GitHub Refresh Token', confidence: 0.99 };
  }
  
  // GitLab (all token types)
  if (/^glpat-[a-zA-Z0-9_-]{20,}$/.test(value)) {
    return { isSecret: true, reason: 'GitLab Personal Access Token', confidence: 0.99 };
  }
  if (/^gldt-[a-zA-Z0-9_-]{20,}$/.test(value)) {
    return { isSecret: true, reason: 'GitLab Deploy Token', confidence: 0.99 };
  }
  if (/^glrt-[a-zA-Z0-9_-]{20,}$/.test(value)) {
    return { isSecret: true, reason: 'GitLab Runner Token', confidence: 0.99 };
  }
  if (/^gloas-[a-zA-Z0-9_-]{20,}$/.test(value)) {
    return { isSecret: true, reason: 'GitLab OAuth Application Secret', confidence: 0.99 };
  }
  
  // Google Cloud
  if (/^AIza[0-9A-Za-z_-]{35}$/.test(value)) {
    return { isSecret: true, reason: 'Google Cloud API Key', confidence: 0.99 };
  }
  
  // Groq
  if (/^gsk_[a-zA-Z0-9]{52}$/.test(value)) {
    return { isSecret: true, reason: 'Groq API Key', confidence: 0.99 };
  }
  
  // HuggingFace
  if (/^hf_[a-zA-Z0-9]{20,}$/.test(value)) {
    return { isSecret: true, reason: 'HuggingFace Access Token', confidence: 0.99 };
  }
  
  // Jira - Pattern too generic (24-char alphanumeric), use entropy-based detection instead
  
  // LaunchDarkly
  if (/^api-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)) {
    return { isSecret: true, reason: 'LaunchDarkly API Key', confidence: 0.99 };
  }
  
  // Mailchimp
  if (/^[a-f0-9]{32}-us[0-9]{1,2}$/.test(value)) {
    return { isSecret: true, reason: 'Mailchimp API Key', confidence: 0.95 };
  }
  
  // Mailgun
  if (/^key-[a-f0-9]{32}$/.test(value)) {
    return { isSecret: true, reason: 'Mailgun API Key', confidence: 0.99 };
  }
  if (/^pubkey-[a-f0-9]{32}$/.test(value)) {
    return { isSecret: true, reason: 'Mailgun Public Key', confidence: 0.95 };
  }
  
  // Monday.com
  if (/^eyJ[a-zA-Z0-9_-]{30,}\.[a-zA-Z0-9_-]{30,}\.[a-zA-Z0-9_-]{30,}$/.test(value)) {
    return { isSecret: true, reason: 'Monday.com API Token (JWT)', confidence: 0.85 };
  }
  
  
  // MySQL connection strings
  if (/mysql:\/\/[^:]+:[^@]+@/.test(value)) {
    return { isSecret: true, reason: 'MySQL Connection String with credentials', confidence: 0.95 };
  }
    
  // Notion
  if (/^secret_[a-zA-Z0-9]{30,}$/.test(value)) {
    return { isSecret: true, reason: 'Notion Integration Token', confidence: 0.99 };
  }
  if (/^ntn_[a-zA-Z0-9]{40,}$/.test(value)) {
    return { isSecret: true, reason: 'Notion API Token', confidence: 0.99 };
  }
  
  // OpenAI
  if (/^sk-[a-zA-Z0-9]{20,}$/.test(value)) {
    return { isSecret: true, reason: 'OpenAI API Key', confidence: 0.99 };
  }
  if (/^sk-proj-[a-zA-Z0-9]{20,}$/.test(value)) {
    return { isSecret: true, reason: 'OpenAI Project API Key', confidence: 0.99 };
  }
  
  // Opsgenie - UUID format is too generic (false positives), use entropy-based detection instead
  
  // Plaid
  if (/^(access|development|sandbox|production)-[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}$/.test(value)) {
    return { isSecret: true, reason: 'Plaid API Key', confidence: 0.95 };
  }
  
  // PlanetScale
  if (/^pscale_tkn_[a-zA-Z0-9_.-]{43,}$/.test(value)) {
    return { isSecret: true, reason: 'PlanetScale API Token', confidence: 0.99 };
  }
  if (/^pscale_oauth_[a-zA-Z0-9_.-]{32,}$/.test(value)) {
    return { isSecret: true, reason: 'PlanetScale OAuth Token', confidence: 0.99 };
  }
  
  // Postgres connection strings
  if (/(postgres|postgresql):\/\/[^:]+:[^@]+@/.test(value)) {
    return { isSecret: true, reason: 'PostgreSQL Connection String with credentials', confidence: 0.95 };
  }
  
  // PostHog
  if (/^phc_[a-zA-Z0-9]{30,}$/.test(value)) {
    return { isSecret: true, reason: 'PostHog API Key', confidence: 0.99 };
  }
  
  // Postman
  if (/^PMAK-[a-f0-9]{24}-[a-f0-9]{34}$/.test(value)) {
    return { isSecret: true, reason: 'Postman API Key', confidence: 0.99 };
  }
  
  // SendGrid
  if (/^SG\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{30,}$/.test(value)) {
    return { isSecret: true, reason: 'SendGrid API Key', confidence: 0.99 };
  }
  
  // Shopify
  if (/^shpat_[a-fA-F0-9]{32}$/.test(value)) {
    return { isSecret: true, reason: 'Shopify Private App Token', confidence: 0.99 };
  }
  if (/^shpss_[a-fA-F0-9]{32}$/.test(value)) {
    return { isSecret: true, reason: 'Shopify Shared Secret', confidence: 0.99 };
  }
  if (/^shpca_[a-fA-F0-9]{32}$/.test(value)) {
    return { isSecret: true, reason: 'Shopify Custom App Token', confidence: 0.99 };
  }
  
  // Slack
  if (/^xox[baprs]-[a-zA-Z0-9-]+$/.test(value)) {
    return { isSecret: true, reason: 'Slack Token', confidence: 0.99 };
  }
  
  // Sourcegraph
  if (/^sgp_[a-f0-9]{40}_[a-f0-9]{40}$/.test(value)) {
    return { isSecret: true, reason: 'Sourcegraph Access Token', confidence: 0.99 };
  }
  
  // Square
  if (/^sq0atp-[a-zA-Z0-9_-]{22}$/.test(value)) {
    return { isSecret: true, reason: 'Square Access Token (Production)', confidence: 0.99 };
  }
  if (/^sq0csp-[a-zA-Z0-9_-]{43}$/.test(value)) {
    return { isSecret: true, reason: 'Square Access Token (Sandbox)', confidence: 0.99 };
  }
  
  // Stripe
  if (/^sk_(live|test)_[a-zA-Z0-9]{24,}$/.test(value)) {
    return { isSecret: true, reason: 'Stripe Secret Key', confidence: 0.99 };
  }
  if (/^rk_(live|test)_[a-zA-Z0-9]{24,}$/.test(value)) {
    return { isSecret: true, reason: 'Stripe Restricted Key', confidence: 0.99 };
  }
  
  // Twilio
  if (/^SK[a-f0-9]{32}$/.test(value)) {
    return { isSecret: true, reason: 'Twilio API Key', confidence: 0.99 };
  }
  if (/^AC[a-f0-9]{32}$/.test(value)) {
    return { isSecret: true, reason: 'Twilio Account SID', confidence: 0.95 };
  }
  
  // NPM tokens
  if (/^npm_[a-zA-Z0-9]{20,}$/.test(value)) {
    return { isSecret: true, reason: 'NPM Access Token', confidence: 0.99 };
  }
  
  // PyPI tokens
  if (/^pypi-AgEIcHlwaS5vcmc[a-zA-Z0-9_-]{70,}$/.test(value)) {
    return { isSecret: true, reason: 'PyPI API Token', confidence: 0.99 };
  }
  
  // Private keys (PEM format) - but NOT public keys
  if (/-----BEGIN (RSA |DSA |EC )?PRIVATE KEY-----/.test(value)) {
    return { isSecret: true, reason: 'Private Key (PEM format)', confidence: 1.0 };
  }
  if (/-----BEGIN OPENSSH PRIVATE KEY-----/.test(value)) {
    return { isSecret: true, reason: 'OpenSSH Private Key', confidence: 1.0 };
  }
  
  // JWT tokens (three parts separated by dots)
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value) && value.length > 100) {
    return { isSecret: true, reason: 'JWT Token', confidence: 0.85 };
  }
  
  return null;
}

/**
 * Detect potential secrets in environment variables with smart analysis
 */
export function detectSecrets(
  envVars: EnvVar[],
  options: { whitelist?: string[]; minConfidence?: number } = {}
): Array<{ key: string; value: string; lineNumber: number; reason: string; confidence: number }> {
  const secrets: Array<{ key: string; value: string; lineNumber: number; reason: string; confidence: number }> = [];
  const whitelist = options.whitelist || [];
  const minConfidence = options.minConfidence || 0.7; // Default: 70% confidence threshold

  // Patterns that indicate secrets in key names
  const secretKeyPatterns = [
    { pattern: /password/i, weight: 0.8 },
    { pattern: /secret/i, weight: 0.8 },
    { pattern: /^api[_-]?key$/i, weight: 0.9 }, // Exact match for API_KEY
    { pattern: /private[_-]?key/i, weight: 0.9 },
    { pattern: /^token$/i, weight: 0.7 }, // Exact TOKEN
    { pattern: /_token$/i, weight: 0.8 }, // Ends with _TOKEN
    { pattern: /credential/i, weight: 0.8 },
    { pattern: /^jwt$/i, weight: 0.7 },
    { pattern: /bearer/i, weight: 0.7 },
  ];

  for (const envVar of envVars) {
    const { key, value, lineNumber } = envVar;

    // Skip if whitelisted
    if (whitelist.includes(key)) {
      continue;
    }

    // Skip empty values
    if (!value || value.length === 0) {
      continue;
    }

    // Check value type first to avoid false positives
    const valueType = inferValueType(value);
    
    // If it's clearly not a secret type, skip
    if (['url', 'boolean', 'number', 'email', 'path', 'public_key', 'color'].includes(valueType.type)) {
      continue;
    }

    // Check for service-specific secret patterns (high confidence)
    const serviceMatch = checkServiceSecretPatterns(value);
    if (serviceMatch && serviceMatch.confidence >= minConfidence) {
      secrets.push({
        key,
        value: maskSecret(value),
        lineNumber,
        reason: serviceMatch.reason,
        confidence: serviceMatch.confidence,
      });
      continue;
    }

    // Calculate entropy for unknown value types
    const entropy = calculateEntropy(value);
    
    // Check if key name suggests it's a secret
    let keySecretScore = 0;
    for (const { pattern, weight } of secretKeyPatterns) {
      if (pattern.test(key)) {
        keySecretScore = Math.max(keySecretScore, weight);
      }
    }

    // Smart detection logic
    if (keySecretScore > 0) {
      // Key suggests secret - need additional evidence
      
      // High entropy + long enough + secret key name = likely secret
      if (entropy > 4.5 && value.length > 20) {
        const confidence = Math.min(0.95, keySecretScore * 0.7 + (entropy / 8) * 0.3);
        if (confidence >= minConfidence) {
          secrets.push({
            key,
            value: maskSecret(value),
            lineNumber,
            reason: 'High entropy value with secret-like key name',
            confidence,
          });
        }
      }
      // Very high entropy alone (>5.0) suggests randomness
      else if (entropy > 5.0 && value.length > 32) {
        const confidence = Math.min(0.9, keySecretScore * 0.6 + (entropy / 8) * 0.4);
        if (confidence >= minConfidence) {
          secrets.push({
            key,
            value: maskSecret(value),
            lineNumber,
            reason: 'Very high entropy suggests secret data',
            confidence,
          });
        }
      }
      // Long base64-like string with secret key (be more strict)
      else if (/^[A-Za-z0-9+/]{48,}={0,2}$/.test(value) && entropy > 4.0) {
        const confidence = Math.min(0.85, keySecretScore * 0.7 + 0.15);
        if (confidence >= minConfidence) {
          secrets.push({
            key,
            value: maskSecret(value),
            lineNumber,
            reason: 'Base64-encoded data with secret key name',
            confidence,
          });
        }
      }
      // Long hex string (but not UUID format) with secret key
      else if (/^[0-9a-f]{40,}$/i.test(value) && !/^[0-9a-f]{8}-/.test(value)) {
        const confidence = Math.min(0.85, keySecretScore * 0.7 + 0.15);
        if (confidence >= minConfidence) {
          secrets.push({
            key,
            value: maskSecret(value),
            lineNumber,
            reason: 'Long hex string with secret key name',
            confidence,
          });
        }
      }
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

/**
 * Filter variables based on exclude/only rules
 */
export function filterVariables(
  vars: string[],
  options: { exclude?: string[]; excludePattern?: RegExp; only?: string[] }
): string[] {
  let filtered = [...vars];

  // Apply "only" filter first (if specified, only include these)
  if (options.only && options.only.length > 0) {
    filtered = filtered.filter(key => options.only!.includes(key));
  }

  // Apply exclude list
  if (options.exclude && options.exclude.length > 0) {
    filtered = filtered.filter(key => !options.exclude!.includes(key));
  }

  // Apply exclude pattern
  if (options.excludePattern) {
    filtered = filtered.filter(key => !options.excludePattern!.test(key));
  }

  return filtered;
}

/**
 * Check if env files are protected in .gitignore
 */
export function checkGitignore(targetDir: string): { 
  hasGitignore: boolean; 
  protectedPatterns: string[];
  missingPatterns: string[];
  actualEnvFiles: string[];
} {
  const gitignorePath = path.join(targetDir, '.gitignore');
  const hasGitignore = fs.existsSync(gitignorePath);
  
  const protectedPatterns: string[] = [];
  const envFilesToProtect = ['.env', '.env.local', '.env.*.local'];
  const actualEnvFiles = fs.existsSync(targetDir) 
    ? fs.readdirSync(targetDir)
        .filter(file => file.startsWith('.env') && !file.endsWith('.example') && !file.endsWith('.sample'))
    : [];

  if (hasGitignore) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim());
    
    // Check for various .env patterns
    const envPatterns = [
      '.env',
      '.env.local',
      '.env.*.local',
      '.env.development.local',
      '.env.test.local',
      '.env.production.local',
      '**/.env',
      '*.env'
    ];
    
    for (const pattern of envPatterns) {
      if (lines.includes(pattern) || lines.includes(`/${pattern}`) || lines.includes(`**/${pattern}`)) {
        protectedPatterns.push(pattern);
      }
    }
  }

  // Determine what's missing
  const hasGenericProtection = protectedPatterns.some(p => 
    p === '.env' || p === '**/.env' || p === '.env.local' || p === '.env.*.local'
  );

  const missingPatterns: string[] = [];
  if (!hasGenericProtection) {
    missingPatterns.push('.env');
    missingPatterns.push('.env.local');
    missingPatterns.push('.env.*.local');
  }

  return {
    hasGitignore,
    protectedPatterns,
    missingPatterns,
    actualEnvFiles,
  };
}

/**
 * Add env file patterns to .gitignore
 */
export function addToGitignore(targetDir: string, patterns: string[]): { added: string[]; created: boolean } {
  const gitignorePath = path.join(targetDir, '.gitignore');
  const created = !fs.existsSync(gitignorePath);
  
  let content = '';
  if (!created) {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  }

  const lines = content.split('\n');
  const added: string[] = [];

  // Check if we need to add a section header
  const hasEnvSection = content.includes('# Environment Variables') || content.includes('# .env files');
  
  if (!hasEnvSection && patterns.length > 0) {
    // Add a blank line if file has content
    if (content.trim().length > 0 && !content.endsWith('\n\n')) {
      content += content.endsWith('\n') ? '\n' : '\n\n';
    }
    content += '# Environment Variables (envlint)\n';
  }

  for (const pattern of patterns) {
    const alreadyExists = lines.some(line => {
      const trimmed = line.trim();
      return trimmed === pattern || trimmed === `/${pattern}` || trimmed === `**/${pattern}`;
    });

    if (!alreadyExists) {
      content += `${pattern}\n`;
      added.push(pattern);
    }
  }

  fs.writeFileSync(gitignorePath, content);

  return { added, created };
}

/**
 * Remove duplicates from env file (keeps first occurrence)
 */
export function removeDuplicates(filePath: string): { removed: number; duplicates: string[] } {
  if (!fs.existsSync(filePath)) {
    return { removed: 0, duplicates: [] };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const seen = new Set<string>();
  const newLines: string[] = [];
  const duplicates: string[] = [];
  let removed = 0;

  lines.forEach((line) => {
    const trimmed = line.trim();
    
    // Keep empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      newLines.push(line);
      return;
    }

    // Parse KEY=VALUE format
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) {
      const key = match[1];
      
      if (seen.has(key)) {
        // Duplicate found - skip this line
        duplicates.push(key);
        removed++;
        return;
      }
      
      seen.add(key);
    }

    newLines.push(line);
  });

  // Write back to file
  fs.writeFileSync(filePath, newLines.join('\n'));

  return { removed, duplicates: Array.from(new Set(duplicates)) };
}

/**
 * Load envlint configuration from .envlintrc.json
 */
export function loadConfig(targetDir: string): EnvLintConfig | null {
  const configPath = path.join(targetDir, '.envlintrc.json');
  
  if (!fs.existsSync(configPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Warning: Failed to parse .envlintrc.json: ${error}`);
    return null;
  }
}

/**
 * Create default .envlintrc.json config file
 */
export function createDefaultConfig(targetDir: string): void {
  const configPath = path.join(targetDir, '.envlintrc.json');
  
  const defaultConfig: EnvLintConfig = {
    strict: false,
    checkSecrets: true,
    minSecretConfidence: 0.7,
    exclude: [],
    secretWhitelist: [],
    gitignore: {
      enabled: true,
      patterns: [
        '.env',
        '.env.local',
        '.env.*.local'
      ],
      autoProtect: false
    }
  };
  
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2) + '\n');
}
