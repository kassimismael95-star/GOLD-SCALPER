
import { Gem, ArrowLeft } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import Button from '@/components/ui/Button';
import StatusMessage, { type Feedback } from '@/components/ui/StatusMessage';
import TextField from '@/components/ui/TextField';
import { apiPost, setAuthTokens, type AuthTokens } from '@/lib/api';
import { isRecord } from '@/lib/guards';

type AuthMode = 'signIn' | 'createAccount' | 'verifyEmail';

interface AuthValues {
  email: string;
  password: string;
}

interface AuthResponse extends AuthTokens {
  user: {
    id: number | string;
    email: string;
  };
}

interface MessageResponse {
  message: string;
  user_id?: number;
}

interface VerifyValues {
  email: string;
  code: string;
}

type AuthErrors = Partial<Record<keyof AuthValues, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;

const MODE_COPY: Record<AuthMode, {
  heading: string;
  submit: string;
  switchLabel: string;
}> = {
  signIn: {
    heading: 'Sign In',
    submit: 'Sign In',
    switchLabel: 'New here? Create an account',
  },
  createAccount: {
    heading: 'Create Account',
    submit: 'Create Account',
    switchLabel: 'Already have an account? Sign in',
  },
  verifyEmail: {
    heading: 'Verify Your Email',
    submit: 'Verify Email',
    switchLabel: '',
  },
};

function isAuthResponse(value: unknown): value is AuthResponse {
  return (
    isRecord(value) &&
    typeof value.access_token === 'string' &&
    typeof value.refresh_token === 'string' &&
    isRecord(value.user) &&
    (typeof value.user.id === 'string' ||
      typeof value.user.id === 'number') &&
    typeof value.user.email === 'string'
  );
}

function isMessageResponse(value: unknown): value is MessageResponse {
  return (
    isRecord(value) &&
    typeof value.message === 'string'
  );
}

function validate(values: AuthValues, mode: AuthMode): AuthErrors {
  const errors: AuthErrors = {};

  if (!EMAIL_PATTERN.test(values.email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (mode === 'createAccount' &&
      values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password =
      `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (values.password.length === 0) {
    errors.password = 'Enter your password.';
  }

  return errors;
}

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('signIn');

  const [values, setValues] = useState<AuthValues>({
    email: '',
    password: '',
  });

  const [verificationCode, setVerificationCode] = useState('');

  const [errors, setErrors] = useState<AuthErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const copy = MODE_COPY[mode];

  const switchMode = () => {
    setMode((current) =>
      current === 'signIn' ? 'createAccount' : 'signIn'
    );

    setErrors({});
    setFeedback(null);
    setVerificationCode('');
  };

  const updateField =
    (field: keyof AuthValues) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (submitting) return;

    const credentials = {
      email: values.email.trim().toLowerCase(),
      password: values.password,
    };

    setErrors({});
    setFeedback(null);

    const nextErrors = validate(credentials, mode);

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);

    try {
      if (mode === 'signIn') {
        const result = await apiPost<AuthResponse>(
          '/api/auth/login',
          credentials,
          isAuthResponse
        );

        if (!result.ok) {
          setFeedback({
            tone: 'error',
            text: result.message,
          });
          return;
        }

        setAuthTokens({
          access_token: result.data.access_token,
          refresh_token: result.data.refresh_token,
        });

        setFeedback({
          tone: 'success',
          text: 'Login successful. Opening your account...',
        });

        window.location.reload();
        return;
      }

      const result = await apiPost<AuthResponse | MessageResponse>(
        '/api/auth/register',
        credentials,
        (value): value is AuthResponse | MessageResponse =>
          isAuthResponse(value) || isMessageResponse(value)
      );

      if (!result.ok) {
        setFeedback({
          tone: 'error',
          text: result.message,
        });
        return;
      }

      if (isAuthResponse(result.data)) {
        setAuthTokens({
          access_token: result.data.access_token,
          refresh_token: result.data.refresh_token,
        });

        setFeedback({
          tone: 'success',
          text: 'Account created successfully.',
        });

        window.location.reload();
        return;
      }

      if (
        result.data.message === 'verification_code_sent'
      ) {
        setMode('verifyEmail');
        setFeedback({
          tone: 'success',
          text: 'A verification code has been sent to your email. It expires in 10 minutes.',
        });
        return;
      }

      setFeedback({
        tone: 'error',
        text: 'Account created, but the server did not return a usable login session.',
      });
    } catch {
      setFeedback({
        tone: 'error',
        text: 'Something went wrong. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (submitting) return;

    const email = values.email.trim().toLowerCase();
    const code = verificationCode.trim();

    if (!EMAIL_PATTERN.test(email)) {
      setFeedback({
        tone: 'error',
        text: 'Enter a valid email address.',
      });
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setFeedback({
        tone: 'error',
        text: 'Enter the six-digit verification code.',
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const result = await apiPost<AuthResponse>(
        '/api/auth/verify-email',
        { email, code },
        isAuthResponse
      );

      if (!result.ok) {
        setFeedback({
          tone: 'error',
          text: result.message,
        });
        return;
      }

      setAuthTokens({
        access_token: result.data.access_token,
        refresh_token: result.data.refresh_token,
      });

      setFeedback({
        tone: 'success',
        text: 'Email verified. Opening your account...',
      });

      window.location.reload();
    } catch {
      setFeedback({
        tone: 'error',
        text: 'Verification failed. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resendVerification = async () => {
    if (submitting) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      const result = await apiPost<MessageResponse>(
        '/api/auth/verification/resend',
        {
          email: values.email.trim().toLowerCase(),
        },
        isMessageResponse
      );

      if (!result.ok) {
        setFeedback({
          tone: 'error',
          text: result.message,
        });
        return;
      }

      setFeedback({
        tone: 'success',
        text: 'If your account requires verification, a new code has been sent. Check your email.',
      });
    } catch {
      setFeedback({
        tone: 'error',
        text: 'Could not resend the verification code.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent">
          <Gem
            className="h-5 w-5 text-ink-inverse"
            aria-hidden="true"
          />
        </span>

        <span className="text-[16px] font-bold tracking-wide text-ink">
          GOLD MOBILE EA
        </span>
      </div>

      {mode === 'verifyEmail' && (
        <button
          type="button"
          onClick={() => {
            setMode('createAccount');
            setFeedback(null);
          }}
          className="mb-5 flex items-center gap-2 self-start text-sm font-semibold text-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to account creation
        </button>
      )}

      <h1 className="text-[28px] font-bold leading-[1.2] tracking-tight text-ink">
        {copy.heading}
      </h1>

      <p className="mb-6 mt-2 text-[15px] leading-[150%] text-ink-muted">
        {mode === 'verifyEmail'
          ? `Enter the six-digit code sent to ${values.email}.`
          : 'Your MT5 credentials are private to your own account.'}
      </p>

      {mode === 'verifyEmail' ? (
        <form
          onSubmit={handleVerify}
          noValidate
          className="flex flex-col gap-5"
        >
          <TextField
            label="EMAIL"
            name="verificationEmail"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={updateField('email')}
            disabled={submitting}
          />

          <TextField
            label="VERIFICATION CODE"
            name="verificationCode"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Enter six-digit code"
            value={verificationCode}
            onChange={(event) =>
              setVerificationCode(
                event.target.value.replace(/\D/g, '').slice(0, 6)
              )
            }
          />

          <Button type="submit" loading={submitting}>
            Verify Email
          </Button>

          <Button
            type="button"
            variant="outline"
            loading={submitting}
            onClick={resendVerification}
          >
            Resend Verification Code
          </Button>

          {feedback && (
            <StatusMessage feedback={feedback} />
          )}
        </form>
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-5"
        >
          <TextField
            label="EMAIL"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Enter your email"
            value={values.email}
            onChange={updateField('email')}
            error={errors.email}
          />

          <TextField
            label="PASSWORD"
            name="password"
            secret
            autoComplete={
              mode === 'signIn'
                ? 'current-password'
                : 'new-password'
            }
            placeholder={
              mode === 'signIn'
                ? 'Enter your password'
                : `At least ${MIN_PASSWORD_LENGTH} characters`
            }
            value={values.password}
            onChange={updateField('password')}
            error={errors.password}
          />

          <Button
            type="submit"
            loading={submitting}
            className="mt-1"
          >
            {copy.submit}
          </Button>

          {feedback && (
            <StatusMessage feedback={feedback} />
          )}
        </form>
      )}

      {mode !== 'verifyEmail' && (
        <button
          type="button"
          onClick={switchMode}
          className="mt-6 self-center text-[14px] font-semibold text-accent transition-opacity hover:opacity-80"
        >
          {copy.switchLabel}
        </button>
      )}
    </div>
  );
}
