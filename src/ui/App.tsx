import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { DownloadSegment } from '../types.ts';
import { formatBytes, formatDuration, formatSpeed, truncatePath } from '../utils.ts';
import { useTerminalSize } from '../hooks/useTerminalSize.ts';
import { FolderPicker } from './FolderPicker.tsx';
import { UrlInput } from './UrlInput.tsx';
import { UfdLoader } from '../engine/downloader.ts';
import path from 'node:path';

const D = '\u2500';

interface AppProps {
    url?: string;
    connections: number;
    initialDestination?: string;
}

export const App: React.FC<AppProps> = ({ url, connections, initialDestination }) => {
    const { columns, rows } = useTerminalSize();
    const w = columns - 2;

    const [step, setStep] = useState<'url-input' | 'picking' | 'downloading'>(url ? (initialDestination ? 'downloading' : 'picking') : 'url-input');
    const [currentUrl, setCurrentUrl] = useState<string | undefined>(url);
    const [destination, setDestination] = useState<string | undefined>(initialDestination);
    const [loader, setLoader] = useState<UfdLoader | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleUrlSubmit = (url: string) => {
        setCurrentUrl(url);
        setStep(initialDestination ? 'downloading' : 'picking');
    };

    const handleFolderSelect = (folder?: string) => {
        if (!currentUrl) return;
        const defaultFilename = path.basename(new URL(currentUrl).pathname) || 'download';
        const chosenFolder = folder && folder.trim() !== '' ? folder : '.';
        const finalPath = path.join(chosenFolder, defaultFilename);
        setDestination(finalPath);
        setStep('downloading');
    };

    useEffect(() => {
        if (step === 'downloading' && destination && !loader && currentUrl) {
            const newLoader = new UfdLoader(currentUrl, connections, destination);
            setLoader(newLoader);

            newLoader.on('error', (err: Error) => {
                setErrorMsg(err.message);
            });

            newLoader.init().then(() => {
                newLoader.start();
            }).catch((err) => {
                setErrorMsg(err instanceof Error ? err.message : String(err));
            });
        }
    }, [step, destination, currentUrl, connections, loader]);

    if (errorMsg) {
        return (
            <Box flexDirection="column" width={w} paddingX={1}>
                <Box justifyContent="space-between">
                    <Text bold color="green">UFDLoader</Text>
                    <Text color="gray">v0.1.0</Text>
                    <Text bold color="red">FAILED</Text>
                </Box>
                <Box><Text color="gray">{D.repeat(w)}</Text></Box>
                <Box paddingY={1}>
                    <Text color="red" bold>Error: {errorMsg}</Text>
                </Box>
            </Box>
        );
    }

    if (step === 'url-input') {
        return <UrlInput onSubmit={handleUrlSubmit} columns={columns} />;
    }

    if (step === 'picking') {
        return <FolderPicker onSelect={handleFolderSelect} columns={columns} rows={rows} />;
    }

    if (loader && destination) {
        return <DownloadDashboard loader={loader} columns={columns} />;
    }

    return (
        <Box flexDirection="column" width={w} paddingX={1}>
            <Box justifyContent="space-between">
                <Text bold color="green">UFDLoader</Text>
                <Text color="gray">v0.1.0</Text>
                <Text color="yellow">Initializing...</Text>
            </Box>
            <Box><Text color="gray">{D.repeat(w)}</Text></Box>
            <Box paddingY={1}>
                <Text color="yellow">Preparing download...</Text>
            </Box>
        </Box>
    );
};

interface DashboardProps {
    loader: UfdLoader;
    columns: number;
}

const DownloadDashboard: React.FC<DashboardProps> = ({ loader, columns }) => {
    const [, forceUpdate] = useState(0);
    const [startTime] = useState(Date.now());
    const [pausedDuration, setPausedDuration] = useState(0);
    const [pausedAt, setPausedAt] = useState<number | null>(null);

    useEffect(() => {
        const handler = () => forceUpdate(t => t + 1);
        loader.on('progress', handler);
        loader.on('initialized', handler);
        loader.on('paused', handler);
        loader.on('resumed', handler);
        loader.on('completed', handler);
        return () => {
            loader.off('progress', handler);
            loader.off('initialized', handler);
            loader.off('paused', handler);
            loader.off('resumed', handler);
            loader.off('completed', handler);
        };
    }, [loader]);

    useInput((input) => {
        if (input === 'p' || input === 'P') {
            const state = loader.getState();
            const totalDownloaded = state.segments.reduce((acc: number, s) => acc + s.current, 0);
            const isCompleted = totalDownloaded >= state.totalSize && state.totalSize > 0;
            if (isCompleted) return;

            if (state.isPaused) {
                setPausedDuration(d => d + (Date.now() - (pausedAt ?? Date.now())));
                setPausedAt(null);
                loader.resume();
            } else {
                setPausedAt(Date.now());
                loader.pause();
            }
        }
    });

    const state = loader.getState();

    const w = columns - 2;
    const barWidth = w - 6;
    const segBarWidth = Math.max(8, Math.floor((w - 38) / 2));

    const totalDownloaded = state.segments.reduce((acc: number, s) => acc + s.current, 0);
    const isCompleted = totalDownloaded >= state.totalSize && state.totalSize > 0;
    const percentage = state.totalSize ? Math.floor((totalDownloaded / state.totalSize) * 100) : 0;

    const elapsedSeconds = (Date.now() - startTime - pausedDuration) / 1000;
    const speed = elapsedSeconds > 0 ? totalDownloaded / elapsedSeconds : 0;
    const remainingBytes = state.totalSize - totalDownloaded;
    const etaSeconds = speed > 0 ? remainingBytes / speed : 0;

    let statusLabel: string;
    let statusColor: string;
    if (isCompleted) {
        statusLabel = 'COMPLETED';
        statusColor = 'green';
    } else if (state.isPaused) {
        statusLabel = 'PAUSED';
        statusColor = 'yellow';
    } else {
        statusLabel = 'DOWNLOADING';
        statusColor = 'cyan';
    }

    const keyHint = isCompleted
        ? '[Ctrl+C] Quit'
        : state.isPaused
            ? '[P] Resume   [Ctrl+C] Quit'
            : '[P] Pause   [Ctrl+C] Quit';

    return (
        <Box flexDirection="column" width={w} paddingX={1}>
            <Box justifyContent="space-between">
                <Text bold color="green">UFDLoader</Text>
                <Text color="gray">v0.1.0</Text>
                <Text bold color={statusColor}>{statusLabel}</Text>
            </Box>
            <Box><Text color="gray">{D.repeat(w)}</Text></Box>

            <InfoRow label="File" value={truncatePath(state.filename, w - 8)} w={w} />
            <InfoRow label="Size" value={formatBytes(state.totalSize)} w={w} />
            <InfoRow label="Dest" value={truncatePath(state.filename, w - 8)} w={w} />

            <Box><Text color="gray">{D.repeat(w)}</Text></Box>

            <Box flexDirection="column">
                <Box justifyContent="space-between">
                    <Text bold color="yellow">Progress</Text>
                    <Text color="white" bold>{percentage}%</Text>
                </Box>
                <ProgressBar percentage={percentage} width={barWidth} color={statusColor} />
                <Box justifyContent="space-between">
                    <Text color="gray">{formatBytes(totalDownloaded)}</Text>
                    <Text color="gray">/ {formatBytes(state.totalSize)}</Text>
                </Box>
            </Box>

            <Box><Text color="gray">{D.repeat(w)}</Text></Box>

            <Box flexDirection="column">
                <Text bold color="yellow">Connections ({state.segments.length})</Text>
                {state.segments.map((segment: DownloadSegment) => (
                    <SegmentRow key={segment.id} segment={segment} barWidth={segBarWidth} />
                ))}
            </Box>

            <Box><Text color="gray">{D.repeat(w)}</Text></Box>

            <Box flexDirection="column">
                <StatsRow label="Speed" value={state.isPaused ? 'Paused' : formatSpeed(speed)} w={w} />
                <StatsRow label="ETA" value={isCompleted ? 'Done' : state.isPaused ? '--' : formatDuration(etaSeconds)} w={w} />
                <StatsRow label="Time" value={formatDuration(elapsedSeconds)} w={w} />
                <StatsRow label="Conn" value={String(state.connections)} w={w} />
                <StatsRow label="Status" value={isCompleted ? 'Completed' : state.isPaused ? 'Paused' : 'Active'} w={w} />
            </Box>

            <Box><Text color="gray">{D.repeat(w)}</Text></Box>

            <Box justifyContent="center">
                <Text color="gray">{keyHint}</Text>
            </Box>
        </Box>
    );
};

const InfoRow: React.FC<{ label: string; value: string; w: number }> = ({ label, value, w }) => (
    <Box gap={1} width={w}>
        <Text color="gray">{label.padEnd(6)}</Text>
        <Text color="white" bold>{value}</Text>
    </Box>
);

const StatsRow: React.FC<{ label: string; value: string; w: number }> = ({ label, value, w }) => (
    <Box justifyContent="space-between" width={w}>
        <Text color="gray">{label}</Text>
        <Text color="white" bold>{value}</Text>
    </Box>
);

const SegmentRow: React.FC<{ segment: DownloadSegment; barWidth: number }> = ({ segment, barWidth }) => {
    const segPercent = segment.total > 0 ? Math.floor((segment.current / segment.total) * 100) : 0;
    const statusSymbol = segment.status === 'completed'
        ? '\u2713'
        : segment.status === 'downloading'
            ? '\u2193'
            : segment.status === 'paused'
                ? '\u23F8'
                : segment.status === 'failed'
                    ? '\u2717'
                    : '\u25CB';
    const statusColor = segment.status === 'completed'
        ? 'green'
        : segment.status === 'downloading'
            ? 'cyan'
            : segment.status === 'paused'
                ? 'yellow'
                : segment.status === 'failed'
                    ? 'red'
                    : 'gray';
    const barColor = segment.status === 'completed' ? 'green' : segment.status === 'paused' ? 'gray' : 'cyan';

    return (
        <Box gap={1}>
            <Text color="gray">#{String(segment.id).padStart(2, '0')}</Text>
            <ProgressBar percentage={segPercent} width={barWidth} color={barColor} />
            <Text color={statusColor}>{statusSymbol}</Text>
            <Text color="gray">{segPercent}%</Text>
            <Text color="gray">{formatBytes(segment.current)}/{formatBytes(segment.total)}</Text>
        </Box>
    );
};

const ProgressBar: React.FC<{ percentage: number; width: number; color: string }> = ({ percentage, width, color }) => {
    const filled = Math.floor((percentage / 100) * width);
    const empty = Math.max(0, width - filled);
    return (
        <Text color={color}>[{'\u2588'.repeat(filled)}{'\u2591'.repeat(empty)}]</Text>
    );
};
