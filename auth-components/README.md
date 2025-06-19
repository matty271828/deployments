# Auth Components

Simple authentication utilities for frontend projects. This library provides easy-to-use functions to interact with the centralized auth service.

## Features

- 🔐 **Simple API**: Easy-to-use functions for login, signup, and session management
- 🚀 **Framework Agnostic**: Works with any frontend framework (React, Vue, Svelte, vanilla JS)
- 📱 **Browser Compatible**: Works in all modern browsers
- 🔒 **Secure**: Handles session tokens and localStorage securely
- ⚡ **Lightweight**: No heavy dependencies

## Installation

This library is automatically included in deployed projects. For local development, you can install it as a dev dependency:

```bash
npm install @deployments/auth-components-dev
```

## Quick Start

```javascript
import { auth } from '@deployments/auth-components';

// Check if user is logged in
if (auth.isAuthenticated()) {
  const user = auth.getCurrentUser();
  console.log('Welcome back,', user.firstName);
} else {
  console.log('Please log in');
}

// Login
async function handleLogin(email, password) {
  try {
    const user = await auth.login({ email, password });
    console.log('Logged in as:', user.firstName);
    // Redirect to dashboard or update UI
  } catch (error) {
    console.error('Login failed:', error.message);
  }
}

// Signup
async function handleSignup(userData) {
  try {
    const user = await auth.signup(userData);
    console.log('Account created for:', user.firstName);
    // Redirect to dashboard or update UI
  } catch (error) {
    console.error('Signup failed:', error.message);
  }
}

// Logout
async function handleLogout() {
  await auth.logout();
  console.log('Logged out');
  // Redirect to login page or update UI
}
```

## API Reference

### `auth.isAuthenticated()`
Check if the user is currently logged in.

**Returns:** `boolean`

```javascript
if (auth.isAuthenticated()) {
  // User is logged in
}
```

### `auth.getCurrentUser()`
Get the current user's information.

**Returns:** `User | null`

```javascript
const user = auth.getCurrentUser();
if (user) {
  console.log(user.firstName, user.email);
}
```

### `auth.login(loginData)`
Log in a user.

**Parameters:**
- `loginData`: `{ email: string, password: string }`

**Returns:** `Promise<User>`

```javascript
const user = await auth.login({ 
  email: 'user@example.com', 
  password: 'password123' 
});
```

### `auth.signup(signupData)`
Register a new user.

**Parameters:**
- `signupData`: `{ email: string, password: string, firstName: string, lastName: string }`

**Returns:** `Promise<User>`

```javascript
const user = await auth.signup({
  email: 'user@example.com',
  password: 'password123',
  firstName: 'John',
  lastName: 'Doe'
});
```

### `auth.logout()`
Log out the current user.

**Returns:** `Promise<void>`

```javascript
await auth.logout();
```

### `auth.validateSession()`
Validate the current session with the server.

**Returns:** `Promise<boolean>`

```javascript
const isValid = await auth.validateSession();
if (!isValid) {
  // Session is invalid, redirect to login
}
```

### `auth.healthCheck()`
Check if the auth service is available.

**Returns:** `Promise<any>`

```javascript
try {
  const health = await auth.healthCheck();
  console.log('Auth service is healthy');
} catch (error) {
  console.error('Auth service is down');
}
```

## Types

### `User`
```typescript
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}
```

### `LoginData`
```typescript
interface LoginData {
  email: string;
  password: string;
}
```

### `SignupData`
```typescript
interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}
```

## Usage Examples

### React Example
```jsx
import { auth } from '@deployments/auth-components';
import { useState, useEffect } from 'react';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth.isAuthenticated()) {
      setUser(auth.getCurrentUser());
    }
    setLoading(false);
  }, []);

  const handleLogin = async (email, password) => {
    try {
      const user = await auth.login({ email, password });
      setUser(user);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleLogout = async () => {
    await auth.logout();
    setUser(null);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {user ? (
        <div>
          <h1>Welcome, {user.firstName}!</h1>
          <button onClick={handleLogout}>Logout</button>
        </div>
      ) : (
        <LoginForm onLogin={handleLogin} />
      )}
    </div>
  );
}
```

### Vue Example
```vue
<template>
  <div>
    <div v-if="user">
      <h1>Welcome, {{ user.firstName }}!</h1>
      <button @click="handleLogout">Logout</button>
    </div>
    <LoginForm v-else @login="handleLogin" />
  </div>
</template>

<script>
import { auth } from '@deployments/auth-components';

export default {
  data() {
    return {
      user: null
    };
  },
  mounted() {
    if (auth.isAuthenticated()) {
      this.user = auth.getCurrentUser();
    }
  },
  methods: {
    async handleLogin(email, password) {
      try {
        this.user = await auth.login({ email, password });
      } catch (error) {
        alert(error.message);
      }
    },
    async handleLogout() {
      await auth.logout();
      this.user = null;
    }
  }
};
</script>
```

### Vanilla JavaScript Example
```javascript
import { auth } from '@deployments/auth-components';

// Check auth on page load
document.addEventListener('DOMContentLoaded', () => {
  if (auth.isAuthenticated()) {
    showDashboard();
  } else {
    showLoginForm();
  }
});

function showDashboard() {
  const user = auth.getCurrentUser();
  document.body.innerHTML = `
    <h1>Welcome, ${user.firstName}!</h1>
    <button onclick="handleLogout()">Logout</button>
  `;
}

function showLoginForm() {
  document.body.innerHTML = `
    <form onsubmit="handleLogin(event)">
      <input type="email" id="email" placeholder="Email" required>
      <input type="password" id="password" placeholder="Password" required>
      <button type="submit">Login</button>
    </form>
  `;
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  try {
    await auth.login({ email, password });
    showDashboard();
  } catch (error) {
    alert(error.message);
  }
}

async function handleLogout() {
  await auth.logout();
  showLoginForm();
}
```

## Error Handling

All async functions throw errors when the request fails:

```javascript
try {
  const user = await auth.login({ email, password });
  // Success
} catch (error) {
  // Handle error
  console.error('Login failed:', error.message);
  // Show error to user
}
```

Common error scenarios:
- Invalid credentials
- Network errors
- Server errors
- Validation errors

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## License

MIT License 