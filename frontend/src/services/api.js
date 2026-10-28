// Dynamic & robust API_BASE resolver for local dev and Vercel production deployments
function resolveApiBase() {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (!envUrl) return '/api';
  const clean = envUrl.replace(/\/+$/, '');
  if (clean.startsWith('http') && !clean.endsWith('/api')) {
    return `${clean}/api`;
  }
  return clean;
}

export const API_BASE = resolveApiBase();

function getAuthHeader() {
  const token = localStorage.getItem('cert_admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Enhanced fetch wrapper that handles authentication expiration gracefully.
 * Dispatches a 'cert_auth_expired' custom event on 401 responses.
 */
async function authFetch(url, options = {}) {
  const res = await fetch(url, options);

  // If unauthorized on any protected route, wipe stale token and alert app
  if (res.status === 401 && !url.includes('/admin/login')) {
    localStorage.removeItem('cert_admin_token');
    window.dispatchEvent(
      new CustomEvent('cert_auth_expired', {
        detail: {
          url,
          message: 'Your administrator session has expired. Please sign in again.'
        }
      })
    );
  }

  return res;
}

export const api = {
  auth: {
    async login(username, password) {
      const cleanUser = (username || '').trim();
      const cleanPass = (password || '').trim();

      const res = await fetch(`${API_BASE}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password: cleanPass })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials.');
      }

      localStorage.setItem('cert_admin_token', data.token);
      return data;
    },

    async getMe() {
      const res = await authFetch(`${API_BASE}/admin/me`, {
        headers: { ...getAuthHeader() }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify session');
      return data;
    },

    logout() {
      localStorage.removeItem('cert_admin_token');
      window.dispatchEvent(new CustomEvent('cert_auth_logged_out'));
    },

    isAuthenticated() {
      return Boolean(localStorage.getItem('cert_admin_token'));
    }
  },

  events: {
    async getAll() {
      const res = await authFetch(`${API_BASE}/admin/events`, {
        headers: { ...getAuthHeader() }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load events');
      return data.events || [];
    },

    async getById(id) {
      const res = await authFetch(`${API_BASE}/admin/events/${id}`, {
        headers: { ...getAuthHeader() }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load event details');
      return data;
    },

    async create(eventData) {
      const res = await authFetch(`${API_BASE}/admin/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(eventData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create event');
      return data.event;
    },

    async delete(id) {
      const res = await authFetch(`${API_BASE}/admin/events/${id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeader() }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete event');
      return data;
    }
  },

  upload: {
    async uploadFiles(eventId, zipFile, participantFile, onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('zipFile', zipFile);
        formData.append('participantFile', participantFile);

        xhr.open('POST', `${API_BASE}/admin/events/${eventId}/upload`);

        const token = localStorage.getItem('cert_admin_token');
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              onProgress(percent);
            }
          };
        }

        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status === 401) {
              localStorage.removeItem('cert_admin_token');
              window.dispatchEvent(
                new CustomEvent('cert_auth_expired', {
                  detail: { message: 'Your session expired during upload. Please sign in again.' }
                })
              );
              reject(new Error('Session expired. Please sign in again.'));
              return;
            }
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              reject(new Error(data.error || 'Upload processing failed'));
            }
          } catch (e) {
            reject(new Error('Invalid server response'));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      });
    }
  },

  matching: {
    async manualMatch(allocationId, payload) {
      const res = await authFetch(`${API_BASE}/admin/allocations/${allocationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update matching allocation');
      return data.allocation;
    },

    async revoke(allocationId) {
      const res = await authFetch(`${API_BASE}/admin/allocations/${allocationId}/revoke`, {
        method: 'POST',
        headers: { ...getAuthHeader() }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke certificate');
      return data.allocation;
    },

    async publish(eventId, { sendEmails = false, forcePublish = false } = {}) {
      const res = await authFetch(`${API_BASE}/admin/events/${eventId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ sendEmails, forcePublish })
      });
      const data = await res.json();
      if (!res.ok) {
        const error = new Error(data.error || 'Publish failed');
        error.pendingReviewsCount = data.pendingReviewsCount;
        throw error;
      }
      return data;
    }
  },

  certificates: {
    getPreviewUrl(certId) {
      return `${API_BASE}/admin/certificates/${certId}/preview`;
    }
  },

  participant: {
    async verify(credentials) {
      let body;
      if (typeof credentials === 'object' && credentials !== null) {
        body = credentials;
      } else {
        body = { identifier: arguments[0], accessCode: arguments[1] };
      }

      const res = await fetch(`${API_BASE}/participant/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid credentials or certificate not found');
      return data;
    },

    getDownloadUrl(ticket) {
      return `${API_BASE}/participant/download/${ticket}`;
    },

    getStreamUrl(ticket) {
      return `${API_BASE}/participant/stream/${ticket}`;
    }
  },

  demo: {
    async seed() {
      const res = await fetch(`${API_BASE}/demo/seed`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to seed demo data');
      return data;
    },

    getSampleCsvUrl() {
      return `${API_BASE}/demo/sample-csv`;
    },

    getSampleZipUrl() {
      return `${API_BASE}/demo/sample-zip`;
    }
  }
};
