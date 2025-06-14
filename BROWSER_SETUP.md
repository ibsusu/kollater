# Browser Certificate Setup

To access the Kollator client at `https://kollator.local:5173`, the certificates are automatically trusted since they were generated with mkcert.

## Automatic Trust (Recommended)

Since we used `mkcert` to generate the certificates, they should be automatically trusted by your browser! Just navigate to:

- **Client App**: https://kollator.local:5173
- **Signaling Server**: https://kollator.local:8000

You should see a secure connection (green lock icon) without any warnings.

## If You Still See Certificate Warnings

If you still see certificate warnings, you may need to restart your browser or run:

```bash
mkcert -install
```

## Manual Certificate Trust (If Needed)

If automatic trust doesn't work, you can manually trust the certificate:

### Chrome/Chromium

1. Navigate to `https://kollator.local:5173`
2. Click "Advanced" on the security warning
3. Click "Proceed to kollator.local (unsafe)"

**OR** for permanent trust:

1. Go to `chrome://settings/certificates`
2. Click "Authorities" tab
3. Click "Import"
4. Select `certs/kollator.local+4.pem`
5. Check "Trust this certificate for identifying websites"
6. Click "OK"

### Firefox

1. Navigate to `https://kollator.local:5173`
2. Click "Advanced"
3. Click "Accept the Risk and Continue"

**OR** for permanent trust:

1. Go to `about:preferences#privacy`
2. Scroll to "Certificates" section
3. Click "View Certificates"
4. Click "Authorities" tab
5. Click "Import"
6. Select `certs/kollator.local+4.pem`
7. Check "Trust this CA to identify websites"
8. Click "OK"

### Safari

1. Open Keychain Access
2. Drag `certs/kollator.local+4.pem` into the "System" keychain
3. Double-click the certificate
4. Expand "Trust" section
5. Set "When using this certificate" to "Always Trust"
6. Close and enter your password when prompted

### Edge

Same as Chrome/Chromium instructions above.

## After Setup

Once the certificate is trusted, you can access:
- **Client App**: https://kollator.local:5173
- **Signaling Server**: https://kollator.local:8000

Both will show a secure connection (green lock icon) in your browser.
