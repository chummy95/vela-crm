export const STAGES = {
  brand:     ['Strategy','Brand Identity Presentation','Brand Touchpoints','First Draft','Final Draft','Offboarding'],
  packaging: ['Discovery & Strategy','Structural Design','Design Concepts','Design Refinement','Print Ready Files','Offboarding'],
  web:       ['Discovery & Strategy','Wireframes','Design Concepts','Full Design','Development','Launch','Offboarding'],
};

export const STAGE_ICONS = {
  brand:     ['🎯','✨','🔤','📝','🏆','🎉'],
  packaging: ['🎯','📐','🎨','🔄','🖨️','🎉'],
  web:       ['🎯','🗺️','🎨','💻','⚙️','🚀','🎉'],
};

export const STATUS_COLORS = {
  draft:     { bg: 'var(--navy-pale)', color: 'var(--navy)' },
  sent:      { bg: 'var(--warn-bg)',   color: 'var(--warn)' },
  approved:  { bg: 'var(--ok-bg)',     color: 'var(--ok)'   },
  signed:    { bg: 'var(--ok-bg)',     color: 'var(--ok)'   },
  paid:      { bg: 'var(--ok-bg)',     color: 'var(--ok)'   },
  unpaid:    { bg: 'var(--warn-bg)',   color: 'var(--warn)' },
  active:    { bg: 'var(--blue-bg)',   color: 'var(--blue)' },
  pending:   { bg: 'var(--warn-bg)',   color: 'var(--warn)' },
  completed: { bg: 'var(--ok-bg)',     color: 'var(--ok)'   },
};

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export const DEFAULT_CLAUSES = [
  { id: 'c1', title: 'Scope of Work',       body: 'The Studio agrees to provide __SERVICE__ services for the Client as detailed in the associated proposal.' },
  { id: 'c2', title: 'Payment Terms',       body: 'The total project value is __VALUE__. A non-refundable deposit of 50% is required before work commences. The balance is due upon final delivery.' },
  { id: 'c3', title: 'Intellectual Property', body: 'Upon receipt of full payment, all IP rights transfer exclusively to the Client. The Studio retains portfolio display rights.' },
  { id: 'c4', title: 'Revisions',           body: 'The project includes up to three revision rounds per stage. Additional rounds are billed at £150/hour.' },
  { id: 'c5', title: 'Cancellation',        body: 'The deposit is non-refundable if the Client cancels after work commences.' },
  { id: 'c6', title: 'Confidentiality',     body: 'Both parties agree to keep all shared information confidential.' },
  { id: 'c7', title: 'Governing Law',       body: 'This agreement is governed by the laws of England and Wales.' },
];
