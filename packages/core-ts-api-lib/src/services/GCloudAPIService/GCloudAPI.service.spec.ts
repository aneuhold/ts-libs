import { ProjectName } from '@aneuhold/core-ts-db-lib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthValidateUserInput } from '../../types/AuthValidateUser.js';
import type { ProjectDashboardInput } from '../../types/project/dashboard/ProjectDashboard.js';
import GCloudAPIService from './GCloudAPI.service.js';

describe('Unit Tests', () => {
  describe('GCloudAPIService', () => {
    /**
     * Can be used to work with the global fetch mock
     */
    const mockFetch = vi.fn();

    beforeEach(() => {
      vi.stubGlobal('fetch', mockFetch);
      GCloudAPIService.setUrl('https://test-url.com/');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.clearAllMocks();
      // Token state is static, so clear it between tests to keep them isolated.
      GCloudAPIService.setAccessToken('');
      GCloudAPIService.setRefreshTokenString('');
    });

    describe('setUrl', () => {
      it('should set the base URL', async () => {
        GCloudAPIService.setUrl('https://new-url.com/');

        const mockResponse = { success: true, data: {}, errors: [] };
        mockFetch.mockResolvedValue({
          text: () => Promise.resolve(JSON.stringify(mockResponse))
        });

        const input: ProjectDashboardInput = { options: {} };
        await GCloudAPIService.projectDashboard(input);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringMatching(/^https:\/\/new-url\.com\//),
          expect.any(Object)
        );
      });
    });

    describe('authValidateUser', () => {
      it('should call the correct endpoint with correct input', async () => {
        const mockResponse = {
          success: true,
          data: { token: 'test-token' },
          errors: []
        };
        mockFetch.mockResolvedValue({
          text: () => Promise.resolve(JSON.stringify(mockResponse))
        });

        const input: AuthValidateUserInput = {
          userName: 'testuser',
          password: 'password123',
          project: ProjectName.Dashboard
        };
        const result = await GCloudAPIService.authValidateUser(input);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://test-url.com/auth/validateUser',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(input)
          })
        );

        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const headers = callArgs[1].headers as Headers;
        expect(headers.get('Content-Type')).toBe('application/json');
        expect(result).toEqual(mockResponse);
      });
    });

    describe('projectDashboard', () => {
      it('should call the correct endpoint with correct input', async () => {
        const mockResponse = {
          success: true,
          data: { projects: [] },
          errors: []
        };
        mockFetch.mockResolvedValue({
          text: () => Promise.resolve(JSON.stringify(mockResponse))
        });

        const input: ProjectDashboardInput = {
          options: { get: { translations: true } }
        };
        const result = await GCloudAPIService.projectDashboard(input);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://test-url.com/project/dashboard',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(input)
          })
        );
        expect(result).toEqual(mockResponse);
      });
    });

    describe('Date Parsing', () => {
      it('should use DateService.dateReviver to parse dates', async () => {
        const dateStr = '2023-10-27T10:00:00.000Z';
        const mockResponse = {
          success: true,
          data: {
            createdAt: dateStr,
            name: 'Test Project'
          },
          errors: []
        };
        mockFetch.mockResolvedValue({
          text: () => Promise.resolve(JSON.stringify(mockResponse))
        });

        const input: ProjectDashboardInput = {
          options: {}
        };
        const result = await GCloudAPIService.projectDashboard(input);
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const data = result.data as unknown as { createdAt: Date; name: string };

        expect(data).toBeDefined();
        expect(data.createdAt).toBeInstanceOf(Date);
        expect(data.createdAt.toISOString()).toBe(dateStr);
        expect(data.name).toBe('Test Project');
      });
    });

    describe('Error Handling', () => {
      it('should handle JSON parse errors gracefully', async () => {
        mockFetch.mockResolvedValue({
          text: () => Promise.resolve('Invalid JSON')
        });

        const input: ProjectDashboardInput = {
          options: {}
        };
        const result = await GCloudAPIService.projectDashboard(input);

        expect(result.success).toBe(false);
        expect(result.errors[0]).toBe('Failed to parse response');
      });

      it('should handle fetch errors', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        const input: ProjectDashboardInput = {
          options: {}
        };
        await expect(GCloudAPIService.projectDashboard(input)).rejects.toThrow('Network error');
      });
    });

    describe('onAuthExpired', () => {
      const onAuthExpired = vi.fn();
      const input: ProjectDashboardInput = { options: {} };
      const unauthorizedBody = { success: false, errors: ['Unauthorized'], data: {} };

      beforeEach(() => {
        GCloudAPIService.setOnAuthExpired(onAuthExpired);
      });

      afterEach(() => {
        GCloudAPIService.setOnAuthExpired(null);
      });

      it('fires the callback and returns the decoded 401 when there is no refresh token', async () => {
        mockFetch.mockResolvedValue({
          status: 401,
          text: () => Promise.resolve(JSON.stringify(unauthorizedBody))
        });

        const result = await GCloudAPIService.projectDashboard(input);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(onAuthExpired).toHaveBeenCalledTimes(1);
        expect(result).toEqual(unauthorizedBody);
      });

      it('fires the callback and returns the original 401 when the refresh fails', async () => {
        GCloudAPIService.setRefreshTokenString('refresh-token');
        mockFetch
          .mockResolvedValueOnce({
            status: 401,
            text: () => Promise.resolve(JSON.stringify(unauthorizedBody))
          })
          .mockResolvedValueOnce({
            status: 401,
            text: () =>
              Promise.resolve(
                JSON.stringify({ success: false, errors: ['Invalid refresh token'], data: {} })
              )
          });

        const result = await GCloudAPIService.projectDashboard(input);

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(onAuthExpired).toHaveBeenCalledTimes(1);
        expect(result).toEqual(unauthorizedBody);
      });

      it('does not fire the callback when the refresh succeeds and the retry is 200', async () => {
        GCloudAPIService.setRefreshTokenString('refresh-token');
        const retryBody = { success: true, errors: [], data: { projects: [] } };
        mockFetch
          .mockResolvedValueOnce({
            status: 401,
            text: () => Promise.resolve(JSON.stringify(unauthorizedBody))
          })
          .mockResolvedValueOnce({
            status: 200,
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  success: true,
                  errors: [],
                  data: { accessToken: 'new-access', refreshTokenString: 'new-refresh' }
                })
              )
          })
          .mockResolvedValueOnce({
            status: 200,
            text: () => Promise.resolve(JSON.stringify(retryBody))
          });

        const result = await GCloudAPIService.projectDashboard(input);

        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(onAuthExpired).not.toHaveBeenCalled();
        expect(result).toEqual(retryBody);
      });

      it('fires the callback when the refresh succeeds but the retry is still 401', async () => {
        GCloudAPIService.setRefreshTokenString('refresh-token');
        mockFetch
          .mockResolvedValueOnce({
            status: 401,
            text: () => Promise.resolve(JSON.stringify(unauthorizedBody))
          })
          .mockResolvedValueOnce({
            status: 200,
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  success: true,
                  errors: [],
                  data: { accessToken: 'new-access', refreshTokenString: 'new-refresh' }
                })
              )
          })
          .mockResolvedValueOnce({
            status: 401,
            text: () => Promise.resolve(JSON.stringify(unauthorizedBody))
          });

        const result = await GCloudAPIService.projectDashboard(input);

        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(onAuthExpired).toHaveBeenCalledTimes(1);
        expect(result).toEqual(unauthorizedBody);
      });

      it('shares one refresh across concurrent 401s instead of expiring the session', async () => {
        GCloudAPIService.setRefreshTokenString('refresh-token');
        const retryBody = { success: true, errors: [], data: { projects: [] } };
        mockFetch
          .mockResolvedValueOnce({
            status: 401,
            text: () => Promise.resolve(JSON.stringify(unauthorizedBody))
          })
          .mockResolvedValueOnce({
            status: 401,
            text: () => Promise.resolve(JSON.stringify(unauthorizedBody))
          })
          .mockResolvedValueOnce({
            status: 200,
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  success: true,
                  errors: [],
                  data: { accessToken: 'new-access', refreshTokenString: 'new-refresh' }
                })
              )
          })
          .mockResolvedValue({
            status: 200,
            text: () => Promise.resolve(JSON.stringify(retryBody))
          });

        const results = await Promise.all([
          GCloudAPIService.projectDashboard(input),
          GCloudAPIService.projectDashboard(input)
        ]);

        // Two 401s, one shared refresh, then two retries. A sixth call means a
        // second refresh went out with the already-rotated token, which fails
        // and expires a session that is actually fine.
        expect(mockFetch).toHaveBeenCalledTimes(5);
        expect(onAuthExpired).not.toHaveBeenCalled();
        expect(results).toEqual([retryBody, retryBody]);
      });
    });
  });
});
