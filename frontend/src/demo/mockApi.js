// Demo-mode data layer: same exports as src/utils/api.js, backed by in-memory sample data.
// Used only by `npm run demo` (vite.demo.config.js). Never touches Firebase.
import { brandStrategyStarter, projectFeedbackStarter } from '../utils/questionnaires';
import { sanitizeWorkflow } from '../utils/workflow';
import { DEFAULT_STUDIO_PROFILE, formatInvoiceNumber, invoiceTotals } from '../utils/invoices';
import { DESIGN_CONTRACT_TEMPLATE } from '../utils/contractTemplate';
import { STUDIO_ENQUIRY_TEMPLATE } from '../utils/intakeForm';

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
    { id: 'pr1', client_id: 'c1', client_name: 'Maison Noor', client_color: '#7A4E3B', service: 'Brand Identity', value: '4800', stage: 1, start_date: day(-34), timeline: '8 weeks', status: 'active', files: [{ id: 'f1', name: 'Moodboard v2.pdf', stage_index: 1, file_type: 'pdf', uploaded_at: iso(day(-20)) }], signoffs: [0, 1, 2], created_at: iso(day(-34)) },
    { id: 'pr2', client_id: 'c3', client_name: 'Saha Retreats', client_color: '#B07A4A', service: 'Web Design', value: '6500', stage: 2, start_date: day(-18), timeline: '10 weeks', status: 'active', files: [], signoffs: [], created_at: iso(day(-18)) },
    { id: 'pr3', client_id: 'c4', client_name: 'Lumen Skin', client_color: '#2F4A6B', service: 'Packaging Design', value: '3900', stage: 1, start_date: day(-9), timeline: '6 weeks', status: 'active', files: [], signoffs: [], created_at: iso(day(-9)) },
    { id: 'pr4', client_id: 'c2', client_name: 'Olive & Ash', client_color: '#5E6B4E', service: 'Brand Identity', value: '4200', stage: 2, start_date: day(-80), timeline: '8 weeks', status: 'delivered', files: [], signoffs: [], created_at: iso(day(-80)) },
  ],
  invoices: [
    { id: 'i1', number: 'INV-0001', issue_date: day(-34), vat_rate: '20', vat_label: 'VAT', currency: 'GBP', items: [{ description: 'Brand identity, 50% deposit', quantity: 1, unit_price: 2000 }], subtotal: '2000', vat_amount: '400', bill_to: { name: 'Maison Noor', contact: 'Layla Haddad', email: 'layla@maisonnoor.com', address: 'King Fahd Road\nRiyadh 12271\nSaudi Arabia' }, paid_at: iso(day(-31)), client_id: 'c1', client_name: 'Maison Noor', project_id: 'pr1', description: 'Brand Identity — 50% deposit', amount: '2400', due_date: day(-30), status: 'paid', created_at: iso(day(-34)) },
    { id: 'i2', client_id: 'c3', client_name: 'Saha Retreats', project_id: 'pr2', description: 'Web Design — deposit', amount: '3250', due_date: day(4), status: 'unpaid', created_at: iso(day(-18)) },
    { id: 'i3', client_id: 'c4', client_name: 'Lumen Skin', project_id: 'pr3', description: 'Packaging — deposit', amount: '1950', due_date: day(-3), status: 'unpaid', created_at: iso(day(-9)) },
    { id: 'i5', number: 'INV-0005', issue_date: day(-1), vat_rate: '20', vat_label: 'VAT', currency: 'GBP', items: [{ description: 'Brand identity, final balance', quantity: 1, unit_price: 1600 }, { description: 'Packaging design, 2 SKUs', quantity: 2, unit_price: 200 }], subtotal: '2000', vat_amount: '400', bill_to: { name: 'Maison Noor', contact: 'Layla Haddad', email: 'layla@maisonnoor.com', address: 'King Fahd Road\nRiyadh 12271\nSaudi Arabia' }, notes: '', client_id: 'c1', client_name: 'Maison Noor', project_id: 'pr1', description: 'Brand Identity — final balance', amount: '2400', due_date: day(12), status: 'unpaid', created_at: iso(day(-1)) },
    { id: 'i4', client_id: 'c2', client_name: 'Olive & Ash', project_id: 'pr4', description: 'Brand Identity — final balance', amount: '2100', due_date: day(-45), status: 'paid', created_at: iso(day(-50)) },
  ],
  proposals: [
    { id: 'pp0', client_id: 'c1', client_name: 'Maison Noor', service: 'Brand Identity', date: day(-40), value: '4800', template: 'A', primary_color: '#1B2B4B', accent_color: '#C9A84C', intro: 'Thank you for sharing the Maison Noor story with me.', overview: 'A refined identity for a Riyadh fragrance house, rooted in heritage and made for a modern audience.', packages: ['Signature identity'], deliverables: ['Logo suite', 'Colour and type system', 'Brand guidelines'], timeline: ['Strategy, 2 weeks', 'Identity design, 4 weeks', 'Guidelines, 2 weeks'], terms: '', process: '', status: 'approved', created_at: iso(day(-40)) },
    { id: 'pp1', client_id: 'c5', client_name: 'Kettle House', service: 'Brand Identity', date: day(-2), value: '4500', template: 'A', primary_color: '#1B2B4B', accent_color: '#C9A84C', intro: 'A considered identity for a slow-living lifestyle brand.', overview: '', packages: ['Signature'], deliverables: ['Logo suite', 'Brand guidelines', 'Social templates'], timeline: ['Strategy — 2 wks', 'Design — 4 wks'], terms: '', process: '', status: 'sent', created_at: iso(day(-2)) },
    { id: 'pp2', client_id: 'c4', client_name: 'Lumen Skin', service: 'Packaging Design', date: day(-14), value: '3900', template: 'A', primary_color: '#1B2B4B', accent_color: '#C9A84C', intro: '', overview: '', packages: [], deliverables: ['3 SKUs', 'Print-ready files'], timeline: [], terms: '', process: '', status: 'approved', created_at: iso(day(-14)) },
  ],
  contracts: [
    { id: 'ct3', client_id: 'c1', client_name: 'Maison Noor', client_contact: 'Layla Haddad', client_email: 'layla@maisonnoor.co', client_address: 'Riyadh, Saudi Arabia', service: 'Packaging design for the Maison Noor fragrance range', value: '3600', start_date: day(7), end_date: day(49), duration: '6 weeks', date: day(-1), primary_color: '#1B2B4B', accent_color: '#C9A84C', clauses: DESIGN_CONTRACT_TEMPLATE, signed: false, created_at: iso(day(-1)) },
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
    { id: 's1', data: { your_name: 'Reem Al-Qahtani', your_location: 'Riyadh, Saudi Arabia', your_email_address: 'reem@darreem.sa', instagram_handle_if_any: '@darreem.atelier', your_business_name: 'Dar Reem Atelier', tell_us_more_about_your_business_briefly_describe_your_product_or_service: 'A modest-wear atelier launching in Riyadh next spring. Made-to-order abayas and occasion wear in natural fabrics.', what_do_you_need_help_with_and_what_are_you_hoping_we_achieve_together: 'A full identity that feels quietly luxurious, packaging for our gift boxes, and a simple website to take appointments.', what_service_are_you_most_interested_in: 'Brand Strategy + Brand Identity, Packaging Design, Website Design', what_investment_range_feels_most_aligned_with_you_our_branding_packages_start_at: '$4500 - $6000', when_are_you_hoping_to_begin_working_together: 'January', how_did_you_hear_about_us: 'Instagram, Other: a friend’s launch' }, submitted_at: iso(day(-1)) },
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

const starter = brandStrategyStarter();
const ans = (i) => starter.questions[i].id;
db.questionnaires = [
  { id: 'qt1', user_id: 'demo', ...starter, created_at: iso(day(-60)), updated_at: iso(day(-60)) },
  { id: 'qt2', user_id: 'demo', ...projectFeedbackStarter(), created_at: iso(day(-60)), updated_at: iso(day(-60)) },
];
db.questionnaire_responses = [
  {
    id: 'qr1', user_id: 'demo', studio_email: 'studio@example.com', client_id: 'c1', client_name: 'Maison Noor', contact_name: 'Layla Haddad',
    project_id: 'pr1', project_service: 'Brand Identity', stage_index: 0, stage_label: 'Strategy', step_id: 's0-brand-strategy-questionn', template_id: 'qt1', title: starter.title, description: starter.description,
    questions: starter.questions,
    answers: {
      [ans(1)]: 'Maison Noor is a Riyadh fragrance house making oud-based perfumes for a younger, design-led audience.',
      [ans(2)]: 'My grandmother blended her own oud at home. I wanted to bring that ritual to people my age without the heavy, old-fashioned packaging.',
      [ans(5)]: 'Women 25 to 40 in Riyadh, Jeddah and Dubai who care about craft and quiet luxury, buy for themselves, and gift often.',
      [ans(6)]: 'A heritage scent that feels personal and modern, not like their mother’s perfume.',
      [ans(7)]: ['Instagram', 'Word of mouth', 'Shops and stockists'],
      [ans(9)]: 'Big oud houses feel traditional; niche Western brands feel distant. We sit in between, with real family recipes.',
      [ans(10)]: 'Premium',
      [ans(12)]: 'Warm, considered, quietly confident, generous',
      [ans(13)]: 'Loud, cheap, overly ornate',
      [ans(17)]: 'Love warm terracotta, sand and deep green. Avoid gold foil everywhere.',
      [ans(21)]: ['Packaging', 'Social media', 'Website'],
      [ans(22)]: 'Saudi Arabia and UAE first, then UK. English and Arabic.',
      [ans(23)]: 'Soft launch for Ramadan.',
    },
    status: 'submitted', seen_by_studio: false, sent_at: iso(day(-30)), updated_at: iso(day(0)), submitted_at: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
  },
  {
    id: 'qr2', user_id: 'demo', studio_email: 'studio@example.com', client_id: 'c4', client_name: 'Lumen Skin', contact_name: 'Priya Nair',
    project_id: 'pr3', project_service: 'Packaging Design', stage_index: 0, template_id: 'qt1', title: starter.title, description: starter.description,
    questions: starter.questions, answers: { [ans(1)]: 'Clean, clinical skincare for sensitive skin.' },
    status: 'in_progress', seen_by_studio: false, sent_at: iso(day(-8)), updated_at: iso(day(-2)), submitted_at: '',
  },
  {
    id: 'qr3', user_id: 'demo', studio_email: 'studio@example.com', client_id: 'c1', client_name: 'Maison Noor', contact_name: 'Layla Haddad',
    project_id: 'pr1', project_service: 'Brand Identity', stage_index: 1, stage_label: 'Brand Identity Presentation', template_id: 'qt1', title: 'Logo direction check-in',
    description: 'A few quick questions so I can refine the first draft before our call.',
    questions: [
      { id: 'f1', type: 'textarea', label: 'What’s your first reaction to the logo direction?', help: '', options: '', required: true },
      { id: 'f2', type: 'choice', label: 'Which colour palette feels most like Maison Noor?', help: '', options: 'Palette A, Palette B, Palette C', required: true },
      { id: 'f3', type: 'textarea', label: 'Anything you’d like changed?', help: '', options: '', required: false },
    ],
    answers: {}, status: 'sent', seen_by_studio: false, sent_at: iso(day(-1)), updated_at: iso(day(-1)), submitted_at: '',
  },
];

// Sample artwork for the demo, drawn as simple SVGs.
const art = (label, bg, fg = '#F5F0E8') => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='800' height='560'><rect width='800' height='560' fill='${bg}'/><text x='400' y='290' font-family='Georgia' font-size='54' fill='${fg}' text-anchor='middle'>${label}</text></svg>`)}`;
db.reviews = [
  { id: 'rv1', user_id: 'demo', client_id: 'c1', client_name: 'Maison Noor', contact_name: 'Layla Haddad', project_id: 'pr1', project_service: 'Brand Identity', stage_index: 0, stage_label: 'Strategy', step_id: 's0-strategy-first-draft', title: 'Strategy first draft', note: 'Here is the first draft of your brand strategy: positioning, audience and tone of voice.', files: [{ name: 'Maison Noor brand strategy v1.pdf', url: 'https://example.com/strategy-v1.pdf', kind: 'file', type: 'application/pdf', size: 2400000 }], kind: 'review', status: 'changes_requested', round: 1, sent_at: iso(day(-24)), decided_at: iso(day(-22)), decision_note: 'Can we lean more into the heritage story?', client_activity_at: iso(day(-22)), studio_seen_at: iso(day(-21)), updated_at: iso(day(-22)) },
  { id: 'rv2', user_id: 'demo', client_id: 'c1', client_name: 'Maison Noor', contact_name: 'Layla Haddad', project_id: 'pr1', project_service: 'Brand Identity', stage_index: 0, stage_label: 'Strategy', step_id: 's0-strategy-first-draft', title: 'Strategy first draft', note: 'Revised with the heritage story at the centre.', files: [{ name: 'Maison Noor brand strategy v2.pdf', url: 'https://example.com/strategy-v2.pdf', kind: 'file', type: 'application/pdf', size: 2600000 }], kind: 'review', status: 'approved', round: 2, sent_at: iso(day(-20)), decided_at: iso(day(-19)), decision_note: '', client_activity_at: iso(day(-19)), studio_seen_at: iso(day(-18)), updated_at: iso(day(-19)) },
  { id: 'rv3', user_id: 'demo', client_id: 'c1', client_name: 'Maison Noor', contact_name: 'Layla Haddad', project_id: 'pr1', project_service: 'Brand Identity', stage_index: 1, stage_label: 'Brand Identity Presentation', step_id: 's1-creative-direction', title: 'Creative direction', note: 'Two routes: Desert Garden and Night Market.', files: [{ name: 'Route A, Desert Garden', url: art('Desert Garden', '#B07A4A'), kind: 'file', type: 'image/svg+xml', size: 200000 }, { name: 'Route B, Night Market', url: art('Night Market', '#1B2B4B'), kind: 'file', type: 'image/svg+xml', size: 200000 }, { name: 'Pinterest board', url: 'https://pinterest.com/example', kind: 'link', type: '', size: 0 }], kind: 'review', status: 'approved', round: 1, sent_at: iso(day(-12)), decided_at: iso(day(-10)), decision_note: 'Desert Garden all the way!', client_activity_at: iso(day(-10)), studio_seen_at: iso(day(-9)), updated_at: iso(day(-10)) },
  { id: 'rv4', user_id: 'demo', client_id: 'c1', client_name: 'Maison Noor', contact_name: 'Layla Haddad', project_id: 'pr1', project_service: 'Brand Identity', stage_index: 1, stage_label: 'Brand Identity Presentation', step_id: 's1-logo-design', title: 'Logo design', note: 'Three logo concepts built on the Desert Garden direction. Let me know your favourite.', files: [{ name: 'Concept 1, Monogram', url: art('MN', '#7A4E3B'), kind: 'file', type: 'image/svg+xml', size: 150000 }, { name: 'Concept 2, Wordmark', url: art('Maison Noor', '#F5F0E8', '#7A4E3B'), kind: 'file', type: 'image/svg+xml', size: 150000 }, { name: 'Concept 3, Seal', url: art('✦ Noor ✦', '#5E6B4E'), kind: 'file', type: 'image/svg+xml', size: 150000 }], kind: 'review', status: 'in_review', round: 1, sent_at: iso(day(-2)), decided_at: '', decision_note: '', client_activity_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(), studio_seen_at: iso(day(-2)), updated_at: iso(day(0)) },
];
db.comments = {
  rv1: [{ id: 'cm0', author_role: 'client', author_name: 'Layla Haddad', text: 'Can we lean more into the heritage story?', decision: 'changes_requested', created_at: iso(day(-22)) }],
  rv3: [{ id: 'cm1', author_role: 'client', author_name: 'Layla Haddad', text: 'Desert Garden all the way!', decision: 'approved', created_at: iso(day(-10)) }],
  rv4: [
    { id: 'cm2', author_role: 'client', author_name: 'Layla Haddad', text: 'Loving concept 1. Could the monogram feel a little softer?', created_at: iso(day(-1)) },
    { id: 'cm3', author_role: 'studio', author_name: 'Mayaa', text: 'Absolutely, I’ll round the terminals and share a tweak.', created_at: iso(day(-1)) },
    { id: 'cm4', author_role: 'client', author_name: 'Layla Haddad', text: 'Perfect, thank you!', created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString() },
  ],
};

const listeners = new Set();
function emitResponses() { listeners.forEach((fn) => fn(JSON.parse(JSON.stringify(db.questionnaire_responses)))); }

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
      Object.assign(row, body.workflow ? { ...body, workflow: sanitizeWorkflow(body.workflow) } : body);
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

const studioProfile = {
  ...DEFAULT_STUDIO_PROFILE,
  business_name: 'Creative Mayaa Studio',
  legal_name: 'Mayaa',
  phone: '+44 20 7946 0000',
  address: '71-75 Shelton Street\nLondon WC2H 9JQ\nUnited Kingdom',
  email: 'hello@creativemayaa.studio',
  website: 'creativemayaa.studio',
  vat_number: 'GB 123 4567 89',
  vat_rate: '20',
  next_invoice_number: 6,
  bank_details: 'Creative Mayaa Studio Ltd\nSort code 04-00-04\nAccount 12345678',
  invoice_notes: 'Thank you for your business. Payment is due within 14 days.',
  payment_link: 'https://buy.stripe.com/test_example',
  card_payments: true,
  brand_primary: '#2E3A2F',
  brand_accent: '#B07A4A',
  heading_font: 'Cormorant Garamond',
  body_font: 'DM Sans',
};

export const studioProfileAPI = {
  async get() { return delay({ ...studioProfile }); },
  async save(body) { Object.assign(studioProfile, body); return delay({ ...studioProfile }); },
};

function withTotals(row) {
  const t = invoiceTotals(row);
  return Object.assign(row, { subtotal: String(t.subtotal), vat_amount: String(t.vat), amount: String(t.total) });
}


// Demo: pretend to email the client when they have portal access.
function demoEmail(collection, rid) {
  const row = byId(collection, rid);
  const client = byId('clients', row?.client_id);
  if (!client?.portal_user_id) return Promise.reject(new Error('This client doesn’t have portal access yet. Give them access on their client page first.'));
  row.emailed_at = new Date().toISOString();
  return delay({ ...row, emailed_to: client.portal_email });
}
export const invoicesAPI = {
  ...crud('invoices'),
  async emailToClient(rid) { return demoEmail('invoices', rid); },
  async create(body) {
    const client = byId('clients', body.client_id);
    const row = withTotals({
      id: id(), created_at: new Date().toISOString(), client_name: client?.name || '', status: 'unpaid',
      number: formatInvoiceNumber(studioProfile.invoice_prefix, studioProfile.next_invoice_number++),
      issue_date: new Date().toISOString().slice(0, 10), vat_rate: studioProfile.vat_rate, vat_label: studioProfile.vat_label, currency: studioProfile.currency,
      bill_to: { name: client?.name || '', contact: client?.contact || '', email: client?.email || '', address: '' },
      ...body,
      items: body.items || [{ description: body.description, quantity: 1, unit_price: body.amount }],
    });
    db.invoices.unshift(row);
    return delay(row);
  },
  async update(rid, body) {
    const row = byId('invoices', rid);
    Object.assign(row, body);
    if (body.items || body.vat_rate !== undefined) withTotals(row);
    return delay(row);
  },
  async updateStatus(rid, status, extra = {}) {
    const row = byId('invoices', rid);
    row.status = typeof status === 'object' ? status.status : status;
    row.paid_at = row.status === 'paid' ? (extra.paid_at || new Date().toISOString()) : '';
    row.payment_method = extra.payment_method || '';
    return delay({ success: true, status: row.status, paid_at: row.paid_at });
  },
};

let notifySettings = { email: 'mayaa@creativemayaa.studio', studio_emails: true, enquiry_emails: true, client_emails: true, ready: true };
export const notifyAPI = {
  async getSettings() { return delay({ ...notifySettings }); },
  async saveSettings(body, { test = false } = {}) {
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new Error('Enter a valid email address.');
    notifySettings = { ...notifySettings, ...body };
    return delay({ ...notifySettings, test: test ? { sent: true } : undefined });
  },
};

export const paymentsAPI = {
  async status() { return { stripe: true }; },
  async checkout(rid) { return `/portal/invoices/${rid}?paid=1`; },
  async check(ids) {
    if (typeof window !== 'undefined' && /[?&]paid=1/.test(window.location.search)) {
      return Object.fromEntries(ids.map((x) => [x, { paid_at: new Date().toISOString(), payment_ref: 'pi_demo' }]));
    }
    return {};
  },
};

export const proposalsAPI = crud('proposals');
const contractListeners = new Set();
const emitContracts = () => contractListeners.forEach((fn) => fn(JSON.parse(JSON.stringify(db.contracts))));
export const contractsAPI = {
  ...crud('contracts'),
  async emailToClient(rid) { return demoEmail('contracts', rid); },
  async sign(rid) {
    const row = byId('contracts', rid);
    row.signed = true;
    row.signed_at = new Date().toISOString();
    emitContracts();
    return delay({ success: true });
  },
  async signAsStudio(rid, { name, image }) {
    const row = byId('contracts', rid);
    row.studio_signature = { name, image, signed_at: new Date().toISOString(), email: 'studio@example.com' };
    return delay({ studio_signature: row.studio_signature });
  },
  async removeStudioSignature(rid) { byId('contracts', rid).studio_signature = null; return delay({}); },
  async signAsClient(rid, { name, title, image, method, fingerprint, agreement }) {
    const row = byId('contracts', rid);
    const stamp = new Date().toISOString();
    Object.assign(row, { signed: true, signed_at: stamp, signed_hash: fingerprint, client_signature: { name, title, image, method, agreement, signed_at: stamp, email: 'layla@maisonnoor.co' } });
    emitContracts();
    return delay({ ...row });
  },
  subscribe(onChange) {
    contractListeners.add(onChange);
    onChange(JSON.parse(JSON.stringify(db.contracts)));
    return () => contractListeners.delete(onChange);
  },
};
export const eventsAPI = crud('events');

let formConfig = null;
try { formConfig = JSON.parse(localStorage.getItem('vela-demo-form') || 'null'); } catch { formConfig = null; }
export const formsAPI = {
  async getConfig() { return delay(formConfig ? { ...formConfig, has_saved: true } : { ...STUDIO_ENQUIRY_TEMPLATE, has_saved: false }); },
  async saveConfig(body) {
    formConfig = { ...body, fields: body.fields.filter((f) => f.label), brand: { business_name: studioProfile.business_name, primary: studioProfile.brand_primary, accent: studioProfile.brand_accent, heading_font: studioProfile.heading_font, body_font: studioProfile.body_font } };
    try { localStorage.setItem('vela-demo-form', JSON.stringify(formConfig)); } catch { /* demo only */ }
    return delay({ ...formConfig, has_saved: true });
  },
  async getPublicConfig() {
    return delay(formConfig || { ...STUDIO_ENQUIRY_TEMPLATE, brand: { business_name: studioProfile.business_name, primary: studioProfile.brand_primary, accent: studioProfile.brand_accent, heading_font: studioProfile.heading_font, body_font: studioProfile.body_font } });
  },
  async getFields() { return delay(db.formFields); },
  async getPublicFields() { return delay(db.formFields); },
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

export const questionnairesAPI = {
  async listTemplates() { return delay(scopeClientId ? [] : db.questionnaires); },
  async getTemplate(rid) { return delay(byId('questionnaires', rid)); },
  async createTemplate(body) {
    const row = { id: id(), user_id: 'demo', title: body.title || 'Untitled questionnaire', description: body.description || '', questions: (body.questions || []).filter((q) => q.label), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    db.questionnaires.unshift(row);
    return delay(row);
  },
  async updateTemplate(rid, body) {
    const row = byId('questionnaires', rid);
    Object.assign(row, { title: body.title, description: body.description, questions: (body.questions || []).filter((q) => q.label), updated_at: new Date().toISOString() });
    return delay(row);
  },
  async removeTemplate(rid) { db.questionnaires = db.questionnaires.filter((r) => r.id !== rid); return delay({ success: true }); },
  async listResponses() { return delay(visible('questionnaire_responses')); },
  async getResponse(rid) { return delay(visible('questionnaire_responses').find((r) => r.id === rid)); },
  async send({ template_id, client_id, project_id, stage_index, note, step_id }) {
    const t = byId('questionnaires', template_id);
    const c = byId('clients', client_id);
    const p = project_id ? byId('projects', project_id) : null;
    if (!t || !c) throw new Error('Choose a questionnaire and a client.');
    const row = {
      id: id(), user_id: 'demo', studio_email: 'studio@example.com', client_id: c.id, client_name: c.name, contact_name: c.contact || '',
      project_id: p?.id || '', project_service: p?.service || '', stage_index: Number(stage_index) || 0, step_id: step_id || '', template_id: t.id,
      title: t.title, description: note || t.description || '', questions: t.questions, answers: {}, status: 'sent', seen_by_studio: false,
      sent_at: new Date().toISOString(), updated_at: new Date().toISOString(), submitted_at: '',
    };
    db.questionnaire_responses.unshift(row);
    emitResponses();
    return delay(row);
  },
  async saveAnswers(rid, answers) {
    const row = byId('questionnaire_responses', rid);
    Object.assign(row, { answers, status: 'in_progress', updated_at: new Date().toISOString() });
    emitResponses();
    return delay(row);
  },
  async submit(rid, answers) {
    const row = byId('questionnaire_responses', rid);
    const stamp = new Date().toISOString();
    Object.assign(row, { answers, status: 'submitted', submitted_at: stamp, updated_at: stamp });
    emitResponses();
    return delay(row);
  },
  async markSeen(rid) { byId('questionnaire_responses', rid).seen_by_studio = true; emitResponses(); return delay({ success: true }); },
  async reopen(rid) {
    const row = byId('questionnaire_responses', rid);
    Object.assign(row, { status: 'in_progress', seen_by_studio: false, submitted_at: '', updated_at: new Date().toISOString() });
    emitResponses();
    return delay(row);
  },
  async removeResponse(rid) { db.questionnaire_responses = db.questionnaire_responses.filter((r) => r.id !== rid); emitResponses(); return delay({ success: true }); },
  subscribeResponses(onChange) {
    listeners.add(onChange);
    setTimeout(() => onChange(JSON.parse(JSON.stringify(db.questionnaire_responses))), 50);
    // Demo only: simulate a client submitting while you watch, so the live alert can be seen.
    if (typeof window !== 'undefined' && /[?&]demoSubmit=1/.test(window.location.search)) {
      setTimeout(() => {
        const row = db.questionnaire_responses.find((r) => r.id === 'qr2');
        if (row && row.status !== 'submitted') { row.status = 'submitted'; row.submitted_at = new Date().toISOString(); row.seen_by_studio = false; emitResponses(); }
      }, 2500);
    }
    return () => listeners.delete(onChange);
  },
};

const reviewListeners = new Set();
const commentListeners = new Map();
function emitReviews() { reviewListeners.forEach((fn) => fn(JSON.parse(JSON.stringify(db.reviews)))); }
function emitComments(rid) { (commentListeners.get(rid) || new Set()).forEach((fn) => fn(JSON.parse(JSON.stringify(db.comments[rid] || [])))); }

export const reviewsAPI = {
  async list() { return delay(visible('reviews')); },
  async get(rid) { return delay(visible('reviews').find((r) => r.id === rid)); },
  async send({ project_id, stage_index, step_id, title, note, files, kind = 'review' }) {
    const p = byId('projects', project_id);
    const c = byId('clients', p.client_id);
    if (!files?.length) throw new Error('Add at least one file or link.');
    const stamp = new Date().toISOString();
    const row = {
      id: id(), user_id: 'demo', client_id: c.id, client_name: c.name, contact_name: c.contact || '', project_id: p.id, project_service: p.service,
      stage_index: Number(stage_index) || 0, step_id, title, note: note || '', files, kind, status: kind === 'delivery' ? 'delivered' : 'in_review',
      round: db.reviews.filter((r) => r.project_id === p.id && r.step_id === step_id).length + 1,
      sent_at: stamp, updated_at: stamp, decided_at: '', decision_note: '', client_activity_at: '', studio_seen_at: stamp,
    };
    db.reviews.unshift(row);
    emitReviews();
    return delay(row);
  },
  async decide(rid, decision, note = '') {
    const row = byId('reviews', rid);
    const stamp = new Date().toISOString();
    Object.assign(row, { status: decision === 'approved' ? 'approved' : 'changes_requested', decided_at: stamp, decision_note: note, client_activity_at: stamp, updated_at: stamp });
    if (note) { db.comments[rid] = [...(db.comments[rid] || []), { id: id(), author_role: 'client', author_name: 'Layla Haddad', text: note, decision: row.status, created_at: stamp }]; emitComments(rid); }
    emitReviews();
    return delay(row);
  },
  async setStatus(rid, status) { const row = byId('reviews', rid); Object.assign(row, { status, decided_at: status === 'in_review' ? '' : new Date().toISOString() }); emitReviews(); return delay(row); },
  async markSeen(rid) { const row = byId('reviews', rid); if (row) { row.studio_seen_at = new Date().toISOString(); emitReviews(); } return delay({}); },
  async remove(rid) { db.reviews = db.reviews.filter((r) => r.id !== rid); emitReviews(); return delay({ success: true }); },
  subscribeComments(rid, onChange) {
    if (!commentListeners.has(rid)) commentListeners.set(rid, new Set());
    commentListeners.get(rid).add(onChange);
    setTimeout(() => onChange(JSON.parse(JSON.stringify(db.comments[rid] || []))), 30);
    return () => commentListeners.get(rid).delete(onChange);
  },
  async addComment(rid, message) {
    const stamp = new Date().toISOString();
    const studio = !scopeClientId;
    const comment = { id: id(), author_role: studio ? 'studio' : 'client', author_name: studio ? 'Mayaa' : 'Layla Haddad', text: message, created_at: stamp };
    db.comments[rid] = [...(db.comments[rid] || []), comment];
    const row = byId('reviews', rid);
    if (studio) row.studio_seen_at = stamp; else row.client_activity_at = stamp;
    emitComments(rid);
    emitReviews();
    return delay(comment);
  },
  subscribe(onChange) {
    reviewListeners.add(onChange);
    setTimeout(() => onChange(JSON.parse(JSON.stringify(db.reviews))), 50);
    if (typeof window !== 'undefined' && /[?&]demoApprove=1/.test(window.location.search)) {
      setTimeout(() => {
        const row = db.reviews.find((r) => r.id === 'rv4');
        const stamp = new Date().toISOString();
        Object.assign(row, { status: 'approved', decided_at: stamp, client_activity_at: stamp });
        emitReviews();
      }, 2500);
    }
    return () => reviewListeners.delete(onChange);
  },
};

export const uploadsAPI = {
  async status() { return { configured: true }; },
  async upload(file, { onProgress } = {}) {
    for (const pct of [30, 70, 100]) { await new Promise((r) => setTimeout(r, 60)); onProgress?.(pct); }
    return { name: file.name, url: URL.createObjectURL(file), type: file.type, size: file.size, kind: 'file' };
  },
};

export const filesAPI = {
  async links(reviewId, urls) { return delay(Object.fromEntries((urls || []).map((u) => [u, u]))); },
};
