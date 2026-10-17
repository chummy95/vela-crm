// Demo-mode data layer: same exports as src/utils/api.js, backed by in-memory sample data.
// Used only by `npm run demo` (vite.demo.config.js). Never touches Firebase.

export const USER_ROLES = { STUDIO: 'studio', CLIENT: 'client' };
export function normalizeRole(value) {
  return value === 'client' ? 'client' : 'studio';
}

const iso = (d) => new Date(d).toISOString();
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
let seq = 100;
const id = () => `demo-${seq++}`;

const db = {
  clients: [
    { id: 'c1', name: 'Maison Noor', contact: 'Layla Haddad', email: 'layla@maisonnoor.co', location: 'Riyadh', industry: 'Beauty & Wellness', color: '#7A4E3B', portal_user_id: 'p1', portal_email: 'layla@maisonnoor.co' },
    { id: 'c2', name: 'Olive & Ash', contact: 'Hannah Pierce', email: 'hannah@oliveandash.com', location: 'London', industry: 'Interiors', color: '#5E6B4E' },
    { id: 'c3', name: 'Saha Retreats', contact: 'Omar Al-Fayez', email: 'omar@saharetreats.sa', location: 'AlUla', industry: 'Hospitality', color: '#B07A4A' },
    { id: 'c4', name: 'Lumen Skin', contact: 'Priya Nair', email: 'priya@lumenskin.com', location: 'Dubai', industry: 'Beauty & Wellness', color: '#2F4A6B' },
    { id: 'c5', name: 'Kettle House', contact: 'James Ward', email: 'james@kettlehouse.co.uk', location: 'Bath', industry: 'Fashion & Lifestyle', color: '#3C3C3C' },
  ],
  projects: [
    { id: 'pr1', client_id: 'c1', client_name: 'Maison Noor', client_color: '#7A4E3B', service: 'Brand Identity', value: '4800', stage: 3, start_date: day(-34), timeline: '8 weeks', status: 'active', files: [{ id: 'f1', name: 'Moodboard v2.pdf', stage_index: 1, file_type: 'pdf', uploaded_at: iso(day(-20)) }], signoffs: [0, 1, 2], created_at: iso(day(-34)) },
    { id: 'pr2', client_id: 'c3', client_name: 'Saha Retreats', client_color: '#B07A4A', service: 'Web Design', value: '6500', stage: 2, start_date: day(-18), timeline: '10 weeks', status: 'active', files: [], signoffs: [], created_at: iso(day(-18)) },
    { id: 'pr3', client_id: 'c4', client_name: 'Lumen Skin', client_color: '#2F4A6B', service: 'Packaging Design', value: '3900', stage: 1, start_date: day(-9), timeline: '6 weeks', status: 'active', files: [], signoffs: [], created_at: iso(day(-9)) },
    { id: 'pr4', client_id: 'c2', client_name: 'Olive & Ash', client_color: '#5E6B4E', service: 'Brand Identity', value: '4200', stage: 5, start_date: day(-80), timeline: '8 weeks', status: 'delivered', files: [], signoffs: [], created_at: iso(day(-80)) },
  ],
  invoices: [
    { id: 'i1', client_id: 'c1', client_name: 'Maison Noor', project_id: 'pr1', description: 'Brand Identity — 50% deposit', amount: '2400', due_date: day(-30), status: 'paid', created_at: iso(day(-34)) },
    { id: 'i2', client_id: 'c3', client_name: 'Saha Retreats', project_id: 'pr2', description: 'Web Design — deposit', amount: '3250', due_date: day(4), status: 'unpaid', created_at: iso(day(-18)) },
    { id: 'i3', client_id: 'c4', client_name: 'Lumen Skin', project_id: 'pr3', description: 'Packaging — deposit', amount: '1950', due_date: day(-3), status: 'unpaid', created_at: iso(day(-9)) },
    { id: 'i5', client_id: 'c1', client_name: 'Maison Noor', project_id: 'pr1', description: 'Brand Identity — final balance', amount: '2400', due_date: day(12), status: 'unpaid', created_at: iso(day(-1)) },
    { id: 'i4', client_id: 'c2', client_name: 'Olive & Ash', project_id: 'pr4', description: 'Brand Identity — final balance', amount: '2100', due_date: day(-45), status: 'paid', created_at: iso(day(-50)) },
  ],
  proposals: [
    { id: 'pp0', client_id: 'c1', client_name: 'Maison Noor', service: 'Brand Identity', date: day(-40), value: '4800', template: 'A', primary_color: '#1B2B4B', accent_color: '#C9A84C', intro: 'Thank you for sharing the Maison Noor story with me.', overview: 'A refined identity for a Riyadh fragrance house, rooted in heritage and made for a modern audience.', packages: ['Signature identity'], deliverables: ['Logo suite', 'Colour and type system', 'Brand guidelines'], timeline: ['Strategy, 2 weeks', 'Identity design, 4 weeks', 'Guidelines, 2 weeks'], terms: '', process: '', status: 'approved', created_at: iso(day(-40)) },
    { id: 'pp1', client_id: 'c5', client_name: 'Kettle House', service: 'Brand Identity', date: day(-2), value: '4500', template: 'A', primary_color: '#1B2B4B', accent_color: '#C9A84C', intro: 'A considered identity for a slow-living lifestyle brand.', overview: '', packages: ['Signature'], deliverables: ['Logo suite', 'Brand guidelines', 'Social templates'], timeline: ['Strategy — 2 wks', 'Design — 4 wks'], terms: '', process: '', status: 'sent', created_at: iso(day(-2)) },
    { id: 'pp2', client_id: 'c4', client_name: 'Lumen Skin', service: 'Packaging Design', date: day(-14), value: '3900', template: 'A', primary_color: '#1B2B4B', accent_color: '#C9A84C', intro: '', overview: '', packages: [], deliverables: ['3 SKUs', 'Print-ready files'], timeline: [], terms: '', process: '', status: 'approved', created_at: iso(day(-14)) },
  ],
  contracts: [
    { id: 'ct0', client_id: 'c1', client_name: 'Maison Noor', client_email: 'layla@maisonnoor.co', service: 'Brand Identity', value: '4800', start_date: day(-34), duration: '8 weeks', date: day(-36), primary_color: '#1B2B4B', accent_color: '#C9A84C', clauses: [], signed: true, created_at: iso(day(-36)) },
    { id: 'ct1', client_id: 'c4', client_name: 'Lumen Skin', client_email: 'priya@lumenskin.com', service: 'Packaging Design', value: '3900', start_date: day(-9), duration: '6 weeks', date: day(-11), primary_color: '#1B2B4B', accent_color: '#C9A84C', clauses: [], signed: true, created_at: iso(day(-11)) },
    { id: 'ct2', client_id: 'c5', client_name: 'Kettle House', client_email: 'james@kettlehouse.co.uk', service: 'Brand Identity', value: '4500', start_date: day(10), duration: '8 weeks', date: day(-1), primary_color: '#1B2B4B', accent_color: '#C9A84C', clauses: [], signed: false, created_at: iso(day(-1)) },
  ],
  events: [
    { id: 'e1', client_id: 'c1', client_name: 'Maison Noor', title: 'First draft presentation', event_type: 'Presentation', date: day(1), time: '11:00', duration: '60', meeting_link: '', color: '#7A4E3B', created_at: iso(day(-5)) },
    { id: 'e2', client_id: 'c5', client_name: 'Kettle House', title: 'Discovery call', event_type: 'Call', date: day(2), time: '15:30', duration: '45', meeting_link: '', color: '#3C3C3C', created_at: iso(day(-2)) },
    { id: 'e3', client_id: 'c3', client_name: 'Saha Retreats', title: 'Design concepts review', event_type: 'Review', date: day(6), time: '10:00', duration: '60', meeting_link: '', color: '#B07A4A', created_at: iso(day(-1)) },
  ],
  submissions: [
    { id: 's1', data: { 'Full Name': 'Reem Al-Qahtani', 'Email Address': 'reem@darreem.sa', 'Tell me about your project': 'We are launching a modest-wear atelier in Riyadh next spring and need a full identity, packaging for our gift boxes and a simple website.', 'Brand / Business Name': 'Dar Reem Atelier', 'Service Interested In': 'Full Suite', 'Project Budget': '£3,000–£5,000+' }, submitted_at: iso(day(-1)) },
    { id: 's2', data: { full_name: 'Sophie Grant', email_address: 'sophie@fernandfield.co.uk', brand_business_name: 'Fern & Field', service_interested_in: 'Brand Identity', project_budget: '£1,500–£3,000' }, submitted_at: iso(day(-4)) },
  ],
  formFields: [
    { label: 'Full Name', field_type: 'text', required: 1, options: '', sort_order: 0 },
    { label: 'Email Address', field_type: 'email', required: 1, options: '', sort_order: 1 },
    { label: 'Brand / Business Name', field_type: 'text', required: 1, options: '', sort_order: 2 },
    { label: 'Service Interested In', field_type: 'select', required: 1, options: 'Brand Identity,Packaging Design,Web Design,Full Suite', sort_order: 3 },
    { label: 'Tell me about your project', field_type: 'textarea', required: 1, options: '', sort_order: 4 },
  ],
  messages: [
    { id: 'm1', client_id: 'c1', client_name: 'Maison Noor', color: '#7A4E3B', text: 'Loved the moodboard — can we push the terracotta a little warmer?', outbound: false, sent_at: iso(day(-1)) },
    { id: 'm2', client_id: 'c1', client_name: 'Maison Noor', color: '#7A4E3B', text: 'Absolutely. I’ll bring two warmer options to Thursday’s presentation.', outbound: true, sent_at: iso(day(0)) },
    { id: 'm3', client_id: 'c3', client_name: 'Saha Retreats', color: '#B07A4A', text: 'Sharing the photography folder for the villas now.', outbound: false, sent_at: iso(day(-2)) },
  ],
};

// When previewing the client portal, mimic Firestore rules: a client only sees their own records.
let scopeClientId = '';
export function setDemoScope(clientId) { scopeClientId = clientId || ''; }
const visible = (coll) => (scopeClientId
  ? db[coll].filter((r) => (coll === 'clients' ? r.id === scopeClientId : r.client_id === scopeClientId))
  : db[coll]);

const delay = (v) => new Promise((r) => setTimeout(() => r(JSON.parse(JSON.stringify(v))), 80));
const byId = (coll, rid) => db[coll].find((r) => r.id === rid);
function crud(coll) {
  return {
    async list() { return delay(visible(coll)); },
    async get(rid) { return delay(byId(coll, rid)); },
    async create(body) {
      const client = body.client_id ? byId('clients', body.client_id) : null;
      const row = { id: id(), created_at: new Date().toISOString(), client_name: client?.name || '', client_color: client?.color, ...body };
      db[coll].unshift(row);
      return delay(row);
    },
    async update(rid, body) {
      const row = byId(coll, rid);
      Object.assign(row, body);
      return delay(row);
    },
    async remove(rid) {
      db[coll] = db[coll].filter((r) => r.id !== rid);
      return delay({ ok: true });
    },
  };
}

export const authAPI = {
  async login() { return { user: DEMO_USER, redirectTo: '/' }; },
  async register() { return { user: DEMO_USER, redirectTo: '/' }; },
  async logout() { return {}; },
  async resetPassword() { return { message: 'Demo mode: no email sent.' }; },
};

export const DEMO_USER = { id: 'demo', name: 'Mayaa', studio_name: 'Creative Mayaa Studio', email: 'studio@example.com', role: 'studio', currency: 'GBP' };

export const clientsAPI = {
  ...crud('clients'),
  async createPortalAccess(rid, form) {
    const row = byId('clients', rid);
    Object.assign(row, { portal_user_id: id(), portal_email: form.email, portal_name: form.name });
    return delay(row);
  },
};

export const projectsAPI = {
  ...crud('projects'),
  async advStage(rid, stage) {
    const row = byId('projects', rid);
    row.stage = Number(stage);
    return delay({ success: true, stage: row.stage });
  },
  async signOff(rid, stageIndex) {
    const row = byId('projects', rid);
    row.signoffs = Array.from(new Set([...(row.signoffs || []), Number(stageIndex)]));
    return delay({ success: true, stage_index: Number(stageIndex) });
  },
  async addFile(rid, body = {}) {
    const row = byId('projects', rid);
    const file = { id: id(), uploaded_at: new Date().toISOString(), ...body, stage_index: Number(body.stage_index ?? row.stage) };
    row.files = [...(row.files || []), file];
    return delay(file);
  },
};

export const invoicesAPI = {
  ...crud('invoices'),
  async updateStatus(rid, status) {
    const row = byId('invoices', rid);
    row.status = typeof status === 'object' ? status.status : status;
    return delay({ success: true, status: row.status });
  },
};

export const proposalsAPI = crud('proposals');
export const contractsAPI = {
  ...crud('contracts'),
  async sign(rid) {
    const row = byId('contracts', rid);
    row.signed = true;
    return delay({ success: true });
  },
};
export const eventsAPI = crud('events');

export const formsAPI = {
  async getFields() { return delay(db.formFields); },
  async getPublicFields() { return delay(db.formFields); },
  async saveFields(fields) { db.formFields = fields.filter((f) => f.label); return delay({ success: true, fields: db.formFields }); },
  async submissions() { return delay(scopeClientId ? [] : db.submissions); },
  async submitPublic(_userId, data) {
    db.submissions.unshift({ id: id(), data, submitted_at: new Date().toISOString() });
    return delay({ ok: true });
  },
};

export const analyticsAPI = {
  async revenue(months) {
    const paid = db.invoices.filter((i) => i.status === 'paid');
    const map = new Map();
    db.projects.forEach((p) => map.set(p.service, (map.get(p.service) || 0) + 1));
    return delay({
      invoices: paid,
      byService: [...map].map(([service, count]) => ({ service, count })),
      months,
      totalPaid: paid.reduce((s, i) => s + Number(i.amount), 0),
      totalOutstanding: db.invoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + Number(i.amount), 0),
    });
  },
  async pipeline() {
    return delay({
      enquiries: db.submissions.length,
      proposals_sent: db.proposals.length,
      contracts_signed: db.contracts.filter((c) => c.signed).length,
      active_projects: db.projects.filter((p) => p.status === 'active').length,
      delivered: db.projects.filter((p) => p.status === 'delivered').length,
    });
  },
};

export const messagesAPI = {
  async list() {
    const latest = new Map();
    [...visible('messages')].sort((a, b) => b.sent_at.localeCompare(a.sent_at)).forEach((m) => {
      if (!latest.has(m.client_id)) {
        latest.set(m.client_id, { client_id: m.client_id, client_name: m.client_name, color: m.color, latest_message: m.text, latest_at: m.sent_at });
      }
    });
    return delay([...latest.values()]);
  },
  async thread(clientId) {
    const target = scopeClientId || clientId;
    return delay(db.messages.filter((m) => m.client_id === target).sort((a, b) => a.sent_at.localeCompare(b.sent_at)));
  },
  async send(clientId, text) {
    const target = scopeClientId || clientId;
    const c = byId('clients', target);
    const row = { id: id(), client_id: target, client_name: c?.name, color: c?.color, text, outbound: !scopeClientId, sent_at: new Date().toISOString() };
    db.messages.push(row);
    return delay(row);
  },
};
