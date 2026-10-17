import React from 'react';

export const INDUSTRIES = ['Beauty & Wellness', 'Fashion & Lifestyle', 'Hospitality', 'Interiors', 'Other'];

export function blankClient() {
  return { name: '', contact: '', email: '', location: '', industry: 'Beauty & Wellness', color: '#1B2B4B' };
}

export function clientToForm(client) {
  return {
    name: client?.name || '',
    contact: client?.contact || '',
    email: client?.email || '',
    location: client?.location || '',
    industry: client?.industry || 'Other',
    color: client?.color || '#1B2B4B',
  };
}

// Shared fields for adding and editing a client.
export default function ClientForm({ id, value, onChange, onSubmit, error }) {
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  return (
    <form id={id} onSubmit={onSubmit}>
      {error && <div className="form-error">{error}</div>}
      <div className="fc">
        <label className="fc-label" htmlFor={`${id}-name`}>Brand name</label>
        <input id={`${id}-name`} className="fi" value={value.name} onChange={set('name')} required autoFocus />
      </div>
      <div className="fi-row">
        <div className="fc">
          <label className="fc-label" htmlFor={`${id}-contact`}>Main contact</label>
          <input id={`${id}-contact`} className="fi" value={value.contact} onChange={set('contact')} />
        </div>
        <div className="fc">
          <label className="fc-label" htmlFor={`${id}-email`}>Email</label>
          <input id={`${id}-email`} className="fi" type="email" value={value.email} onChange={set('email')} />
        </div>
      </div>
      <div className="fi-row">
        <div className="fc">
          <label className="fc-label" htmlFor={`${id}-location`}>Location</label>
          <input id={`${id}-location`} className="fi" value={value.location} onChange={set('location')} placeholder="City" />
        </div>
        <div className="fc">
          <label className="fc-label" htmlFor={`${id}-industry`}>Industry</label>
          <select id={`${id}-industry`} className="fi fsel" value={value.industry} onChange={set('industry')}>
            {INDUSTRIES.map((industry) => <option key={industry}>{industry}</option>)}
          </select>
        </div>
      </div>
      <div className="fc" style={{ marginBottom: 0 }}>
        <label className="fc-label" htmlFor={`${id}-color`}>Brand colour</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            id={`${id}-color`}
            type="color"
            value={value.color}
            onChange={set('color')}
            style={{ width: 44, height: 36, borderRadius: 6, border: '1px solid var(--line)', cursor: 'pointer', background: 'none', padding: 2 }}
          />
          <span className="muted" style={{ fontSize: 13 }}>Used for this client’s mark across Vela</span>
        </div>
      </div>
    </form>
  );
}
