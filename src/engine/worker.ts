import axios from 'axios';
import fs from 'node:fs';
import type { DownloadSegment } from '../types.ts';

export class DownloadWorker {
    private segment: DownloadSegment;
    private url: string;
    private filePath: string;
    private onProgress: (bytes: number) => void;
    private abortController: AbortController;
    private aborted = false;

    constructor(
        segment: DownloadSegment,
        url: string,
        filePath: string,
        onProgress: (bytes: number) => void
    ) {
        this.segment = segment;
        this.url = url;
        this.filePath = filePath;
        this.onProgress = onProgress;
        this.abortController = new AbortController();
    }

    wasAborted(): boolean {
        return this.aborted;
    }

    async start(): Promise<void> {
        const { start, current, end } = this.segment;
        const rangeStart = start + current;

        if (rangeStart >= end) {
            return;
        }

        try {
            const response = await axios({
                method: 'get',
                url: this.url,
                headers: {
                    Range: `bytes=${rangeStart}-${end}`,
                },
                responseType: 'stream',
                signal: this.abortController.signal,
            });

            const writeStream = fs.createWriteStream(this.filePath, {
                flags: 'r+',
                start: rangeStart,
            });

            return new Promise<void>((resolve, reject) => {
                let settled = false;

                const signal = this.abortController.signal;
                if (signal.aborted) {
                    this.aborted = true;
                    settled = true;
                    writeStream.end();
                    response.data.destroy();
                    resolve();
                    return;
                }

                const onAbort = () => {
                    this.aborted = true;
                    settled = true;
                    writeStream.end();
                    response.data.destroy();
                    resolve();
                };

                signal.addEventListener('abort', onAbort, { once: true });

                response.data.on('data', (chunk: Buffer) => {
                    this.onProgress(chunk.length);
                });

                response.data.pipe(writeStream);

                writeStream.on('finish', () => {
                    if (!settled) {
                        settled = true;
                        resolve();
                    }
                });

                writeStream.on('error', (err: Error) => {
                    if (!settled) {
                        settled = true;
                        reject(err);
                    }
                });

                response.data.on('error', (err: Error) => {
                    if (!settled) {
                        settled = true;
                        reject(err);
                    }
                });
            });
        } catch (error: any) {
            if (axios.isCancel(error)) {
                this.aborted = true;
                return;
            } else {
                throw error;
            }
        }
    }

    stop() {
        this.abortController.abort();
    }
}
