/**
 * Playwright global teardown — runs once after all E2E specs.
 * Shuts down the mock SOAP server.
 */

export default async function globalTeardown() {
  const proc = (globalThis as any).__mockSoapProcess;
  if (proc) {
    proc.kill('SIGTERM');
    console.log('[global-teardown] Mock SOAP server stopped');
  }
}
