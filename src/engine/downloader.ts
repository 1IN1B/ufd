import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import EventEmitter from 'node:events';
import type { DownloadState, DownloadSegment } from '../types.ts';
import { DownloadWorker } from './worker.ts';
import { loadState, saveState, deleteState } from './state.ts';

/**
 * Convert an Axios error into a human‑readable message.
 * Handles HTTP status codes (e.g. 404, 500) and generic network errors.
 */
function formatNetworkError(err: any): string {
    if (err?.response?.status) {
        return `Network error ${err.response.status}: ${err.response.statusText}`;
    }
    if (err?.code) {
        return `Network error (${err.code}): ${err.message}`;
    }
    return `Network error: ${err?.message ?? String(err)}`;
}


export class UfdLoader extends EventEmitter {
    private state: DownloadState;
    private workers: DownloadWorker[] = [];

    constructor(url: string, connections: number = 8, destination?: string) {
        super();
        // Determine a safe filename
        const urlPath = new URL(url).pathname;
        const baseFromUrl = path.basename(urlPath) || 'download';

        let finalPath: string;
        if (!destination) {
            // No destination supplied → use current directory + base name
            finalPath = path.join('.', baseFromUrl);
        } else {
            // If the path exists and is a directory, treat it as a folder
            if (fs.existsSync(destination)) {
                const stats = fs.statSync(destination);
                if (stats.isDirectory()) {
                    finalPath = path.join(destination, baseFromUrl);
                } else {
                    // Existing file – use it directly
                    finalPath = destination;
                }
            } else {
                // Path does not exist – decide based on extension
                const hasExt = path.extname(destination) !== '';
                if (hasExt) {
                    // Assume user gave a full file path (even though it doesn't exist yet)
                    finalPath = destination;
                } else {
                    // Assume it's a folder that will be created
                    finalPath = path.join(destination, baseFromUrl);
                }
            }
        }

        const filename = finalPath;

        const existingState = loadState(filename);
        if (existingState && existingState.url === url) {
            this.state = existingState;
        } else {
            this.state = {
                url,
                filename,
                totalSize: 0,
                segments: [],
                connections,
                isPaused: false,
            };
        }
    }

    async init() {
        if (this.state.totalSize > 0) {
            // Already initialized from state
            this.emit('initialized', this.state);
            return;
        }

        // Maximum number of attempts (initial try + up to 2 retries)
        const MAX_RETRIES = 3;
        const TIMEOUT_MS = 10000; // 10 seconds
        let head: any = null;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                head = await axios.head(this.state.url, {
                    timeout: TIMEOUT_MS,
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    },
                });
                // Successful response, break out of retry loop
                break;
            } catch (err: any) {
                // If it's a timeout or a 5xx server error, we may retry
                const status = err?.response?.status;
                const isTimeout = err?.code === 'ECONNABORTED';
                const isServerError = status && status >= 500 && status < 600;
                const is403 = status === 403;
                
                if (attempt < MAX_RETRIES && (isTimeout || isServerError)) {
                    // simple back‑off: wait a bit before next attempt
                    await new Promise(r => setTimeout(r, 500 * attempt));
                    continue;
                }
                
                // Emit a friendly error and re‑throw
                const friendly = formatNetworkError(err);
                
                // Add helpful message for 403 errors
                if (is403) {
                    this.emit('error', new Error(`${friendly}\n\nThis appears to be a Cloudflare-protected site or access-restricted content.\nTry using a browser to download the file directly, or contact the site administrator.`));
                    throw err;
                }
                
                this.emit('error', new Error(friendly));
                throw err;
            }
        }
        if (!head) {
            // Should never happen, but guard against TypeScript complaints
            const err = new Error('Failed to obtain HEAD response after retries');
            this.emit('error', err);
            throw err;
        }
        const totalSize = parseInt(head.headers['content-length'] || '0', 10);
        const acceptRanges = head.headers['accept-ranges'] === 'bytes';

        if (totalSize === 0) {
            throw new Error('Could not determine file size');
        }

        this.state.totalSize = totalSize;

        // Create empty file if not exists
        if (!fs.existsSync(this.state.filename)) {
            fs.writeFileSync(this.state.filename, Buffer.alloc(0));
            // Pre-allocate space
            const fd = fs.openSync(this.state.filename, 'r+');
            fs.ftruncateSync(fd, totalSize);
            fs.closeSync(fd);
        }

        if (acceptRanges) {
            const segmentSize = Math.floor(totalSize / this.state.connections);
            for (let i = 0; i < this.state.connections; i++) {
                const start = i * segmentSize;
                const end = i === this.state.connections - 1 ? totalSize - 1 : (i + 1) * segmentSize - 1;
                this.state.segments.push({
                    id: i,
                    start,
                    end,
                    current: 0,
                    total: end - start + 1,
                    status: 'pending',
                });
            }
        } else {
            this.state.segments.push({
                id: 0,
                start: 0,
                end: totalSize - 1,
                current: 0,
                total: totalSize,
                status: 'pending',
            });
        }

        saveState(this.state);
        this.emit('initialized', this.state);
    }

    start() {
        this.state.isPaused = false;
        this._runWorkers();
    }

    pause() {
        this.state.isPaused = true;
        saveState(this.state);
        for (const worker of this.workers) {
            worker.stop();
        }
        this.emit('paused', this.state);
    }

    resume() {
        this.state.isPaused = false;
        for (const segment of this.state.segments) {
            if (segment.status === 'paused') {
                segment.status = 'pending';
            }
        }
        this._runWorkers();
        this.emit('resumed', this.state);
    }

    private _runWorkers() {
        let lastSave = Date.now();
        let pausedEmitted = false;
        this.workers = [];

        for (const segment of this.state.segments) {
            if (segment.status === 'completed') continue;
            if (segment.status !== 'failed') {
                segment.status = 'downloading';
            }

            const worker = new DownloadWorker(
                segment,
                this.state.url,
                this.state.filename,
                (bytes) => {
                    segment.current += bytes;
                    if (segment.current >= segment.total) {
                        segment.status = 'completed';
                    }

                    if (Date.now() - lastSave > 1000) {
                        saveState(this.state);
                        lastSave = Date.now();
                    }

                    this.emit('progress', this.state);

                    if (!this.state.isPaused && this.state.segments.every(s => s.status === 'completed')) {
                        deleteState(this.state.filename);
                        this.emit('completed', this.state);
                    }
                }
            );

            this.workers.push(worker);

            worker.start().then(() => {
                if (this.state.isPaused) {
                    if (segment.status !== 'completed') {
                        segment.status = 'paused';
                    }
                    if (!pausedEmitted) {
                        pausedEmitted = true;
                        saveState(this.state);
                        this.emit('paused', this.state);
                    }
                }
            }).catch((err) => {
                if (!this.state.isPaused) {
                    segment.status = 'failed';
                    this.emit('error', err);
                }
            });
        }
    }

    getState() {
        return this.state;
    }
}
