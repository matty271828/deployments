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

## Architecture

The service uses a shared D1 database (`AUTH_DB`) with domain-prefixed tables for data isolation:

```
AUTH_DB
├── {domain}_users     # User accounts per domain
└── {domain}_sessions  # Session data per domain
```

For example, for the domain `leetrepeat.com`:
- `leetrepeat_users` - User accounts
- `leetrepeat_sessions` - Session data

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
- **Expiration**: Tokens expire after 1 hour
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

### 8. Email Sending

**Endpoint:** `POST /auth/email/send`

**Description:** Send a notification email using Brevo (formerly Sendinblue)

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "recipient@example.com",
  "subject": "Email Subject",
  "message": "Email message content"
}
```

**Example Request:**
```bash
curl -X POST https://leetrepeat.com/auth/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "subject": "Welcome to our service!",
    "message": "Thank you for signing up with our platform."
  }'
```

**Example Response:**
```json
{
  "success": true,
  "message": "Email sent successfully"
}
```

**Rate Limiting:** 5 requests per minute per IP address

---

## Email Service

The authentication service includes email functionality powered by **Brevo** (formerly Sendinblue):

### Features
- 📧 **Transactional Emails**: Signup confirmations, password resets, notifications
- 🎨 **Professional Templates**: HTML and text versions with domain branding
- 🔧 **Easy Integration**: Simple API for sending custom emails

### Email Types

#### 1. Signup Confirmation
Automatically sent when a user registers:
- Welcome message with domain branding
- Account details confirmation
- Professional HTML and text versions

#### 2. Password Reset
Sent when password reset is requested:
- Secure reset link with token
- 1-hour expiration
- Clear instructions and security warnings

#### 3. Generic Notifications
Custom emails for any purpose:
- Flexible subject and message content
- HTML formatting support
- Domain-specific branding

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

---

## Gmail "Send Mail As" Setup

Since support emails are forwarded to your Gmail inbox, you can configure Gmail to reply as if you're sending from the support email address.

### Prerequisites
- Support email forwarding is already configured (e.g., `support@yourdomain.com` → your Gmail)
- Brevo domain authentication is set up for your domain

### Setup Instructions

#### 1. Get Brevo SMTP Credentials
1. Log into your Brevo account at https://app.brevo.com/
2. Navigate to **Settings → SMTP & API** (or look for SMTP settings)
3. **Important:** Check the **"Master Password"** box to enable SMTP access
4. Generate an SMTP password for your `support@yourdomain.com` sender
5. Note down the SMTP settings:
   - **SMTP Server:** `smtp-relay.brevo.com`
   - **Port:** `587` (or `465` for SSL)
   - **Username:** `support@yourdomain.com`
   - **Password:** Your Brevo SMTP password

#### 2. Configure Gmail
1. In Gmail, go to **Settings → Accounts and Import**
2. Under "Send mail as", click **"Add another email address"**
3. Enter the following details:
   - **Name:** Your Domain Support (or preferred name)
   - **Email address:** `support@yourdomain.com`
4. **Uncheck** "Treat as an alias"
5. Click **"Next Step"**
6. Configure SMTP settings:
   - **SMTP Server:** `smtp-relay.brevo.com`
   - **Port:** `587`
   - **Username:** `support@yourdomain.com`
   - **Password:** Your Brevo SMTP password
   - **Security:** TLS (recommended)
7. Click **"Add Account"**

#### 3. Verify the Setup
1. Gmail will send a verification email to `support@yourdomain.com`
2. Since you have forwarding configured, this email will arrive in your Gmail inbox
3. Click the verification link in the email to complete the setup

#### 4. Using the Feature
- When composing emails in Gmail, you'll see a "From" dropdown
- Select `support@yourdomain.com` to send emails as the support address
- Recipients will see the email as coming from your support address

#### 5. Setting a Custom Display Name (Recommended)
By default, Gmail may show your personal name alongside the support email address. To fix this:

1. **Go to Gmail Settings** → **Accounts and Import**
2. **Under "Send mail as"**, find your `support@yourdomain.com` entry
3. **Click "edit info"** next to it
4. **Change the name** to something professional like:
   - "Your Domain Support"
   - "Support Team"
   - "Customer Support"
   - Or leave it blank for just the email address
5. **Save the changes**

This will make your emails appear as "Your Domain Support <support@yourdomain.com>" instead of "Your Name <support@yourdomain.com>".

### Troubleshooting

**If you can't find SMTP settings in Brevo:**
- Some Brevo accounts may use API keys for SMTP authentication
- Try using your Brevo API key as the SMTP password
- Contact Brevo support if you need specific SMTP credentials

**If verification email doesn't arrive:**
- Check that email forwarding is working correctly
- Verify that `support@yourdomain.com` is configured as a sender in Brevo
- Check your spam folder

**If SMTP authentication fails:**
- Double-check the SMTP server and port settings
- Ensure your Brevo account has SMTP access enabled
- Verify the username and password are correct

---

## Error Responses