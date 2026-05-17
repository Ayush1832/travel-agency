/**
 * Fails the process at boot if production-unsafe default secrets are detected.
 * Called before NestFactory.create() so the app never starts in a broken state.
 */

const DEFAULTS: Record<string, string> = {
  JWT_ACCESS_SECRET: 'access-secret-change-in-prod',
  JWT_REFRESH_SECRET: 'refresh-secret-change-in-prod',
};

const REQUIRED_IN_PROD: string[] = [
  'MONGO_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'PAYTABS_SERVER_KEY',
];

export function validateSecrets(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const errors: string[] = [];

  for (const [key, defaultVal] of Object.entries(DEFAULTS)) {
    if ((process.env[key] ?? defaultVal) === defaultVal) {
      errors.push(`${key} is set to its insecure default value`);
    }
  }

  for (const key of REQUIRED_IN_PROD) {
    if (!process.env[key]) {
      errors.push(`${key} is required in production but is not set`);
    }
  }

  if (errors.length > 0) {
    console.error('\n[FATAL] Production secret validation failed:');
    errors.forEach((e) => console.error(`  ✗ ${e}`));
    console.error('\nSet all required environment variables before starting the server.\n');
    process.exit(1);
  }
}
