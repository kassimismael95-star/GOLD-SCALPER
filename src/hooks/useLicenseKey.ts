
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { InfoRow, SettingsSection } from '@/components/settings/SettingsSection';
import Button from '@/components/ui/Button';
import StatusMessage, { type Feedback } from '@/components/ui/StatusMessage';
import type { ResourceState } from '@/hooks/useResource';
import { formatTime } from '@/lib/format';
import {
  apiPost,
  clearAuthTokens,
  getRefreshToken,
} from '@/lib/api';
import { isRecord } from '@/lib/guards';
import type { Mt5Status } from '@/types/api';

interface SettingsPageProps {
  connection: ResourceState<Mt5Status>;
}

export default function SettingsPage({ connection }: SettingsPageProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const logout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setFeedback(null);

    const refreshToken = getRefreshToken();

    const result = await apiPost(
      '/api/auth/logout',
      { refresh_token: refreshToken },
      (value): value is { ok: boolean } =>
        isRecord(value) && value.ok === true
    );

    clearAuthTokens();
    window.dispatchEvent(new Event('gold-auth-changed'));

    setLoggingOut(false);

    if (!result.ok) {
      setFeedback({
        tone: 'error',
        text: 'Signed out on this device. Server-side logout could not be confirmed.',
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-bold leading-[1.2] tracking-tight text-ink">
        Settings
      </h1>

      {connection.phase === 'loading' && (
        <p className="text-[15px] text-ink-muted">Loading settings...</p>
      )}

      {connection.phase === 'error' && (
        <div className="flex flex-col gap-2 rounded-[16px] border border-divider bg-card p-5">
          <p className="text-[16px] font-bold text-ink">DATA UNAVAILABLE</p>
          <p className="text-[14px] leading-[150%] text-ink-muted">
            {connection.message}
          </p>
        </div>
      )}

      {connection.phase === 'ready' && (
        <SettingsSection title="ACCOUNT">
          <InfoRow
            label="Connection"
            value={connection.data.connected ? 'CONNECTED' : 'DISCONNECTED'}
          />
          <InfoRow
            label="Broker server"
            value={connection.data.server ?? '—'}
          />
          <InfoRow
            label="MT5 login ID"
            value={connection.data.login ?? '—'}
          />
          <InfoRow
            label="Last updated"
            value={formatTime(connection.data.lastUpdated)}
          />
        </SettingsSection>
      )}

      <SettingsSection title="RISK MANAGEMENT">
        <p className="text-[14px] leading-[150%] text-ink-muted">
          Risk limits can be viewed and changed once the server provides them.
          They are not available yet.
        </p>
      </SettingsSection>

      <Button
        variant="outline"
        icon={<LogOut className="h-5 w-5" aria-hidden="true" />}
        loading={loggingOut}
        onClick={logout}
      >
        Logout
      </Button>

      {feedback && <StatusMessage feedback={feedback} />}
    </div>
  );
}
