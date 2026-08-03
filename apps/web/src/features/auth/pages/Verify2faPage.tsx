import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { Field, Input } from '../../../components/ui/Input';
import { ApiError } from '../../../lib/api-client';
import { useVerify2fa } from '../hooks';

export function Verify2faPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const verify = useVerify2fa();

  const challengeToken = (location.state as { challengeToken?: string } | null)?.challengeToken;

  if (!challengeToken) {
    // Landed here directly (bookmark, refresh) without going through login first — nothing to verify against.
    return <Navigate to="/login" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await verify.mutateAsync({ challengeToken: challengeToken!, code });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Please try again.');
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h1 className="text-lg">Two-factor verification</h1>
          <p className="mt-1 text-[13px] text-muted">Enter the 6-digit code from your authenticator app.</p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
          <Field label="Code" htmlFor="code">
            <Input
              id="code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-center tracking-[0.3em]"
            />
          </Field>
          {error && <p className="text-[12.5px] text-critical">{error}</p>}
          <Button type="submit" variant="primary" disabled={verify.isPending} className="mt-1">
            {verify.isPending ? 'Verifying…' : 'Verify'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
