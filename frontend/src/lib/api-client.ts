import ky from 'ky';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/** Read a cookie value by name. Returns null if not found. */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

/** Attach the CSRF token header (read from the csrf_token cookie) to the request. */
function attachCSRFToken(request: Request): void {
  const csrfToken = getCookie('csrf_token');
  if (csrfToken) {
    request.headers.set('X-CSRF-Token', csrfToken);
  }
}

// Create ky instance with default configuration
const apiClient = ky.create({
  prefixUrl: API_BASE_URL,
  timeout: 30000,
  credentials: 'include',
  retry: {
    limit: 2,
    methods: ['get', 'post', 'put', 'delete'],
    statusCodes: [408, 413, 500, 502, 503, 504],
  },
  hooks: {
    beforeRequest: [
      async (request) => {
        // Attach CSRF token for state-changing requests
        attachCSRFToken(request);

        // Remove trailing slash from URL (Gin doesn't handle /api/students/ the same as /api/students)
        const url = new URL(request.url);

        if (url.pathname.endsWith('/') && url.pathname !== '/') {
          url.pathname = url.pathname.slice(0, -1);

          // Clone the request to preserve the body (body streams can only be read once)
          const clonedRequest = request.clone();
          const body = await clonedRequest.text();

          return new Request(url.toString(), {
            method: request.method,
            headers: request.headers,
            body: body || undefined,
            credentials: 'include',
          });
        }
      },
    ],
    afterResponse: [
      async (request, _options, response) => {
        // Handle 401 Unauthorized - token expired
        if (response.status === 401) {
          // Don't redirect on auth endpoints (401 = wrong credentials, not expired session)
          const url = new URL(request.url);
          if (url.pathname.includes('/auth/login') || url.pathname.includes('/auth/refresh')) {
            return response;
          }

          if (typeof window !== 'undefined') {
            // Clear UI-only localStorage data
            localStorage.removeItem('user');
            // Redirect to login
            window.location.href = '/auth/login';
          }
        }
        return response;
      },
    ],
  },
});

// API clients - URLs must match Traefik routing in dynamic.yml
export const authApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/auth` });
export const staffApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/staff` });
export const adminStaffApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/admin-staff` });
export const studentApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/students` });
export const catalogApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/catalog` });
export const semesterApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/semesters` });
export const enrollmentApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/enrollment` });
export const attendanceApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/attendance` });
export const gradesApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/grades` });
export const mealApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/meals` });

// API clients without 401 auto-redirect — for admin pages that call
// multiple services in parallel (e.g. system page). The global 401 hook
// would redirect before Promise.allSettled can catch individual failures.
const noRedirectClient = ky.create({
  prefixUrl: API_BASE_URL,
  timeout: 30000,
  credentials: 'include',
  retry: { limit: 0 },
  hooks: {
    beforeRequest: [
      (request) => {
        attachCSRFToken(request);
      },
    ],
  },
});

export const gradesApiSafe = noRedirectClient.extend({ prefixUrl: `${API_BASE_URL}/api/grades` });
export const enrollmentApiSafe = noRedirectClient.extend({ prefixUrl: `${API_BASE_URL}/api/enrollment` });
export const mealApiSafe = noRedirectClient.extend({ prefixUrl: `${API_BASE_URL}/api/meals` });
export const catalogApiSafe = noRedirectClient.extend({ prefixUrl: `${API_BASE_URL}/api/catalog` });
export const authApiSafe = noRedirectClient.extend({ prefixUrl: `${API_BASE_URL}/api/auth` });
export const attendanceApiSafe = noRedirectClient.extend({ prefixUrl: `${API_BASE_URL}/api/attendance` });
export const studentApiSafe = noRedirectClient.extend({ prefixUrl: `${API_BASE_URL}/api/students` });
export const staffApiSafe = noRedirectClient.extend({ prefixUrl: `${API_BASE_URL}/api/staff` });

// Export the raw ky client for direct use if needed
export { apiClient };
