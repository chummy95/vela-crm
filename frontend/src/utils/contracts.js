// Helpers for signing contracts: a fingerprint of exactly what was signed.
import { LEGACY_CLAUSES } from './constants';
import { fillClause, placeholderValues } from './contractTemplate';

export function contractClauses(contract) {
  return Array.isArray(contract?.clauses) && contract.clauses.length ? contract.clauses : LEGACY_CLAUSES;
}

// The parts of a contract that make up the agreement, exactly as the client reads them.
export function contractContent(contract, brand = {}, currency = 'GBP') {
  const values = placeholderValues(contract, brand, currency);
  return JSON.stringify({
    service: contract.service || '',
    value: contract.value || '',
    start_date: contract.start_date || '',
    end_date: contract.end_date || '',
    duration: contract.duration || '',
    date: contract.date || '',
    client_name: contract.client_name || '',
    client_address: contract.client_address || '',
    studio: brand.business_name || '',
    clauses: contractClauses(contract).map((c) => ({ title: c.title || '', body: fillClause(c.body, values) })),
  });
}

// SHA-256 of the agreement text, shown on the signed copy so any later change is detectable.
export async function contractFingerprint(contract, brand = {}, currency = 'GBP') {
  const data = new TextEncoder().encode(contractContent(contract, brand, currency));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const AGREEMENT_TEXT = 'I have read this agreement and agree to its terms. I understand that typing or drawing my signature here is the same as signing on paper.';

export function signedLabel(contract) {
  if (!contract?.signed) return 'Awaiting signature';
  return contract.client_signature ? 'Signed' : 'Signed outside Vela';
}
