
import { apiPost, type ApiResult } from '@/lib/api';
import { isRecord } from '@/lib/guards';

export type BotCommand = 'START' | 'STOP';

interface CommandResponse {
  command_id: number;
  status: string;
  desired_state: string;
}

function isCommandResponse(value: unknown): value is CommandResponse {
  return (
    isRecord(value) &&
    typeof value.command_id === 'number' &&
    typeof value.status === 'string' &&
    typeof value.desired_state === 'string'
  );
}

export async function sendBotCommand(
  accountId: number,
  command: BotCommand
): Promise<ApiResult<CommandResponse>> {
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return {
      ok: false,
      message: 'A valid MT5 account ID is required.',
    };
  }

  return apiPost(
    `/api/accounts/${accountId}/commands`,
    {
      command,
      payload: {},
    },
    isCommandResponse
  );
}
