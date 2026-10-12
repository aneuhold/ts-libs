import { ProjectName } from '@aneuhold/core-ts-db-lib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APIErrorCode } from '../../types/APIErrorCode.js';
import type { AuthValidateUserInput } from '../../types/AuthValidateUser.js';
import type { ProjectDashboardInput } from '../../types/project/dashboard/ProjectDashboard.js';
import GCloudAPIService from './GCloudAPI.service.js';

/**
 * Creates a promise that never settles on its own and rejects with the abort
 * reason once the signal aborts, the way fetch and body reads behave.
 *
 * @param signal - The abort signal of the request.
 */
const rejectOnAbort = (signal: AbortSignal | null | undefined): Promise<never> =>
  new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => {
      const reason: unknown = signal.reason;
      reject(reason instanceof Error ? reason : new Error('Aborted'));
    });
  });

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

        const mockResponse = { success: true, data: {}, errors: [], statusCode: 200 };
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
          errors: [],
          statusCode: 200
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
          errors: [],
          statusCode: 200
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

      describe('response decoding', () => {
        const input: ProjectDashboardInput = { options: {} };

        it('should use DateService.dateReviver to parse dates', async () => {
          const dateStr = '2023-10-27T10:00:00.000Z';
          const mockResponse = {
            success: true,
            data: {
              createdAt: dateStr,
              name: 'Test Project'
            },
            errors: [],
            statusCode: 200
          };
          mockFetch.mockResolvedValue({
            text: () => Promise.resolve(JSON.stringify(mockResponse))
          });

          const result = await GCloudAPIService.projectDashboard(input);
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const data = result.data as unknown as { createdAt: Date; name: string };

          expect(data).toBeDefined();
          expect(data.createdAt).toBeInstanceOf(Date);
          expect(data.createdAt.toISOString()).toBe(dateStr);
          expect(data.name).toBe('Test Project');
        });

        it('should handle JSON parse errors gracefully', async () => {
          mockFetch.mockResolvedValue({
            status: 200,
            text: () => Promise.resolve('Invalid JSON')
          });

          const result = await GCloudAPIService.projectDashboard(input);

          expect(result.success).toBe(false);
          expect(result.errors[0]).toBe('Failed to decode response');
          expect(result.errorCode).toBe(APIErrorCode.InvalidAPIResponseShape);
        });

        it('keeps the statusCode of a valid body', async () => {
          const body = { success: true, errors: [], data: {}, statusCode: 200 };
          mockFetch.mockResolvedValue({
            status: 200,
            text: () => Promise.resolve(JSON.stringify(body))
          });

          const result = await GCloudAPIService.projectDashboard(input);

          expect(result).toEqual(body);
        });

        it('takes the statusCode from the HTTP status for an unparseable 5xx body', async () => {
          mockFetch.mockResolvedValue({
            status: 503,
            text: () => Promise.resolve('Service Unavailable')
          });

          const result = await GCloudAPIService.projectDashboard(input);

          expect(result.success).toBe(false);
          expect(result.statusCode).toBe(503);
          expect(result.errorCode).toBe(APIErrorCode.InvalidAPIResponseShape);
        });

        it('fails the shape check for a body missing statusCode', async () => {
          mockFetch.mockResolvedValue({
            status: 200,
            text: () => Promise.resolve(JSON.stringify({ success: true, errors: [], data: {} }))
          });

          const result = await GCloudAPIService.projectDashboard(input);

          expect(result.success).toBe(false);
          expect(result.statusCode).toBe(200);
          expect(result.errorCode).toBe(APIErrorCode.InvalidAPIResponseShape);
          expect(result.errors[0]).toBe('Response did not match the expected APIResponse shape');
        });

        it('returns InvalidAPIResponseShape when the body fails to decode', async () => {
          mockFetch.mockResolvedValue({
            status: 200,
            text: () => Promise.reject(new TypeError('Decoding failed'))
          });

          const result = await GCloudAPIService.projectDashboard(input);

          expect(result.success).toBe(false);
          expect(result.statusCode).toBe(200);
          expect(result.errorCode).toBe(APIErrorCode.InvalidAPIResponseShape);
        });

        it('still decodes an errorCode outside the enum', async () => {
          const body = {
            success: false,
            errors: ['Something new'],
            data: {},
            statusCode: 400,
            errorCode: 'SomeFutureCode'
          };
          mockFetch.mockResolvedValue({
            status: 400,
            text: () => Promise.resolve(JSON.stringify(body))
          });

          const result = await GCloudAPIService.projectDashboard(input);

          expect(result).toEqual(body);
        });
      });

      describe('transport failures', () => {
        afterEach(() => {
          vi.useRealTimers();
        });

        it('should handle fetch errors', async () => {
          mockFetch.mockRejectedValue(new Error('Network error'));

          const input: ProjectDashboardInput = {
            options: {}
          };
          await expect(GCloudAPIService.projectDashboard(input)).rejects.toThrow('Network error');
        });

        it('rejects a request that never resolves', async () => {
          vi.useFakeTimers();
          mockFetch.mockImplementation((_url: string, init: RequestInit) =>
            rejectOnAbort(init.signal)
          );

          const resultPromise = GCloudAPIService.projectDashboard({ options: {} });
          const assertion = expect(resultPromise).rejects.toThrow('timed out');
          await vi.advanceTimersByTimeAsync(30_000);

          await assertion;
        });

        it('rejects a request whose body never finishes', async () => {
          vi.useFakeTimers();
          mockFetch.mockImplementation((_url: string, init: RequestInit) =>
            Promise.resolve({
              status: 200,
              text: () => rejectOnAbort(init.signal)
            })
          );

          const resultPromise = GCloudAPIService.projectDashboard({ options: {} });
          const assertion = expect(resultPromise).rejects.toThrow('timed out');
          await vi.advanceTimersByTimeAsync(30_000);

          await assertion;
        });
      });
    });

    describe('setOnAuthExpired', () => {
      const onAuthExpired = vi.fn();
      const input: ProjectDashboardInput = { options: {} };
      const unauthorizedBody = {
        success: false,
        errors: ['Unauthorized'],
        data: {},
        statusCode: 401,
        errorCode: APIErrorCode.Unauthorized
      };

      beforeEach(() => {
        GCloudAPIService.setOnAuthExpired(onAuthExpired);
      });

      afterEach(() => {
        GCloudAPIService.setOnAuthExpired(null);
        vi.useRealTimers();
      });

      it('treats a 401 whose body is not an APIResponse as unauthorized', async () => {
        mockFetch.mockResolvedValue({
          status: 401,
          text: () => Promise.resolve('<html>Unauthorized</html>')
        });

        const result = await GCloudAPIService.projectDashboard(input);

        expect(onAuthExpired).toHaveBeenCalledTimes(1);
        expect(result.statusCode).toBe(401);
        expect(result.errorCode).toBe(APIErrorCode.InvalidAPIResponseShape);
      });

      it('rejects when the refresh times out and starts a fresh refresh on the next 401', async () => {
        vi.useFakeTimers();
        GCloudAPIService.setRefreshTokenString('refresh-token');
        mockFetch
          .mockResolvedValueOnce({
            status: 401,
            text: () => Promise.resolve(JSON.stringify(unauthorizedBody))
          })
          .mockImplementationOnce((_url: string, init: RequestInit) => rejectOnAbort(init.signal))
          .mockResolvedValue({
            status: 401,
            text: () => Promise.resolve(JSON.stringify(unauthorizedBody))
          });

        const resultPromise = GCloudAPIService.projectDashboard(input);
        const assertion = expect(resultPromise).rejects.toThrow('timed out');
        await vi.advanceTimersByTimeAsync(30_000);
        await assertion;

        // The second call gets a 401, then a new refresh attempt (also 401).
        await GCloudAPIService.projectDashboard(input);
        expect(mockFetch).toHaveBeenCalledTimes(4);
        expect(mockFetch).toHaveBeenLastCalledWith(
          'https://test-url.com/auth/refresh',
          expect.any(Object)
        );
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
                JSON.stringify({
                  success: false,
                  errors: ['Invalid refresh token'],
                  data: {},
                  statusCode: 401,
                  errorCode: APIErrorCode.InvalidRefreshToken
                })
              )
          });

        const result = await GCloudAPIService.projectDashboard(input);

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(onAuthExpired).toHaveBeenCalledTimes(1);
        expect(result).toEqual(unauthorizedBody);
      });

      it('does not fire the callback when the refresh succeeds and the retry is 200', async () => {
        GCloudAPIService.setRefreshTokenString('refresh-token');
        const retryBody = { success: true, errors: [], data: { projects: [] }, statusCode: 200 };
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
                  data: { accessToken: 'new-access', refreshTokenString: 'new-refresh' },
                  statusCode: 200
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
                  data: { accessToken: 'new-access', refreshTokenString: 'new-refresh' },
                  statusCode: 200
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
        const retryBody = { success: true, errors: [], data: { projects: [] }, statusCode: 200 };
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
                  data: { accessToken: 'new-access', refreshTokenString: 'new-refresh' },
                  statusCode: 200
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
