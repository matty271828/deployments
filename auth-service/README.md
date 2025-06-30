# Authentication Service

A centralized authentication microservice built with Cloudflare Workers and D1 databases. This service provides secure user authentication and session management for multiple domains, with each domain having its own isolated user and session data.

## Features

- 🔐 **Secure Authentication**: PBKDF2 password hashing with salt
- 🏠 **Domain Isolation**: Each domain gets its own user and session tables
- 🎫 **Session Management**: Secure session tokens following Lucia's recommendations
- 🔄 **Session Refresh**: Ability to refresh session tokens
- 🛡️ **Security**: Constant-time comparisons, secure random generation
- 🌐 **CORS Support**: Full cross-origin request support
- 📊 **Health Monitoring**: Built-in health check endpoint
- 👤 **User Profiles**: Full user information including first and last names
- 🔗 **Session-User Linking**: Sessions are linked to users for complete user context
- 🚫 **Rate Limiting**: Token bucket rate limiting to prevent brute force attacks
- 🛡️ **CSRF Protection**: CSRF tokens for form-based authentication
- 🔒 **Account Lockout**: Progressive account lockout after failed login attempts
- 📧 **Email Verification**: Email verification system with secure tokens
- 🔑 **Password Reset**: Secure password reset with time-limited tokens
- 📨 **Email Service**: Integrated email sending via Brevo
- 🔗 **OAuth SSO**: Dynamic Single Sign-On support for any OAuth 2.0 provider

## Architecture

The service uses a shared D1 database (`AUTH_DB`) with domain-prefixed tables for data isolation:

```
AUTH_DB
├── {domain}_users                    # User accounts per domain
├── {domain}_sessions                 # Session data per domain
├── {domain}_password_reset_tokens    # Password reset tokens per domain
├── {domain}_email_verification_tokens # Email verification tokens per domain
├── {domain}_csrf_tokens              # CSRF tokens per domain
└── {domain}_rate_limits              # Rate limiting data per domain
```

For example, for the domain `leetrepeat.com`:
- `leetrepeat_users` - User accounts
- `leetrepeat_sessions` - Session data
- `leetrepeat_password_reset_tokens` - Password reset tokens
- `leetrepeat_email_verification_tokens` - Email verification tokens
- `leetrepeat_csrf_tokens` - CSRF tokens
- `leetrepeat_rate_limits` - Rate limiting data

## API Endpoints

### Base URL
All endpoints are available at your domain with the `/auth` prefix:
```
https://yourdomain.com/auth/{endpoint}
```

### 1. Health Check

**Endpoint:** `GET /auth/health`

**Description:** Check service status and domain information

**Headers:** None required

**Example Request:**
```bash
curl https://leetrepeat.com/auth/health
```

**Example Response:**
```json
{
  "status": 200,
  "domain": "leetrepeat.com",
  "subdomain": "leetrepeat",
  "timestamp": "2025-06-19T08:01:35.746Z"
}
```

---

### 2. User Registration

**Endpoint:** `POST /auth/signup`

**Description:** Create a new user account and generate a session

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Example Request:**
```bash
curl -X POST https://leetrepeat.com/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"securepassword123","firstName":"John","lastName":"Doe"}'
```

**Example Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "id": "tncy8nc46v8grqwfvmifteyt",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "createdAt": "2025-06-19T08:01:35.746Z"
  },
  "session": {
    "id": "58rh2iarc64r2blbv7sq2a2i",
    "token": "58rh2iarc64r2blbv7sq2a2i.tdfi7ful8ftttqrg8wue6z2u",
    "expiresAt": "2025-06-20T08:01:35.865Z"
  }
}
```

**Validation Rules:**
- Email must be a valid email format
- Password must be at least 8 characters long
- First name and last name are required
- Email must be unique within the domain

---

### 3. User Login

**Endpoint:** `POST /auth/login`

**Description:** Authenticate user credentials and generate a session

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Example Request:**
```bash
curl -X POST https://leetrepeat.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"securepassword123"}'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "tncy8nc46v8grqwfvmifteyt",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "createdAt": "2025-06-19T08:01:35.000Z"
  },
  "session": {
    "id": "7345nu7zkblqhdrchgslcxys",
    "token": "7345nu7zkblqhdrchgslcxys.3m8ir84vyne8cafma8uipmxv",
    "expiresAt": "2025-06-20T08:02:08.651Z"
  }
}
```

---

### 4. Session Validation

**Endpoint:** `GET /auth/session`

**Description:** Validate a session token and return session information

**Headers:**
```
Authorization: Bearer {session_token}
```

**Example Request:**
```bash
curl -X GET https://leetrepeat.com/auth/session \
  -H "Authorization: Bearer 7345nu7zkblqhdrchgslcxys.3m8ir84vyne8cafma8uipmxv"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Session is valid",
  "user": {
    "id": "tncy8nc46v8grqwfvmifteyt",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "createdAt": "2025-06-19T08:01:35.000Z"
  },
  "session": {
    "id": "7345nu7zkblqhdrchgslcxys",
    "createdAt": "2025-06-19T08:02:08.000Z",
    "expiresAt": "2025-06-20T08:02:08.000Z"
  }
}
```

---

### 5. Session Refresh

**Endpoint:** `POST /auth/refresh`

**Description:** Generate a new session token while invalidating the old one

**Headers:**
```
Authorization: Bearer {session_token}
Content-Type: application/json
```

**Request Body:** None required

**Example Request:**
```bash
curl -X POST https://leetrepeat.com/auth/refresh \
  -H "Authorization: Bearer 7345nu7zkblqhdrchgslcxys.3m8ir84vyne8cafma8uipmxv" \
  -H "Content-Type: application/json"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Session refreshed successfully",
  "session": {
    "id": "new-session-id",
    "token": "new-session-id.new-secret",
    "expiresAt": "2025-06-20T08:XX:XX.XXXZ"
  }
}
```

---

### 6. User Logout

**Endpoint:** `POST /auth/logout`

**Description:** Invalidate a session token

**Headers:**
```
Authorization: Bearer {session_token}
Content-Type: application/json
```

**Request Body:** None required

**Example Request:**
```bash
curl -X POST https://leetrepeat.com/auth/logout \
  -H "Authorization: Bearer 7345nu7zkblqhdrchgslcxys.3m8ir84vyne8cafma8uipmxv" \
  -H "Content-Type: application/json"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### 7. CSRF Token Generation

**Endpoint:** `GET /auth/csrf-token`

**Description:** Generate a CSRF token for form protection

**Headers:** None required

**Example Request:**
```bash
curl -X GET https://leetrepeat.com/auth/csrf-token
```

**Example Response:**
```json
{
  "success": true,
  "message": "CSRF token generated successfully",
  "token": "5r5cfvhwhcdgp3h88sn8dhw4"
}
```

**Usage for Forms:**
```html
<!-- Get CSRF token first -->
<script>
fetch('/auth/csrf-token')
  .then(response => response.json())
  .then(data => {
    document.getElementById('csrf-token').value = data.token;
  });
</script>

<!-- Include in form -->
<form action="/auth/login" method="POST">
  <input type="hidden" name="csrfToken" id="csrf-token">
  <input name="email" type="email" required>
  <input name="password" type="password" required>
  <button type="submit">Login</button>
</form>
```

---

### 8. Debug Database

**Endpoint:** `GET /auth/debug`

**Description:** Debug endpoint to inspect database state and session creation (development only)

**Headers:** None required

**Example Request:**
```bash
curl -X GET https://leetrepeat.com/auth/debug
```

**Example Response:**
```json
{
  "success": true,
  "message": "Debug information",
  "data": {
    "tables": ["users", "sessions", "csrf_tokens"],
    "userCount": 5,
    "sessionCount": 3,
    "timestamp": "2025-06-19T08:01:35.746Z"
  }
}
```

**Note:** This endpoint is intended for development and debugging purposes only.

---

### 9. Password Reset Request

**Endpoint:** `POST /auth/password-reset`

**Description:** Request a password reset for an account. Sends a reset link via email.

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "csrfToken": "optional-csrf-token"
}
```

**Example Request:**
```bash
curl -X POST https://leetrepeat.com/auth/password-reset \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

**Example Response:**
```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

**Security Notes:**
- Always returns success to prevent email enumeration attacks
- Reset tokens expire after 15 minutes
- Rate limited to prevent abuse
- CSRF protection available for form submissions

---

### 10. Password Reset Confirmation

**Endpoint:** `POST /auth/password-reset/confirm`

**Description:** Complete password reset using a valid reset token

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "SecureNewPass123!",
  "csrfToken": "optional-csrf-token"
}
```

**Example Request:**
```bash
curl -X POST https://leetrepeat.com/auth/password-reset/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123def456",
    "newPassword": "SecureNewPass123!"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Password has been successfully reset. You can now log in with your new password.",
  "user": {
    "id": "tncy8nc46v8grqwfvmifteyt",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "createdAt": "2025-06-19T08:01:35.000Z"
  }
}
```

**Validation Rules:**
- Token must be valid and not expired
- Token can only be used once
- New password must meet all password requirements
- Account is automatically unlocked after successful reset

---

### 11. Email Verification

**Endpoint:** `POST /auth/verify-email`

**Description:** Verify a user's email address using a verification token

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "token": "verification-token-from-email",
  "csrfToken": "optional-csrf-token"
}
```

**Example Request:**
```bash
curl -X POST https://leetrepeat.com/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "abc123def456"}'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Email verification successful",
  "user": {
    "id": "tncy8nc46v8grqwfvmifteyt",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": true
  }
}
```

**Validation Rules:**
- Token must be valid and not expired
- Token can only be used once
- User's email will be marked as verified

---

### 12. Resend Verification Email

**Endpoint:** `POST /auth/resend-verification`

**Description:** Resend email verification link to a user

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "csrfToken": "optional-csrf-token"
}
```

**Example Request:**
```bash
curl -X POST https://leetrepeat.com/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Verification email sent successfully"
}
```

**Notes:**
- Only works for unverified users
- Creates a new verification token
- Sends the same signup confirmation email with new verification link

---

### 13. GraphQL Proxy

**Endpoint:** `POST /auth/graphql` and `GET /auth/graphql`

**Description:** Proxy GraphQL requests to domain-specific workers

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {session_token} (optional)
```

**Request Body:** GraphQL query/mutation

**Example Request:**
```bash
curl -X POST https://leetrepeat.com/auth/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "query { users { id name } }"}'
```

**Example Response:**
```json
{
  "data": {
    "users": [
      {"id": "1", "name": "John Doe"}
    ]
  }
}
```

**Note:** This endpoint forwards GraphQL requests to domain-specific workers for processing.

---

## Testing Email Verification

### Complete Email Verification Flow

```bash
# 1. Sign up a new user (verification email sent automatically)
curl -X POST https://leetrepeat.com/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'

# 2. Check email for verification link (token will be in URL)
# Verification link format: https://yourdomain.com/verify-email?token=TOKEN_HERE

# 3. Verify email with token
curl -X POST https://leetrepeat.com/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "TOKEN_FROM_EMAIL"}'

# 4. Resend verification if needed
curl -X POST https://leetrepeat.com/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

### Email Verification Security Features

- **Time-limited tokens**: Verification tokens expire after 24 hours
- **Single-use tokens**: Each token can only be used once
- **Rate limiting**: Prevents abuse of verification requests
- **Automatic cleanup**: Expired tokens are automatically removed
- **User status tracking**: Email verification status is stored in user record

---

## Testing CSRF Protection

### Complete Test Sequence

```bash
# 1. Get CSRF token
curl -X GET https://leetrepeat.com/auth/csrf-token

# 2. Sign up with CSRF token (use strong password)
curl -X POST https://leetrepeat.com/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "csrfToken": "YOUR_TOKEN_HERE"
  }'

# 3. Get another CSRF token for login
curl -X GET https://leetrepeat.com/auth/csrf-token

# 4. Login with CSRF token
curl -X POST https://leetrepeat.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "csrfToken": "YOUR_TOKEN_HERE"
  }'

# 5. Test duplicate token usage (should fail)
curl -X POST https://leetrepeat.com/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test2@example.com",
    "password": "SecurePass123!",
    "firstName": "Jane",
    "lastName": "Smith",
    "csrfToken": "SAME_TOKEN_AS_STEP_2"
  }'
```

### Password Requirements

Passwords must meet the following requirements:
- **Length**: At least 12 characters
- **Uppercase**: At least one letter A-Z
- **Lowercase**: At least one letter a-z  
- **Numbers**: At least one digit 0-9
- **Special characters**: At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
- **No common passwords**: Cannot be a common password
- **No sequential patterns**: Cannot contain sequential patterns like "123456"
- **No repeated characters**: Cannot have more than 2 consecutive identical characters

**Examples of valid passwords:**
- `SecurePass123!` ✅
- `MyPassword456@` ✅
- `TestUser789#` ✅
- `StrongPass2024$` ✅

---

## Error Responses

All endpoints return consistent error responses with the following format:

```json
{
  "success": false,
  "error": "Error description",
  "status": 400
}
```

### Common Error Codes

| Status | Error Message | Description |
|--------|---------------|-------------|
| 400 | `Email, password, firstName, and lastName are required` | Missing required fields |
| 400 | `All fields must be strings` | Invalid field types |
| 400 | `Invalid email format` | Email validation failed |
| 400 | `Password must be at least 12 characters long` | Password too weak |
| 400 | `Invalid JSON in request body` | Malformed JSON |
| 400 | `Invalid session token format` | Token format incorrect |
| 401 | `Authorization header with Bearer token is required` | Missing auth header |
| 401 | `Invalid email or password` | Login credentials incorrect |
| 401 | `Invalid email or password. X attempts remaining before lockout.` | Login failed with attempt count |
| 401 | `Invalid or expired session` | Session token invalid |
| 403 | `Invalid CSRF token` | CSRF token validation failed |
| 404 | `Endpoint not found` | Invalid endpoint |
| 404 | `User not found` | User associated with session not found |
| 405 | `Method not allowed` | Wrong HTTP method |
| 409 | `User already exists` | Email already registered |
| 423 | `Account temporarily locked. Please try again in X minutes.` | Account locked due to failed attempts |
| 423 | `Account locked due to too many failed attempts. Please try again in X minutes.` | Account locked after failed attempt |
| 429 | `Too many login attempts. Please try again later.` | Rate limited - too many login attempts |
| 429 | `Too many signup attempts. Please try again later.` | Rate limited - too many signup attempts |
| 429 | `Too many session requests. Please try again later.` | Rate limited - too many session operations |
| 429 | `Too many CSRF token requests. Please try again later.` | Rate limited - too many CSRF token requests |
| 429 | `Too many requests. Please try again later.` | Rate limited - too many general API requests |
| 500 | `Database not available` | Database connection issue |
| 503 | `Database schema not initialized` | Tables don't exist |

---

## Session Token Format

Session tokens follow the format: `{session_id}.{session_secret}`

Example: `58rh2iarc64r2blbv7sq2a2i.tdfi7ful8ftttqrg8wue6z2u`

- **Session ID**: 24-character secure random string
- **Session Secret**: 24-character secure random string
- **Separator**: Dot (.)

## Security Features

### Password Security
- **Hashing**: PBKDF2 with 100,000 iterations
- **Salt**: 16-byte random salt per user
- **Algorithm**: SHA-256
- **Requirements**: 12+ characters, uppercase, lowercase, numbers, special characters
- **Validation**: Blocks common passwords and sequential patterns

### Session Security
- **Token Format**: `{session_id}.{session_secret}`
- **Secret Storage**: Hashed secrets in database
- **Expiration**: 24 hours from creation
- **Validation**: Constant-time comparison
- **Revocation**: Immediate session termination

### Account Lockout Protection
- **Progressive Lockout**: Increasing lockout durations
- **Lockout Levels**:
  - 3 failed attempts → 5-minute lockout
  - 5 failed attempts → 15-minute lockout
  - 7 failed attempts → 1-hour lockout
  - 10 failed attempts → 24-hour lockout
- **Automatic Reset**: Successful login clears lockout status
- **User Feedback**: Clear messages about remaining attempts and lockout duration

### Data Isolation
- **Domain Prefixing**: All tables prefixed with domain name
- **Cross-Domain Protection**: Users/sessions isolated per domain
- **Secure IDs**: Cryptographically secure random generation

### Error Handling
- **Generic Errors**: Internal errors are not exposed to clients
- **Input Validation**: Comprehensive validation of all inputs
- **SQL Injection Protection**: Parameterized queries throughout

### CORS Security
- **Origin Validation**: Only allows requests from registered domains
- **Dynamic Allowlist**: Automatically updates as domains are added/removed
- **Fail Secure**: Blocks unauthorized origins by default
- **Security Headers**: Comprehensive security headers on all responses

### Rate Limiting
- **Token Bucket Algorithm**: Smooth handling of request bursts
- **Login Protection**: 5 attempts per 15 minutes per IP
- **Signup Protection**: 3 attempts per hour per IP
- **Session Operations**: 30 requests per minute per IP (validation, refresh, logout)
- **General API**: 100 requests per minute per IP (health)
- **Persistent Storage**: Uses D1 database for cross-request persistence
- **Automated Cleanup**: Background cleanup runs every 12 hours across all domains

### CSRF Protection
- **Token Generation**: Secure random tokens for form protection
- **One-Time Use**: Tokens are consumed after validation
- **Expiration**: Tokens expire after 15 minutes
- **Form Integration**: Easy integration with HTML forms
- **Automatic Cleanup**: Expired tokens are automatically removed

### Testing Account Lockout

```bash
# 1. Create a test user first
curl -X POST https://leetrepeat.com/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lockout-test@example.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User"
  }'

# 2. Test progressive lockout (run these in sequence)
# Attempt 1-3: Normal error messages
curl -X POST https://leetrepeat.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lockout-test@example.com",
    "password": "wrongpassword"
  }'

# Response: "Invalid email or password. 2 attempts remaining before lockout."

# Attempt 4: 5-minute lockout
curl -X POST https://leetrepeat.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lockout-test@example.com",
    "password": "wrongpassword"
  }'

# Response: "Account locked due to too many failed attempts. Please try again in 5 minutes."

# 3. Try correct password during lockout (should fail)
curl -X POST https://leetrepeat.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lockout-test@example.com",
    "password": "SecurePass123!"
  }'

# Response: "Account temporarily locked. Please try again in X minutes."

# 4. After lockout expires, successful login resets everything
curl -X POST https://leetrepeat.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lockout-test@example.com",
    "password": "SecurePass123!"
  }'

# Response: "Login successful" (and failed attempts reset to 0)
```

---

## CORS Support

### Database Schema

The service uses a schema template that gets processed during deployment. See [schema.sql](./schema.sql) for the template structure.

The schema automatically creates domain-prefixed tables:

```sql
-- Users table
CREATE TABLE {PREFIX}_users (
    id TEXT NOT NULL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER -- unix time (seconds) when account unlocks
);

-- Sessions table
CREATE TABLE {PREFIX}_sessions (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL,
    secret_hash BLOB NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES {PREFIX}_users(id) ON DELETE CASCADE
);

-- CSRF tokens table
CREATE TABLE {PREFIX}_csrf_tokens (
    token TEXT NOT NULL PRIMARY KEY,
    created_at INTEGER NOT NULL
);

-- Rate limiting table
CREATE TABLE {PREFIX}_rate_limits (
    key TEXT NOT NULL PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    refilled_at_ms INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);
```

Where `{PREFIX}` is replaced with the domain name (e.g., `leetrepeat`).

---

## Email Service

The authentication service includes email functionality powered by **Brevo** (formerly Sendinblue):

### Features
- 📧 **Transactional Emails**: Signup confirmations, password resets, email verification
- 🎨 **Professional Templates**: HTML and text versions with domain branding
- 🔧 **Secure Integration**: Email sending only through internal service calls

### Email Types

#### 1. Signup Confirmation
Automatically sent when a user registers:
- Welcome message with domain branding
- Email verification link with token
- Professional HTML and text versions

#### 2. Password Reset
Sent when password reset is requested:
- Secure reset link with token
- 15-minute expiration for security
- Clear instructions and security warnings

#### 3. Email Verification
Sent when email verification is requested:
- Verification link with token
- Professional branding and instructions
- Secure token-based verification

### Configuration

To use the email service, set the following environment variable:

```bash
BREVO_API_KEY=your_brevo_api_key_here
```

To get your Brevo API key:
1. Go to https://app.brevo.com/
2. Sign in to your Brevo account
3. Navigate to Settings → API Keys
4. Click 'Create a new API key'
5. Give it a name (e.g., 'Auth Service')
6. Select 'Full Access' or 'Restricted Access' with these permissions:
   - Transactional emails: Read & Write
7. Copy the generated API key

**Security Note:** Email functionality is only available internally through the authentication service. There are no public email endpoints to prevent abuse and spam.

---

## Gmail "Send Mail As" Setup

Since support emails are forwarded to your Gmail inbox, you can configure Gmail to reply as if you're sending from the support email address.

### Prerequisites
- Support email forwarding is already configured (e.g., `support@yourdomain.com` → your Gmail)
- Brevo domain authentication is set up for your domain

### Setup Instructions

1. **Create OAuth Applications** with Google and/or GitHub
2. **Add Repository Secrets** using the naming convention above
3. **Deploy** - OAuth providers are automatically configured
4. **Test** OAuth flows using the provided endpoints

See `OAUTH_SETUP.md` for detailed setup instructions.

---

## Stripe Integration

The auth-service includes comprehensive Stripe integration for subscription management.

### Environment Variables

Add these to your `wrangler.toml`:

```toml
[vars]
STRIPE_SECRET_KEY = "sk_test_..." # Your Stripe secret key
STRIPE_WEBHOOK_SECRET = "whsec_..." # Your webhook endpoint secret
```

### Webhook Setup

**✅ Automated Setup:** Webhooks are automatically configured during deployment via GitHub Actions.

The deployment process will:
1. Create a webhook endpoint for your auth service
2. Configure all required events automatically
3. Set the webhook secret as an environment variable
4. Test the webhook configuration

**Required Events (automatically configured):**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

**Manual Setup (if needed):**
If you need to set up webhooks manually:

1. **Create Webhook Endpoint in Stripe Dashboard:**
   - Go to Stripe Dashboard → Developers → Webhooks
   - Click "Add endpoint"
   - Endpoint URL: `https://your-auth-service.your-domain.com/auth/webhook`
   - Select the events listed above

2. **Get Webhook Secret:**
   - After creating the webhook, click on it to view details
   - Click "Reveal" next to "Signing secret"
   - Copy the `whsec_...` value
   - Add it to your `wrangler.toml` as `STRIPE_WEBHOOK_SECRET`

3. **Test Webhook:**
   - In the webhook details, click "Send test webhook"
   - Select `checkout.session.completed` event
   - Verify it returns a 200 status

### Subscription Flow

1. **User initiates checkout:**
   ```javascript
   POST /auth/create-checkout-session
   {
     "priceId": "price_...",
     "successUrl": "https://your-domain.com/success",
     "cancelUrl": "https://your-domain.com/cancel"
   }
   ```

2. **User completes payment on Stripe Checkout**

3. **Webhook processes the completion:**
   - `checkout.session.completed` creates/updates subscription
   - `invoice.payment_succeeded` confirms payment status
   - `invoice.payment_failed` marks as past_due

4. **User can manage subscription:**
   ```javascript
   POST /auth/create-portal-session
   {
     "returnUrl": "https://your-domain.com/account"
   }
   ```

### Subscription Statuses

- `free` - No active subscription
- `standard member` - Active paid subscription
- `canceled` - Subscription cancelled
- `past_due` - Payment failed, retrying

### Security Features

- **Webhook signature verification** prevents spoofing
- **Idempotency** prevents duplicate processing
- **Rate limiting** on webhook endpoint
- **CSRF protection** on checkout/portal creation

### Troubleshooting

**Webhook not receiving events:**
- Verify endpoint URL is correct
- Check webhook secret matches environment variable
- Ensure endpoint is publicly accessible

**Subscription status not updating:**
- Check webhook logs in Stripe Dashboard
- Verify webhook events are being sent
- Check auth-service logs for processing errors

**Payment succeeds but user still shows as free:**
- Verify webhook endpoint is configured
- Check webhook secret is correct
- Look for webhook processing errors in logs

---

## OAuth SSO Integration

The auth-service includes comprehensive OAuth 2.0/OpenID Connect support for Single Sign-On (SSO) with **dynamic provider discovery**. The system can work with any OAuth provider without requiring code changes.

### Dynamic Provider Discovery

The system automatically discovers and configures OAuth providers by scanning environment variables with a specific naming convention:

```
{PROJECT}_{PROVIDER}_OAUTH_CLIENT_ID
{PROJECT}_{PROVIDER}_OAUTH_CLIENT_SECRET
```

**Examples:**
- `LEETREPEAT_GOOGLE_OAUTH_CLIENT_ID`
- `LEETREPEAT_GITHUB_OAUTH_CLIENT_SECRET`
- `MYAPP_DISCORD_OAUTH_CLIENT_ID`
- `MYAPP_SLACK_OAUTH_CLIENT_SECRET`

### Supported Providers

The system can work with **any OAuth provider** that follows OAuth 2.0 standards. Common providers include:

- **Google** - Google OAuth 2.0
- **GitHub** - GitHub OAuth App
- **Microsoft** - Microsoft Identity Platform
- **Facebook** - Facebook Login
- **LinkedIn** - LinkedIn OAuth 2.0
- **Twitter/X** - Twitter OAuth 2.0
- **Discord** - Discord OAuth 2.0
- **Slack** - Slack OAuth
- **GitLab** - GitLab OAuth
- **Bitbucket** - Bitbucket OAuth
- **Custom** - Any OAuth 2.0 compliant provider

### Optional Configuration

You can also set optional environment variables for each provider:

```
{PROJECT}_{PROVIDER}_OAUTH_SCOPES     # Custom scopes (optional)
{PROJECT}_{PROVIDER}_OAUTH_ENABLED    # Set to "false" to disable (optional)
```

**Examples:**
- `LEETREPEAT_GOOGLE_OAUTH_SCOPES=openid email profile https://www.googleapis.com/auth/calendar`
- `LEETREPEAT_GITHUB_OAUTH_ENABLED=false`

### Configuration

OAuth providers are automatically configured during deployment. The system will:

1. **Scan all environment variables** for OAuth-related secrets
2. **Discover available providers** based on the naming convention
3. **Validate the configuration** for each provider
4. **Configure the database** with the OAuth provider settings
5. **Enable the OAuth endpoints** for discovered providers

Providers with missing credentials are gracefully skipped during deployment.

### Database Schema

The OAuth system uses these domain-specific tables:

```sql
-- OAuth provider configurations
CREATE TABLE {domain}_oauth_providers (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    scopes TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- OAuth account linking
CREATE TABLE {domain}_oauth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    provider_user_email TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES {domain}_users(id) ON DELETE CASCADE,
    UNIQUE(provider, provider_user_id)
);

-- OAuth state tokens for flow security
CREATE TABLE {domain}_oauth_state_tokens (
    token TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);
```

### API Endpoints

Once configured, OAuth providers are available via these endpoints:

- `GET /auth/oauth/authorize?provider={provider}` - Start OAuth flow
- `GET /auth/oauth/{provider}/callback` - Handle OAuth callback  
- `POST /auth/oauth/link` - Link OAuth account to existing user
- `POST /auth/oauth/unlink` - Unlink OAuth account
- `GET /auth/oauth/accounts` - Get user's linked OAuth accounts
- `GET /auth/oauth/providers` - List configured OAuth providers

### Example Usage

```bash
# Start Google OAuth flow
curl "https://yourdomain.com/auth/oauth/authorize?provider=google"

# Start GitHub OAuth flow
curl "https://yourdomain.com/auth/oauth/authorize?provider=github"

# List configured providers
curl "https://yourdomain.com/auth/oauth/providers"
```

### Error Handling

**Common OAuth Errors:**
- `OAuth provider not configured` - Provider not set up for this domain
- `Invalid or expired OAuth state token` - Security validation failed
- `OAuth authentication failed` - Provider returned an error
- `User already exists` - Email already registered with different method

**Rate Limiting:**
- OAuth endpoints are rate limited to prevent abuse
- Too many requests return 429 status

### Security Features

- **State Token Validation** - Prevents CSRF attacks on OAuth flows
- **One-time Use State Tokens** - State tokens are deleted after use
- **Rate Limiting** - All OAuth endpoints are rate limited
- **CSRF Protection** - Optional CSRF tokens for linking/unlinking
- **Secure Token Storage** - OAuth tokens are stored securely
- **Domain Isolation** - Each domain has separate OAuth configurations
- **Dynamic Discovery** - Only providers with valid credentials are enabled
