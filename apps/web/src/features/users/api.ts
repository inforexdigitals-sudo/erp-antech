import { api } from '../../lib/api-client';
import type { CurrentUserProfile } from '../../stores/auth-store';

export function getMe(): Promise<CurrentUserProfile> {
  return api.get<CurrentUserProfile>('/users/me');
}
