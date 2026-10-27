const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api/v1` 
  : (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' 
      ? '/api/v1' 
      : 'http://localhost:3000/api/v1');

class APIClient {
  private static instance: APIClient;
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  private constructor() {}

  public static getInstance(): APIClient {
    if (!APIClient.instance) {
      APIClient.instance = new APIClient();
    }
    return APIClient.instance;
  }

  private getAccessToken(): string | null {
    return localStorage.getItem('nk_token');
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem('nk_refresh_token');
  }

  private saveTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem('nk_token', accessToken);
    localStorage.setItem('nk_refresh_token', refreshToken);
  }

  private clearTokens() {
    localStorage.removeItem('nk_token');
    localStorage.removeItem('nk_refresh_token');
    localStorage.removeItem('nk_user');
    window.location.reload();
  }

  private onTokenRefreshed(accessToken: string) {
    this.refreshSubscribers.map((callback) => callback(accessToken));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  public async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${API_BASE}${endpoint}`;
    
    // Set headers
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const token = this.getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    let response = await fetch(url, config);

    // If unauthorized, attempt token refresh
    if (response.status === 401 && this.getRefreshToken()) {
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: this.getRefreshToken() }),
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            this.saveTokens(data.accessToken, data.refreshToken);
            this.isRefreshing = false;
            this.onTokenRefreshed(data.accessToken);
          } else {
            this.isRefreshing = false;
            this.clearTokens();
            throw new Error('Session expired');
          }
        } catch (err) {
          this.isRefreshing = false;
          this.clearTokens();
          throw err;
        }
      }

      // Queue original requests until token is refreshed
      return new Promise((resolve) => {
        this.addRefreshSubscriber((newToken) => {
          headers.set('Authorization', `Bearer ${newToken}`);
          resolve(fetch(url, config));
        });
      });
    }

    return response;
  }

  public async get(endpoint: string, options: RequestInit = {}): Promise<any> {
    const res = await this.request(endpoint, { ...options, method: 'GET' });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `GET request failed with status ${res.status}`);
    }
    return res.json();
  }

  public async post(endpoint: string, body: any, options: RequestInit = {}): Promise<any> {
    const res = await this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `POST request failed with status ${res.status}`);
    }
    return res.json();
  }
}

export const api = APIClient.getInstance();
export const API_ROOT = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' 
    ? '' 
    : 'http://localhost:3000');
export const API_BASE_URL = API_BASE;
