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
  potentialSecrets: Array<{ key: string; value: string; lineNumber: number; reason: string }>;
  unusedInExample: string[];
}

export interface LintOptions {
  envPath: string;
  examplePath: string;
  generateExample: boolean;
  checkSecrets: boolean;
  strict: boolean;
}
