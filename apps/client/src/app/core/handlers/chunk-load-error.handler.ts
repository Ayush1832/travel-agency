import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class ChunkLoadErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    const msg = (error as Error)?.message ?? '';
    const isChunkError =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('ChunkLoadError') ||
      msg.includes('Loading chunk') ||
      (error as any)?.name === 'ChunkLoadError';

    if (isChunkError) {
      // Guard against infinite reload loop: only reload once per 30 s
      const key = 'chunkReloadAt';
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last > 30_000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
        return;
      }
    }

    console.error(error);
  }
}
