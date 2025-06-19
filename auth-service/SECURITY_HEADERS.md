# Security Headers Implementation

This document describes the comprehensive security headers implementation in the authentication service to protect against various types of attacks.

## Overview

The auth service now includes a complete set of security headers that are applied to all HTTP responses. These headers help protect against:

- Cross-Site Scripting (XSS) attacks
- Clickjacking attacks
- MIME type sniffing attacks
- Cross-site request forgery (CSRF)
- Information disclosure
- Unauthorized access to browser features

## Security Headers Implemented

### 1. X-Content-Type-Options: nosniff
**Purpose**: Prevents browsers from MIME-sniffing a response away from the declared Content-Type.
**Value**: `nosniff`
**Protection**: Prevents MIME type confusion attacks where malicious content is served with an incorrect MIME type.

### 2. X-Frame-Options: DENY
**Purpose**: Prevents the page from being displayed in a frame, iframe, embed, or object.
**Value**: `DENY`
**Protection**: Protects against clickjacking attacks by preventing the page from being embedded in other sites.

### 3. X-XSS-Protection: 1; mode=block
**Purpose**: Enables the browser's built-in XSS filter.
**Value**: `1; mode=block`
**Protection**: Provides additional protection against reflected XSS attacks (though modern browsers rely more on CSP).

### 4. Strict-Transport-Security: max-age=31536000; includeSubDomains
**Purpose**: Tells browsers to only access the site using HTTPS.
**Value**: `max-age=31536000; includeSubDomains`
**Protection**: Ensures all communication is encrypted and applies to all subdomains.

### 5. Referrer-Policy: strict-origin-when-cross-origin
**Purpose**: Controls how much referrer information is included with requests.
**Value**: `strict-origin-when-cross-origin`
**Protection**: Limits information disclosure while maintaining functionality for same-origin requests.

### 6. Content-Security-Policy
**Purpose**: Defines which resources can be loaded and executed.
**Value**: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';`
**Protection**: 
- Prevents XSS attacks by controlling script execution
- Prevents clickjacking with `frame-ancestors 'none'`
- Restricts resource loading to trusted sources

### 7. Permissions-Policy
**Purpose**: Controls which browser features and APIs can be used.
**Value**: `camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()`
**Protection**: Disables potentially sensitive browser features to prevent unauthorized access.

### 8. Cross-Origin-Embedder-Policy: require-corp
**Purpose**: Ensures that all resources are either same-origin or explicitly marked as loadable from another origin.
**Value**: `require-corp`
**Protection**: Provides additional isolation between origins.

### 9. Cross-Origin-Opener-Policy: same-origin
**Purpose**: Ensures that the browsing context is isolated from other origins.
**Value**: `same-origin`
**Protection**: Prevents cross-origin window access and provides additional security isolation.

### 10. Cross-Origin-Resource-Policy: same-origin
**Purpose**: Prevents the browser from loading the resource in a cross-origin context.
**Value**: `same-origin`
**Protection**: Ensures resources are only accessible from the same origin.

## Implementation Details

### Centralized Security Headers Function

The security headers are implemented through a centralized function in `src/cors.ts`:

```typescript
function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
  };
}
```

### Application to All Responses

Security headers are applied to all responses through the `getSecureCorsHeaders` function, which:

1. Generates the base security headers
2. Adds CORS-specific headers for allowed origins
3. Returns the complete header set for all responses

### Error Responses

Even error responses (like 403 Forbidden) include the full set of security headers to ensure comprehensive protection.

## Testing Security Headers

### Manual Testing

You can test the headers using curl:

```bash
curl -I http://localhost:3000/auth/health
```

### Browser Developer Tools

1. Open your browser's developer tools (F12)
2. Go to the Network tab
3. Make a request to your auth service
4. Click on the request to see the response headers
5. Verify that all security headers are present

### Expected Headers

The response should include all of these security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

## Security Considerations

### Content Security Policy (CSP)

The CSP policy is configured for a typical web application. You may need to adjust it based on your specific needs:

- **script-src**: Currently allows 'unsafe-inline' for inline scripts
- **style-src**: Currently allows 'unsafe-inline' for inline styles
- **img-src**: Allows HTTPS images and data URIs
- **frame-ancestors**: Set to 'none' to prevent embedding

### Permissions Policy

The permissions policy disables several browser features. If your application needs any of these features, you'll need to modify the policy accordingly.

### Cross-Origin Policies

The cross-origin policies are set to maximum security. If you need cross-origin functionality, you may need to adjust these settings.

## Browser Compatibility

These security headers are supported by all modern browsers:

- Chrome 4+
- Firefox 4+
- Safari 4+
- Edge 12+

Older browsers may ignore some headers, but this doesn't affect security as the headers are additive.

## Monitoring and Maintenance

### Regular Testing

- Run the security headers test after any changes
- Use browser developer tools to verify headers in production
- Monitor for any CSP violations in production

### Updates

- Keep security headers up to date with best practices
- Monitor for new security header standards
- Update CSP policies as application requirements change

## References

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [MDN Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers#security)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy) 