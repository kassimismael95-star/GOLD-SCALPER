
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle, Bot, CheckCircle2, ChevronRight, Eye, EyeOff,
  Gem, House, KeyRound, Layers, Loader2, LockKeyhole, LogOut,
  Plug, Power, RotateCcw, Settings, Square, TrendingUp, Wallet, Zap
} from 'lucide-react';
import { api, logout, restoreSession, saveTokens } from '@/lib/api';
import './index.css';

type Page = 'home' | 'activation' | 'settings';

type Account = {
  id: number;
  label: string;
  broker: string;
  login: string;
  server: string;
  mode: 'demo' | 'live';
  symbol: string;
  desired_state: string;
  actual_state: string;
  is_deleted: boolean;
  last_seen: string | null;
  telemetry: any;
  risk_settings: any;
};

type Plan = {
  code: string;
  amount: number;
  currency: string;
  duration_days: number;
};

type Entitlement = {
  active: boolean;
  code: string | null;
  expires_at: string | null;
  trial_uses: number;
  trial_uses_remaining: number;
};

const money = (value: any) =>
  value === null || value === undefined
    ? '—'
    : Number(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

const time = (value: string | null) =>
  value ? new Date(value).toLocaleString() : '—';

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  secret = false,
  autoComplete = 'off',
  inputMode,
  readOnly = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  secret?: boolean;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'numeric';
  readOnly?: boolean;
}) {
  const [show, setShow] = useState(false);

  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-wrap">
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          type={secret ? (show ? 'text' : 'password') : type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          readOnly={readOnly}
        />
        {secret && (
          <button
            type="button"
            className="eye"
            onClick={() => setShow(!show)}
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        )}
      </div>
    </label>
  );
}

function Message({ text, ok = false }: { text: string; ok?: boolean }) {
  return (
    <div className={`message ${ok ? 'success' : 'error'}`} role={ok ? 'status' : 'alert'}>
      {ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      <span>{text}</span>
    </div>
  );
}

function Btn({
  children,
  onClick,
  kind = 'primary',
  busy = false,
  disabled = false,
  icon
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: 'primary' | 'outline' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      className={`btn ${kind}`}
      onClick={onClick}
      disabled={disabled || busy}
      type="button"
    >
      {busy ? <Loader2 className="spin" size={19} /> : icon}
      {children}
    </button>
  );
}

function Auth({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<
    'login' | 'register' | 'verify' | 'reset' | 'resetConfirm'
  >('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setSuccess(false);

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (mode === 'login' || mode === 'register') {
        if (mode === 'register' && password.length < 12) {
          throw new Error('Password must contain at least 12 characters.');
        }

        const data = await api<any>(
          `/api/auth/${mode === 'login' ? 'login' : 'register'}`,
          'POST',
          { email: cleanEmail, password },
          false
        );

        if (data.access_token) {
          saveTokens(data.access_token, data.refresh_token);
          onAuthed();
        } else if (mode === 'register') {
          setMode('verify');
          setMessage('A verification code has been sent to your email.');
          setSuccess(true);
        } else {
          throw new Error('The server did not return a session.');
        }
      } else if (mode === 'verify') {
        const data = await api<any>(
          '/api/auth/verify-email',
          'POST',
          { email: cleanEmail, code: code.trim() },
          false
        );

        saveTokens(data.access_token, data.refresh_token);
        onAuthed();
      } else if (mode === 'reset') {
        await api(
          '/api/auth/password-reset/request',
          'POST',
          { email: cleanEmail },
          false
        );

        setMode('resetConfirm');
        setMessage('If the account exists, a reset code has been sent.');
        setSuccess(true);
      } else {
        await api(
          '/api/auth/password-reset/confirm',
          'POST',
          {
            email: cleanEmail,
            code: code.trim(),
            new_password: password
          },
          false
        );

        setMode('login');
        setPassword('');
        setCode('');
        setMessage('Password reset successfully. You can sign in now.');
        setSuccess(true);
      }
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === 'login' ? 'Sign In' :
    mode === 'register' ? 'Create Account' :
    mode === 'verify' ? 'Verify Email' :
    mode === 'reset' ? 'Reset Password' :
    'Confirm Password Reset';

  return (
    <div className="auth-screen">
      <div className="brand">
        <span className="brand-icon"><Gem /></span>
        <b>GOLD MOBILE EA</b>
      </div>

      <h1>{title}</h1>
      <p className="muted auth-sub">
        Your MT5 credentials are private to your own account.
      </p>

      <form onSubmit={submit} className="stack">
        <Field
          label="EMAIL"
          value={email}
          onChange={setEmail}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Enter your email"
        />

        {(mode === 'login' || mode === 'register' || mode === 'resetConfirm') && (
          <Field
            label="PASSWORD"
            value={password}
            onChange={setPassword}
            secret
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="At least 12 characters"
          />
        )}

        {(mode === 'verify' || mode === 'resetConfirm') && (
          <Field
            label="VERIFICATION CODE"
            value={code}
            onChange={setCode}
            placeholder="Enter the code"
            inputMode="numeric"
          />
        )}

        <Btn busy={busy}>
          {mode === 'login' ? 'Sign In' :
           mode === 'register' ? 'Create Account' :
           mode === 'verify' ? 'Verify Email' :
           mode === 'reset' ? 'Send Reset Code' :
           'Reset Password'}
        </Btn>
      </form>

      {message && <Message text={message} ok={success} />}

      <div className="auth-links">
        {mode === 'login' && (
          <>
            <button type="button" onClick={() => setMode('register')}>
              New here? Create an account
            </button>
            <button type="button" onClick={() => setMode('reset')}>
              Forgot password?
            </button>
          </>
        )}

        {mode !== 'login' && (
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setMessage('');
            }}
          >
            Back to Sign In
          </button>
        )}

        {mode === 'verify' && (
          <button
            type="button"
            onClick={async () => {
              try {
                await api(
                  '/api/auth/verification/resend',
                  'POST',
                  { email: email.trim().toLowerCase() },
                  false
                );
                setMessage('A new verification code was requested.');
                setSuccess(true);
              } catch (error) {
                setMessage(errorText(error));
                setSuccess(false);
              }
            }}
          >
            Resend verification code
          </button>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  // Customers go to Bot Activation first after signing in.
  const [page, setPage] = useState<Page>('activation');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeOk, setNoticeOk] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [license, setLicense] = useState('');
  const [credentials, setCredentials] = useState({
    label: 'My MT5 Account',
    login: '',
    server: '',
    broker: 'Exness',
    symbol: 'XAUUSD',
    password: '',
    mode: 'demo'
  });
  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');
  const [newToken, setNewToken] = useState('');

  const selected = useMemo(
    () => accounts.find(account => account.id === selectedId) || accounts[0] || null,
    [accounts, selectedId]
  );

  const say = (text: string, ok = false) => {
    setNotice(text);
    setNoticeOk(ok);
  };

  const loadData = useCallback(async () => {
    if (!authenticated) return;

    setLoading(true);
    setError('');

    try {
      const [accountData, licenceData, planData, paymentData] = await Promise.all([
        api<any>('/api/accounts'),
        api<Entitlement>('/api/licences/status'),
        api<any>('/api/plans', 'GET', undefined, false),
        api<any>('/api/dashboard/payments')
      ]);

      const rows: Account[] = (accountData.accounts || [])
        .filter((account: Account) => !account.is_deleted);

      setAccounts(rows);

      setSelectedId(current =>
        current && rows.some(account => account.id === current)
          ? current
          : rows[0]?.id ?? null
      );

      setEntitlement(licenceData);
      setPlans(planData.plans || []);
      setPayments(paymentData.payments || []);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const ok = await restoreSession();
      if (!mounted) return;
      setAuthenticated(ok);
      setChecking(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (authenticated) void loadData();
  }, [authenticated, loadData]);

  useEffect(() => {
    if (!authenticated) return;

    const interval = window.setInterval(() => {
      void loadData();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [authenticated, loadData]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusyAction(key);
    setNotice('');

    try {
      await action();
    } catch (error) {
      say(errorText(error));
    } finally {
      setBusyAction('');
    }
  };

  const activateLicense = () =>
    run('license', async () => {
      const enteredCode = license.trim().toUpperCase();

      const allowedCodes = [
        'BOSSMODE98',
        'BOSSMODE99',
        'BOSSMODE01D',
        'BOSSMODE30D'
      ];

      if (!allowedCodes.includes(enteredCode)) {
        throw new Error('Invalid licence code. Check the code and try again.');
      }

      if (enteredCode === 'BOSSMODE30D') {
        throw new Error(
          'BOSSMODE30D is activated after verified payment. Please use the VIP payment section.'
        );
      }

      const data = await api<any>(
        '/api/licences/activate',
        'POST',
        { code: enteredCode }
      );

      const latest = await api<Entitlement>('/api/licences/status');

      setEntitlement(latest);
      setLicense('');

      say(`License ${data.code || enteredCode} activated successfully.`, true);
    });

  const createAccount = () =>
    run('account', async () => {
      if (!entitlement?.active) {
        throw new Error('Activate your licence before connecting an MT5 account.');
      }

      if (!/^\d+$/.test(credentials.login.trim())) {
        throw new Error('MT5 login ID must contain numbers only.');
      }

      if (!credentials.server.trim()) {
        throw new Error('Enter your broker server.');
      }

      if (!credentials.password) {
        throw new Error('Enter your MT5 password.');
      }

      const data = await api<any>(
        '/api/accounts',
        'POST',
        {
          label: credentials.label.trim(),
          login: credentials.login.trim(),
          server: credentials.server.trim(),
          broker: credentials.broker.trim() || 'Exness',
          symbol: credentials.symbol.trim() || 'XAUUSD',
          mt5_password: credentials.password,
          mode: accountMode
        }
      );

      if (data.ea_token) setNewToken(data.ea_token);

      setCredentials(current => ({ ...current, password: '' }));
      setShowCreate(false);

      say(
        'MT5 account details were submitted to the trading server. Waiting for the execution agent.',
        true
      );

      await loadData();
    });

  const command = (name: string) =>
    run(name, async () => {
      if (!selected) throw new Error('Connect an MT5 account first.');

      if (!entitlement?.active && name === 'START') {
        throw new Error('An active licence is required before starting the bot.');
      }

      const data = await api<any>(
        `/api/accounts/${selected.id}/commands`,
        'POST',
        { command: name, payload: {} }
      );

      say(
        `${name.replace(/_/g, ' ')} command queued. Server status: ${data.status || 'PENDING'}.`,
        true
      );

      await loadData();
    });

  const savePassword = () =>
    run('password', async () => {
      if (!selected) throw new Error('Select an MT5 account first.');

      const password = credentials.password;
      if (!password) throw new Error('Enter the new MT5 password.');

      await api(
        `/api/accounts/${selected.id}/credentials`,
        'PUT',
        { mt5_password: password }
      );

      setCredentials(current => ({ ...current, password: '' }));

      say(
        'Credentials submitted securely. The account may need to reconnect before trading resumes.',
        true
      );

      await loadData();
    });

  const pay = (plan: Plan) =>
    run(plan.code, async () => {
      const data = await api<any>(
        '/api/payments/flutterwave/initialize',
        'POST',
        { plan_code: plan.code, currency: plan.currency }
      );

      if (!data.checkout_url) {
        throw new Error('Payment provider did not return a checkout link.');
      }

      window.location.assign(data.checkout_url);
    });

  const refresh = () =>
    run('refresh', async () => {
      await loadData();
      say('Account information refreshed.', true);
    });

  const doLogout = () =>
    run('logout', async () => {
      await logout();
      setAuthenticated(false);
      setAccounts([]);
      setEntitlement(null);
      setPage('activation');
    });

  if (checking) {
    return (
      <div className="loading-screen">
        <Loader2 className="spin" />
        Loading GOLD MOBILE EA...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="app-frame">
        <Auth
          onAuthed={() => {
            setPage('activation');
            setAuthenticated(true);
          }}
        />
      </div>
    );
  }

  const connected = Boolean(
    selected?.telemetry?.connected_to_broker &&
    selected?.actual_state !== 'STALE'
  );

  const running = selected?.desired_state === 'RUNNING';
  const telemetry = selected?.telemetry;
  const status = selected?.actual_state || 'NO ACCOUNT';
  const hasEntitlement = Boolean(entitlement?.active);

  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon"><Gem /></span>
          <b>GOLD MOBILE EA</b>
        </div>

        <div className="header-actions">
          <button
            className="round-icon"
            onClick={() => void refresh()}
            aria-label="Refresh"
          >
            <RotateCcw size={17} />
          </button>

          <span
            className={`connection-dot ${connected ? 'on' : ''}`}
            title={connected ? 'MT5 connected' : 'MT5 disconnected'}
          >
            <Zap size={17} />
          </span>
        </div>
      </header>

      <main className="main-content">
        {page === 'home' && (
          <section className="stack">
            <h1>GOLD MOBILE EA</h1>

            {error && <Message text={error} />}

            <div className="metric-grid">
              <Metric
                label="MT5 Connection"
                value={!selected ? 'NO ACCOUNT' : loading ? 'CHECKING' : connected ? 'CONNECTED' : 'DISCONNECTED'}
                icon={<Plug />}
                good={connected}
              />

              <Metric
                label="Bot Status"
                value={!selected ? 'NO ACCOUNT' : running ? 'RUNNING' : 'STOPPED'}
                icon={<Bot />}
                good={running}
              />

              <Metric
                label="Balance"
                value={!selected ? 'NO ACCOUNT' : telemetry ? money(telemetry.balance) : 'DATA UNAVAILABLE'}
                icon={<Wallet />}
              />

              <Metric
                label="Equity"
                value={!selected ? 'NO ACCOUNT' : telemetry ? money(telemetry.equity) : 'DATA UNAVAILABLE'}
                icon={<TrendingUp />}
              />

              <Metric
                label="Open Positions"
                value={!selected ? 'NO ACCOUNT' : telemetry ? String(telemetry.open_positions_count) : 'DATA UNAVAILABLE'}
                icon={<Layers />}
                wide
              />
            </div>

            {accounts.length > 1 && (
              <label className="field">
                <span>MT5 ACCOUNT</span>
                <select
                  value={selected?.id ?? ''}
                  onChange={event => setSelectedId(Number(event.target.value))}
                >
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.label} · {account.mode.toUpperCase()} · {account.login}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="stack controls">
              <Btn
                disabled={!selected || !hasEntitlement || running}
                busy={busyAction === 'START'}
                onClick={() => void command('START')}
                icon={<Power size={19} />}
              >
                Start Bot
              </Btn>

              <Btn
                kind="outline"
                disabled={!selected || !running}
                busy={busyAction === 'STOP'}
                onClick={() => void command('STOP')}
                icon={<Square size={18} />}
              >
                Stop Bot
              </Btn>

              <Btn
                kind="danger"
                disabled={!selected}
                busy={busyAction === 'EMERGENCY_STOP'}
                onClick={() => void command('EMERGENCY_STOP')}
                icon={<AlertTriangle size={18} />}
              >
                EMERGENCY HARD RESET
              </Btn>
            </div>

            {!hasEntitlement && (
              <Message text="Activate an eligible licence or verified subscription before starting new trades." />
            )}

            {notice && <Message text={notice} ok={noticeOk} />}

            {newToken && (
              <div className="token-panel">
                <b>One-time EA token</b>
                <p>Copy this token and store it securely. The server only displays it once.</p>
                <code>{newToken}</code>

                <button
                  className="text-button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(newToken);
                    say('EA token copied.', true);
                  }}
                >
                  Copy token
                </button>

                <button className="text-button" onClick={() => setNewToken('')}>
                  Dismiss
                </button>
              </div>
            )}

            <div className="subtle-card">
              <div className="row-between">
                <b>Account status</b>
                <span className={`pill ${connected ? 'pill-green' : ''}`}>{status}</span>
              </div>

              <p className="muted">
                {selected
                  ? `${selected.broker} · ${selected.server} · ${selected.mode.toUpperCase()}`
                  : 'No MT5 account connected'}
              </p>

              <p className="muted small">
                Last update: {time(telemetry?.updated_at || selected?.last_seen || null)}
              </p>
            </div>
          </section>
        )}

        {page === 'activation' && (
          <section className="stack">
            <div className="page-heading">
              <Plug />
              <h1>Bot Activation</h1>
            </div>

            <p className="muted">
              Activate your licence, then connect your MetaTrader 5 account.
            </p>

            <div className={`panel license-panel ${hasEntitlement ? 'active' : ''}`}>
              <div className="row">
                <span className="icon-bubble"><LockKeyhole /></span>
                <div>
                  <h2>{hasEntitlement ? 'License Active' : 'Master License Key'}</h2>
                  <p className="muted">
                    {hasEntitlement
                      ? `Key ${entitlement?.code} is active on your account.`
                      : 'Enter your licence key to continue to MT5 setup.'}
                  </p>
                </div>
              </div>

              {hasEntitlement ? (
                <>
                  <div className="license-meta">
                    <span>STATUS</span>
                    <b>ACTIVE</b>
                    <span>EXPIRES</span>
                    <b>
                      {entitlement?.expires_at
                        ? time(entitlement.expires_at)
                        : 'No expiry shown'}
                    </b>
                  </div>

                  <Btn
                    onClick={() => setPage('home')}
                    icon={<ChevronRight size={18} />}
                  >
                    Continue to Dashboard
                  </Btn>
                </>
              ) : (
                <>
                  <Field
                    label="LICENSE KEY"
                    value={license}
                    onChange={setLicense}
                    placeholder="Enter your license key"
                  />

                  <p className="muted small">
                    Accepted codes: BOSSMODE98, BOSSMODE99, BOSSMODE01D.
                    BOSSMODE30D is activated after verified payment.
                  </p>

                  <Btn
                    busy={busyAction === 'license'}
                    disabled={!license.trim()}
                    onClick={() => void activateLicense()}
                    icon={<KeyRound size={18} />}
                  >
                    Unlock
                  </Btn>
                </>
              )}
            </div>

            {entitlement && (
              <div className="subtle-card">
                <b>Trial availability</b>
                <p className="muted">
                  {entitlement.trial_uses_remaining} trial uses remaining of 2.
                </p>
              </div>
            )}

            {hasEntitlement && (
              <>
                <div className="row-between">
                  <h2>MT5 Connection</h2>
                  <span className={`pill ${connected ? 'pill-green' : ''}`}>
                    {connected ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </div>

                {accounts.length > 1 && (
                  <label className="field">
                    <span>SELECT MT5 ACCOUNT</span>
                    <select
                      value={selected?.id ?? ''}
                      onChange={event => setSelectedId(Number(event.target.value))}
                    >
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.label} · {account.mode.toUpperCase()} · {account.login}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {selected ? (
                  <div className={`panel connection-panel ${connected ? 'active' : ''}`}>
                    <div className="row">
                      <span className="icon-bubble"><Zap /></span>
                      <div>
                        <h2>{connected ? 'Active MT5 Connection' : 'MT5 account saved'}</h2>
                        <p className="muted">
                          {connected
                            ? 'Broker heartbeat confirms connection.'
                            : 'Waiting for a live broker heartbeat.'}
                        </p>
                      </div>
                    </div>

                    <Info label="LOGIN ID" value={selected.login} />
                    <Info label="BROKER SERVER" value={selected.server} />
                    <Info label="PASSWORD" value="•••••••• (encrypted on server)" />
                    <Info label="LAST UPDATED" value={time(telemetry?.updated_at || selected.last_seen)} />
                    <Info label="ACCOUNT MODE" value={selected.mode.toUpperCase()} />
                  </div>
                ) : (
                  <div className="panel">
                    <h2>No MT5 account connected</h2>
                    <p className="muted">
                      Create an account connection below. Your MT5 password is
                      submitted to the backend and should never be displayed again.
                    </p>
                  </div>
                )}

                <div className="divider" />

                <h2>{selected && !showCreate ? 'Update Credentials' : 'Connect an MT5 Account'}</h2>

                {selected && !showCreate && (
                  <>
                    <p className="muted small">
                      Login, server and symbol are fixed at account creation.
                      To connect another account, add it separately.
                    </p>

                    <Btn kind="outline" onClick={() => setShowCreate(true)}>
                      Add another MT5 account
                    </Btn>

                    <div className="panel stack">
                      <Field label="LOGIN ID" value={selected.login} onChange={() => {}} readOnly />
                      <Field label="BROKER SERVER" value={selected.server} onChange={() => {}} readOnly />
                      <Field label="SYMBOL" value={selected.symbol} onChange={() => {}} readOnly />

                      <Field
                        label="NEW PASSWORD"
                        value={credentials.password}
                        onChange={value => setCredentials(current => ({ ...current, password: value }))}
                        secret
                        placeholder="Enter new MT5 password"
                      />

                      <Btn
                        onClick={() => void savePassword()}
                        busy={busyAction === 'password'}
                      >
                        Update Credentials
                      </Btn>
                    </div>
                  </>
                )}

                {(!selected || showCreate) && (
                  <div className="panel stack">
                    <Field
                      label="ACCOUNT LABEL"
                      value={credentials.label}
                      onChange={value => setCredentials(current => ({ ...current, label: value }))}
                      placeholder="My MT5 Account"
                    />

                    <Field
                      label="LOGIN ID"
                      value={credentials.login}
                      onChange={value => setCredentials(current => ({ ...current, login: value }))}
                      inputMode="numeric"
                      placeholder="Enter MT5 login ID"
                    />

                    <Field
                      label="BROKER SERVER"
                      value={credentials.server}
                      onChange={value => setCredentials(current => ({ ...current, server: value }))}
                      placeholder="e.g. Exness-MT5Trial"
                    />

                    <Field
                      label="BROKER"
                      value={credentials.broker}
                      onChange={value => setCredentials(current => ({ ...current, broker: value }))}
                    />

                    <Field
                      label="SYMBOL"
                      value={credentials.symbol}
                      onChange={value => setCredentials(current => ({ ...current, symbol: value }))}
                      placeholder="XAUUSD"
                    />

                    <div className="field">
                      <span>ACCOUNT TYPE</span>
                      <div className="segmented">
                        <button
                          type="button"
                          className={accountMode === 'demo' ? 'selected' : ''}
                          onClick={() => setAccountMode('demo')}
                        >
                          DEMO
                        </button>

                        <button
                          type="button"
                          className={accountMode === 'live' ? 'selected' : ''}
                          onClick={() => setAccountMode('live')}
                        >
                          REAL
                        </button>
                      </div>
                    </div>

                    {accountMode === 'live' && (
                      <Message text="Real account creation is subject to the backend's live-trading authorization. Selecting REAL here does not bypass that server-side control." />
                    )}

                    <Field
                      label="MT5 PASSWORD"
                      value={credentials.password}
                      onChange={value => setCredentials(current => ({ ...current, password: value }))}
                      secret
                      placeholder="Enter MT5 trading password"
                    />

                    <Btn
                      busy={busyAction === 'account'}
                      onClick={() => void createAccount()}
                    >
                      Connect MT5 Account
                    </Btn>

                    {selected && (
                      <Btn kind="outline" onClick={() => setShowCreate(false)}>
                        Cancel
                      </Btn>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="divider" />

            <h2>VIP Plans & Payment</h2>
            <p className="muted small">
              Checkout is created by your backend. Paid access is activated only
              after Flutterwave payment verification.
            </p>

            <div className="plans">
              {plans.map(plan => (
                <div className="plan-card" key={plan.code}>
                  <div className="row-between">
                    <b>{plan.duration_days}-Day VIP</b>
                    <span className="pill">{plan.code}</span>
                  </div>

                  <div className="price">
                    {plan.currency} {plan.amount}
                  </div>

                  <p className="muted small">
                    {plan.duration_days} days of subscription access
                  </p>

                  <Btn
                    busy={busyAction === plan.code}
                    onClick={() => void pay(plan)}
                  >
                    Pay with Flutterwave <ChevronRight size={17} />
                  </Btn>
                </div>
              ))}
            </div>

            <div className="subtle-card">
              <div className="row-between">
                <b>Payment history</b>
                <button className="text-button" onClick={() => void loadData()}>
                  Refresh
                </button>
              </div>

              {payments.length ? (
                payments.map(payment => (
                  <div className="history-row" key={payment.tx_ref}>
                    <div>
                      <b>{payment.plan_code}</b>
                      <p className="muted small">{time(payment.created_at)}</p>
                    </div>

                    <div className="history-right">
                      <b>{payment.currency} {payment.amount}</b>
                      <span className={`pill ${payment.status === 'SUCCESS' ? 'pill-green' : ''}`}>
                        {payment.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted small">No payments found yet.</p>
              )}
            </div>

            {notice && <Message text={notice} ok={noticeOk} />}
          </section>
        )}

        {page === 'settings' && (
          <section className="stack">
            <h1>Settings</h1>

            <div className="panel stack">
              <h3>ACCOUNT</h3>
              <Info label="Connection" value={connected ? 'CONNECTED' : 'DISCONNECTED'} />
              <Info label="Broker server" value={selected?.server || '—'} />
              <Info label="MT5 login ID" value={selected?.login || '—'} />
              <Info label="Last updated" value={time(selected?.telemetry?.updated_at || selected?.last_seen || null)} />
              <Info label="Account mode" value={selected?.mode?.toUpperCase() || '—'} />
            </div>

            <div className="panel stack">
              <h3>RISK MANAGEMENT</h3>
              <p className="muted">
                Risk limits can be viewed and changed once the server provides them.
              </p>
            </div>

            <div className="panel stack">
              <h3>SUBSCRIPTION</h3>
              <Info label="Entitlement" value={entitlement?.code || 'NONE'} />
              <Info label="Status" value={entitlement?.active ? 'ACTIVE' : 'INACTIVE'} />
              <Info label="Expiry" value={time(entitlement?.expires_at || null)} />
            </div>

            <Btn
              kind="outline"
              onClick={() => void doLogout()}
              busy={busyAction === 'logout'}
              icon={<LogOut size={18} />}
            >
              Logout
            </Btn>

            {notice && <Message text={notice} ok={noticeOk} />}
          </section>
        )}
      </main>

      <nav className="bottom-nav">
        <button
          className={page === 'home' ? 'active' : ''}
          onClick={() => setPage('home')}
        >
          <House />
          <span>Home</span>
        </button>

        <button
          className={page === 'activation' ? 'active' : ''}
          onClick={() => setPage('activation')}
        >
          <Plug />
          <span>Bot Activation</span>
        </button>

        <button
          className={page === 'settings' ? 'active' : ''}
          onClick={() => setPage('settings')}
        >
          <Settings />
          <span>Settings</span>
        </button>

        <div className="nav-brand">GOLD MOBILE EA</div>
      </nav>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  good = false,
  wide = false
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  good?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`metric ${wide ? 'wide' : ''}`}>
      <div className="metric-top">
        <span>{label}</span>
        {icon}
      </div>
      <b className={good ? 'good' : ''}>{value}</b>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
