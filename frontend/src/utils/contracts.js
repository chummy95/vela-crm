// Helpers for signing contracts: a fingerprint of exactly what was signed.
import { DEFAULT_CLAUSES } from './constants';

export function contractClauses(contract) {
  return Array.isArray(contract?.clauses) && contract.clauses.length ? contract.clauses : DEFAULT_CLAUSES;
}

// The parts of a contract that make up the agreement, in a fixed order.
export function contractContent(contract) {
  return JSON.stringify({
    service: contract.service || '',
    value: contract.value || '',
    start_date: contract.start_date || '',
    duration: contract.duration || '',
    date: contract.date || '',
    client_name: contract.client_name || '',
    client_address: contract.client_address || '',
    clauses: contractClauses(contract).map((c) => ({ title: c.title || '', body: c.body || '' })),
  });
}

// SHA-256 of the agreement text, shown on the signed copy so any later change is detectable.
export async function contractFingerprint(contract) {
  const data = new TextEncoder().encode(contractContent(contract));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const AGREEMENT_TEXT = 'I have read this agreement and agree to its terms. I understand that typing or drawing my signature here is the same as signing on paper.';

export function signedLabel(contract) {
  if (!contract?.signed) return 'Awaiting signature';
  return contract.client_signature ? 'Signed' : 'Signed outside Vela';
}
