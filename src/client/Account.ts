import type { PublicUser } from '../shared/contracts';
import { api } from './api';

export type AccountCredentials = {
	email: string;
	password: string;
};

export type AccountRegistration = AccountCredentials & {
	displayName: string;
};

export type AccountProfile = {
	displayName: string;
	age: number;
	weightKg: number;
	heightCm: number;
};

type AccountResponse = {
	user: PublicUser;
	message?: string;
};

export const accountApi = {
	current: () => api<AccountResponse>('/auth/me'),
	register: (details: AccountRegistration) => api<AccountResponse>('/auth/register', details),
	login: (credentials: AccountCredentials) => api<AccountResponse>('/auth/login', credentials),
	updateProfile: (profile: AccountProfile) => api<AccountResponse>('/profile', profile, 'PUT'),
	updateAvatar: (avatarImageData: string | null) => api<AccountResponse>('/profile/avatar', { avatarImageData }, 'PUT'),
	logout: () => api<void>('/auth/logout', {}),
};
