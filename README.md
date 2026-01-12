# envlint

> Lightweight CLI to validate, clean, and manage your `.env` files

[![npm version](https://badge.fury.io/js/%40asimdelal%2Fenvlint.svg)](https://www.npmjs.com/package/@asimdelal/envlint)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Zero dependencies. Blazing fast. Works everywhere.**

Every project has `.env` files, but they're often messy and error-prone. **envlint** catches issues before they reach production.

## Features

- **Compare** `.env` vs `.env.example`
- **Find** missing, unused, and duplicated variables
- **Detect** secrets accidentally committed (API keys, tokens, etc.)
- **Auto-generate** `.env.example` from `.env`
- **Zero dependencies** - lightweight and fast
- **Beautiful output** with color-coded results

## Quick Start

```bash
# Use instantly with npx (no install required)
npx @asimdelal/envlint

# Or install globally
npm install -g @asimdelal/envlint
envlint
```

**That's it!** It will check your `.env` and `.env.example` files automatically.

## Usage

```bash
envlint [directory] [options]
```

| Option | Description |
|--------|-------------|
| `-g, --generate` | Generate `.env.example` from `.env` |
| `-s, --strict` | Strict mode (fail on undocumented variables) |
| `-e, --env <file>` | Specify env file (default: `.env`) |
| `-x, --example <file>` | Specify example file (default: `.env.example`) |
| `--no-secrets` | Skip secret detection |
| `-h, --help` | Show help |

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

Detects common secret patterns:

```
⚠ OPENAI_API_KEY = sk-pr***xyz1
   Line 5: OpenAI API key format

⚠ SLACK_TOKEN = xoxb-***-456
   Line 8: Slack token format
```

Detected patterns:
- OpenAI API keys (`sk-...`)
- GitHub tokens (`ghp_...`, `ghs_...`)
- Slack tokens (`xox...`)
- Private keys (PEM format)
- Long base64/hex strings
- Variables with "secret", "password", "token" in name

### 4. Undocumented Variables

Variables in `.env` but not in `.env.example`:

```
ℹ DEBUG (exists in .env but not in .env.example)
ℹ TEMP_VAR (exists in .env but not in .env.example)
```

In strict mode (`--strict`), these become errors.

## Examples

### Example 1: Basic Validation

```bash
$ envlint

╔═══════════════════════════════════════╗
║           envlint v1.0.0              ║
║    .env Validator & Cleaner           ║
╚═══════════════════════════════════════╝

Directory: /Users/me/project

Missing in .env
──────────────────────────────────────────────────
✗ DATABASE_URL (defined in .env.example but missing in .env)

Duplicate Variables in .env
──────────────────────────────────────────────────
✗ PORT (defined on lines: 3, 15)

══════════════════════════════════════════════════
✗ Found 2 issue(s)
```

### Example 2: Generate `.env.example`

```bash
$ envlint --generate

╔═══════════════════════════════════════╗
║           envlint v1.0.0              ║
║    .env Validator & Cleaner           ║
╚═══════════════════════════════════════╝

ℹ Generating .env.example from .env...
✓ .env.example generated at /Users/me/project/.env.example
```

### Example 3: Clean Project

```bash
$ envlint

╔═══════════════════════════════════════╗
║           envlint v1.0.0              ║
║    .env Validator & Cleaner           ║
╚═══════════════════════════════════════╝

Directory: /Users/me/project

══════════════════════════════════════════════════
✓ All checks passed! Your .env files are clean.
```

## CI/CD Integration

**GitHub Actions:**
```yaml
- run: npx envlint --strict
```

**GitLab CI:**
```yaml
envlint:
  script: npx envlint --strict
```

**Pre-commit Hook:**
```bash
#!/bin/bash
npx envlint --strict || exit 1
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
| **Secret Detection** | Yes | Limited |
| **Auto-generate Example** | Yes | No |
| **Duplicate Detection** | Yes | Limited |
| **Beautiful Output** | Yes | Basic |
| **File Size** | <50KB | >5MB |
| **Speed** | Instant | Slow |

## Use Cases

- **Onboarding**: New developers know exactly which env vars to set
- **Security**: Catch secrets before they're committed
- **Consistency**: Keep `.env` and `.env.example` in sync
- **CI/CD**: Automated validation in your pipeline
- **Documentation**: Auto-generate example files

## Support

[Report Issues](https://github.com/asimd/envlint/issues) • [Feature Requests](https://github.com/asimd/envlint/issues)

---

**Made by [@asimd](https://github.com/asimd)**
