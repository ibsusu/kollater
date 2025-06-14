# Kollator Client

The browser-based frontend for Kollator's peer-to-peer file sharing application. This client implements WebRTC mesh networking and BitTorrent v2 protocol with custom extensions for distributed file sharing.

## Architecture Overview

The client serves as the user interface and file management layer in Kollator's "Ticket Booth Architecture". It handles file ingestion, local processing, peer-to-peer transfers, and storage management entirely within the browser environment.

### Core Responsibilities

- **File Ingestion**: Accept files from the native filesystem via browser file picker
- **Local Processing**: Chunk files into 5MB segments and generate BitTorrent v2 + Kollator metadata
- **P2P Networking**: Establish WebRTC connections for direct peer-to-peer chunk sharing
- **DHT Participation**: Discover and announce chunk availability through distributed hash table
- **Local Storage**: Manage files using Origin Private File System (OPFS) with 5GB quota
- **Fallback Handling**: Seamlessly switch between peers and workers for reliable transfers

## Technology Stack

- **Framework**: Preact with TypeScript
- **Build Tool**: Vite with Tailwind CSS
- **WebRTC**: simple-peer for connection abstraction
- **P2P Protocol**: webtorrent/bittorrent-dht for chunk discovery
- **Storage**: Origin Private File System (OPFS) API
- **Crypto**: libsodium-wrappers for hashing and future encryption
- **File Processing**: hash-wasm for efficient chunk hashing
- **UI Components**: Custom components with Tailwind styling

## Key Features

### File Processing Pipeline

1. **Upload Flow**:
   - User selects files via browser file picker
   - Files are chunked into 5MB segments locally
   - Generate BitTorrent v2 hashes (pieces + Merkle tree)
   - Generate Kollator-specific 5MB chunk hashes
   - Create hybrid .ko torrent files with extended metadata
   - Store chunks in OPFS and metadata locally
   - Distribute to assigned workers via WebRTC

2. **Download Flow**:
   - Query DHT for peers with specific chunk hashes
   - Request from multiple peers simultaneously
   - Implement failover logic (< 5KiB/s for 5+ seconds triggers peer switch)
   - Fallback to workers that fetch from S3 if needed
   - Reassemble original files from downloaded chunks

### WebRTC Implementation

- **Connection Management**: Automatic bootstrapping through front servers
- **Data Channels**: Binary message protocol with 2-byte headers
- **NAT Traversal**: STUN/TURN server integration for firewall bypass
- **Reconnection**: Automatic retry logic for connection failures
- **Performance**: Optimized for 5MB chunk transfers over WebRTC data channels

### Storage Management

- **Local Cache**: OPFS-based storage with 5GB browser quota
- **Chunk Organization**: Efficient indexing and retrieval of file segments
- **Metadata Storage**: Local torrent file and chunk mapping storage
- **Quota Management**: Intelligent cleanup and space management

## Project Structure

```
client/
├── src/
│   ├── core/                 # Core application logic
│   │   ├── comms.ts         # WebRTC communication layer
│   │   ├── fileProcessing.ts # File chunking and hashing
│   │   ├── fileStore.ts     # OPFS storage management
│   │   ├── peer.ts          # P2P connection handling
│   │   └── worker.ts        # Web worker integration
│   ├── components/          # UI components
│   │   ├── app.tsx          # Main application component
│   │   ├── dropzone.tsx     # File upload interface
│   │   └── fileList.tsx     # File management UI
│   └── assets/              # Static assets
├── public/                  # Public assets
└── docs/                    # Built application
```

## Development Setup

### Prerequisites

- Node.js 18+ or Bun runtime
- Modern browser with WebRTC support
- HTTPS development environment (required for OPFS)

### Installation

```bash
# Install dependencies
npm install
# or
bun install
```

### Development Server

```bash
# Start development server with HTTPS
npm run dev
# or
bun run dev
```

The development server runs on `https://localhost:5173` with automatic HTTPS for WebRTC and OPFS compatibility.

### Building

```bash
# Build for production
npm run build
# or
bun run build
```

Built files are output to the `docs/` directory for GitHub Pages deployment.

## Configuration

### Environment Variables

Create `.env.local` in `src/core/` for local configuration:

```env
VITE_SIGNALING_SERVER=wss://your-signaling-server.com
VITE_STUN_SERVERS=stun:stun.l.google.com:19302
VITE_TURN_SERVERS=turn:your-turn-server.com:3478
```

### WebRTC Configuration

The client automatically discovers and connects to available signaling servers and workers through the front server bootstrap process.

## Browser Compatibility

### Supported Browsers

- **Chrome/Chromium**: 86+ (full OPFS support)
- **Firefox**: 102+ (limited OPFS support)
- **Safari**: 15.2+ (WebRTC support)
- **Edge**: 86+ (Chromium-based)

### Required APIs

- WebRTC DataChannel API
- Origin Private File System (OPFS)
- File System Access API (for file picker)
- Web Workers
- WebAssembly (for crypto operations)

## Performance Characteristics

### Transfer Optimization

- **Chunk Size**: 5MB optimized for WebRTC data channel efficiency
- **Parallel Downloads**: Multiple peer connections per file
- **Speed Monitoring**: Automatic peer switching for slow transfers
- **Cache Strategy**: Intelligent local storage with LRU-style management

### Resource Usage

- **Memory**: Efficient streaming with minimal RAM usage
- **Storage**: 5GB OPFS quota with automatic cleanup
- **CPU**: WebAssembly crypto operations for optimal performance
- **Network**: Adaptive bandwidth usage with congestion control

## Security Model

### Current Implementation

- **Anonymous Sharing**: No user authentication required
- **IP-based Tracking**: Basic abuse prevention through IP monitoring
- **Chunk Verification**: Hash-based integrity checking
- **No Encryption**: Plaintext transfers (encryption planned for future)

### Future Security Features

- End-to-end encryption for all transfers
- File-level encryption with user-controlled keys
- Advanced abuse prevention and rate limiting
- Optional user authentication for private networks

## Troubleshooting

### Common Issues

1. **WebRTC Connection Failures**:
   - Ensure HTTPS is enabled
   - Check firewall/NAT configuration
   - Verify STUN/TURN server accessibility

2. **OPFS Storage Issues**:
   - Requires HTTPS context
   - Check browser storage quota
   - Clear browser data if corrupted

3. **File Transfer Failures**:
   - Monitor network connectivity
   - Check peer availability
   - Verify chunk integrity

### Debug Mode

Enable debug logging by setting `localStorage.debug = 'kollator:*'` in browser console.

## Contributing

### Code Style

- TypeScript strict mode enabled
- ESLint + Prettier for code formatting
- Preact/React patterns for components
- Functional programming preferred for core logic

### Testing

```bash
# Run type checking
npm run type-check

# Build and verify
npm run build
```

### Performance Monitoring

The client includes built-in performance monitoring for:
- WebRTC connection establishment times
- File transfer speeds and success rates
- Storage quota usage and cleanup efficiency
- DHT query response times

## Related Components

- **Front Servers**: Handle initial bootstrapping and WebRTC signaling
- **Workers**: Provide reliable storage and S3 integration
- **DHT Network**: Enables peer and chunk discovery
- **STUN/TURN Servers**: Facilitate NAT traversal for WebRTC connections
