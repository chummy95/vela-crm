import React from 'react';
import { formatDate, formatMoney } from '../utils/format';
import { brandVars, useBrandFonts } from '../utils/brand';
import { AGREEMENT_TEXT, contractClauses } from '../utils/contracts';
import { fillClause, inlineRuns, parseClause, placeholderValues, plainText } from '../utils/contractTemplate';

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

// Clause text with placeholders filled in (plain text, for PDFs and older callers).
export function clauseText(clause, contract, currency = 'GBP', brand = {}) {
  return plainText(fillClause(clause.body, placeholderValues(contract, brand, currency)));
}

function Inline({ text }) {
  return inlineRuns(text).map((run, i) => {
    let node = run.text;
    if (run.missing) node = <span key={i} className="ph-missing" title="Fill this in on the contract">{run.text}</span>;
    else if (run.bold) node = <strong key={i}>{run.text}</strong>;
    else node = <React.Fragment key={i}>{run.text}</React.Fragment>;
    return run.bold && run.missing ? <strong key={i}>{node}</strong> : node;
  });
}

function ClauseBody({ text }) {
  return parseClause(text).map((block, i) => {
    if (block.type === 'sub') return <h4 key={i} className="clause-sub"><Inline text={block.text} /></h4>;
    if (block.type === 'list') return <ul key={i}>{block.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}</ul>;
    return <p key={i}>{block.lines.map((line, j) => <React.Fragment key={j}>{j > 0 && <br />}<Inline text={line} /></React.Fragment>)}</p>;
  });
}

// A contract laid out as a signed-or-unsigned agreement.
export function ContractDocument({ contract, studioName: nameProp, currency: currencyProp, brand = {} }) {
  useBrandFonts(brand);
  const currency = currencyProp || brand.currency || 'GBP';
  const studioName = brand.business_name || nameProp;
  const clauses = contractClauses(contract);
  const values = placeholderValues(contract, brand, currency);
  return (
    <article className="doc-preview contract-doc" aria-label="Contract" style={brandVars(brand)}>
      {brand.logo && <img className="doc-logo" src={brand.logo} alt={studioName || 'Studio logo'} />}
      <div className="doc-kicker">Design services contract{contract.date ? `, ${formatDate(contract.date, longDate)}` : ''}</div>
      <h2 className="doc-title">{contract.service || 'Untitled contract'}</h2>
      <div className="doc-for">
        Between {studioName || 'the Studio'} and {contract.client_name || 'the Client'}
      </div>
      {clauses.map((clause, index) => (
        <section key={clause.id || index} className="clause">
          <h3 className="clause-title">{index + 1}. {clause.title}</h3>
          <div className="clause-body"><ClauseBody text={fillClause(clause.body, values)} /></div>
        </section>
      ))}
      <div className="doc-sign">
        <SignatureBlock
          party="Client’s signature"
          who={contract.client_name}
          signature={contract.client_signature}
          note={contract.signed && !contract.client_signature ? 'Signed outside Vela' : ''}
        />
        <SignatureBlock party="Designer’s signature" who={studioName} signature={contract.studio_signature} />
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

function SignatureBlock({ party, who, signature, note }) {
  return (
    <div>
      <div className="sig-label">{party}</div>
      {signature?.image ? <img className="sig-img" src={signature.image} alt={`Signature of ${signature.name}`} /> : <div className="sig-blank" />}
      <div className="sig-line">
        {signature ? <div className="sig-name">{signature.name}{signature.title ? `, ${signature.title}` : ''}</div> : who ? <div>{who}</div> : null}
        <div>Date: {signature ? stamp(signature.signed_at) : note || ''}</div>
      </div>
    </div>
  );
}
