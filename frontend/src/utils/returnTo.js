// Remembers the page someone opened before being asked to sign in (for example a link in an
// email), so they land back on it afterwards.
const KEY = 'vela-return-to';

export function rememberReturn(path) {
  try { sessionStorage.setItem(KEY, path); } catch { /* private mode */ }
}

// The sign-in page and the router both ask right after sign-in; the second asker gets the same answer.
let recent = { path: '', at: 0 };

export function takeReturn(role) {
  let path = '';
  try { path = sessionStorage.getItem(KEY) || ''; sessionStorage.removeItem(KEY); } catch { /* private mode */ }
  if (path) recent = { path, at: Date.now() };
  else if (Date.now() - recent.at < 4000) path = recent.path;
  if (!path.startsWith('/') || path.startsWith('//')) return '';
  const isPortal = path === '/portal' || path.startsWith('/portal/');
  if (role === 'client' ? !isPortal : isPortal) return '';
  if (/^\/(portal\/)?login/.test(path)) return '';
  return path;
}
