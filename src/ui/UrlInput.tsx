import React from 'react';
import { Box, Text } from 'ink';
import { TextInput } from '@inkjs/ui';

interface Props {
    onSubmit: (url: string) => void;
    columns: number;
}

export const UrlInput: React.FC<Props> = ({ onSubmit, columns }) => {
    const w = columns - 2;
    const dw = w;

    return (
        <Box flexDirection="column" width={w} paddingX={1}>
            <Box justifyContent="space-between">
                <Text bold color="green">UFDLoader</Text>
                <Text color="gray">v0.1.0</Text>
                <Text bold color="yellow">Download Accelerator</Text>
            </Box>
            <Box><Text color="gray">{D.repeat(dw)}</Text></Box>
            <Box paddingY={1}>
                <Text color="white">Enter the URL to download</Text>
            </Box>
            <Box>
                <TextInput
                    placeholder="https://example.com/file.zip"
                    onSubmit={onSubmit}
                />
            </Box>
            <Box paddingTop={1}><Text color="gray">{D.repeat(dw)}</Text></Box>
            <Box gap={1}>
                <Text color="cyan">Enter</Text><Text color="gray">confirm</Text>
                <Text color="cyan">Ctrl+C</Text><Text color="gray">exit</Text>
            </Box>
        </Box>
    );
};

const D = '\u2500';