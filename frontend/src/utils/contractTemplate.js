// Contract templates and the placeholders that fill them in.
//
// Clause bodies use a little markup:
//   ## Heading       a bold sub-heading (e.g. "## 2.1 Project Description")
//   - item           a bullet point
//   **text**         bold text
//   __PLACEHOLDER__  filled in from the contract, the client and the studio's settings

export const DESIGN_CONTRACT_TEMPLATE = [
  { id: 'parties', title: 'Parties', body: `This Design Services Contract is entered into on __DATE__ (the “Effective Date”) by and between:

## Client:
Name: __CLIENT_CONTACT__
Address: __CLIENT_ADDRESS__
Email: __CLIENT_EMAIL__

Hereafter referred to as the “Client.”

AND

## Contractor:
Name: __DESIGNER_NAME__
Address: __STUDIO_ADDRESS__
Email: __STUDIO_EMAIL__
Phone: __STUDIO_PHONE__

Hereafter referred to as the “Designer.”` },
  { id: 'scope', title: 'Project Scope', body: `## 2.1 Project Description
The Client agrees to hire the Designer to provide design services as described below:

__SERVICE__

## 2.2 Project Process
The Parties agree to follow the project process as indicated in the attached Project Proposal document.` },
  { id: 'deliverables', title: 'Deliverables', body: `## 3.1 Expected Deliverables
The Designer agrees to deliver the following design materials:

- Logo Suite
- Brand Identity Assets
- Brand Stationery
- Brand Guidelines

## 3.2 Approval Process
The Client shall review the deliverables promptly upon receipt and provide feedback within 7 days. Revisions, if necessary, will be made by the Designer.` },
  { id: 'timeline', title: 'Timeline', body: `Here’s a breakdown of when the project is set to commence.
Start date: **__START_DATE__** – End date: **__END_DATE__**.

The provided timeline is an approximate timeline for when I anticipate the project will reach completion.
Please understand that these dates are not meant to pressure or rush the process, they serve more as reference points rather than strict deadlines.` },
  { id: 'payment', title: 'Payment Policy', body: `## 5.1 Payment Amount
Client shall pay Designer **__VALUE__** for the services performed under this contract, the payment policy for the project is:

- A non-refundable down payment of 50% (__DEPOSIT__) of the total project cost upon signing this contract.
- The remaining 50% (__BALANCE__) shall be paid in full before the delivery of the final design materials.

## 5.2 Payment Method
Payments shall be made via Bank Transfer.` },
  { id: 'ownership', title: 'Ownership and Rights', body: `## 6.1 Transfer of Rights
Upon full payment of the compensation set forth in this contract, Client shall be the exclusive owner of all intellectual property rights, including but not limited to copyrights and trademarks, in and to the work product produced by Designer in connection with this contract. All sketches designed during this project, which are not used by the Client, will remain the property of the Designer.

## 6.2 Trademark Infringements
The Designer shall not be held responsible for any costs or legal liabilities arising from trademark infringements or other intellectual property issues related to the design materials after full payment has been made.

## 6.3 Portfolio Usage
The Designer is granted the right to use the completed design materials for portfolio and self-promotion purposes.` },
  { id: 'revisions', title: 'Revisions and Feedback', body: `The Client agrees to provide timely feedback and request revisions, if necessary, within 7 days of receiving deliverables. In the event that further revisions become necessary beyond what was initially agreed upon, each additional round of revisions will incur an additional fee of $30 per round.
These charges will be included in the final invoice.` },
  { id: 'confidentiality', title: 'Confidentiality', body: 'Client and Designer agree to maintain the confidentiality of any proprietary or sensitive information shared during the project.' },
  { id: 'cancellation', title: 'Cancellation', body: `Client or Designer may terminate this contract with written notice if the other Party breaches any material term or condition. In the event of termination, the Client shall pay for any work completed up to that point.

If the Client decides to cancel the project after ideas and proposals have been submitted, refunds for any previous payments made will not be provided.` },
  { id: 'unforeseen', title: 'Unforeseen Circumstances', body: 'In the event that the Designer becomes incapacitated or unable to continue the project due to unexpected and uncontrollable circumstances (e.g., acts of nature, illness, or other emergencies), a portion of the total project budget may be reimbursed. In most cases, a full refund will be issued. If the work completed thus far can be utilized by another designer to continue the project, a refund percentage will be determined based on the work completed. Alternatively, any reasonable suggestions for handling the situation will be taken into consideration.' },
  { id: 'suspension', title: 'Project Suspension', body: 'Should the project need to be suspended for any reason, the Client and Designer shall discuss the terms and conditions for resuming the project at a later date.' },
  { id: 'entire', title: 'Entire Agreement', body: 'This contract constitutes the entire agreement between the parties and supersedes all prior negotiations, understandings, and agreements between them, whether written or oral, relating to the subject matter of this contract.' },
  { id: 'amendment', title: 'Amendment', body: 'This contract may be amended or modified only by written agreement signed by both parties.' },
  { id: 'signatures', title: 'Signatures', body: `By signing below, the parties acknowledge their understanding and acceptance of the terms and conditions outlined in this contract.

Please retain a copy of this contract for your records.` },
];

export const PLACEHOLDERS = [
  ['__DATE__', 'Contract date'],
  ['__SERVICE__', 'Project description'],
  ['__VALUE__', 'Project value'],
  ['__DEPOSIT__', '50% deposit'],
  ['__BALANCE__', 'Remaining 50%'],
  ['__START_DATE__', 'Start date'],
  ['__END_DATE__', 'End date'],
  ['__DURATION__', 'Duration'],
  ['__CLIENT_NAME__', 'Client business'],
  ['__CLIENT_CONTACT__', 'Client contact name'],
  ['__CLIENT_ADDRESS__', 'Client address'],
  ['__CLIENT_EMAIL__', 'Client email'],
  ['__DESIGNER_NAME__', 'Your name'],
  ['__STUDIO_NAME__', 'Business name'],
  ['__STUDIO_ADDRESS__', 'Your address'],
  ['__STUDIO_EMAIL__', 'Your email'],
  ['__STUDIO_PHONE__', 'Your phone'],
];

const MISSING_OPEN = '⟦';
const MISSING_CLOSE = '⟧';

function amount(value, currency, fraction = 1) {
  const n = Number(String(value || '').replace(/[^0-9.]/g, ''));
  if (!n) return '';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: (n * fraction) % 1 ? 2 : 0 }).format(n * fraction);
  } catch {
    return String(Math.round(n * fraction * 100) / 100);
  }
}

function day(value) {
  if (!value) return '';
  const d = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function placeholderValues(contract = {}, brand = {}, currency = 'GBP') {
  return {
    __DATE__: day(contract.date),
    __SERVICE__: contract.description || contract.service || '',
    __VALUE__: amount(contract.value, currency),
    __DEPOSIT__: amount(contract.value, currency, 0.5),
    __BALANCE__: amount(contract.value, currency, 0.5),
    __START_DATE__: day(contract.start_date),
    __END_DATE__: day(contract.end_date),
    __DURATION__: contract.duration || '',
    __CLIENT_NAME__: contract.client_name || '',
    __CLIENT_CONTACT__: contract.client_contact || contract.client_name || '',
    __CLIENT_ADDRESS__: contract.client_address || '',
    __CLIENT_EMAIL__: contract.client_email || '',
    __DESIGNER_NAME__: brand.legal_name || brand.business_name || '',
    __STUDIO_NAME__: brand.business_name || '',
    __STUDIO_ADDRESS__: String(brand.address || '').split('\n').map((l) => l.trim()).filter(Boolean).join(', '),
    __STUDIO_EMAIL__: brand.email || '',
    __STUDIO_PHONE__: brand.phone || '',
  };
}

// Fill placeholders. Missing values become ⟦Label⟧ so screens can highlight them and PDFs show a blank.
export function fillClause(body, values) {
  let out = String(body || '');
  PLACEHOLDERS.forEach(([token, label]) => {
    const v = values[token];
    out = out.split(token).join(v ? v : `${MISSING_OPEN}${label}${MISSING_CLOSE}`);
  });
  return out;
}

// Turn clause text into blocks: { type: 'sub' | 'para' | 'list', lines | items | text }.
export function parseClause(text) {
  const blocks = [];
  let para = [];
  let list = [];
  const flushPara = () => { if (para.length) { blocks.push({ type: 'para', lines: para }); para = []; } };
  const flushList = () => { if (list.length) { blocks.push({ type: 'list', items: list }); list = []; } };
  String(text || '').split('\n').forEach((raw) => {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); return; }
    if (/^##\s+/.test(line)) { flushPara(); flushList(); blocks.push({ type: 'sub', text: line.replace(/^##\s+/, '') }); return; }
    if (/^\s*[-•]\s+/.test(line)) { flushPara(); list.push(line.replace(/^\s*[-•]\s+/, '')); return; }
    flushList();
    para.push(line);
  });
  flushPara();
  flushList();
  return blocks;
}

// Split inline text into runs: { text, bold, missing }.
export function inlineRuns(text) {
  const runs = [];
  String(text).split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
    if (!part) return;
    const bold = /^\*\*[^*]+\*\*$/.test(part);
    const inner = bold ? part.slice(2, -2) : part;
    inner.split(new RegExp(`(${MISSING_OPEN}[^${MISSING_CLOSE}]*${MISSING_CLOSE})`, 'g')).forEach((piece) => {
      if (!piece) return;
      const missing = piece.startsWith(MISSING_OPEN) && piece.endsWith(MISSING_CLOSE);
      runs.push({ text: missing ? piece.slice(1, -1) : piece, bold, missing });
    });
  });
  return runs;
}

export function plainText(text) {
  return String(text || '').replace(/\*\*/g, '').replace(new RegExp(`${MISSING_OPEN}[^${MISSING_CLOSE}]*${MISSING_CLOSE}`, 'g'), '__________');
}
