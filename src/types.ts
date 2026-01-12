export interface EnvVar {
  key: string;
  value: string;
  lineNumber: number;
}

export interface ValidationResult {
  missingInEnv: string[];
  missingInExample: string[];
  duplicatesInEnv: Map<string, number[]>;
  duplicatesInExample: Map<string, number[]>;
  potentialSecrets: Array<{ key: string; value: string; lineNumber: number; reason: string; confidence: number }>;
  unusedInExample: string[];
  envFileName: string;
  exampleFileName: string;
}

export interface LintOptions {
  envPath: string;
  examplePath: string;
  generateExample: boolean;
  checkSecrets: boolean;
  strict: boolean;
  exclude?: string[];
  excludePattern?: RegExp;
  only?: string[];
  compareMode?: boolean;
  secretWhitelist?: string[];
  minSecretConfidence?: number;
}

export interface EnvLintConfig {
  // Validation options
  strict?: boolean;
  checkSecrets?: boolean;
  minSecretConfidence?: number;
  
  // Filters
  exclude?: string[];
  excludePattern?: string;
  only?: string[];
  secretWhitelist?: string[];
  
  // Gitignore protection
  gitignore?: {
    enabled?: boolean;
    patterns?: string[];
    autoProtect?: boolean; // Auto-add missing patterns
  };
  
  // File paths
  envFile?: string;
  exampleFile?: string;
}
