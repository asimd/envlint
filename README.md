# envlint

> Lightweight CLI to validate, clean, and manage your `.env` files

[![npm version](https://badge.fury.io/js/%40asimdelal%2Fenvlint.svg)](https://www.npmjs.com/package/@asimdelal/envlint)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Zero dependencies. Zero false positives. Blazing fast. Works everywhere.**

Every project has `.env` files, but they're often messy and error-prone. **envlint** catches issues before they reach production with smart secret detection that uses entropy analysis, value type inference, and confidence scoring - no more false alarms!

## Features

- **Zero false positives** - Smart secret detection with entropy analysis & confidence scoring
- **Protect env files** - Automatically add `.env` files to `.gitignore`
- **Compare** any two `.env` files with powerful filtering
- **Exclude variables** from comparison (by name or regex pattern)
- **Filter comparisons** to specific variables only
- **Auto-detects** available env files (`.env.local`, `.env.docker`, etc.)
- **Find** missing, unused, and duplicated variables
- **Detect secrets** with confidence levels - OpenAI, GitHub, AWS, Slack, Stripe, and more
- **Whitelist support** - Exclude known safe variables from secret detection
- **Auto-generate** `.env.example` from `.env`
- **Zero dependencies** - lightweight and fast
- **Beautiful output** with color-coded results

## Installation

```bash
# Run without installing (recommended for trying it out)
npx @asimdelal/envlint

# Install globally
npm install -g @asimdelal/envlint

# Or install as dev dependency in your project
npm install --save-dev @asimdelal/envlint
```

## Quick Start

```bash
# Just run it - that's all you need!
envlint
```

**That's it!** It automatically checks your `.env` vs `.env.example`.

### Common Commands

```bash
# Validate (default)
envlint

# Generate .env.example
envlint -g

# Generate .env.example from specific env file
envlint -g .env.docker

# Compare environments (space or comma separated)
envlint -c .env.staging .env.production

# Auto-fix duplicates
envlint --fix

# Protect .env in .gitignore
envlint --protect
```

### Optional: Create Config File

For team-wide settings:

```bash
# Create .envlintrc.json
envlint --init

# Now just run envlint (uses config automatically)
envlint
```

## Configuration File (Recommended)

Create a `.envlintrc.json` to customize envlint for your project:

```bash
envlint --init
```

**Example `.envlintrc.json`:**

```json
{
  "strict": false,
  "checkSecrets": true,
  "minSecretConfidence": 0.7,
  "exclude": ["PORT", "NODE_ENV"],
  "excludePattern": "^(TEST_|MOCK_)",
  "secretWhitelist": ["PUBLIC_KEY", "JWKS_URI"],
  "gitignore": {
    "enabled": true,
    "patterns": [
      ".env",
      ".env.local",
      ".env.*.local"
    ],
    "autoProtect": false
  },
  "envFile": ".env",
  "exampleFile": ".env.example"
}
```

**Benefits:**
- No need to pass flags every time
- Team-wide consistency (commit `.envlintrc.json` to git)
- Customize secret detection for your project
- Define your gitignore protection strategy

## Usage

```bash
envlint [options]
```

### Main Commands

| Command | Description |
|---------|-------------|
| `envlint` | Validate .env vs .env.example (default) |
| `envlint -g` | Generate .env.example from .env |
| `envlint -c file1,file2` | Compare two env files |
| `envlint --fix` | Auto-fix duplicates |
| `envlint --protect` | Add .env to .gitignore |
| `envlint --init` | Create config file |

### Options

| Option | Description |
|--------|-------------|
| `-s, --strict` | Fail on undocumented variables |
| `--exclude <vars>` | Skip variables (comma-separated) |
| `--no-secrets` | Skip secret detection |
| `--min-confidence <0-1>` | Secret detection threshold (default: 0.7) |
| `-h, --help` | Show help |

<details>
<summary><b>All Options</b> (click to expand)</summary>

| Option | Description |
|--------|-------------|
| `-e, --env <file>` | Specify env file (default: `.env`) |
| `-x, --example <file>` | Specify example file (default: `.env.example`) |
| `--exclude-pattern <regex>` | Exclude variables matching regex |
| `--only <vars>` | Only check specific variables |
| `--protect-interactive` | Interactively choose gitignore patterns |
| `--check-gitignore` | Check if env files are protected |
| `--secret-whitelist <vars>` | Exclude from secret detection |

</details>

**Note:** CLI options override config file settings.

## What It Checks

### 1. Missing Variables in `.env`

Variables defined in `.env.example` but missing in `.env`:

```
✗ DATABASE_URL (defined in .env.example but missing in .env)
✗ API_KEY (defined in .env.example but missing in .env)
```

### 2. Duplicate Variables

Same variable defined multiple times:

```
✗ PORT (defined on lines: 3, 15)
✗ NODE_ENV (defined on lines: 8, 22)
```

### 3. Potential Secrets

**Smart detection with zero false positives** using entropy analysis, value type inference, and confidence scoring:

```
⚠ OPENAI_API_KEY = sk-pr***xyz1
   Line 5: OpenAI API key format
   Confidence: 99%

⚠ SLACK_TOKEN = xoxb-***-456
   Line 8: Slack token format
   Confidence: 99%
```

**Detected patterns:**
- OpenAI API keys (`sk-...`, `sk-proj-...`)
- GitHub tokens (`ghp_...`, `ghs_...`)
- Slack tokens (`xox...`)
- AWS Access Keys (`AKIA...`)
- Private keys (PEM format)
- JWT tokens (high entropy, 3-part format)
- High-entropy secrets (based on key name + entropy analysis)

**Smart filtering (no false positives):**
- Ignores URLs, UUIDs, booleans, numbers
- Ignores email addresses and file paths
- Ignores public keys (only flags private keys)
- Uses entropy analysis for ambiguous cases
- Confidence levels (70%-100%)
- Whitelist support for known safe variables

### 4. Undocumented Variables

Variables in `.env` but not in `.env.example`:

```
ℹ DEBUG (exists in .env but not in .env.example)
ℹ TEMP_VAR (exists in .env but not in .env.example)
```

In strict mode (`--strict`), these become errors.

### 5. Compare Any Two Files

Compare staging vs production environments:

```bash
envlint --compare .env.staging,.env.production
```

Exclude environment-specific variables:

```bash
envlint -c .env.local,.env.docker --exclude NODE_ENV,PORT,HOST
```

Only check critical variables:

```bash
envlint -c .env.staging,.env.prod --only DATABASE_URL,API_KEY,SECRET_KEY
```

Exclude test variables using patterns:

```bash
envlint --compare .env,.env.test --exclude-pattern "^TEST_|^MOCK_"
```

### 6. Smart Secret Detection

Control false positives with confidence levels and whitelists:

```bash
# Only show high-confidence secrets (90%+)
envlint --min-confidence 0.9

# Whitelist known safe variables (e.g., public keys, configuration)
envlint --secret-whitelist PUBLIC_KEY,JWKS_URI,AUTH_SERVICE_URL

# Combine both for maximum precision
envlint --min-confidence 0.85 --secret-whitelist PUBLIC_KEY,JWKS_URI
```

## Examples

### Just Validate (Most Common)

```bash
$ envlint

envlint v1.2.0

Directory: /Users/me/project

══════════════════════════════════════════════════
✓ All checks passed! Your .env files are clean.
```

### Generate .env.example

```bash
$ envlint -g

envlint v1.2.0

ℹ Generating .env.example from .env...
✓ .env.example generated successfully
```

**Generate from specific file:**

```bash
$ envlint -g .env.docker

envlint v1.2.0

ℹ Generating .env.example from .env.docker...
✓ .env.example generated successfully
```

**Auto-detection:**
If `.env` doesn't exist, envlint will automatically find and use the first available env file.

### Compare Environments

```bash
# Space-separated (easier to type)
$ envlint -c .env.staging .env.production

# Or comma-separated
$ envlint -c .env.staging,.env.production

envlint v1.2.0

ℹ Compare mode: .env.staging ↔ .env.production

Missing in .env.staging
──────────────────────────────────────────────────
✗ REDIS_URL (defined in .env.production but missing in .env.staging)

══════════════════════════════════════════════════
✗ Found 1 issue(s)
```

### With Issues Found

```bash
$ envlint

envlint v1.2.0

Missing in .env
──────────────────────────────────────────────────
✗ DATABASE_URL (defined in .env.example but missing in .env)

Duplicate Variables in .env
──────────────────────────────────────────────────
✗ PORT (defined on lines: 3, 15)

⚠️  Potential Secrets Detected
──────────────────────────────────────────────────
⚠ OPENAI_API_KEY = sk-p***a890
   Line 7: OpenAI API Key
   Confidence: 99%

══════════════════════════════════════════════════
✗ Found 3 issue(s)
```

<details>
<summary><b>More Examples</b> (click to expand)</summary>

### Create Config File

```bash
$ envlint --init

✓ .envlintrc.json created
ℹ Run "envlint" to validate with your config
```

### Auto-Fix Duplicates

```bash
$ envlint --fix

✓ Removed 2 duplicate variable(s)
  • PORT
  • NODE_ENV
```

### Exclude Variables

```bash
$ envlint --exclude NODE_ENV,PORT,DEBUG
```

### Compare with Exclusions

```bash
$ envlint -c .env.staging,.env.prod --exclude NODE_ENV,PORT
```

</details>

## CI/CD Integration

**GitHub Actions:**
```yaml
# Basic validation
- run: npx @asimdelal/envlint --strict

# Compare staging and production
- run: npx @asimdelal/envlint --compare .env.staging,.env.production --exclude NODE_ENV,PORT
```

**GitLab CI:**
```yaml
envlint:
  script: npx @asimdelal/envlint --strict

env-compare:
  script: npx @asimdelal/envlint -c .env.staging,.env.prod --only DATABASE_URL,API_KEY
```

**Pre-commit Hook:**
```bash
#!/bin/bash
npx @asimdelal/envlint --strict || exit 1
```

## Best Practices

### 1. Start with Configuration (Recommended)

Create `.envlintrc.json` and commit it to your repo for team consistency:

```bash
envlint --init
# Edit .envlintrc.json to match your project needs
git add .envlintrc.json
git commit -m "Add envlint configuration"
```

**Example config:**
```json
{
  "strict": false,
  "minSecretConfidence": 0.8,
  "exclude": ["NODE_ENV", "PORT", "DEBUG"],
  "secretWhitelist": ["PUBLIC_KEY", "JWKS_URI"],
  "gitignore": {
    "patterns": [".env", ".env.local", ".env.*.local"]
  }
}
```

**Benefits:**
- Team-wide consistency
- No need to remember CLI flags
- Document your project's standards

### 2. Protect Env Files Immediately

On first setup or when onboarding new developers:

```bash
# Interactive mode - choose what to protect
envlint --protect-interactive

# Or auto-protect everything
envlint --protect
```

Add this to your README or onboarding docs!

### 3. Multi-Environment Projects

When working with multiple environments (dev, staging, prod), use comparison to ensure consistency:

```bash
# Ensure staging has all production variables
envlint --compare .env.staging,.env.production --exclude NODE_ENV,DEBUG

# Check only critical production variables
envlint --compare .env.local,.env.production --only DATABASE_URL,API_KEY,SECRET_KEY
```

### 2. Exclude Environment-Specific Variables

Some variables are intentionally different per environment:

```bash
envlint --compare .env.staging,.env.prod --exclude "NODE_ENV,PORT,HOST,DEBUG"
```

### 3. Test Environment Variables

Exclude test-specific variables using patterns:

```bash
envlint --exclude-pattern "^(TEST_|MOCK_|FIXTURE_)"
```

### 4. Focus on Critical Variables

In large projects, focus validation on critical variables:

```bash
envlint --only "DATABASE_URL,API_KEY,SECRET_KEY,STRIPE_KEY"
```

### 5. Reduce False Positives in Secret Detection

Use confidence thresholds and whitelists for clean CI/CD pipelines:

```bash
# For CI/CD: only fail on high-confidence secrets
envlint --min-confidence 0.9

# Whitelist known safe variables containing secret-like keywords
envlint --secret-whitelist "PUBLIC_KEY,JWKS_URI,AUTH_SERVICE_URL,TOKEN_ENDPOINT"

# Combine with other filters for maximum precision
envlint --strict --min-confidence 0.85 --secret-whitelist PUBLIC_KEY
```

## Development

```bash
git clone https://github.com/asimd/envlint.git
cd envlint
npm install
npm run build
npm test
```

## License

MIT © 2026

## Why Choose envlint?

| Feature | envlint | Other Tools |
|---------|---------|-------------|
| **Zero Dependencies** | Yes | No |
| **Zero False Positives** | Yes | No |
| **Smart Secret Detection** | Yes (entropy + confidence) | Limited |
| **Compare Any Files** | Yes | No |
| **Exclude/Filter Variables** | Yes | No |
| **Secret Whitelist** | Yes | No |
| **Auto-generate Example** | Yes | No |
| **Duplicate Detection** | Yes | Limited |
| **Speed** | Instant | Slow |
| **Multi-environment Support** | Yes | Limited |

## Use Cases

- **Onboarding**: New developers know exactly which env vars to set
- **Security**: Catch secrets before they're committed
- **Consistency**: Keep `.env` and `.env.example` in sync across environments
- **Environment Comparison**: Ensure staging and production have matching configs
- **CI/CD**: Automated validation in your pipeline
- **Documentation**: Auto-generate example files
- **Multi-environment**: Compare `.env.local`, `.env.docker`, `.env.production`, etc.
- **Selective Validation**: Focus on critical variables or exclude environment-specific ones

## Quick Tips

**Tip 1**: Create a config file for your project
```bash
envlint --init
# Edit .envlintrc.json, commit to git
```

**Tip 2**: Protect your env files interactively
```bash
envlint --protect-interactive
```

**Tip 3**: Use `--compare` to ensure your staging environment matches production
```bash
envlint -c .env.staging,.env.prod --exclude NODE_ENV,DEBUG
```

**Tip 4**: Add envlint to your git pre-commit hook to catch issues early
```bash
echo "npx @asimdelal/envlint --strict" > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

**Tip 5**: Use `--only` in CI/CD to validate only critical production variables
```bash
envlint --only DATABASE_URL,API_KEY,SECRET_KEY
```

**Tip 6**: Eliminate false positives in secret detection with confidence thresholds
```bash
envlint --min-confidence 0.9 --secret-whitelist PUBLIC_KEY,JWKS_URI
```

## Support

[Report Issues](https://github.com/asimd/envlint/issues) • [Feature Requests](https://github.com/asimd/envlint/issues)

---

**Made by [@asimd](https://github.com/asimd)**
