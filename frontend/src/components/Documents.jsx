import React from 'react';
import { DEFAULT_CLAUSES } from '../utils/constants';
import { formatDate, formatMoney } from '../utils/format';

const longDate = { day: 'numeric', month: 'long', year: 'numeric' };

function list(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || '').split('\n').map((x) => x.trim()).filter(Boolean);
}

// A proposal laid out as the document the client reads. Used in the studio editor and the client portal.
export function ProposalDocument({ proposal, studioName, currency = 'GBP', emptyHint }) {
  const packages = list(proposal.packages);
  const deliverables = list(proposal.deliverables);
  const timeline = list(proposal.timeline);
  const isEmpty = !proposal.intro && !proposal.overview && !packages.length && !deliverables.length;
  return (
    <article className="doc-preview" aria-label="Proposal">
      <div className="doc-kicker">Proposal{proposal.date ? `, ${formatDate(proposal.date, longDate)}` : ''}</div>
      <h2 className="doc-title">{proposal.service || 'Untitled proposal'}</h2>
      <div className="doc-for">Prepared for {proposal.client_name || 'you'}{studioName ? ` by ${studioName}` : ''}</div>
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
export function ContractDocument({ contract, studioName, currency = 'GBP' }) {
  const clauses = Array.isArray(contract.clauses) && contract.clauses.length ? contract.clauses : DEFAULT_CLAUSES;
  const terms = [
    contract.start_date ? `Starting ${formatDate(contract.start_date, longDate)}` : '',
    contract.duration ? `for ${contract.duration}` : '',
  ].filter(Boolean).join(', ');
  return (
    <article className="doc-preview" aria-label="Contract">
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
        <div>For {studioName || 'the Studio'}</div>
        <div>For {contract.client_name || 'the Client'}{contract.signed ? ' (signed)' : ''}</div>
      </div>
    </article>
  );
}
