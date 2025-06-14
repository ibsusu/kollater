# S3 Upload Tests for Kollator

This document describes the comprehensive S3 upload test suite for the Kollator application.

## Overview

The S3 upload tests provide end-to-end testing of the file upload functionality with S3 (MinIO) storage backend. These tests verify that files uploaded through the Kollator web interface are properly processed, encrypted, and stored in the appropriate S3 buckets.

## Test Coverage

### Basic S3 Tests (`s3-upload.spec.ts`)

### 1. Basic S3 Upload Workflow
- **Test**: `should upload file to S3 through application workflow`
- **Purpose**: Verifies that files uploaded through the UI are processed and stored in S3
- **Checks**: File appears in UI, S3 storage with encryption metadata

### 2. Multiple File Uploads
- **Test**: `should handle multiple file uploads to S3`
- **Purpose**: Tests concurrent file upload handling
- **Checks**: All files processed, S3 storage verification

### 3. S3 Infrastructure Verification
- **Test**: `should verify S3 bucket accessibility and configuration`
- **Purpose**: Validates MinIO setup and bucket accessibility
- **Checks**: All three buckets (`kollator-chunks`, `kollator-torrents`, `kollator-410`) are accessible

### 4. Large File Handling
- **Test**: `should handle large file upload to S3`
- **Purpose**: Tests performance with larger files (1MB test file)
- **Checks**: Large file processing and S3 storage

### 5. Encryption Verification
- **Test**: `should verify S3 encryption and metadata`
- **Purpose**: Ensures files are properly encrypted before S3 storage
- **Checks**: Encryption metadata (IV), content encryption verification

### 6. Torrent File Routing
- **Test**: `should handle torrent file uploads to correct bucket`
- **Purpose**: Verifies torrent files are routed to appropriate bucket
- **Checks**: File type detection and bucket routing

### 7. Storage Management
- **Test**: `should verify S3 storage capacity and cleanup`
- **Purpose**: Tests storage management and cleanup functionality
- **Checks**: Multiple file uploads, storage capacity tracking

### End-to-End Tests (`e2e-s3-upload.spec.ts`)

### 8. Complete Upload Workflow
- **Test**: `should complete full end-to-end upload workflow: ingestion → chunking → torrent → S3`
- **Purpose**: Tests the complete file processing pipeline from browser ingestion to S3 storage
- **Process**: 
  1. Browser file ingestion (10MB test file)
  2. 5MB chunking process
  3. Torrent metadata creation
  4. OPFS storage verification
  5. S3 upload verification
  6. Encryption metadata validation
  7. File integrity verification
- **Checks**: OPFS chunks, torrent metadata, S3 storage, encryption, chunk integrity

### 9. Concurrent Large File Processing
- **Test**: `should handle concurrent file uploads with proper chunking and S3 storage`
- **Purpose**: Tests multiple large files (6MB, 8MB, 12MB) processed concurrently
- **Checks**: Proper chunking, S3 storage of all chunks, torrent metadata for each file

### 10. Chunk Integrity and Reconstruction
- **Test**: `should verify chunk integrity and torrent reconstruction capability`
- **Purpose**: Verifies chunk integrity and ability to reconstruct files from chunks
- **Process**:
  1. Upload 7MB file (creates 2 chunks: 5MB + 2MB)
  2. Verify chunk sizes and hashes
  3. Verify S3 storage of encrypted chunks
  4. Test chunk retrieval from S3
- **Checks**: Chunk size verification, hash integrity, S3 retrieval capability

## Prerequisites

### 1. MinIO Setup
Ensure MinIO is running via Docker Compose:
```bash
docker-compose up -d
```

This will start MinIO on `localhost:9000` with the following configuration:
- **Access Key**: `kollator`
- **Secret Key**: `kollator123`
- **Buckets**: `kollator-chunks`, `kollator-410`, `kollator-torrents`

### 2. Dependencies
Install the required dependencies using Bun:
```bash
cd tests
bun install
```

The tests require:
- `@playwright/test` - Testing framework
- `@aws-sdk/client-s3` - S3 client for direct S3 operations (version 3.569.0 to match server)
- `@types/bun` - Bun type definitions
- `@types/node` - Node.js type definitions

### 3. Application Setup
Ensure the Kollator application is running and accessible at the configured URL (typically `http://localhost:5173` or similar).

## Running the Tests

### Using the Test Harness (Recommended)

The project includes a comprehensive test harness that handles server startup, dependency installation, and test execution:

#### Run All S3 Tests
```bash
./test-harness.sh test --grep="S3 Upload"
```

#### Run End-to-End Tests Only
```bash
./test-harness.sh test --grep="End-to-End S3 Upload"
```

#### Run Specific Test
```bash
./test-harness.sh test --grep="should complete full end-to-end upload workflow"
```

#### Run with UI (Visual Mode)
```bash
./test-harness.sh test --ui --grep="S3 Upload"
```

#### Run in Headed Mode (See Browser)
```bash
./test-harness.sh test --headed --grep="End-to-End S3 Upload"
```

#### Manual Testing Mode
```bash
./test-harness.sh manual
```
This starts all servers and keeps them running for manual testing.

### Direct Test Execution (Alternative)

If you prefer to run tests directly (ensure servers are already running):

```bash
cd tests
bun run test -- s3-upload.spec.ts
bun run test -- e2e-s3-upload.spec.ts
```

### Test Harness Commands

```bash
# Install dependencies
./test-harness.sh install

# Run tests with various options
./test-harness.sh test [--headed|--debug|--ui] [--grep="pattern"]

# Start servers for manual testing
./test-harness.sh manual

# Clean up processes
./test-harness.sh clean
```

## Test Architecture

### S3 Client Configuration
The tests use a direct S3 client to verify backend storage:
```typescript
const s3Config = {
  region: 'us-east-1',
  endpoint: 'http://localhost:9000',
  forcePathStyle: true,
  credentials: {
    accessKeyId: 'kollator',
    secretAccessKey: 'kollator123'
  }
};
```

### Test Lifecycle
1. **beforeAll**: Verify MinIO connectivity and bucket accessibility
2. **beforeEach**: Navigate to application, clear existing files
3. **Test Execution**: Upload files via UI, verify S3 storage
4. **afterEach**: Clean up S3 objects created during tests

### File Upload Simulation
Tests simulate file uploads by:
1. Creating test files in memory
2. Using `page.evaluate()` to call the application's file import function
3. Waiting for processing completion
4. Verifying both UI updates and S3 storage

### End-to-End Workflow
The end-to-end tests specifically verify:
1. **Browser Ingestion**: Files are properly ingested into the browser
2. **Chunking Process**: Large files are split into 5MB chunks
3. **Torrent Creation**: Torrent metadata is generated with chunk hashes
4. **OPFS Storage**: Chunks and metadata are stored in Origin Private File System
5. **S3 Upload**: Encrypted chunks and torrent metadata are uploaded to S3
6. **Integrity Verification**: Chunk hashes and file integrity are maintained

## Key Features Tested

### Encryption
- Files are encrypted before S3 storage using AES-256-GCM
- Initialization Vector (IV) is stored in S3 metadata
- Content verification ensures encryption is working

### File Processing
- Files are processed through the application's file handling pipeline
- OPFS (Origin Private File System) integration
- Database storage tracking

### Chunking System
- Large files are split into 5MB chunks for efficient transfer
- Each chunk is individually encrypted and uploaded
- Chunk integrity is verified through SHA-256 hashes

### Torrent Metadata
- BitTorrent-compatible metadata is generated
- Kollator-specific chunk information is included
- Torrent files are stored both locally (OPFS) and remotely (S3)

### Storage Management
- Multiple bucket support for different file types
- Storage capacity management
- File cleanup and cache management

## Troubleshooting

### MinIO Connection Issues
If tests fail with S3 connection errors:
1. Verify MinIO is running: `docker-compose ps`
2. Check MinIO logs: `docker-compose logs minio`
3. Verify bucket creation: `docker-compose logs minio-setup`

### Application Not Ready
If tests fail with application readiness issues:
1. Ensure the application is running and accessible
2. Check that the filer system is properly initialized
3. Verify OPFS support in the test browser

### Test Timeouts
If tests timeout:
1. Increase timeout values for large file tests
2. Check system performance and available resources
3. Verify network connectivity to MinIO

### End-to-End Test Issues
If end-to-end tests fail:
1. Verify full mode is enabled (simpleMode = false)
2. Check that worker processes are running
3. Ensure sufficient disk space for large file processing
4. Verify WebRTC/communication channels are working

## Test Data

### File Types Tested
- Binary files (random data)
- Text files (UTF-8 content)
- Large files (1MB+)
- Very large files (10MB+ for chunking tests)
- Torrent files (mock .torrent format)

### Expected S3 Structure
Files are stored in S3 with:
- **Key**: SHA-256 hash of the original file hash
- **Metadata**: Encryption IV and other processing metadata
- **Content**: AES-256-GCM encrypted file data

### Expected OPFS Structure
```
/
├── kollatorDb (database file)
├── chunks/
│   ├── [chunk-hash-1] (5MB chunk)
│   ├── [chunk-hash-2] (5MB chunk)
│   └── [chunk-hash-n] (remaining bytes)
├── [file-hash] (original file)
└── [file-hash]torrent (torrent metadata)
```

## Integration with CI/CD

These tests can be integrated into CI/CD pipelines with:
1. MinIO container setup
2. Application deployment
3. Test execution with proper cleanup

Example GitHub Actions workflow:
```yaml
- name: Setup Bun
  uses: oven-sh/setup-bun@v1
  with:
    bun-version: latest

- name: Start MinIO
  run: docker-compose up -d minio

- name: Install Dependencies and Run S3 Upload Tests
  run: ./test-harness.sh test --grep="S3 Upload"

- name: Cleanup
  if: always()
  run: |
    ./test-harness.sh clean
    docker-compose down
```

### Alternative Direct Execution
```yaml
- name: Setup Bun
  uses: oven-sh/setup-bun@v1

- name: Start MinIO
  run: docker-compose up -d minio

- name: Install Test Dependencies
  run: |
    cd tests
    bun install

- name: Start Application Servers
  run: |
    # Start servers in background
    cd server/signaling && bun install && bun run index.ts &
    cd server/worker && bun install && bun run index.ts &
    cd client && bun install && bun run dev &
    sleep 10

- name: Run S3 Upload Tests
  run: |
    cd tests
    bun run test -- s3-upload.spec.ts
    bun run test -- e2e-s3-upload.spec.ts
```

## Security Considerations

### Test Environment
- Tests use local MinIO instance with test credentials
- No production data is used in tests
- All test data is cleaned up after execution

### Encryption Testing
- Verifies encryption is applied before storage
- Tests encryption metadata integrity
- Ensures no plaintext data reaches S3

## Performance Considerations

### Test Execution Time
- Basic tests: ~30 seconds per test
- Large file tests: ~60 seconds per test
- End-to-end tests: ~2-5 minutes per test
- Full suite: ~10-20 minutes

### Resource Usage
- Memory: Tests create files in memory (up to 10MB per test)
- Storage: Temporary S3 storage during test execution
- Network: Local MinIO communication only
- CPU: Encryption and chunking operations

## Future Enhancements

### Potential Test Additions
1. **Concurrent Upload Stress Testing**: Multiple simultaneous uploads
2. **Network Failure Simulation**: Test resilience to network issues
3. **Storage Quota Testing**: Verify behavior when storage limits are reached
4. **File Corruption Testing**: Test handling of corrupted uploads
5. **Performance Benchmarking**: Measure upload speeds and processing times
6. **Torrent Reconstruction Testing**: Verify ability to reconstruct files from chunks
7. **Cross-Browser Compatibility**: Test across different browsers
8. **Mobile Device Testing**: Test file uploads on mobile devices

### Integration Opportunities
1. **Real AWS S3 Testing**: Optional tests against real S3 (with proper credentials)
2. **Cross-Browser Testing**: Verify functionality across different browsers
3. **Mobile Testing**: Test file uploads on mobile devices
4. **Accessibility Testing**: Ensure upload UI is accessible
5. **Load Testing**: Test system behavior under high load
6. **Disaster Recovery Testing**: Test recovery from various failure scenarios
