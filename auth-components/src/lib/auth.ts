/**
 * Authentication utilities for connecting React components to the auth service
 */

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface Session {
  id: string;
  token: string;
  expiresAt: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  error?: string;
  user?: User;
  session?: Session;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

class AuthClient {
  private baseUrl: string;
  private csrfToken: string | null = null;
  private isDevelopment: boolean;

  constructor(baseUrl?: string) {
    // In development, allow overriding the auth service URL
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else if (typeof window !== 'undefined') {
      // Check for environment variable or use current domain
      const authServiceUrl = import.meta.env.VITE_AUTH_SERVICE_URL;
      this.baseUrl = authServiceUrl || window.location.origin;
    } else {
      this.baseUrl = '';
    }
    
    this.isDevelopment = import.meta.env.DEV;
  }

  /**
   * Check if we're in development mode and should use mock responses
   */
  private shouldUseMock(): boolean {
    // In development, use mock mode if:
    // 1. We're in development mode AND
    // 2. Either no auth service URL is configured OR we're on localhost
    return this.isDevelopment && (
      !import.meta.env.VITE_AUTH_SERVICE_URL || 
      this.baseUrl.includes('localhost') ||
      this.baseUrl.includes('127.0.0.1')
    );
  }

  /**
   * Generate mock user data
   */
  private generateMockUser(data: { email: string; firstName?: string; lastName?: string }): User {
    return {
      id: `mock-${Date.now()}`,
      email: data.email,
      firstName: data.firstName || 'Mock',
      lastName: data.lastName || 'User',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate mock session data
   */
  private generateMockSession(): Session {
    return {
      id: `session-${Date.now()}`,
      token: `mock-token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };
  }

  /**
   * Get CSRF token for form protection
   */
  async getCSRFToken(): Promise<string> {
    if (this.shouldUseMock()) {
      this.csrfToken = `mock-csrf-${Date.now()}`;
      return this.csrfToken;
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/csrf-token`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get CSRF token: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.csrfToken = data.token;
      return data.token;
    } catch (error) {
      console.error('Error getting CSRF token:', error);
      if (this.isDevelopment) {
        console.warn('Using mock CSRF token for development');
        this.csrfToken = `mock-csrf-${Date.now()}`;
        return this.csrfToken;
      }
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('auth_token');
  }

  /**
   * Get current user from localStorage
   */
  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    
    const userStr = localStorage.getItem('auth_user');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr) as User;
    } catch {
      return null;
    }
  }

  /**
   * Login user
   */
  async login(loginData: LoginData): Promise<User> {
    console.log('🔧 Auth login called with:', { 
      isDevelopment: this.isDevelopment, 
      baseUrl: this.baseUrl, 
      shouldUseMock: this.shouldUseMock() 
    });

    if (this.shouldUseMock()) {
      console.log('🔧 Using mock login');
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock validation
      if (!loginData.email || !loginData.password) {
        throw new Error('Email and password are required');
      }
      
      if (loginData.password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      const user = this.generateMockUser({ email: loginData.email });
      const session = this.generateMockSession();
      
      // Store in localStorage
      localStorage.setItem('auth_token', session.token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      
      console.log('🔧 Mock login successful:', user);
      return user;
    }

    console.log('🔧 Using real auth service login');
    // Get CSRF token if not already available
    if (!this.csrfToken) {
      await this.getCSRFToken();
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...loginData,
          csrfToken: this.csrfToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Login failed: ${response.status} ${response.statusText}`);
      }

      const data: AuthResponse = await response.json();

      if (data.success && data.session && data.user) {
        // Store session token in localStorage
        localStorage.setItem('auth_token', data.session.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        return data.user;
      }

      throw new Error(data.error || 'Login failed');
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Register new user
   */
  async signup(signupData: SignupData): Promise<User> {
    console.log('🔧 Auth signup called with:', { 
      isDevelopment: this.isDevelopment, 
      baseUrl: this.baseUrl, 
      shouldUseMock: this.shouldUseMock() 
    });

    if (this.shouldUseMock()) {
      console.log('🔧 Using mock signup');
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock validation
      if (!signupData.email || !signupData.password || !signupData.firstName || !signupData.lastName) {
        throw new Error('All fields are required');
      }
      
      if (signupData.password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      const user = this.generateMockUser(signupData);
      const session = this.generateMockSession();
      
      // Store in localStorage
      localStorage.setItem('auth_token', session.token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      
      console.log('🔧 Mock registration successful:', user);
      return user;
    }

    console.log('🔧 Using real auth service signup');
    // Get CSRF token if not already available
    if (!this.csrfToken) {
      await this.getCSRFToken();
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...signupData,
          csrfToken: this.csrfToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Signup failed: ${response.status} ${response.statusText}`);
      }

      const data: AuthResponse = await response.json();

      if (data.success && data.session && data.user) {
        // Store session token in localStorage
        localStorage.setItem('auth_token', data.session.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        return data.user;
      }

      throw new Error(data.error || 'Signup failed');
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('auth_token');
    
    if (this.shouldUseMock()) {
      console.log('🔧 Mock logout successful');
    } else if (token) {
      try {
        await fetch(`${this.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.warn('Logout request failed:', error);
      }
    }

    // Clear local storage regardless of API call success
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    this.csrfToken = null; // Clear CSRF token on logout
  }

  /**
   * Validate current session
   */
  async validateSession(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const token = localStorage.getItem('auth_token');
    if (!token) return false;

    if (this.shouldUseMock()) {
      // Mock session validation - always return true if token exists
      return true;
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/session`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data: AuthResponse = await response.json();

      if (!data.success) {
        // Clear invalid session
        this.logout();
        return false;
      }

      return true;
    } catch (error) {
      console.warn('Session validation failed:', error);
      this.logout();
      return false;
    }
  }

  /**
   * Health check for auth service
   */
  async healthCheck(): Promise<any> {
    if (this.shouldUseMock()) {
      return {
        status: 200,
        domain: 'localhost',
        subdomain: 'mock',
        timestamp: new Date().toISOString(),
        mock: true
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/health`, {
        method: 'GET',
      });
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  /**
   * Get the current base URL (useful for debugging)
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Check if we're using mock mode
   */
  isMockMode(): boolean {
    return this.shouldUseMock();
  }
}

// Export a default instance
export const auth = new AuthClient(); 