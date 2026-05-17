import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

const isCI = !!process.env.CI;

// E2E uses a dedicated MongoDB database so it doesn't pollute dev data.
// Port 27018 is a standalone mongod started with --replSet rs0 (transactions require replica set).
const E2E_MONGO_URI = process.env.E2E_MONGO_URI ?? 'mongodb://localhost:27018/travel-b2b-e2e?replicaSet=rs0';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/*.spec.ts'],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  timeout: 60_000,
  expect: { timeout: 15_000 },

  // Run specs serially — they share DB state, ordering matters for Spec 2 (depends on Spec 1 data)
  workers: 1,
  retries: isCI ? 1 : 0,

  use: {
    baseURL: 'http://localhost:4200',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    // Pass env variables to the browser context via extraHTTPHeaders isn't needed;
    // the server env is set via webServer.env below
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      // NestJS API server
      command: 'npm run start --workspace=server',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !isCI,
      timeout: 90_000,
      env: {
        PORT: '3000',
        NODE_ENV: 'test',
        MONGO_URI: E2E_MONGO_URI,
        REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
        REDIS_PORT: process.env.REDIS_PORT ?? '6379',
        JWT_ACCESS_SECRET: 'e2e-access-secret-do-not-use-in-prod',
        JWT_REFRESH_SECRET: 'e2e-refresh-secret-do-not-use-in-prod',
        JWT_ACCESS_EXPIRES_IN: '1h',
        TBO_API_URL: 'http://localhost:5099',
        TBO_CLIENT_ID: 'e2e-client',
        TBO_API_USERNAME: 'e2e-user',
        TBO_API_KEY: 'e2e-key',
        TBO_SANDBOX: 'true',
        PAYTABS_SERVER_KEY: 'e2e-paytabs-key',
        PAYTABS_PROFILE_ID: '12345',
        PAYTABS_SANDBOX: 'true',
        BCRYPT_ROUNDS: '4',
        CLIENT_APP_URL: 'http://localhost:4200',
        ADMIN_APP_URL: 'http://localhost:4201',
      },
    },
    {
      // Angular client app (workspace name is "client", not path "apps/client")
      command: 'npm run start --workspace=client -- --port 4200',
      url: 'http://localhost:4200',
      reuseExistingServer: !isCI,
      timeout: 300_000,
    },
    {
      // Angular admin app (workspace name is "admin", not path "apps/admin")
      command: 'npm run start --workspace=admin -- --port 4201',
      url: 'http://localhost:4201',
      reuseExistingServer: !isCI,
      timeout: 300_000,
    },
  ],
});
