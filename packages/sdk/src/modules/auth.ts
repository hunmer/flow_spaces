import type { HttpClient } from '../client';

export function createAuthApi(http: HttpClient) {
  return {
    login: (password: string): Promise<{ token: string }> =>
      http.post('/api/auth/login', { password }, { noAuth: true }),

  };
}
