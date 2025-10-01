/**
 * Aufgabe: parse CLI flags (--key=value) und liefere Defaults:
 * endpoint, threshold, limit, failUnderAcc.
 * Validierung + hilfreiche Fehlermeldungen.
 */

export interface EvaluationConfig {
  endpoint: string;
  threshold: number;
  limit: number;
  failUnderAcc: number;
}

const DEFAULT_CONFIG: EvaluationConfig = {
  endpoint: 'http://localhost:8080/api/answer',
  threshold: 0.55,
  limit: 100,
  failUnderAcc: 0.6,
};

/**
 * Parse command line arguments with validation
 * @param args Command line arguments (default: process.argv.slice(2))
 * @returns Parsed and validated configuration
 */
export function parseCliArgs(args: string[] = process.argv.slice(2)): EvaluationConfig {
  const config = { ...DEFAULT_CONFIG };
  const errors: string[] = [];

  // Parse each argument
  for (const arg of args) {
    if (!arg.startsWith('--')) {
      errors.push(`Invalid argument format: "${arg}". Expected --key=value format.`);
      continue;
    }

    const [key, ...valueParts] = arg.slice(2).split('=');
    const value = valueParts.join('='); // Handle values with = in them

    if (!value) {
      errors.push(`Missing value for argument: "${arg}". Expected --${key}=value format.`);
      continue;
    }

    switch (key) {
      case 'endpoint':
        if (!isValidUrl(value)) {
          errors.push(`Invalid endpoint URL: "${value}". Expected a valid HTTP/HTTPS URL.`);
        } else {
          config.endpoint = value;
        }
        break;

      case 'threshold':
        const threshold = parseFloat(value);
        if (isNaN(threshold) || threshold < 0 || threshold > 1) {
          errors.push(`Invalid threshold: "${value}". Expected a number between 0 and 1.`);
        } else {
          config.threshold = threshold;
        }
        break;

      case 'limit':
        const limit = parseInt(value, 10);
        if (isNaN(limit) || limit < 1 || limit > 10000) {
          errors.push(`Invalid limit: "${value}". Expected a positive integer between 1 and 10000.`);
        } else {
          config.limit = limit;
        }
        break;

      case 'fail-under-acc':
        const failUnderAcc = parseFloat(value);
        if (isNaN(failUnderAcc) || failUnderAcc < 0 || failUnderAcc > 1) {
          errors.push(`Invalid fail-under-acc: "${value}". Expected a number between 0 and 1.`);
        } else {
          config.failUnderAcc = failUnderAcc;
        }
        break;

      case 'help':
      case 'h':
        printHelp();
        process.exit(0);

      default:
        errors.push(`Unknown argument: "--${key}". Use --help for available options.`);
    }
  }

  // Report errors and exit if any found
  if (errors.length > 0) {
    console.error('❌ Configuration errors:');
    errors.forEach(error => console.error(`  • ${error}`));
    console.error('\nUse --help for usage information.');
    process.exit(1);
  }

  // Validate cross-parameter constraints
  if (config.failUnderAcc > 1 || config.threshold > 1) {
    console.error('❌ Configuration warning: threshold and fail-under-acc should typically be between 0 and 1.');
  }

  return config;
}

/**
 * Validate if a string is a valid URL
 * @param urlString String to validate
 * @returns True if valid URL
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log(`
🤖 QA System Evaluation Tool

USAGE:
  npx tsx src/utils/eval.ts [OPTIONS]

OPTIONS:
  --endpoint=URL          API endpoint to test (default: ${DEFAULT_CONFIG.endpoint})
  --threshold=NUMBER      Confidence threshold for fallback detection (0-1, default: ${DEFAULT_CONFIG.threshold})
  --limit=NUMBER          Maximum number of test cases to run (1-10000, default: ${DEFAULT_CONFIG.limit})
  --fail-under-acc=NUMBER Minimum accuracy required to pass (0-1, default: ${DEFAULT_CONFIG.failUnderAcc})
  --help, -h              Show this help message

EXAMPLES:
  # Basic evaluation with defaults
  npx tsx src/utils/eval.ts

  # Custom endpoint and threshold
  npx tsx src/utils/eval.ts --endpoint=http://localhost:3000/api/answer --threshold=0.7

  # Strict accuracy requirements
  npx tsx src/utils/eval.ts --fail-under-acc=0.9 --threshold=0.6

  # Quick test run
  npx tsx src/utils/eval.ts --limit=10

EXIT CODES:
  0  Success (accuracy >= fail-under-acc threshold)
  1  Failure (accuracy < fail-under-acc threshold or configuration errors)

METRICS:
  • Accuracy@1:     Percentage of correct predictions (ignores __NONE__ cases)
  • Fallback Rate:  Percentage of low-confidence or missing responses
  • Response Time:  Average API response time in milliseconds
  • Network Errors: Count of API call failures
`);
}

/**
 * Validate configuration values for common issues
 * @param config Configuration to validate
 * @returns Array of warning messages (empty if no issues)
 */
export function validateConfig(config: EvaluationConfig): string[] {
  const warnings: string[] = [];

  if (config.threshold > 0.9) {
    warnings.push(`High threshold (${config.threshold}) may cause excessive fallbacks.`);
  }

  if (config.threshold < 0.3) {
    warnings.push(`Low threshold (${config.threshold}) may accept poor quality answers.`);
  }

  if (config.failUnderAcc > 0.95) {
    warnings.push(`Very high accuracy requirement (${config.failUnderAcc}) may be difficult to achieve.`);
  }

  if (config.limit > 1000) {
    warnings.push(`Large limit (${config.limit}) may result in slow evaluation.`);
  }

  if (!config.endpoint.includes('/api/answer')) {
    warnings.push(`Endpoint "${config.endpoint}" doesn't appear to be an answer API endpoint.`);
  }

  return warnings;
}

/**
 * Print configuration summary
 * @param config Configuration to display
 */
export function printConfigSummary(config: EvaluationConfig): void {
  console.log('🔧 Configuration:');
  console.log(`  📍 Endpoint:         ${config.endpoint}`);
  console.log(`  🎯 Threshold:        ${config.threshold}`);
  console.log(`  📊 Limit:            ${config.limit}`);
  console.log(`  ✅ Fail Under Acc:   ${config.failUnderAcc}`);

  const warnings = validateConfig(config);
  if (warnings.length > 0) {
    console.log('\n⚠️  Configuration warnings:');
    warnings.forEach(warning => console.log(`  • ${warning}`));
  }
  console.log();
}
