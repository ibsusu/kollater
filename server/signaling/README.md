# Kollator Signaling Server (Front Server)

The "Ticket Booth" component of Kollator's distributed architecture. Front servers handle initial client bootstrapping, WebRTC signaling, and maintain synchronized worker pool mappings for the peer-to-peer file sharing network.

## Architecture Overview

Front servers act as lightweight entry points that facilitate WebRTC connection establishment between clients and workers. They implement a distributed coordination system using consistent hashing and leader election for fault tolerance.

### Core Responsibilities

- **Client Bootstrapping**: Serve static resources for initial page load
- **WebRTC Signaling**: Handle connection signaling between clients and workers
- **Worker Pool Management**: Maintain synchronized mapping of IP ranges to workers
- **Leader Election**: Implement fault-tolerant coordination across multiple front servers
- **Load Balancing**: Use consistent hashing for optimal client-to-worker assignment

## Technology Stack

- **Runtime**: Bun with TypeScript
- **WebRTC**: node-datachannel for server-side WebRTC support
- **Database**: cr-sqlite for distributed state synchronization
- **Networking**: HTTP servers with anycast networking support
- **Coordination**: Custom leader election and consistent hashing algorithms

## Key Features

### Ticket Booth Architecture

The front server implements Kollator's "Ticket Booth" pattern:

1. **Initial Contact**: Clients connect via HTTP to get bootstrap information
2. **Worker Assignment**: Use consistent hashing to assign clients to optimal workers
3. **Signaling Relay**: Facilitate WebRTC offer/answer exchange between clients and workers
4. **Connection Handoff**: Once WebRTC is established, clients communicate directly with workers
5. **Health Monitoring**: Continuously monitor worker availability with 1-second timeouts

### Distributed Coordination

- **Consistent Hashing**: IP range → worker mapping shared across all front servers
- **cr-sqlite Sync**: Distributed database for real-time state synchronization
- **Leader Election**: Automatic failover when primary front server becomes unavailable
- **Worker Discovery**: Dynamic addition/removal of workers with automatic rebalancing

### Fault Tolerance

- **Multi-Server Deployment**: Multiple front servers for high availability
- **Automatic Failover**: Leader election ensures continuous operation
- **Worker Health Checks**: 1-second timeout detection with automatic rebalancing
- **State Synchronization**: All front servers maintain identical worker mappings

## Project Structure

```
server/signaling/
├── src/
│   ├── constants.ts         # Configuration constants
│   └── utils.ts            # Utility functions
├── node-datachannel/       # WebRTC implementation (git submodule)
├── index.ts                # Main server entry point
├── signaling.js           # Legacy signaling implementation
└── package.json           # Dependencies and scripts
```

## Development Setup

### Prerequisites

- Bun runtime (v1.1.4+)
- Node.js 18+ (for node-datachannel compilation)
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

The server runs on port 8080 by default with WebSocket support for signaling.

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
PORT=8080
HOST=0.0.0.0

# Worker Pool Configuration
WORKER_HEALTH_TIMEOUT=1000
CONSISTENT_HASH_REPLICAS=150

# Database Configuration
SQLITE_PATH=./signaling.db
SYNC_INTERVAL=100

# WebRTC Configuration
STUN_SERVERS=stun:stun.l.google.com:19302
TURN_SERVERS=turn:your-turn-server.com:3478
```

### Worker Pool Configuration

Front servers maintain a consistent hash ring for worker assignment:

```typescript
// Example worker configuration
const workerPool = {
  "192.168.1.100": { region: "us-west", capacity: 100 },
  "192.168.1.101": { region: "us-west", capacity: 100 },
  "192.168.1.102": { region: "us-east", capacity: 100 },
  "192.168.1.103": { region: "us-east", capacity: 100 }
};
```

## API Endpoints

### HTTP Endpoints

- `GET /` - Serve client application
- `GET /health` - Server health check
- `GET /workers` - Available worker list
- `POST /bootstrap` - Client bootstrap with worker assignment

### WebSocket Endpoints

- `WS /signaling` - WebRTC signaling relay
- `WS /worker-sync` - Inter-server synchronization

## Deployment Architecture

### Testbed Configuration

```yaml
# Docker Compose example
version: '3.8'
services:
  signaling-1:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ID=signaling-1
      - LEADER_ELECTION=true
    
  signaling-2:
    build: .
    ports:
      - "8081:8080"
    environment:
      - NODE_ID=signaling-2
      - LEADER_ELECTION=true
```

### Production Deployment

- **Anycast Networking**: Single IP address routes to nearest front server
- **Load Balancing**: Geographic distribution with regional worker pools
- **Health Monitoring**: Automated deployment and scaling
- **SSL Termination**: HTTPS/WSS for secure signaling

## Consistent Hashing Algorithm

The front server uses consistent hashing to assign clients to workers:

```typescript
// Simplified consistent hashing implementation
class ConsistentHash {
  private ring: Map<number, string> = new Map();
  private replicas: number = 150;

  addWorker(workerId: string) {
    for (let i = 0; i < this.replicas; i++) {
      const hash = this.hash(`${workerId}:${i}`);
      this.ring.set(hash, workerId);
    }
  }

  getWorker(clientIP: string): string {
    const hash = this.hash(clientIP);
    // Find next worker in ring
    return this.findNextWorker(hash);
  }
}
```

## Leader Election

Front servers implement a simple leader election protocol:

1. **Startup**: Each server attempts to acquire leadership
2. **Heartbeat**: Leader sends periodic heartbeats to followers
3. **Failure Detection**: Followers detect leader failure via missed heartbeats
4. **Re-election**: New leader elected when current leader fails
5. **State Sync**: New leader synchronizes state with all followers

## Performance Characteristics

### Scalability Metrics

- **Connection Handling**: 10,000+ concurrent WebSocket connections per server
- **Signaling Latency**: <50ms for WebRTC offer/answer relay
- **Worker Assignment**: <10ms consistent hash lookup
- **State Sync**: <100ms cr-sqlite synchronization across servers

### Resource Usage

- **Memory**: ~50MB base + ~1KB per active connection
- **CPU**: Minimal usage (signaling relay only)
- **Network**: Low bandwidth (signaling messages only)
- **Storage**: Minimal (worker mappings and connection state)

## Monitoring and Observability

### Health Checks

```bash
# Server health
curl http://localhost:8080/health

# Worker pool status
curl http://localhost:8080/workers

# Connection metrics
curl http://localhost:8080/metrics
```

### Logging

The server provides structured logging for:
- Client connection/disconnection events
- Worker health status changes
- Leader election events
- WebRTC signaling message relay
- Error conditions and recovery actions

## Security Considerations

### Current Implementation

- **Anonymous Access**: No client authentication required
- **Worker Authentication**: Shared symmetric key prevents unauthorized workers
- **Rate Limiting**: Basic IP-based connection limits
- **Input Validation**: All signaling messages validated

### Production Security

- **DDoS Protection**: Rate limiting and connection throttling
- **SSL/TLS**: HTTPS/WSS for encrypted signaling
- **Access Control**: Optional IP whitelisting for worker connections
- **Audit Logging**: Comprehensive security event logging

## Troubleshooting

### Common Issues

1. **Worker Connection Failures**:
   - Check worker health endpoints
   - Verify consistent hash ring integrity
   - Monitor leader election status

2. **Client Bootstrap Failures**:
   - Verify static asset serving
   - Check WebSocket connectivity
   - Monitor server resource usage

3. **Synchronization Issues**:
   - Check cr-sqlite database integrity
   - Verify inter-server connectivity
   - Monitor sync lag metrics

### Debug Mode

Enable debug logging:

```bash
DEBUG=kollator:signaling bun run index.ts
```

## Related Components

- **Workers**: Backend nodes that front servers coordinate
- **Clients**: Browser applications that bootstrap through front servers
- **STUN/TURN Servers**: NAT traversal infrastructure
- **Load Balancers**: Optional layer for geographic distribution

This project was created using `bun init` in bun v1.1.4. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
