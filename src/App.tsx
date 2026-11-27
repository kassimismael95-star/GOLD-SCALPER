import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  Gem,
  House,
  KeyRound,
  Layers,
  Loader2,
  LockKeyhole,
  LogOut,
  Plug,
  Power,
  RotateCcw,
  Settings,
  Square,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';

import { api, logout, restoreSession, saveTokens } from '@/lib/api';
import './index.css';

type Page = 'activation' | 'home' | 'settings';

type Account = {
  id: string | number;
  label: string;
  broker: string;
  login: string;
  server: string;
  mode: 'demo' | 'live';
  symbol: string;
  desired_state?: string;
  actual_state?: string;
  is_deleted?: boolean;
  last_seen?: string | null;
  telemetry?: {
    connected_to_broker?: boolean;
    balance?: number;
    equity?: number;
    open_positions_count?: number;
    updated_at?: string;
  };
};

type Entitlement = {
  active: boolean;
  code: string | null;
  expires_at: string | null;
  trial_uses?: number;
  trial_uses_remaining?: number;
};

type Credentials = {
  label: string;
  login: string;
  server: string;
  broker: string;
  symbol: string;
  password: string;
};

const money = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—';
};

const formatTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : '—';

const getError = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  secret = false,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  secret?: boolean;
  inputMode?: 'text' | 'email' | 'numeric';
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="field">
      <span>{label}</span>

      <div className="field-wrap">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={secret ? (visible ? 'text' : 'password') : type}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={secret ? 'new-password' : 'off'}
        />

        {secret && (
          <button
            type="button"
            className="eye"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        )}
      </div>
    </label>
  );
}

function Message({
  text,
  ok = false,
}: {
  text: string;
  ok?: boolean;
}) {
  return (
    <div
      className={`message ${ok ? 'success' : 'error'}`}
      role={ok ? 'status' : 'alert'}
    >
      {ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      <span>{text}</span>
    </div>
  );
}

function Button({
  children,
  onClick,
  kind = 'primary',
  busy = false,
  disabled = false,
  icon,
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
      type="button"
      className={`btn ${kind}`}
      onClick={onClick}
      disabled={disabled || busy}
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

    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (mode === 'login' || mode === 'register') {
        if (mode === 'register' && password.length < 12) {
          throw new Error('Password must contain at least 12 characters.');
        }

        const result = await api<any>(
          `/api/auth/${mode === 'login' ? 'login' : 'register'}`,
          'POST',
          {
            email: normalizedEmail,
            password,
          },
          false
        );

        if (result.access_token) {
          saveTokens(result.access_token, result.refresh_token);
          onAuthed();
        } else if (mode === 'register') {
          setMode('verify');
          setMessage('Check your email for the verification code.');
          setSuccess(true);
        } else {
          throw new Error('The server did not return a login session.');
        }
      } else if (mode === 'verify') {
        const result = await api<any>(
          '/api/auth/verify-email',
          'POST',
          {
            email: normalizedEmail,
            code: code.trim(),
          },
          false
        );

        saveTokens(result.access_token, result.refresh_token);
        onAuthed();
      } else if (mode === 'reset') {
        await api(
          '/api/auth/password-reset/request',
          'POST',
          { email: normalizedEmail },
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
            email: normalizedEmail,
            code: code.trim(),
            new_password: password,
          },
          false
        );

        setMode('login');
        setMessage('Password reset. You can now sign in.');
        setSuccess(true);
      }
    } catch (error) {
      setMessage(getError(error));
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === 'login'
      ? 'Sign In'
      : mode === 'register'
        ? 'Create Account'
        : mode === 'verify'
          ? 'Verify Email'
          : mode === 'reset'
            ? 'Reset Password'
            : 'Confirm Password Reset';

  return (
    <div className="auth-screen">
      <div className="brand">
        <span className="brand-icon">
          <Gem />
        </span>
        <b>GOLD MOBILE EA</b>
      </div>

      <h1>{title}</h1>
      <p className="muted auth-sub">
        Secure access to your personal MT5 control panel.
      </p>

      <form onSubmit={submit} className="stack">
        <Field
          label="EMAIL"
          value={email}
          onChange={setEmail}
          type="email"
          inputMode="email"
          placeholder="Enter your email"
        />

        {(mode === 'login' ||
          mode === 'register' ||
          mode === 'resetConfirm') && (
          <Field
            label="PASSWORD"
            value={password}
            onChange={setPassword}
            secret
            placeholder="At least 12 characters"
          />
        )}

        {(mode === 'verify' || mode === 'resetConfirm') && (
          <Field
            label="VERIFICATION CODE"
            value={code}
            onChange={setCode}
            placeholder="Enter the code from your email"
            inputMode="numeric"
          />
        )}

        <button className="btn primary" type="submit" disabled={busy}>
          {busy && <Loader2 className="spin" size={19} />}

          {mode === 'login'
            ? 'Sign In'
            : mode === 'register'
              ? 'Create Account'
              : mode === 'verify'
                ? 'Verify Email'
                : mode === 'reset'
                  ? 'Send Reset Code'
                  : 'Reset Password'}
        </button>
      </form>

      {message && <Message text={message} ok={success} />}

      <div className="auth-links">
        {mode === 'login' && (
          <>
            <button onClick={() => setMode('register')}>
              New here? Create an account
            </button>
            <button onClick={() => setMode('reset')}>
              Forgot password?
            </button>
          </>
        )}

        {mode !== 'login' && (
          <button
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
                setMessage(getError(error));
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

  const [page, setPage] = useState<Page>('activation');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);

  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeOk, setNoticeOk] = useState(false);
  const [busyAction, setBusyAction] = useState('');

  const [license, setLicense] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newToken, setNewToken] = useState('');

  const [accountMode, setAccountMode] = useState<'demo' | 'live'>('demo');

  const [credentials, setCredentials] = useState<Credentials>(() => ({
    label: 'My MT5 Account',
    login: localStorage.getItem('gold_mt5_login') || '',
    server: localStorage.getItem('gold_mt5_server') || '',
    broker: 'Exness',
    symbol: localStorage.getItem('gold_mt5_symbol') || 'XAUUSD',
    password: '',
  }));

  const selected = useMemo(
    () => accounts.find((account) => String(account.id) === String(selectedId))
      || accounts[0]
      || null,
    [accounts, selectedId]
  );

  const hasEntitlement = Boolean(entitlement?.active);

  const say = (text: string, ok = false) => {
    setNotice(text);
    setNoticeOk(ok);
  };

  const loadData = useCallback(async () => {
    if (!authenticated) return;

    setLoading(true);
    setError('');

    try {
      const [accountResult, licenceResult] = await Promise.all([
        api<any>('/api/accounts'),
        api<Entitlement>('/api/licences/status'),
      ]);

      const rows: Account[] = (accountResult.accounts || []).filter(
        (account: Account) => !account.is_deleted
      );

      setAccounts(rows);

      setSelectedId((current) => {
        if (
          current !== null &&
          rows.some((account) => String(account.id) === String(current))
        ) {
          return current;
        }

        return rows[0]?.id ?? null;
      });

      setEntitlement(licenceResult);

      if (licenceResult.active) {
        setPage((current) =>
          current === 'activation' ? 'activation' : current
        );
      } else {
        setPage('activation');
      }
    } catch (error) {
      setError(getError(error));
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    let alive = true;

    (async () => {
      const valid = await restoreSession();

      if (!alive) return;

      setAuthenticated(valid);
      setChecking(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (authenticated) {
      void loadData();
    }
  }, [authenticated, loadData]);

  useEffect(() => {
    if (!authenticated) return;

    const interval = window.setInterval(() => {
      void loadData();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [authenticated, loadData]);

  const run = async (
    key: string,
    action: () => Promise<void>
  ) => {
    setBusyAction(key);
    setNotice('');

    try {
      await action();
    } catch (error) {
      say(getError(error));
    } finally {
      setBusyAction('');
    }
  };

  const activateLicense = () =>
    run('license', async () => {
      const code = license.trim().toUpperCase();

      if (!code) {
        throw new Error('Enter your license key.');
      }

      if (code === 'BOSSMODE30D') {
        const result = await api<any>(
          '/api/payments/flutterwave/initialize',
          'POST',
          {
            plan_code: 'BOSSMODE30D',
          }
        );

        if (!result.checkout_url) {
          throw new Error(
            'The payment server did not return a checkout link.'
          );
        }

        window.location.assign(result.checkout_url);
        return;
      }

      if (
        !['BOSSMODE98', 'BOSSMODE99', 'BOSSMODE01D'].includes(code)
      ) {
        throw new Error('This license key is not recognized.');
      }

      const result = await api<any>(
        '/api/licences/activate',
        'POST',
        { code }
      );

      if (result.active === false) {
        throw new Error('The server did not confirm an active license.');
      }

      setLicense('');

      await loadData();

      say(
        `License ${result.code || code} was accepted by the server.`,
        true
      );
    });

  const createAccount = () =>
    run('account', async () => {
      const login = credentials.login.trim();
      const server = credentials.server.trim();
      const password = credentials.password;

      if (!hasEntitlement) {
        throw new Error('Activate a license before connecting MT5.');
      }

      if (!/^\d+$/.test(login)) {
        throw new Error('MT5 login ID must contain numbers only.');
      }

      if (!server) {
        throw new Error('Enter your broker server.');
      }

      if (!password) {
        throw new Error('Enter your MT5 trading password.');
      }

      const result = await api<any>('/api/accounts', 'POST', {
        label: credentials.label.trim() || 'My MT5 Account',
        login,
        server,
        broker: credentials.broker.trim() || 'Exness',
        symbol: credentials.symbol.trim() || 'XAUUSD',
        mt5_password: password,
        mode: accountMode,
      });

      if (result.ea_token) {
        setNewToken(result.ea_token);
      }

      localStorage.setItem('gold_mt5_login', login);
      localStorage.setItem('gold_mt5_server', server);
      localStorage.setItem(
        'gold_mt5_symbol',
        credentials.symbol.trim() || 'XAUUSD'
      );

      setCredentials((current) => ({
        ...current,
        password: '',
      }));

      setShowCreate(false);

      await loadData();

      say(
        'The MT5 account details were submitted to the backend.',
        true
      );
    });

  const savePassword = () =>
    run('password', async () => {
      if (!selected) {
        throw new Error('Select an MT5 account first.');
      }

      if (!credentials.password) {
        throw new Error('Enter the new MT5 password.');
      }

      await api(
        `/api/accounts/${selected.id}/credentials`,
        'PUT',
        {
          mt5_password: credentials.password,
        }
      );

      setCredentials((current) => ({
        ...current,
        password: '',
      }));

      say('The password update request was accepted by the server.', true);

      await loadData();
    });

  const command = (name: string) =>
    run(name, async () => {
      if (!selected) {
        throw new Error('Connect an MT5 account first.');
      }

      if (name === 'START' && !hasEntitlement) {
        throw new Error('An active license is required to start the bot.');
      }

      const result = await api<any>(
        `/api/accounts/${selected.id}/commands`,
        'POST',
        {
          command: name,
          payload: {},
        }
      );

      say(
        `${name.replace(/_/g, ' ')} request sent. Server status: ${
          result.status || 'PENDING'
        }.`,
        true
      );

      await loadData();
    });

  const doLogout = () =>
    run('logout', async () => {
      await logout();

      setAuthenticated(false);
      setAccounts([]);
      setEntitlement(null);
      setSelectedId(null);
      setPage('activation');
    });

  const refresh = () =>
    run('refresh', async () => {
      await loadData();
      say('Information refreshed.', true);
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
            setAuthenticated(true);
            setPage('activation');
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

  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">
            <Gem />
          </span>
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
        {page === 'activation' && (
          <section className="stack">
            <div className="page-heading">
              <Plug />
              <h1>Account Activation</h1>
            </div>

            <p className="muted">
              Activate your license before connecting your MT5 account.
            </p>

            {error && <Message text={error} />}
            {notice && <Message text={notice} ok={noticeOk} />}

            <div className={`panel license-panel ${hasEntitlement ? 'active' : ''}`}>
              <div className="row">
                <span className="icon-bubble">
                  <LockKeyhole />
                </span>

                <div>
                  <h2>{hasEntitlement ? 'License Active' : 'Enter License Key'}</h2>

                  <p className="muted">
                    {hasEntitlement
                      ? `Your ${entitlement?.code || 'license'} is active.`
                      : 'Enter your assigned VIP key, trial key, or paid subscription key.'}
                  </p>
                </div>
              </div>

              {hasEntitlement ? (
                <>
                  <div className="license-meta">
                    <span>STATUS</span>
                    <b>ACTIVE</b>

                    <span>LICENSE</span>
                    <b>{entitlement?.code || 'ACTIVE'}</b>

                    <span>EXPIRES</span>
                    <b>{formatTime(entitlement?.expires_at)}</b>
                  </div>

                  <Button
                    onClick={() => setPage('home')}
                    icon={<CheckCircle2 size={18} />}
                  >
                    Continue to MT5 Setup
                  </Button>
                </>
              ) : (
                <>
                  <Field
                    label="LICENSE KEY"
                    value={license}
                    onChange={setLicense}
                    placeholder="Enter your license key"
                  />

                  <Button
                    busy={busyAction === 'license'}
                    onClick={() => void activateLicense()}
                    icon={<KeyRound size={18} />}
                  >
                    Activate / Continue
                  </Button>

                  <p className="muted small">
                    VIP and trial keys are checked directly. BOSSMODE30D
                    opens the paid checkout flow.
                  </p>
                </>
              )}
            </div>

            {hasEntitlement && (
              <>
                <div className="row-between">
                  <h2>MT5 Connection</h2>
                  <span className={`pill ${connected ? 'pill-green' : ''}`}>
                    {connected ? 'CONNECTED' : 'NOT CONNECTED'}
                  </span>
                </div>

                {accounts.length > 0 && (
                  <div className="panel stack">
                    <h3>Saved MT5 Accounts</h3>

                    {accounts.map((account) => (
                      <button
                        type="button"
                        key={account.id}
                        className={`account-choice ${
                          String(selected?.id) === String(account.id)
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() => setSelectedId(account.id)}
                      >
                        <b>{account.label}</b>
                        <span>
                          {account.mode.toUpperCase()} · {account.login}
                        </span>
                      </button>
                    ))}

                    <Button
                      kind="outline"
                      onClick={() => setShowCreate((value) => !value)}
                    >
                      {showCreate ? 'Cancel' : 'Add another MT5 account'}
                    </Button>
                  </div>
                )}

                {(!selected || showCreate) && (
                  <div className="panel stack">
                    <h2>
                      {selected ? 'Add MT5 Account' : 'Connect MT5 Account'}
                    </h2>

                    <Field
                      label="ACCOUNT LABEL"
                      value={credentials.label}
                      onChange={(value) =>
                        setCredentials((current) => ({
                          ...current,
                          label: value,
                        }))
                      }
                    />

                    <Field
                      label="MT5 LOGIN ID"
                      value={credentials.login}
                      onChange={(value) =>
                        setCredentials((current) => ({
                          ...current,
                          login: value,
                        }))
                      }
                      inputMode="numeric"
                      placeholder="Enter MT5 login ID"
                    />

                    <Field
                      label="BROKER SERVER"
                      value={credentials.server}
                      onChange={(value) =>
                        setCredentials((current) => ({
                          ...current,
                          server: value,
                        }))
                      }
                      placeholder="e.g. Exness-MT5Trial"
                    />

                    <Field
                      label="BROKER"
                      value={credentials.broker}
                      onChange={(value) =>
                        setCredentials((current) => ({
                          ...current,
                          broker: value,
                        }))
                      }
                    />

                    <Field
                      label="GOLD SYMBOL"
                      value={credentials.symbol}
                      onChange={(value) =>
                        setCredentials((current) => ({
                          ...current,
                          symbol: value,
                        }))
                      }
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
                      <Message text="Real account creation is subject to the backend's live-trading authorization. The server may reject it until that authorization is enabled." />
                    )}

                    <Field
                      label="MT5 TRADING PASSWORD"
                      value={credentials.password}
                      onChange={(value) =>
                        setCredentials((current) => ({
                          ...current,
                          password: value,
                        }))
                      }
                      secret
                      placeholder="Enter MT5 trading password"
                    />

                    <Button
                      busy={busyAction === 'account'}
                      onClick={() => void createAccount()}
                    >
                      Save MT5 Account
                    </Button>

                    <p className="muted small">
                      Your login, server and symbol are remembered in this
                      browser. Your MT5 password is not saved in browser
                      storage.
                    </p>
                  </div>
                )}

                {selected && !showCreate && (
                  <div className="panel stack">
                    <h3>Selected MT5 Account</h3>

                    <Info label="LOGIN ID" value={selected.login} />
                    <Info label="SERVER" value={selected.server} />
                    <Info label="SYMBOL" value={selected.symbol} />
                    <Info label="MODE" value={selected.mode.toUpperCase()} />
                    <Info
                      label="CONNECTION"
                      value={connected ? 'CONNECTED' : 'WAITING FOR MT5'}
                    />

                    <Field
                      label="UPDATE MT5 PASSWORD"
                      value={credentials.password}
                      onChange={(value) =>
                        setCredentials((current) => ({
                          ...current,
                          password: value,
                        }))
                      }
                      secret
                      placeholder="Enter new password"
                    />

                    <Button
                      kind="outline"
                      busy={busyAction === 'password'}
                      onClick={() => void savePassword()}
                    >
                      Update Password
                    </Button>
                  </div>
                )}

                <Button
                  kind="outline"
                  onClick={() => setPage('home')}
                  icon={<House size={18} />}
                >
                  Open Dashboard
                </Button>
              </>
            )}
          </section>
        )}

        {page === 'home' && (
          <section className="stack">
            <h1>Trading Dashboard</h1>

            {error && <Message text={error} />}
            {notice && <Message text={notice} ok={noticeOk} />}

            {!hasEntitlement && (
              <Message text="Activate your license before using the trading controls." />
            )}

            <div className="metric-grid">
              <Metric
                label="MT5 Connection"
                value={
                  !selected
                    ? 'NO ACCOUNT'
                    : loading
                      ? 'CHECKING'
                      : connected
                        ? 'CONNECTED'
                        : 'DISCONNECTED'
                }
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
                value={selected ? money(telemetry?.balance) : 'NO ACCOUNT'}
                icon={<Wallet />}
              />

              <Metric
                label="Equity"
                value={selected ? money(telemetry?.equity) : 'NO ACCOUNT'}
                icon={<TrendingUp />}
              />

              <Metric
                label="Open Positions"
                value={
                  selected
                    ? String(telemetry?.open_positions_count ?? '—')
                    : 'NO ACCOUNT'
                }
                icon={<Layers />}
                wide
              />
            </div>

            {accounts.length > 1 && (
              <label className="field">
                <span>SELECT MT5 ACCOUNT</span>

                <select
                  value={selected?.id ?? ''}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label} · {account.mode.toUpperCase()} · {account.login}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="stack controls">
              <Button
                disabled={!selected || !hasEntitlement || running}
                busy={busyAction === 'START'}
                onClick={() => void command('START')}
                icon={<Power size={19} />}
              >
                Start Bot
              </Button>

              <Button
                kind="outline"
                disabled={!selected || !running}
                busy={busyAction === 'STOP'}
                onClick={() => void command('STOP')}
                icon={<Square size={18} />}
              >
                Stop Bot
              </Button>

              <Button
                kind="danger"
                disabled={!selected}
                busy={busyAction === 'EMERGENCY_STOP'}
                onClick={() => void command('EMERGENCY_STOP')}
                icon={<AlertTriangle size={18} />}
              >
                Emergency Stop
              </Button>
            </div>

            {newToken && (
              <div className="token-panel">
                <b>One-time EA token</b>
                <p>Copy this token and store it securely.</p>
                <code>{newToken}</code>

                <button
                  className="text-button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(newToken);
                    say('Token copied.', true);
                  }}
                >
                  Copy token
                </button>

                <button
                  className="text-button"
                  onClick={() => setNewToken('')}
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="subtle-card">
              <div className="row-between">
                <b>Account Status</b>
                <span className={`pill ${connected ? 'pill-green' : ''}`}>
                  {selected?.actual_state || 'NO ACCOUNT'}
                </span>
              </div>

              <p className="muted">
                {selected
                  ? `${selected.broker} · ${selected.server} · ${selected.mode.toUpperCase()}`
                  : 'No MT5 account connected'}
              </p>

              <p className="muted small">
                Last update: {formatTime(telemetry?.updated_at || selected?.last_seen)}
              </p>
            </div>
          </section>
        )}

        {page === 'settings' && (
          <section className="stack">
            <h1>Settings</h1>

            <div className="panel stack">
              <h3>ACCOUNT</h3>
              <Info label="Email session" value="Authenticated" />
              <Info
                label="License"
                value={entitlement?.code || 'NONE'}
              />
              <Info
                label="License status"
                value={hasEntitlement ? 'ACTIVE' : 'INACTIVE'}
              />
              <Info
                label="Expiry"
                value={formatTime(entitlement?.expires_at)}
              />
            </div>

            <div className="panel stack">
              <h3>MT5 ACCOUNT</h3>
              <Info label="Login ID" value={selected?.login || '—'} />
              <Info label="Broker server" value={selected?.server || '—'} />
              <Info label="Mode" value={selected?.mode?.toUpperCase() || '—'} />
            </div>

            <Button
              kind="outline"
              busy={busyAction === 'logout'}
              onClick={() => void doLogout()}
              icon={<LogOut size={18} />}
            >
              Sign Out
            </Button>

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
          <span>Activation</span>
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
  wide = false,
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
