import { authResponseSchema, type LoginInput, type RegisterInput } from '@tecleo/shared';
import { z } from 'zod';

import { fetchApi } from '@/lib/api';

import { useAuthStore } from './auth-store';

export async function login(input: LoginInput) {
  const session = await fetchApi('/auth/login', authResponseSchema, {
    method: 'POST',
    body: input,
  });
  useAuthStore.getState().setSession(session);
  return session;
}

export async function register(input: RegisterInput) {
  const session = await fetchApi('/auth/register', authResponseSchema, {
    method: 'POST',
    body: input,
  });
  useAuthStore.getState().setSession(session);
  return session;
}

export async function logout() {
  try {
    await fetchApi('/auth/logout', z.null(), { method: 'POST' });
  } finally {
    useAuthStore.getState().clear();
  }
}
