import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { ErrorNote, Spinner } from '../../../components/ui/Feedback';
import { Field, Input } from '../../../components/ui/Input';
import { ApiError } from '../../../lib/api-client';
import { useCompanyLogoUrl, useCompanyProfile, useUpdateCompanyProfile, useUploadCompanyLogo } from '../hooks';
import type { CompanyProfile } from '../api';

function LogoPreview({ hasLogo }: { hasLogo: boolean }) {
  const url = useCompanyLogoUrl(hasLogo);

  if (!hasLogo) return <p className="text-[13px] text-muted">No logo uploaded yet.</p>;
  if (!url) return <Spinner />;
  return <img src={url} alt="Company logo" className="max-h-[100px] max-w-full rounded border border-line bg-white p-2" />;
}

function LogoUploader({ profile }: { profile: CompanyProfile }) {
  const upload = useUploadCompanyLogo();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      await upload.mutateAsync(file);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload this logo.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <LogoPreview hasLogo={profile.hasLogo} key={profile.hasLogo ? 'has-logo' : 'no-logo'} />
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={onFileChange}
          disabled={upload.isPending}
          className="text-[13px]"
        />
        {upload.isPending && <Spinner />}
      </div>
      <p className="text-xs text-muted">
        This image is stamped across the top of every generated PDF (Quotations, Purchase Orders, Invoices, Payment
        Certificates). PNG, JPEG, or WebP, up to 2MB — a wide banner works best.
      </p>
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}

function ProfileForm({ profile }: { profile: CompanyProfile }) {
  const update = useUpdateCompanyProfile();
  const [form, setForm] = useState({
    name: profile.name,
    legalName: profile.legalName ?? '',
    registrationNumber: profile.registrationNumber ?? '',
    addressLine1: profile.addressLine1 ?? '',
    addressLine2: profile.addressLine2 ?? '',
    city: profile.city ?? '',
    stateProvince: profile.stateProvince ?? '',
    postalCode: profile.postalCode ?? '',
    phone: profile.phone ?? '',
    email: profile.email ?? '',
    website: profile.website ?? '',
    description1: profile.description1 ?? '',
    description2: profile.description2 ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await update.mutateAsync({
        ...form,
        legalName: form.legalName || undefined,
        registrationNumber: form.registrationNumber || undefined,
        addressLine1: form.addressLine1 || undefined,
        addressLine2: form.addressLine2 || undefined,
        city: form.city || undefined,
        stateProvince: form.stateProvince || undefined,
        postalCode: form.postalCode || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        website: form.website || undefined,
        description1: form.description1 || undefined,
        description2: form.description2 || undefined,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save these changes.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="Company Name" htmlFor="cp-name">
          <Input id="cp-name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Legal Name" htmlFor="cp-legal">
          <Input id="cp-legal" value={form.legalName} onChange={(e) => set('legalName', e.target.value)} />
        </Field>
        <Field label="Registration Number" htmlFor="cp-reg">
          <Input id="cp-reg" value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} />
        </Field>
        <Field label="Phone" htmlFor="cp-phone">
          <Input id="cp-phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="cp-email">
          <Input id="cp-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Website" htmlFor="cp-website">
          <Input id="cp-website" placeholder="antechengg.com" value={form.website} onChange={(e) => set('website', e.target.value)} />
        </Field>
        <Field label="Address Line 1" htmlFor="cp-addr1">
          <Input id="cp-addr1" value={form.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} />
        </Field>
        <Field label="Address Line 2" htmlFor="cp-addr2">
          <Input id="cp-addr2" value={form.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} />
        </Field>
        <Field label="City" htmlFor="cp-city">
          <Input id="cp-city" value={form.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field label="State / Province" htmlFor="cp-state">
          <Input id="cp-state" value={form.stateProvince} onChange={(e) => set('stateProvince', e.target.value)} />
        </Field>
        <Field label="Postal Code" htmlFor="cp-postal">
          <Input id="cp-postal" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} />
        </Field>
        <Field label="Header Line 1" htmlFor="cp-desc1">
          <Input
            id="cp-desc1"
            placeholder="Residential / Commercial for Electrical, ACMV Systems, Plumbing"
            value={form.description1}
            onChange={(e) => set('description1', e.target.value)}
          />
        </Field>
        <Field label="Header Line 2" htmlFor="cp-desc2">
          <Input
            id="cp-desc2"
            placeholder="Installation, Servicing, Repairs & Maintenance Works."
            value={form.description2}
            onChange={(e) => set('description2', e.target.value)}
          />
        </Field>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={update.isPending} className="self-start">
          {update.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
        {saved && !update.isPending && <span className="text-[13px] text-success">Saved.</span>}
      </div>
    </form>
  );
}

export function CompanyProfileTab() {
  const { data: profile, isLoading, error } = useCompanyProfile();

  return (
    <div>
      {isLoading && <div className="flex justify-center py-12"><Spinner /></div>}
      {error && <ErrorNote>{error instanceof ApiError ? error.message : 'Could not load the company profile.'}</ErrorNote>}

      {profile && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <LogoUploader profile={profile} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileForm profile={profile} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
