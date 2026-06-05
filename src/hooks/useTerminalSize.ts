import { useState, useEffect } from 'react';
import { useStdout } from 'ink';

export function useTerminalSize() {
    const { stdout } = useStdout();
    const [size, setSize] = useState({
        columns: stdout.columns ?? 80,
        rows: stdout.rows ?? 24,
    });

    useEffect(() => {
        const onResize = () => {
            stdout.write('\x1b[2J\x1b[H');
            setSize({
                columns: stdout.columns ?? 80,
                rows: stdout.rows ?? 24,
            });
        };
        stdout.on('resize', onResize);
        return () => { stdout.off('resize', onResize); };
    }, [stdout]);

    return size;
}