import { useEffect, useState } from 'react';
import { studioProfileAPI } from '../utils/api';
import { DEFAULT_STUDIO_PROFILE } from '../utils/invoices';
import { DEFAULT_BRAND } from '../utils/brand';

// The studio's business details and brand kit (for the studio, or for a client, their studio's).
export function useStudioProfile() {
  const [profile, setProfile] = useState({ ...DEFAULT_STUDIO_PROFILE, ...DEFAULT_BRAND });
  useEffect(() => {
    let live = true;
    studioProfileAPI.get().then((p) => { if (live) setProfile(p); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return profile;
}
