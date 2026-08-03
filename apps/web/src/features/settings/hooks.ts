import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchBlob } from '../../lib/api-client';
import { companyApi, UpdateCompanyProfileInput } from './api';

export function useCompanyProfile() {
  return useQuery({ queryKey: ['company', 'profile'], queryFn: companyApi.getProfile });
}

/** Fetches the uploaded logo as an object URL — GET /company/logo requires the in-memory access token, so a plain <img src> can't authenticate on its own. Shared by CompanyProfilePage's preview and layouts/AppShell.tsx's CompanyHeader. */
export function useCompanyLogoUrl(hasLogo: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasLogo) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchBlob('/company/logo')
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [hasLogo]);

  return url;
}

export function useUpdateCompanyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCompanyProfileInput) => companyApi.updateProfile(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', 'profile'] }),
  });
}

export function useUploadCompanyLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => companyApi.uploadLogo(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', 'profile'] }),
  });
}
