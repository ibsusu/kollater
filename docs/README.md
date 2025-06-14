# Kollator Documentation & Build Output

This directory contains the built client application and documentation for Kollator's peer-to-peer file sharing system. It serves as both the production build output and the deployment directory for GitHub Pages hosting.

## Directory Purpose

The `docs/` directory serves multiple functions in the Kollator project:

1. **Production Build**: Contains the compiled and optimized client application
2. **GitHub Pages Hosting**: Serves as the deployment source for kollator.com
3. **Static Assets**: Houses all client-side resources including textures, audio, and JavaScript
4. **Documentation Site**: Provides user-facing documentation and demos

## Contents Overview

### Core Application Files

- `index.html` - Main application entry point with optimized loading
- `vite.svg` - Vite build tool favicon and branding
- `assets/` - Compiled and minified JavaScript, CSS, and other assets

### Static Resources

- `audio/` - Audio files for the application
  - `a_corp.mp3/ogg` - Corporate audio track
  - `behold.mp3` - Demo audio file
- `js/` - JavaScript utilities and processors
  - `enable-threads.js` - Web worker thread enablement
  - `noiseProcessor.js` - Audio processing utilities
  - `sodium.js` - Cryptographic library
- `textures/` - 3D textures and visual assets
  - `cube/SwedishRoyalCastle/` - Skybox textures for 3D environment

### Build Artifacts

The `assets/` directory contains Vite-generated build artifacts:

- **JavaScript Bundles**: 
  - `index-*.js` - Main application bundle
  - `glitzWorker-*.js` - WebGL/3D worker thread
  - `worker-*.js` - File processing worker
- **CSS Bundles**:
  - `index-*.css` - Compiled Tailwind CSS styles
- **Source Maps**: Development debugging information (in development builds)

## Build Process

### Development Build

The docs directory is populated during the development build process:

```bash
# From client/ directory
npm run build
# or
bun run build
```

This process:
1. Compiles TypeScript to JavaScript
2. Bundles and minifies all assets
3. Optimizes images and other static resources
4. Generates production-ready HTML with asset hashing
5. Outputs everything to `docs/` for deployment

### Asset Optimization

Vite performs several optimizations during the build:

- **Code Splitting**: Separates application code from vendor libraries
- **Tree Shaking**: Removes unused code from bundles
- **Minification**: Compresses JavaScript and CSS
- **Asset Hashing**: Adds content hashes to filenames for cache busting
- **Compression**: Optimizes images and other static assets

## Deployment

### GitHub Pages

The docs directory is configured for GitHub Pages deployment:

1. **Repository Settings**: GitHub Pages source set to `/docs` folder
2. **Custom Domain**: Configured for kollator.com
3. **HTTPS**: Automatic SSL certificate via GitHub
4. **CDN**: Global content delivery via GitHub's infrastructure

### Manual Deployment

For other hosting providers:

```bash
# Copy docs/ contents to web server
rsync -av docs/ user@server:/var/www/kollator/

# Or use any static site hosting service
# Upload docs/ directory contents to hosting provider
```

## File Structure

```
docs/
├── index.html              # Main application entry point
├── vite.svg               # Build tool favicon
├── assets/                # Compiled application bundles
│   ├── index-*.js         # Main application JavaScript
│   ├── index-*.css        # Compiled styles
│   ├── glitzWorker-*.js   # 3D rendering worker
│   └── worker-*.js        # File processing worker
├── audio/                 # Audio assets
│   ├── a_corp.mp3
│   ├── a_corp.ogg
│   └── behold.mp3
├── js/                    # JavaScript utilities
│   ├── enable-threads.js
│   ├── noiseProcessor.js
│   └── sodium.js
└── textures/              # 3D textures and visual assets
    └── cube/
        └── SwedishRoyalCastle/
            ├── nx.jpg     # Negative X skybox face
            ├── ny.jpg     # Negative Y skybox face
            ├── nz.jpg     # Negative Z skybox face
            ├── px.jpg     # Positive X skybox face
            ├── py.jpg     # Positive Y skybox face
            ├── pz.jpg     # Positive Z skybox face
            └── readme.txt # Texture attribution
```

## Performance Considerations

### Loading Optimization

The built application implements several performance optimizations:

- **Lazy Loading**: Code splitting for on-demand module loading
- **Service Worker**: Caching strategy for offline functionality (if implemented)
- **Resource Hints**: Preload critical resources for faster initial load
- **Compression**: Gzip/Brotli compression for reduced transfer sizes

### Browser Compatibility

The built application targets modern browsers with:

- **ES2020**: Modern JavaScript features with appropriate polyfills
- **WebRTC**: Native WebRTC support required
- **WebAssembly**: WASM support for cryptographic operations
- **Web Workers**: Multi-threading support for file processing

## Content Security Policy

The application implements CSP headers for security:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval';
  worker-src 'self' blob:;
  connect-src 'self' wss: https:;
  media-src 'self' blob:;
">
```

## Monitoring and Analytics

### Performance Monitoring

The application includes built-in performance monitoring:

- **Core Web Vitals**: LCP, FID, CLS measurements
- **Resource Loading**: Asset load times and sizes
- **WebRTC Performance**: Connection establishment and transfer speeds
- **Error Tracking**: JavaScript errors and WebRTC failures

### Usage Analytics

Privacy-respecting analytics track:

- **Page Views**: Basic usage statistics
- **Feature Usage**: File upload/download patterns
- **Performance Metrics**: Real user monitoring data
- **Error Rates**: Application stability metrics

## Maintenance

### Regular Updates

The docs directory should be updated when:

1. **Client Code Changes**: Any modifications to the client application
2. **Dependency Updates**: Library updates that affect the build
3. **Asset Changes**: New or modified static resources
4. **Configuration Changes**: Build tool or deployment configuration updates

### Cache Management

When deploying updates:

1. **Asset Hashing**: Vite automatically handles cache busting via filename hashes
2. **HTML Updates**: Update index.html to reference new asset hashes
3. **CDN Purging**: Clear CDN caches if using external CDN
4. **Browser Cache**: Users automatically receive updates due to hash changes

## Troubleshooting

### Common Build Issues

1. **Missing Assets**: Ensure all referenced files exist in client/public/
2. **Build Failures**: Check TypeScript compilation errors
3. **Large Bundle Sizes**: Analyze bundle composition and optimize imports
4. **Missing Dependencies**: Verify all required packages are installed

### Deployment Issues

1. **404 Errors**: Check file paths and case sensitivity
2. **CORS Issues**: Verify server configuration for cross-origin requests
3. **HTTPS Requirements**: Ensure HTTPS for WebRTC and OPFS functionality
4. **Cache Problems**: Clear browser and CDN caches after updates

## Related Components

- **Client Application**: Source code in `client/` directory
- **Build System**: Vite configuration and build scripts
- **GitHub Pages**: Hosting and deployment infrastructure
- **CDN**: Content delivery and global distribution
