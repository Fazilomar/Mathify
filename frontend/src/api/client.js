// Centralized API client with JWT automatic refresh and error handling
export const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://mathify-backend-one.vercel.app' : '');

export const API = {
  getAccess: () => localStorage.getItem('mx_access'),
  getRefresh: () => localStorage.getItem('mx_refresh'),

  setTokens(access, refresh) {
    if (access) localStorage.setItem('mx_access', access);
    if (refresh) localStorage.setItem('mx_refresh', refresh);
  },

  clearTokens() {
    localStorage.removeItem('mx_access');
    localStorage.removeItem('mx_refresh');
    localStorage.removeItem('mx_user');
  },

  getCurrentUserId() {
    const token = this.getAccess();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.user_id;
    } catch {
      return null;
    }
  },

  async refresh() {
    const refresh = this.getRefresh();
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_BASE}/api/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (res.ok) {
        const data = await res.json();
        this.setTokens(data.access, data.refresh);
        return true;
      }
    } catch {
      // network failure
    }
    return false;
  },

  async req(endpoint, opts = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const headers = { ...(opts.headers || {}) };

    const token = this.getAccess();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Only set Content-Type to JSON if body is not FormData
    if (!(opts.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      let res = await fetch(url, { ...opts, headers });

      // If token expired, try automatic refresh once
      if (res.status === 401 && this.getRefresh()) {
        const ok = await this.refresh();
        if (ok) {
          headers['Authorization'] = `Bearer ${this.getAccess()}`;
          res = await fetch(url, { ...opts, headers });
        } else {
          this.clearTokens();
          window.dispatchEvent(new Event('auth:unauthorized'));
        }
      }

      return res;
    } catch (err) {
      console.error('API request error:', err);
      throw err;
    }
  },

  async get(endpoint, opts = {}) {
    return this.req(endpoint, { ...opts, method: 'GET' });
  },

  async post(endpoint, body, opts = {}) {
    const isForm = body instanceof FormData;
    return this.req(endpoint, {
      ...opts,
      method: 'POST',
      body: isForm ? body : JSON.stringify(body),
    });
  },

  async put(endpoint, body, opts = {}) {
    const isForm = body instanceof FormData;
    return this.req(endpoint, {
      ...opts,
      method: 'PUT',
      body: isForm ? body : JSON.stringify(body),
    });
  },

  async patch(endpoint, body, opts = {}) {
    const isForm = body instanceof FormData;
    return this.req(endpoint, {
      ...opts,
      method: 'PATCH',
      body: isForm ? body : JSON.stringify(body),
    });
  },

  async delete(endpoint, opts = {}) {
    return this.req(endpoint, { ...opts, method: 'DELETE' });
  },
};
