# Kollator - P2P File Sharing Network

A browser-based peer-to-peer file sharing application utilizing WebRTC mesh networking and BitTorrent v2 protocol with custom extensions.

## Quick Start (Testbed)

### Prerequisites
- Bun runtime (for servers)
- Node.js/npm (for client)
- mkcert (for local SSL certificates)
- Git (for submodule initialization)

### 1. Initialize Git Submodules

The project uses git submodules for node-datachannel dependencies. Initialize them first:

```bash
# Clone the repository with submodules
git clone --recursive <repository-url>

# Or if you already cloned without --recursive, initialize submodules:
git submodule update --init --recursive
```

### 2. Setup SSL Certificates with mkcert

First, install and setup mkcert for local SSL certificates:

```bash
# Install mkcert (choose your platform)
# macOS
brew install mkcert

# Linux
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo cp mkcert-v*-linux-amd64 /usr/local/bin/mkcert

# Windows (using Chocolatey)
choco install mkcert

# Windows (using Scoop)
scoop bucket add extras
scoop install mkcert
```

Install the local CA and generate certificates:

```bash
# Install the local CA in the system trust store
mkcert -install

# Generate certificates for kollator.local and wildcard subdomain
cd certs/
mkcert kollator.local "*.kollator.local"

# This creates:
# - kollator.local+1.pem (certificate)
# - kollator.local+1-key.pem (private key)
```

### 3. Start the Testbed
```bash
# Start all components as binaries
./start-testbed.sh
```

### 4. Check Status
```bash
# Check if everything is running properly
./check-testbed.sh
```

### 5. Access the Application
- **Client App**: https://kollator.local:5173 (SSL certificate trusted via mkcert)
- **Signaling Server**: https://kollator.local:8000 (SSL certificate trusted via mkcert)

> **Note**: With mkcert properly installed, browsers will automatically trust the certificates without security warnings.

## Architecture

Kollator implements a "Ticket Booth Architecture":

- **Front Servers** (`server/signaling/`): Handle WebRTC signaling and client bootstrapping
- **Workers** (`server/worker/`): Provide persistent storage and data retrieval
- **Clients** (`client/`): Browser-based file management and P2P transfers

## Development Notes

### Current Status
- ✅ Basic WebRTC signaling between components
- ✅ Binary startup scripts for performance
- ✅ SSL certificate generation
- ⚠️  File chunking needs optimization (see below)
- ❌ BitTorrent DHT integration (planned)
- ❌ S3 storage integration (planned)
- ❌ OPFS client storage (planned)

### Known Issues

#### WebRTC File Chunking
The file chunking needs work due to WebRTC DataChannel limitations:
- **Issue**: https://github.com/feross/simple-peer/issues/561
- **Solution**: Use 16KB chunks as recommended
- **Module**: https://www.npmjs.com/package/chunk-stream

```javascript
var chunks = require('chunk-stream')
inputStream.pipe(chunks(16000)).pipe(peer)
// or with write:
var chunkStream = chunks(16000)
chunkStream.pipe(peer)
chunkStream.write(myData)
```

**References**:
- [WebRTC DataChannel Message Size Blog](http://viblast.com/blog/2015/2/5/webrtc-data-channel-message-size/)
- [ChatGPT Discussion](https://chatgpt.com/c/82e3fa4e-0338-469b-91f6-2a9e8a865490)
- [HN Discussion](https://news.ycombinator.com/item?id=40408515)

## Troubleshooting

### Common Issues

1. **Certificate Trust Issues**
   
   If you're seeing SSL certificate warnings, ensure mkcert is properly installed:
   
   ```bash
   # Check if mkcert CA is installed
   mkcert -CAROOT
   
   # If not installed, install the local CA
   mkcert -install
   
   # Regenerate certificates if needed
   cd certs/
   mkcert kollator.local "*.kollator.local"
   ```
   
   **Manual Certificate Trust (if mkcert doesn't work):**
   ```bash
   # Chrome: Settings > Privacy > Manage Certificates > Authorities
   # Import: certs/_wildcard.kollator.local+3.pem
   
   # Firefox: Settings > Privacy & Security > Certificates > View Certificates
   # Import the certificate under "Authorities" tab
   
   # Safari: Double-click the certificate file and add to Keychain
   # Set trust to "Always Trust" in Keychain Access
   ```

2. **DNS Resolution**
   ```bash
   # Ensure kollator.local resolves (done automatically by start-testbed.sh)
   echo "127.0.0.1 kollator.local" | sudo tee -a /etc/hosts
   ```

3. **mkcert Installation Issues**
   
   **macOS**: If Homebrew installation fails:
   ```bash
   # Alternative installation via direct download
   curl -JLO "https://dl.filippo.io/mkcert/latest?for=darwin/amd64"
   chmod +x mkcert-v*-darwin-amd64
   sudo mv mkcert-v*-darwin-amd64 /usr/local/bin/mkcert
   ```
   
   **Linux**: If you don't have sudo access:
   ```bash
   # Install to user directory
   mkdir -p ~/.local/bin
   curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
   chmod +x mkcert-v*-linux-amd64
   mv mkcert-v*-linux-amd64 ~/.local/bin/mkcert
   export PATH="$HOME/.local/bin:$PATH"
   ```
   
   **Windows**: If package managers aren't available:
   ```bash
   # Download from GitHub releases
   # Visit: https://github.com/FiloSottile/mkcert/releases
   # Download mkcert-v*-windows-amd64.exe
   # Rename to mkcert.exe and add to PATH
   ```

3. **Submodule Issues**
   
   If you're getting errors related to node-datachannel or missing dependencies:
   
   ```bash
   # Check submodule status
   git submodule status
   
   # If submodules are not initialized or out of sync:
   git submodule update --init --recursive
   
   # If you need to update submodules to latest commits:
   git submodule update --remote --recursive
   
   # If submodule URLs have changed or you have SSH key issues:
   git submodule sync --recursive
   git submodule update --init --recursive
   ```

4. **Port Conflicts**
   ```bash
   # Check what's using ports
   lsof -i :8000  # Signaling server
   lsof -i :5173  # Client dev server
   ```

### Logs
All logs are stored in the `logs/` directory:
- `signaling.log` - Front server logs
- `worker1.log` - Worker server logs  
- `client.log` - Client dev server logs

### Manual Startup
If the startup script doesn't work, start components manually:

```bash
# Terminal 1: Signaling Server
cd server/signaling && bun run index.ts

# Terminal 2: Worker
cd server/worker && bun run index.ts

# Terminal 3: Client
cd client && npm run dev
```

## Next Steps (PDR Implementation)

To fully implement the PDR requirements:

1. **File Processing Pipeline**
   - Implement 5MB file chunking
   - Add BitTorrent v2 hash generation
   - Create .ko torrent file format

2. **DHT Integration**
   - Add `webtorrent/bittorrent-dht` to all components
   - Implement chunk discovery and announcement

3. **Storage Systems**
   - Integrate S3/Wasabi for worker persistent storage
   - Implement OPFS for client-side storage
   - Add LRU caching for workers

4. **Advanced Features**
   - Consistent hashing for worker assignment
   - cr-sqlite for front server synchronization
   - Fault tolerance and automatic recovery

## Contributing

See individual component READMEs for detailed development information:
- [Client README](client/README.md)
- [Signaling Server README](server/signaling/README.md)
- [Worker Server README](server/worker/README.md)
