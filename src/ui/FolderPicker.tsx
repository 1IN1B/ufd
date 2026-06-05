import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { formatBytes, truncatePath } from '../utils.ts';

interface ListItem {
    type: 'action' | 'directory' | 'file' | 'divider';
    action?: 'up' | 'select';
    name: string;
    size?: number;
}

interface Props {
    onSelect: (folder: string) => void;
    columns: number;
    rows: number;
}

const D = '\u2500';

export const FolderPicker: React.FC<Props> = ({ onSelect, columns, rows }) => {
    const w = columns - 2;
    const visibleCount = Math.max(5, rows - 13);

    const [currentPath, setCurrentPath] = useState(process.cwd());
    const [cursor, setCursor] = useState(0);
    const [mode, setMode] = useState<'navigate' | 'search'>('navigate');
    const [searchText, setSearchText] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const homeDir = os.homedir();
    const downloadsDir = path.join(homeDir, 'Downloads');

    const allItems = useMemo<ListItem[]>(() => {
        try {
            const entries = fs.readdirSync(currentPath, { withFileTypes: true });
            const dirs = entries
                .filter(f => f.isDirectory() && !f.name.startsWith('.'))
                .sort((a, b) => a.name.localeCompare(b.name));
            const files = entries
                .filter(f => !f.isDirectory() && !f.name.startsWith('.'))
                .sort((a, b) => a.name.localeCompare(b.name));

            const items: ListItem[] = [
                { type: 'action', action: 'up', name: '..  (parent directory)' },
                { type: 'action', action: 'select', name: 'SELECT THIS FOLDER' },
            ];

            if (dirs.length > 0) {
                items.push({ type: 'divider', name: 'directories' });
                for (const d of dirs) {
                    items.push({ type: 'directory', name: d.name });
                }
            }

            if (files.length > 0) {
                items.push({ type: 'divider', name: 'files' });
                try {
                    for (const f of files) {
                        const fullPath = path.join(currentPath, f.name);
                        const stat = fs.statSync(fullPath);
                        items.push({ type: 'file', name: f.name, size: stat.size });
                    }
                } catch {
                    for (const f of files) {
                        items.push({ type: 'file', name: f.name });
                    }
                }
            }

            setErrorMsg(null);
            return items;
        } catch (err: any) {
            setErrorMsg(err.message || 'Cannot read directory');
            return [];
        }
    }, [currentPath]);

    const displayItems = useMemo<ListItem[]>(() => {
        if (mode !== 'search' || searchText.length === 0) return allItems;
        const lowerSearch = searchText.toLowerCase();
        return allItems.filter(item => {
            if (item.type === 'divider') return false;
            if (item.type === 'action') return true;
            return item.name.toLowerCase().includes(lowerSearch);
        });
    }, [allItems, mode, searchText]);

    const clampCursor = useCallback((idx: number, items: ListItem[]): number => {
        if (items.length === 0) return 0;
        let clamped = Math.max(0, Math.min(idx, items.length - 1));
        while (clamped < items.length && items[clamped]!.type === 'divider') clamped++;
        if (clamped >= items.length) {
            clamped = items.length - 1;
            while (clamped >= 0 && items[clamped]!.type === 'divider') clamped--;
        }
        return Math.max(0, clamped);
    }, []);

    useEffect(() => { setCursor(0); }, [currentPath, mode, searchText]);

    useEffect(() => {
        const clamped = clampCursor(cursor, displayItems);
        if (clamped !== cursor) setCursor(clamped);
    }, [cursor, displayItems, clampCursor]);

    const scrollOffset = useMemo(() => {
        if (cursor < visibleCount) return 0;
        return cursor - visibleCount + 3;
    }, [cursor, visibleCount]);

    const visibleSlice = useMemo(() => {
        const start = Math.max(0, scrollOffset);
        return displayItems.slice(start, start + visibleCount);
    }, [displayItems, scrollOffset, visibleCount]);

    const hasMoreAbove = scrollOffset > 0;
    const hasMoreBelow = scrollOffset + visibleCount < displayItems.length;

    const jumpTo = useCallback((targetPath: string) => {
        try {
            fs.accessSync(targetPath, fs.constants.R_OK);
            setCurrentPath(targetPath);
            setSearchText('');
            setMode('navigate');
        } catch {
            setErrorMsg('Cannot access: ' + targetPath);
        }
    }, []);

    const handleSelectItem = useCallback((item: ListItem) => {
        if (item.type === 'action' && item.action === 'up') {
            const parent = path.dirname(currentPath);
            if (parent !== currentPath) {
                setCurrentPath(parent);
                setSearchText('');
                setMode('navigate');
            }
        } else if (item.type === 'action' && item.action === 'select') {
            onSelect(currentPath);
        } else if (item.type === 'directory') {
            setCurrentPath(path.join(currentPath, item.name));
            setSearchText('');
            setMode('navigate');
        }
    }, [currentPath, onSelect]);

    const moveUp = useCallback(() => {
        let newCursor = cursor - 1;
        while (newCursor >= 0 && displayItems[newCursor]?.type === 'divider') newCursor--;
        if (newCursor >= 0) setCursor(newCursor);
    }, [cursor, displayItems]);

    const moveDown = useCallback(() => {
        let newCursor = cursor + 1;
        while (newCursor < displayItems.length && displayItems[newCursor]?.type === 'divider') newCursor++;
        if (newCursor < displayItems.length) setCursor(newCursor);
    }, [cursor, displayItems]);

    useInput((input, key) => {
        if (mode === 'search') {
            if (key.escape) { setMode('navigate'); setSearchText(''); return; }
            if (key.return) {
                const item = displayItems[cursor];
                if (item && item.type !== 'divider') handleSelectItem(item);
                return;
            }
            if (key.backspace || key.delete) { setSearchText(prev => prev.slice(0, -1)); return; }
            if (key.upArrow) { moveUp(); return; }
            if (key.downArrow) { moveDown(); return; }
            if (input.length === 1 && !key.ctrl && !key.meta) { setSearchText(prev => prev + input); return; }
            return;
        }

        if (key.upArrow) { moveUp(); return; }
        if (key.downArrow) { moveDown(); return; }
        if (key.return) {
            const item = displayItems[cursor];
            if (item && item.type !== 'divider') handleSelectItem(item);
            return;
        }
        if (input === '/') { setMode('search'); setSearchText(''); return; }
        if (input === 'h' || input === 'H') { jumpTo(homeDir); return; }
        if (input === 'd' || input === 'D') { jumpTo(downloadsDir); return; }
        if (input === 'r' || input === 'R') { jumpTo('/'); return; }
        if (key.escape) {
            const parent = path.dirname(currentPath);
            if (parent !== currentPath) setCurrentPath(parent);
            return;
        }
    });

    const renderDividerLine = (label: string) => (
        <Box>
            <Text color="gray">{D.repeat(4)} </Text>
            <Text color="gray" bold>{label}</Text>
            <Text color="gray"> {D.repeat(Math.max(1, w - label.length - 7))}</Text>
        </Box>
    );

    const renderItem = (item: ListItem, localIdx: number) => {
        const globalIdx = localIdx + scrollOffset;
        const isFocused = globalIdx === cursor;
        const marker = isFocused ? '\u25B8' : ' ';
        const markerColor = isFocused ? 'green' : 'gray';

        if (item.type === 'action' && item.action === 'up') {
            return (
                <Box key="action-up">
                    <Text color={markerColor}>{marker}</Text>
                    <Text color={isFocused ? 'yellow' : 'gray'} bold={isFocused}>{'\u25C4'} {item.name}</Text>
                </Box>
            );
        }
        if (item.type === 'action' && item.action === 'select') {
            return (
                <Box key="action-select">
                    <Text color={markerColor}>{marker}</Text>
                    <Text color={isFocused ? 'green' : 'gray'} bold>{'\u2713'} {item.name}</Text>
                </Box>
            );
        }
        if (item.type === 'divider') {
            return <Box key={`div-${item.name}-${globalIdx}`}>{renderDividerLine(item.name)}</Box>;
        }
        if (item.type === 'directory') {
            return (
                <Box key={`dir-${item.name}`}>
                    <Text color={markerColor}>{marker}</Text>
                    <Text color={isFocused ? 'cyan' : 'white'} bold={isFocused}>{'\u25B8'} {item.name}/</Text>
                </Box>
            );
        }
        if (item.type === 'file') {
            const sizeStr = item.size !== undefined ? formatBytes(item.size) : '';
            return (
                <Box key={`file-${item.name}`}>
                    <Text color={markerColor}>{marker}</Text>
                    <Text color={isFocused ? 'white' : 'gray'}>{'\u25CB'} {item.name}</Text>
                    {sizeStr && <Text color="gray">  {sizeStr}</Text>}
                </Box>
            );
        }
        return null;
    };

    const displayPath = truncatePath(currentPath, w - 8);

    return (
        <Box flexDirection="column" width={w} paddingX={1}>
            <Box justifyContent="space-between">
                <Text bold color="green">UFDLoader</Text>
                <Text color="gray">v0.1.0</Text>
                <Text bold color="yellow">Select Destination</Text>
            </Box>
            <Box><Text color="gray">{D.repeat(w)}</Text></Box>

            <Box>
                <Text color="gray">{'Path  '}</Text>
                <Text color="white" bold>{displayPath}</Text>
            </Box>
            <Box><Text color="gray">{D.repeat(w)}</Text></Box>

            <Box gap={2}>
                <Text color="gray">Quick:</Text>
                <Text color="cyan">H</Text><Text color="gray"> Home</Text>
                <Text color="cyan">D</Text><Text color="gray"> Downloads</Text>
                <Text color="cyan">R</Text><Text color="gray"> Root</Text>
            </Box>
            <Box><Text color="gray">{D.repeat(w)}</Text></Box>

            {mode === 'search' ? (
                <Box>
                    <Text color="yellow">{'/ '}</Text>
                    <Text color="white" bold>Search: </Text>
                    <Text color="green">{searchText}</Text>
                    <Text color="gray" bold>{'\u2588'}</Text>
                    <Text color="gray">  {displayItems.filter(i => i.type !== 'divider').length} matches</Text>
                </Box>
            ) : (
                <Box>
                    <Text color="yellow">{'/ '}</Text>
                    <Text color="gray">Press / to search</Text>
                </Box>
            )}
            <Box><Text color="gray">{D.repeat(w)}</Text></Box>

            {errorMsg ? (
                <Box paddingY={1}><Text color="red" bold>Error: {errorMsg}</Text></Box>
            ) : (
                <Box flexDirection="column">
                    {hasMoreAbove && <Box><Text color="gray">  {'\u2191'} {scrollOffset} more above</Text></Box>}
                    {visibleSlice.map((item, idx) => renderItem(item, idx))}
                    {hasMoreBelow && <Box><Text color="gray">  {'\u2193'} {displayItems.length - scrollOffset - visibleCount} more below</Text></Box>}
                </Box>
            )}

            <Box><Text color="gray">{D.repeat(w)}</Text></Box>
            <Box gap={1}>
                <Text color="cyan">{'\u2191\u2193'}</Text><Text color="gray"> Navigate</Text>
                <Text color="cyan">Enter</Text><Text color="gray"> Select</Text>
                <Text color="cyan">/</Text><Text color="gray"> Search</Text>
                <Text color="cyan">Esc</Text><Text color="gray"> Back</Text>
            </Box>
        </Box>
    );
};