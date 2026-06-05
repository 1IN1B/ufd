export interface DownloadSegment {
    id: number;
    start: number;
    end: number;
    current: number;
    total: number;
    status: 'pending' | 'downloading' | 'paused' | 'completed' | 'failed';
}

export interface DownloadState {
    url: string;
    filename: string;
    totalSize: number;
    segments: DownloadSegment[];
    connections: number;
    isPaused: boolean;
}

export interface ProgressUpdate {
    segmentId: number;
    bytesDownloaded: number;
    totalBytes: number;
}
