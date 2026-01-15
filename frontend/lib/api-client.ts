import ky from 'ky';
import {
  mockAuthApi,
  mockStaffApi,
  mockStudentApi,
  mockCatalogApi,
  mockEnrollmentApi,
  mockAttendanceApi,
  mockGradesApi,
  mockMealApi,
} from './mock-api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost';
const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true';

// Create ky instance with default configuration
export const apiClient = ky.create({
  prefixUrl: API_BASE_URL,
  timeout: 30000,
  retry: {
    limit: 2,
    methods: ['get', 'post', 'put', 'delete'],
    statusCodes: [408, 413, 429, 500, 502, 503, 504],
  },
  hooks: {
    beforeRequest: [
      (request) => {
        // Add authorization token if exists
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        // Handle 401 Unauthorized - token expired
        if (response.status === 401) {
          // Clear token and redirect to login
          if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            window.location.href = '/auth/login';
          }
        }
        return response;
      },
    ],
  },
});

// Real API clients
const realAuthApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/v1/auth` });
const realStaffApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/v1/staff` });
const realStudentApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/v1/students` });
const realCatalogApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/v1/catalog` });
const realEnrollmentApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/v1/enrollment` });
const realAttendanceApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/v1/attendance` });
const realGradesApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/v1/grades` });
const realMealApi = apiClient.extend({ prefixUrl: `${API_BASE_URL}/api/v1/meal` });

// Export API clients (mock or real based on environment variable)
export const authApi = USE_MOCK_API ? mockAuthApi : realAuthApi;
export const staffApi = USE_MOCK_API ? mockStaffApi : realStaffApi;
export const studentApi = USE_MOCK_API ? mockStudentApi : realStudentApi;
export const catalogApi = USE_MOCK_API ? mockCatalogApi : realCatalogApi;
export const enrollmentApi = USE_MOCK_API ? mockEnrollmentApi : realEnrollmentApi;
export const attendanceApi = USE_MOCK_API ? mockAttendanceApi : realAttendanceApi;
export const gradesApi = USE_MOCK_API ? mockGradesApi : realGradesApi;
export const mealApi = USE_MOCK_API ? mockMealApi : realMealApi;

// Log which API is being used
if (typeof window !== 'undefined') {
  console.log(`[API Client] Using ${USE_MOCK_API ? 'MOCK' : 'REAL'} API`);
}
