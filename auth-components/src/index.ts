/**
 * Authentication utilities for frontend projects
 * Simple functions to interact with the centralized auth service
 */

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  session?: {
    id: string;
    token: string;
    expiresAt: string;
  };
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

export class AuthClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Default to current domain if no base URL provided
    this.baseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
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
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData),
    });

    const data: AuthResponse = await response.json();

    if (data.success && data.session && data.user) {
      // Store session token in localStorage
      localStorage.setItem('auth_token', data.session.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      return data.user;
    }

    throw new Error(data.message || 'Login failed');
  }

  /**
   * Register new user
   */
  async signup(signupData: SignupData): Promise<User> {
    const response = await fetch(`${this.baseUrl}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(signupData),
    });

    const data: AuthResponse = await response.json();

    if (data.success && data.session && data.user) {
      // Store session token in localStorage
      localStorage.setItem('auth_token', data.session.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      return data.user;
    }

    throw new Error(data.message || 'Signup failed');
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('auth_token');
    if (token) {
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
  }

  /**
   * Validate current session
   */
  async validateSession(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const token = localStorage.getItem('auth_token');
    if (!token) return false;

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
}

// Export a default instance
export const auth = new AuthClient(); 