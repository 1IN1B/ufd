# UFDLoader

> Terminal-based download accelerator built with multi-connection technology.

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/1IN1B/ufd)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/1IN1B/ufd/blob/main/LICENSE)

## Features

- **Multi-Connection Downloads** – Split files into parallel segments across multiple connections for maximum bandwidth utilization.
- **Resume Support** – Interrupted downloads pick up exactly where they left off.
- **Cross-Platform** – Native binaries for Linux, macOS (Intel & Apple Silicon), and Windows.
- **Real-Time Progress** – Interactive terminal UI with per-connection progress bars, speed metrics, and ETA estimates.
- **Interactive Folder Picker** – Browse and select download destinations with a built-in keyboard-navigable directory browser.
- **Error Recovery** – Automatic retry on failed connections with smart error handling.

## Prerequisites

- [Bun](https://bun.com) runtime (v1.1.0 or later)
- Git

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/1IN1B/ufd.git
cd ufd
```

### 2. Install Dependencies

```bash
bun install
```

## Usage

### Development (Run Directly)

```bash
bun run index.ts <url> [options]
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `-n, --connections <number>` | Number of parallel connections | `8` |
| `-o, --output <path>` | Output destination (skips folder picker) | auto |

**Examples:**

```bash
# Download with default 8 connections
bun run index.ts https://example.com/file.zip

# Use 16 connections for faster downloads
bun run index.ts -n 16 https://example.com/file.zip

# Specify output path directly
bun run index.ts -o ~/Downloads/file.zip https://example.com/file.zip
```

## Building from Source

### Option 1: Build All Platforms (Automated)

Run the build script to compile binaries for all platforms:

```bash
chmod +x build.sh
./build.sh
```

**Output:** Compiled executables in the `dist/` directory:

- `dist/ufdloader-linux` – Linux x64
- `dist/ufdloader-mac` – macOS Intel (x64)
- `dist/ufdloader-mac-arm64` – macOS Apple Silicon (ARM64)
- `dist/ufdloader-windows.exe` – Windows x64

### Option 2: Build for Specific OS

You can also build for a specific platform using npm scripts:

#### Linux

```bash
bun run build:linux
```

**Output:** `dist/ufdloader-linux`

#### macOS (Intel)

```bash
bun run build:mac
```

**Output:** `dist/ufdloader-mac`

#### macOS (Apple Silicon – M1/M2/M3)

```bash
bun run build:mac-arm
```

**Output:** `dist/ufdloader-mac-arm64`

#### Windows

```bash
bun run build:windows
```

**Output:** `dist/ufdloader-windows.exe`

### Option 3: Manual Build

You can also compile manually using `bun build`:

```bash
# Linux
bun build --compile --target=bun-linux-x64 index.ts --outfile dist/ufdloader-linux

# macOS Intel
bun build --compile --target=bun-darwin-x64 index.ts --outfile dist/ufdloader-mac

# macOS Apple Silicon
bun build --compile --target=bun-darwin-arm64 index.ts --outfile dist/ufdloader-mac-arm64

# Windows
bun build --compile --target=bun-windows-x64 index.ts --outfile dist/ufdloader-windows.exe
```

## Installing the Binary

After building, you can move the binary to a directory in your `PATH` for global access:

### Linux & macOS

```bash
# For Linux
sudo mv dist/ufdloader-linux /usr/local/bin/ufdloader
sudo chmod +x /usr/local/bin/ufdloader

# For macOS Intel
sudo mv dist/ufdloader-mac /usr/local/bin/ufdloader
sudo chmod +x /usr/local/bin/ufdloader

# For macOS Apple Silicon
sudo mv dist/ufdloader-mac-arm64 /usr/local/bin/ufdloader
sudo chmod +x /usr/local/bin/ufdloader
```

### Windows

1. Move `dist/ufdloader-windows.exe` to a directory in your `PATH` (e.g., `C:\Windows\System32\` or create a custom folder and add it to PATH).
2. Optionally rename it to `ufdloader.exe`.
3. Open Command Prompt or PowerShell and run `ufdloader`.

## Development

### Project Structure

```
ufd/
├── index.ts              # Entry point (CLI argument parsing)
├── index.html            # Landing page
├── src/
│   ├── engine/
│   │   └── downloader.ts # Core download engine
│   └── ui/
│       └── App.tsx       # Terminal UI (Ink/React)
├── build.sh              # Cross-platform build script
├── package.json
└── tsconfig.json
```

### Technologies Used

- **Bun** – Fast JavaScript runtime & bundler
- **TypeScript** – Type-safe development
- **Commander** – CLI argument parsing
- **Ink + React** – Terminal UI framework
- **Axios** – HTTP client for range requests
- **Chalk** – Terminal styling

## License

[MIT](https://github.com/1IN1B/ufd/blob/main/LICENSE) © Bibhuti Bhushan Saha
