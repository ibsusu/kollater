# Kollator Worker Server

Reliable backend nodes that provide persistent storage and data retrieval for Kollator's peer-to-peer file sharing network. Workers handle S3 storage operations, maintain local caches, and participate in the DHT for chunk discovery.

## Architecture Overview

Workers serve as the backbone of Kollator's distributed storage system. They bridge the gap between ephemeral browser clients and persistent cloud storage, providing reliability and availability for the P2P network.

### Core Responsibilities

- **Persistent Storage**: Store and retrieve file chunks from S3-compatible storage (Wasabi)
- **Local Caching**: Maintain LRU cache (300MB max) for frequently accessed chunks
- **DHT Participation**: Announce chunk availability and respond to discovery queries
- **Client API Processing**: Handle client requests via WebRTC data channels
- **Worker Authentication**: Authenticate with other workers using shared symmetric keys
- **Automatic Failover**: Provide S3 fallback when chunks not locally available

## Technology Stack

- **Runtime**: Bun with TypeScript
- **WebRTC**: node-datachannel for server-side WebRTC support
- **Storage**: AWS SDK for S3-compatible object storage
- **DHT**: webtorrent/bittorrent-dht for peer discovery
- **Caching**: Custom LRU implementation with filesystem backend
- **Authentication**: Symmetric key cryptography for worker verification

## Key Features

### Storage Strategy

Workers implement a multi-tier storage approach:

1. **Local Cache**: 300MB LRU cache for hot data
   - Filesystem-based storage for fast access
   - Automatic eviction of least recently used chunks
   - Configurable cache size and retention policies

2. **S3 Backend**: Persistent storage for all chunks
   - All chunks and torrent metadata stored in S3
   - Automatic upload on chunk receipt
   - Fallback retrieval when not in local cache

3. **Intelligent Caching**: 
   - Cache popular chunks based on access patterns
   - Prefetch related chunks for sequential access
   - Coordinate with other workers to avoid duplication

### WebRTC Data Channel Protocol

Workers communicate with clients using a binary protocol:

```
Message Format:
[2-byte header][payload]

Header Format:
- Byte 0: Message type (0x01=chunk_request, 0x02=chunk_response, etc.)
- Byte 1: Flags (compression, encryption, etc.)
```

### DHT Integration

- **Chunk Announcement**: Announce availability of stored chunks
- **Peer Discovery**: Help clients find other peers with specific chunks
- **Network Coordination**: Coordinate with other workers for load balancing
- **Health Monitoring**: Participate in network health and topology discovery

## Project Structure

```
server/worker/
├── src/
│   ├── comms.ts            # WebRTC communication layer
│   ├── constants.ts        # Configuration constants
│   ├── filer.ts           # File and chunk management
│   └── utils.ts           # Utility functions
├── crypto/
│   └── encryptionKey      # Shared symmetric key for worker auth
├── node-datachannel/      # WebRTC implementation (git submodule)
├── index.ts               # Main server entry point
└── package.json           # Dependencies and scripts
```

## Development Setup

### Prerequisites

- Bun runtime (v1.1.4+)
- Node.js 18+ (for node-datachannel compilation)
- S3-compatible storage access (AWS S3, Wasabi, MinIO)
- Git (for submodule management)
- C++ build tools (for native WebRTC compilation)

### Installation

```bash
# Install dependencies (includes node-datachannel build)
bun install

# Manual node-datachannel build if needed
cd node-datachannel
bun install
bun run build
cd ..
```

### Development Server

```bash
# Start development server
bun run index.ts

# Alternative: use nodemon for auto-restart
bun run dev
```

The worker runs on port 8081 by default and connects to the signaling server for coordination.

### Building

```bash
# Build node-datachannel native module
bun run build

# Type checking
bun run type-check
```

## Configuration

### Environment Variables

```env
# Server Configuration
PORT=8081
HOST=0.0.0.0
WORKER_ID=worker-001

# Storage Configuration
S3_ENDPOINT=https://s3.wasabisys.com
S3_BUCKET=kollator-chunks
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_REGION=us-east-1

# Cache Configuration
CACHE_SIZE_MB=300
CACHE_PATH=./cache
LRU_MAX_AGE_HOURS=24

# DHT Configuration
DHT_BOOTSTRAP_NODES=router.bittorrent.com:6881,dht.transmissionbt.com:6881
DHT_PORT=6881

# WebRTC Configuration
STUN_SERVERS=stun:stun.l.google.com:19302
TURN_SERVERS=turn:your-turn-server.com:3478

# Authentication
WORKER_SHARED_KEY_PATH=./crypto/encryptionKey
```

### S3 Storage Configuration

Workers support any S3-compatible storage provider:

```typescript
// S3 client configuration
const s3Config = {
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true, // Required for some S3-compatible services
};
```

## Storage Operations

### Chunk Storage

```typescript
// Store chunk in both cache and S3
async function storeChunk(chunkHash: string, data: Buffer) {
  // Store in local cache
  await cache.set(chunkHash, data);
  
  // Upload to S3
  await s3.putObject({
    Bucket: S3_BUCKET,
    Key: `chunks/${chunkHash}`,
    Body: data,
    ContentType: 'application/octet-stream',
  });
}
```

### Chunk Retrieval

```typescript
// Retrieve chunk with cache fallback
async function getChunk(chunkHash: string): Promise<Buffer> {
  // Try local cache first
  let data = await cache.get(chunkHash);
  if (data) return data;
  
  // Fallback to S3
  const response = await s3.getObject({
    Bucket: S3_BUCKET,
    Key: `chunks/${chunkHash}`,
  });
  
  data = await response.Body.transformToByteArray();
  
  // Cache for future requests
  await cache.set(chunkHash, data);
  
  return data;
}
```

## API Endpoints

### WebRTC Data Channel Messages

- `CHUNK_REQUEST`: Request specific chunk by hash
- `CHUNK_RESPONSE`: Return requested chunk data
- `CHUNK_STORE`: Store new chunk in worker storage
- `CHUNK_LIST`: List available chunks
- `DHT_ANNOUNCE`: Announce chunk availability to DHT
- `HEALTH_CHECK`: Worker health and status information

### HTTP Endpoints (Internal)

- `GET /health` - Worker health check
- `GET /stats` - Cache and storage statistics
- `GET /chunks` - List cached chunks
- `POST /cache/clear` - Clear local cache
- `POST /dht/announce` - Force DHT announcement

## Cache Management

### LRU Cache Implementation

```typescript
class LRUCache {
  private maxSize: number;
  private cache: Map<string, CacheEntry>;
  private accessOrder: string[];

  async set(key: string, data: Buffer) {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      await this.evictLRU();
    }
    
    // Store to filesystem
    await this.writeToFile(key, data);
    
    // Update cache metadata
    this.cache.set(key, {
      size: data.length,
      accessTime: Date.now(),
      filePath: this.getFilePath(key),
    });
    
    this.updateAccessOrder(key);
  }
}
```

### Cache Statistics

Workers provide detailed cache performance metrics:

- **Hit Rate**: Percentage of requests served from cache
- **Miss Rate**: Percentage of requests requiring S3 fallback
- **Eviction Rate**: Frequency of LRU evictions
- **Storage Usage**: Current cache size vs. maximum
- **Access Patterns**: Most and least accessed chunks

## DHT Integration

### Chunk Announcement

```typescript
// Announce chunk availability to DHT
async function announceChunk(chunkHash: string) {
  const infoHash = Buffer.from(chunkHash, 'hex');
  
  dht.announce(infoHash, {
    port: DHT_PORT,
    impliedPort: true,
  }, (err) => {
    if (err) console.error('DHT announce failed:', err);
    else console.log('Announced chunk:', chunkHash);
  });
}
```

### Peer Discovery

```typescript
// Find peers with specific chunk
async function findPeers(chunkHash: string): Promise<Peer[]> {
  return new Promise((resolve, reject) => {
    const infoHash = Buffer.from(chunkHash, 'hex');
    const peers: Peer[] = [];
    
    dht.lookup(infoHash, (err, numPeers) => {
      if (err) reject(err);
      else resolve(peers);
    });
    
    dht.on('peer', (peer, infoHash) => {
      if (infoHash.toString('hex') === chunkHash) {
        peers.push(peer);
      }
    });
  });
}
```

## Performance Characteristics

### Storage Performance

- **Cache Hit Rate**: Target >70% for frequently accessed content
- **S3 Fallback Latency**: <500ms for cache misses
- **Chunk Upload Speed**: Limited by S3 bandwidth and connection
- **Local Cache Access**: <10ms for cached chunks

### Network Performance

- **WebRTC Throughput**: Up to 1Gbps per connection (hardware limited)
- **Concurrent Connections**: 1000+ simultaneous client connections
- **DHT Response Time**: <100ms for peer discovery queries
- **Chunk Transfer Rate**: 5MB chunks in <5 seconds over good connections

### Resource Usage

- **Memory**: ~100MB base + cache metadata
- **Storage**: 300MB local cache + unlimited S3
- **CPU**: Moderate usage for crypto operations and data transfer
- **Network**: High bandwidth usage for chunk transfers

## Security Model

### Worker Authentication

Workers authenticate with each other using shared symmetric keys:

```typescript
// Generate authentication token
function generateAuthToken(workerId: string, timestamp: number): string {
  const message = `${workerId}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', SHARED_KEY);
  hmac.update(message);
  return hmac.digest('hex');
}

// Verify authentication token
function verifyAuthToken(workerId: string, timestamp: number, token: string): boolean {
  const expectedToken = generateAuthToken(workerId, timestamp);
  return crypto.timingSafeEqual(
    Buffer.from(token, 'hex'),
    Buffer.from(expectedToken, 'hex')
  );
}
```

### Data Integrity

- **Chunk Verification**: SHA-256 hash verification for all chunks
- **Transfer Integrity**: WebRTC built-in integrity checking
- **Storage Verification**: Periodic integrity checks of cached data
- **Corruption Recovery**: Automatic re-download from S3 on corruption detection

## Monitoring and Observability

### Health Checks

```bash
# Worker health
curl http://localhost:8081/health

# Cache statistics
curl http://localhost:8081/stats

# Chunk inventory
curl http://localhost:8081/chunks
```

### Metrics Collection

Workers expose metrics for monitoring:

```json
{
  "uptime": 86400,
  "connections": {
    "active": 45,
    "total": 1250
  },
  "cache": {
    "hitRate": 0.73,
    "size": "287MB",
    "chunks": 1432
  },
  "storage": {
    "s3Requests": 2341,
    "s3Errors": 12,
    "uploadedChunks": 856
  },
  "dht": {
    "announcements": 1432,
    "queries": 3421,
    "peers": 234
  }
}
```

## Deployment Architecture

### Docker Configuration

```dockerfile
FROM oven/bun:1.1.4

WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install

COPY . .
RUN bun run build

EXPOSE 8081
CMD ["bun", "run", "index.ts"]
```

### Production Deployment

```yaml
# Docker Compose for worker cluster
version: '3.8'
services:
  worker-1:
    build: .
    ports:
      - "8081:8081"
    environment:
      - WORKER_ID=worker-1
      - S3_ENDPOINT=https://s3.wasabisys.com
    volumes:
      - ./cache1:/app/cache
      - ./crypto:/app/crypto:ro

  worker-2:
    build: .
    ports:
      - "8082:8081"
    environment:
      - WORKER_ID=worker-2
      - S3_ENDPOINT=https://s3.wasabisys.com
    volumes:
      - ./cache2:/app/cache
      - ./crypto:/app/crypto:ro
```

## Troubleshooting

### Common Issues

1. **S3 Connection Failures**:
   - Verify credentials and endpoint configuration
   - Check network connectivity to S3 service
   - Monitor S3 service status and quotas

2. **Cache Performance Issues**:
   - Monitor cache hit rates and eviction patterns
   - Adjust cache size based on available storage
   - Check filesystem performance and available space

3. **WebRTC Connection Problems**:
   - Verify STUN/TURN server configuration
   - Check firewall rules for WebRTC ports
   - Monitor signaling server connectivity

4. **DHT Connectivity Issues**:
   - Verify bootstrap node accessibility
   - Check DHT port availability
   - Monitor peer discovery success rates

### Debug Mode

Enable comprehensive debug logging:

```bash
DEBUG=kollator:worker,kollator:cache,kollator:s3 bun run index.ts
```

## Related Components

- **Front Servers**: Coordinate worker pool and handle client bootstrapping
- **Clients**: Browser applications that connect to workers for storage
- **S3 Storage**: Persistent backend storage for all chunks
- **DHT Network**: Enables peer and chunk discovery across the network

This project was created using `bun init` in bun v1.1.4. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
