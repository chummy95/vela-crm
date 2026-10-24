import React from 'react';
import { DEFAULT_CLAUSES } from '../utils/constants';
import { formatDate, formatMoney } from '../utils/format';
import { brandVars, useBrandFonts } from '../utils/brand';
import { AGREEMENT_TEXT } from '../utils/contracts';

const longDate = { day: 'numeric', month: 'long', year: 'numeric' };

function list(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || '').split('\n').map((x) => x.trim()).filter(Boolean);
}

// A proposal laid out as the document the client reads. Used in the studio editor and the client portal.
export function ProposalDocument({ proposal, studioName, currency = 'GBP', emptyHint, brand = {} }) {
  useBrandFonts(brand);
  const by = brand.business_name || studioName;
  const packages = list(proposal.packages);
  const deliverables = list(proposal.deliverables);
  const timeline = list(proposal.timeline);
  const isEmpty = !proposal.intro && !proposal.overview && !packages.length && !deliverables.length;
  return (
    <article className="doc-preview" aria-label="Proposal" style={brandVars(brand)}>
      {brand.logo && <img className="doc-logo" src={brand.logo} alt={by || 'Studio logo'} />}
      <div className="doc-kicker">Proposal{proposal.date ? `, ${formatDate(proposal.date, longDate)}` : ''}</div>
      <h2 className="doc-title">{proposal.service || 'Untitled proposal'}</h2>
      <div className="doc-for">Prepared for {proposal.client_name || 'you'}{by ? ` by ${by}` : ''}</div>
      {proposal.intro && <p className="doc-lead">{proposal.intro}</p>}
      {proposal.overview && <><h3>Overview</h3><p>{proposal.overview}</p></>}
      {packages.length > 0 && <><h3>Packages</h3><ul>{packages.map((x) => <li key={x}>{x}</li>)}</ul></>}
      {deliverables.length > 0 && <><h3>Deliverables</h3><ul>{deliverables.map((x) => <li key={x}>{x}</li>)}</ul></>}
      {timeline.length > 0 && <><h3>Timeline</h3><ol>{timeline.map((x) => <li key={x}>{x}</li>)}</ol></>}
      {proposal.process && <><h3>How we’ll work</h3><p>{proposal.process}</p></>}
      {proposal.value && <div className="doc-total"><span>Investment</span><strong>{formatMoney(proposal.value, currency)}</strong></div>}
      {proposal.terms && <><h3>Terms</h3><p className="doc-small">{proposal.terms}</p></>}
      {isEmpty && emptyHint && <p className="faint" style={{ marginTop: 18 }}>{emptyHint}</p>}
    </article>
  );
}

export function clauseText(clause, contract, currency = 'GBP') {
  return String(clause.body || '')
    .replace(/__SERVICE__/g, contract.service || 'the agreed service')
    .replace(/__VALUE__/g, contract.value ? formatMoney(contract.value, currency) : 'the agreed value');
}

// A contract laid out as a signed-or-unsigned agreement.
export function ContractDocument({ contract, studioName: nameProp, currency = 'GBP', brand = {} }) {
  useBrandFonts(brand);
  const studioName = brand.business_name || nameProp;
  const clauses = Array.isArray(contract.clauses) && contract.clauses.length ? contract.clauses : DEFAULT_CLAUSES;
  const terms = [
    contract.start_date ? `Starting ${formatDate(contract.start_date, longDate)}` : '',
    contract.duration ? `for ${contract.duration}` : '',
  ].filter(Boolean).join(', ');
  return (
    <article className="doc-preview" aria-label="Contract" style={brandVars(brand)}>
      {brand.logo && <img className="doc-logo" src={brand.logo} alt={studioName || 'Studio logo'} />}
      <div className="doc-kicker">Services agreement{contract.date ? `, ${formatDate(contract.date, longDate)}` : ''}</div>
      <h2 className="doc-title">{contract.service || 'Untitled contract'}</h2>
      <div className="doc-for">
        Between {studioName || 'the Studio'} and {contract.client_name || 'the Client'}{contract.client_address ? `, ${contract.client_address}` : ''}
      </div>
      {(terms || contract.value) && (
        <p className="doc-small" style={{ marginTop: 16 }}>
          {terms}{terms && contract.value ? '. ' : ''}{contract.value ? `Total value ${formatMoney(contract.value, currency)}.` : ''}
        </p>
      )}
      {clauses.map((clause, index) => (
        <section key={clause.id || index}>
          <h3>{index + 1}. {clause.title}</h3>
          <p>{clauseText(clause, contract, currency)}</p>
        </section>
      ))}
      <div className="doc-sign">
        <SignatureBlock party={`For ${studioName || 'the Studio'}`} signature={contract.studio_signature} />
        <SignatureBlock
          party={`For ${contract.client_name || 'the Client'}`}
          signature={contract.client_signature}
          note={contract.signed && !contract.client_signature ? 'Signed outside Vela' : ''}
        />
      </div>
      {contract.client_signature && (
        <div className="doc-audit" aria-label="Signature record">
          <b>Signed electronically.</b> {contract.client_signature.name}
          {contract.client_signature.email ? ` (${contract.client_signature.email})` : ''} {contract.client_signature.method === 'typed' ? 'typed' : 'drew'} their signature
          {' '}on {stamp(contract.client_signature.signed_at)} after agreeing: “{contract.client_signature.agreement || AGREEMENT_TEXT}”
          {contract.studio_signature ? ` ${contract.studio_signature.name} signed for ${studioName || 'the Studio'} on ${stamp(contract.studio_signature.signed_at)}.` : ''}
          {contract.signed_hash && <><br />Document fingerprint (SHA-256): {contract.signed_hash}</>}
        </div>
      )}
    </article>
  );
}

function stamp(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
}

function SignatureBlock({ party, signature, note }) {
  return (
    <div>
      {signature?.image ? <img className="sig-img" src={signature.image} alt={`Signature of ${signature.name}`} /> : <div className="sig-blank" />}
      <div className="sig-line">
        {signature ? <div className="sig-name">{signature.name}{signature.title ? `, ${signature.title}` : ''}</div> : null}
        <div>{party}</div>
        {signature && <div>{stamp(signature.signed_at)}</div>}
        {!signature && note && <div>{note}</div>}
      </div>
    </div>
  );
}
