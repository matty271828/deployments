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
| 400 | `Password must be at least 8 characters long` | Password too weak |
| 400 | `Invalid JSON in request body` | Malformed JSON |
| 400 | `Invalid session token format` | Token format incorrect |
| 401 | `Authorization header with Bearer token is required` | Missing auth header |
| 401 | `Invalid email or password` | Login credentials incorrect |
| 401 | `Invalid or expired session` | Session token invalid |
| 404 | `Endpoint not found` | Invalid endpoint |
| 404 | `User not found` | User associated with session not found |
| 405 | `Method not allowed` | Wrong HTTP method |
| 409 | `User already exists` | Email already registered |
| 429 | `Too many login attempts. Please try again later.` | Rate limited - too many login attempts |
| 429 | `Too many signup attempts. Please try again later.` | Rate limited - too many signup attempts |
| 429 | `Too many session requests. Please try again later.` | Rate limited - too many session operations |
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

### Session Security
- **Token Format**: `{session_id}.{session_secret}`
- **Secret Storage**: Hashed secrets in database
- **Expiration**: 24 hours from creation
- **Validation**: Constant-time comparison

### Data Isolation
- **Domain Prefixing**: All tables prefixed with domain name
- **Cross-Domain Protection**: Users/sessions isolated per domain
- **Secure IDs**: Cryptographically secure random generation

### Error Handling
- **Generic Errors**: Internal errors are not exposed to clients
- **Input Validation**: Comprehensive validation of all inputs
- **SQL Injection Protection**: Parameterized queries throughout

### Rate Limiting
- **Token Bucket Algorithm**: Smooth handling of request bursts
- **Login Protection**: 5 attempts per 15 minutes per IP
- **Signup Protection**: 3 attempts per hour per IP
- **Session Operations**: 30 requests per minute per IP (validation, refresh, logout)
- **General API**: 100 requests per minute per IP (health)
- **Persistent Storage**: Uses D1 database for cross-request persistence
- **Automated Cleanup**: Background cleanup runs every 12 hours across all domains

## CORS Support

The service includes full CORS support for cross-origin requests:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Development

### Prerequisites
- Node.js 18+
- Wrangler CLI
- Cloudflare account with D1 database

### Setup

This service is deployed automatically using Terraform and GitHub Actions. The deployment process:

1. **Infrastructure**: Terraform creates the D1 database and worker
2. **Schema**: GitHub Actions applies the database schema template
3. **Deployment**: Worker code is deployed via Cloudflare API

For manual development and testing:

```bash
# Install dependencies
npm install

# Configure wrangler.toml with your database ID
# Deploy locally
wrangler dev
```

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
    created_at INTEGER NOT NULL
);

-- Sessions table
CREATE TABLE {PREFIX}_sessions (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL,
    secret_hash BLOB NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES {PREFIX}_users(id) ON DELETE CASCADE
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

## License

MIT License - see LICENSE file for details. 