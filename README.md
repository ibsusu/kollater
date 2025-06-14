# Kollator - P2P File Sharing Network

A browser-based peer-to-peer file sharing application utilizing WebRTC mesh networking and BitTorrent v2 protocol with custom extensions.

## Quick Start (Testbed)

### Prerequisites
- Bun runtime (for servers)
- Node.js/npm (for client)
- OpenSSL (for certificates)

### 1. Start the Testbed
```bash
# Start all components as binaries
./start-testbed.sh
```

### 2. Check Status
```bash
# Check if everything is running properly
./check-testbed.sh
```

### 3. Access the Application
- **Client App**: https://kollator.local:5173 (requires certificate trust)
- **Signaling Server**: https://kollator.local:8000 (requires certificate trust)

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
   ```bash
   # Add certificate to browser trust store
   # Chrome: Settings > Privacy > Manage Certificates > Authorities
   # Import: certs/_wildcard.kollator.local+3.pem
   ```

2. **DNS Resolution**
   ```bash
   # Ensure kollator.local resolves
   echo "127.0.0.1 kollator.local" | sudo tee -a /etc/hosts
   ```

3. **Port Conflicts**
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
