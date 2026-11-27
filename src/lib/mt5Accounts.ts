
import {
  apiGet,
  apiPost,
  apiPut,
  type ApiResult,
} from '@/lib/api';
import { isRecord } from '@/lib/guards';

export interface SavedMt5Account {
  accountId: number;
  label: string;
  loginId: string;
  brokerServer: string;
  symbol: string;
  mode: 'demo' | 'live';
  hasStoredPassword: boolean;
}

export interface Mt5CredentialInput {
  loginId: string;
  brokerServer: string;
  symbol: string;
  password: string;
}

interface BackendAccount {
  id: number;
  label: string;
  login: string;
  server: string;
  mode: 'demo' | 'live';
  symbol: string;
  is_deleted: boolean;
}

interface AccountListResponse {
  accounts: BackendAccount[];
}

interface CreateAccountResponse {
  account: BackendAccount;
  ea_token: string;
  ea_token_notice: string;
}

interface UpdateCredentialResponse {
  ok: boolean;
}

function isBackendAccount(value: unknown): value is BackendAccount {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.label === 'string' &&
    typeof value.login === 'string' &&
    typeof value.server === 'string' &&
    (value.mode === 'demo' || value.mode === 'live') &&
    typeof value.symbol === 'string' &&
    typeof value.is_deleted === 'boolean'
  );
}

function isAccountListResponse(
  value: unknown
): value is AccountListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.accounts) &&
    value.accounts.every(isBackendAccount)
  );
}

function isCreateAccountResponse(
  value: unknown
): value is CreateAccountResponse {
  return (
    isRecord(value) &&
    isBackendAccount(value.account) &&
    typeof value.ea_token === 'string' &&
    typeof value.ea_token_notice === 'string'
  );
}

function isUpdateCredentialResponse(
  value: unknown
): value is UpdateCredentialResponse {
  return isRecord(value) && value.ok === true;
}

function toSavedAccount(account: BackendAccount): SavedMt5Account {
  return {
    accountId: account.id,
    label: account.label,
    loginId: account.login,
    brokerServer: account.server,
    symbol: account.symbol,
    mode: account.mode,
    // The backend never returns the stored MT5 password.
    hasStoredPassword: true,
  };
}

export async function fetchMt5Account(
  _licenseKey?: string
): Promise<ApiResult<SavedMt5Account | null>> {
  const result = await apiGet(
    '/api/accounts',
    isAccountListResponse
  );

  if (!result.ok) return result;

  const account = result.data.accounts.find(
    (item) => !item.is_deleted
  );

  if (!account) {
    return { ok: true, data: null };
  }

  return {
    ok: true,
    data: toSavedAccount(account),
  };
}

export async function saveMt5Credentials(
  _licenseKey: string,
  input: Mt5CredentialInput
): Promise<ApiResult<null>> {
  // First check whether this customer already has an account.
  const existingResult = await fetchMt5Account();

  if (!existingResult.ok) {
    return existingResult;
  }

  const existing = existingResult.data;

  if (existing) {
    // The backend's credentials endpoint updates only the password.
    // It does not change the login, server, or trading symbol.
    const detailsMatch =
      existing.loginId === input.loginId &&
      existing.brokerServer === input.brokerServer &&
      existing.symbol === input.symbol;

    if (!detailsMatch) {
      return {
        ok: false,
        message:
          'Your account already exists. The backend currently allows password updates only. Login, server, and symbol cannot be changed here.',
      };
    }

    const updateResult = await apiPut(
      `/api/accounts/${existing.accountId}/credentials`,
      { mt5_password: input.password },
      isUpdateCredentialResponse
    );

    return updateResult.ok
      ? { ok: true, data: null }
      : updateResult;
  }

  // New accounts are created in DEMO mode.
  // Live-account registration is locked by the backend.
  const createResult = await apiPost(
    '/api/accounts',
    {
      label: 'Gold Mobile EA',
      login: input.loginId,
      server: input.brokerServer,
      symbol: input.symbol || 'AUTO',
      mt5_password: input.password,
      mode: 'demo',
      broker: 'Exness',
    },
    isCreateAccountResponse
  );

  if (!createResult.ok) return createResult;

  // The backend returns an EA token once at account creation.
  // The account is created successfully, but this UI does not yet
  // display or store that one-time token. We will handle that in
  // the account-setup screen.
  return { ok: true, data: null };
}
