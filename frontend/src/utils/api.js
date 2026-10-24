import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, createSecondaryFirebaseServices, db, ensureFirebaseConfigured } from '../lib/firebase';
import { sanitizeWorkflow, workflowLabels } from './workflow';
import { DEFAULT_STUDIO_PROFILE, formatInvoiceNumber, invoiceTotals, toNumber } from './invoices';
import { CUSTOM, DEFAULT_BRAND, fontOption, isHex } from './brand';

export const USER_ROLES = {
  STUDIO: 'studio',
  CLIENT: 'client',
};

const DEFAULT_FORM_FIELDS = [
  { label: 'Full Name', field_type: 'text', required: 1, options: '', sort_order: 0 },
  { label: 'Email Address', field_type: 'email', required: 1, options: '', sort_order: 1 },
  { label: 'Brand / Business Name', field_type: 'text', required: 1, options: '', sort_order: 2 },
  { label: 'Service Interested In', field_type: 'select', required: 1, options: 'Brand Identity,Packaging Design,Web Design,Full Suite', sort_order: 3 },
  { label: 'Tell me about your project', field_type: 'textarea', required: 1, options: '', sort_order: 4 },
  { label: 'Project Budget', field_type: 'select', required: 0, options: '£1,500–£3,000,£3,000–£5,000+', sort_order: 5 },
];

function now() {
  return new Date().toISOString();
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function email(value) {
  return text(value).toLowerCase();
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `vela_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function compareDatesDesc(a, b, field) {
  return new Date(b?.[field] || 0).getTime() - new Date(a?.[field] || 0).getTime();
}

function compareDatesAsc(a, b, field) {
  return new Date(a?.[field] || 0).getTime() - new Date(b?.[field] || 0).getTime();
}

function compareEventSchedule(a, b) {
  const left = new Date(`${a?.date || '1970-01-01'}T${a?.time || '00:00'}`).getTime();
  const right = new Date(`${b?.date || '1970-01-01'}T${b?.time || '00:00'}`).getTime();
  return left - right;
}

function toStringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => text(item)).filter(Boolean);
  }
  return text(value)
    .split('\n')
    .map((item) => text(item))
    .filter(Boolean);
}

function stripUndefinedValues(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function friendlyAuthError(error, fallback = 'Something went wrong. Please try again.') {
  const code = text(error?.code);

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'The email or password is incorrect.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/email-already-in-use':
      return 'That email address is already in use.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    default:
      return text(error?.message) || fallback;
  }
}

export function normalizeRole(value) {
  return value === USER_ROLES.CLIENT ? USER_ROLES.CLIENT : USER_ROLES.STUDIO;
}

function normalizeProfile(profile, fallback = {}) {
  return {
    ...fallback,
    ...(profile || {}),
    role: normalizeRole(profile?.role || fallback.role),
  };
}

function isStudioProfile(profile) {
  return normalizeRole(profile?.role) === USER_ROLES.STUDIO;
}

function isClientProfile(profile) {
  return normalizeRole(profile?.role) === USER_ROLES.CLIENT;
}

function clientPortalRoute() {
  return '/portal';
}

function studioRoute() {
  return '/';
}

function matchesClientRecord(profile, data) {
  return Boolean(
    profile?.client_id
      && profile?.studio_owner_id
      && data?.client_id === profile.client_id
      && data?.user_id === profile.studio_owner_id
  );
}

function matchesClientDoc(profile, id, data) {
  return Boolean(
    profile?.client_id
      && profile?.studio_owner_id
      && id === profile.client_id
      && data?.user_id === profile.studio_owner_id
  );
}

function requireCurrentFirebaseUser() {
  ensureFirebaseConfigured();
  if (!auth?.currentUser) {
    throw new Error('You need to sign in first.');
  }
  return auth.currentUser;
}

async function getUserProfile(uid, sourceDb = db) {
  ensureFirebaseConfigured();
  const snapshot = await getDoc(doc(sourceDb, 'users', uid));
  if (!snapshot.exists()) {
    return null;
  }
  return normalizeProfile({ id: snapshot.id, ...snapshot.data() }, { id: uid });
}

async function requireSession() {
  const firebaseUser = requireCurrentFirebaseUser();
  const profile = normalizeProfile(
    await getUserProfile(firebaseUser.uid),
    {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || '',
    }
  );

  return { firebaseUser, profile };
}

async function requireStudioSession() {
  const session = await requireSession();
  if (!isStudioProfile(session.profile)) {
    throw new Error('Only studio accounts can perform this action.');
  }
  return session;
}

async function requireClientSession() {
  const session = await requireSession();
  if (!isClientProfile(session.profile)) {
    throw new Error('This page is only available in the client portal.');
  }
  return session;
}

async function getAccessibleDoc(collectionName, id, session) {
  const snapshot = await getDoc(doc(db, collectionName, id));
  if (!snapshot.exists()) {
    throw new Error('Not found');
  }

  const data = snapshot.data();
  if (isStudioProfile(session.profile)) {
    if (data.user_id !== session.firebaseUser.uid) {
      throw new Error('Not found');
    }
  } else if (collectionName === 'clients') {
    if (!matchesClientDoc(session.profile, snapshot.id, data)) {
      throw new Error('Not found');
    }
  } else if (!matchesClientRecord(session.profile, data)) {
    throw new Error('Not found');
  }

  return { id: snapshot.id, ...data };
}

async function listAccessibleDocs(collectionName) {
  const session = await requireSession();

  if (isStudioProfile(session.profile)) {
    const snapshot = await getDocs(query(collection(db, collectionName), where('user_id', '==', session.firebaseUser.uid)));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }

  if (collectionName === 'clients') {
    if (!session.profile.client_id) {
      return [];
    }
    try {
      return [await getAccessibleDoc('clients', session.profile.client_id, session)];
    } catch {
      return [];
    }
  }

  const targetClientId = text(session.profile.client_id);
  const studioOwnerId = text(session.profile.studio_owner_id);
  if (!targetClientId || !studioOwnerId) {
    return [];
  }

  // Both filters are needed: the security rules only let a client list records
  // that belong to their own client file *and* their studio.
  const snapshot = await getDocs(query(
    collection(db, collectionName),
    where('client_id', '==', targetClientId),
    where('user_id', '==', studioOwnerId),
  ));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => matchesClientRecord(session.profile, item));
}

async function deleteStudioDoc(collectionName, id) {
  const session = await requireStudioSession();
  await getAccessibleDoc(collectionName, id, session);
  await deleteDoc(doc(db, collectionName, id));
  return { success: true };
}

async function getStudioClient(clientId, session) {
  return getAccessibleDoc('clients', clientId, session);
}

function buildThreadList(messages) {
  const latestByClient = new Map();
  messages
    .slice()
    .sort((a, b) => compareDatesDesc(a, b, 'sent_at'))
    .forEach((message) => {
      if (!latestByClient.has(message.client_id)) {
        latestByClient.set(message.client_id, {
          client_id: message.client_id,
          client_name: message.client_name || 'Unknown client',
          color: message.color || '#1B2B4B',
          latest_message: message.text || '',
          latest_at: message.sent_at || '',
        });
      }
    });

  return Array.from(latestByClient.values());
}

async function createPortalProfileForClient({ client, emailAddress, password, name, studioOwnerId }) {
  const secondary = await createSecondaryFirebaseServices();

  try {
    let credential;
    try {
      credential = await createUserWithEmailAndPassword(secondary.auth, emailAddress, password);
    } catch (error) {
      throw new Error(friendlyAuthError(error, 'Unable to create portal access.'));
    }
    const profile = {
      id: credential.user.uid,
      role: USER_ROLES.CLIENT,
      email: emailAddress,
      name,
      client_id: client.id,
      client_name: client.name,
      studio_owner_id: studioOwnerId,
      portal_enabled: true,
      created_at: now(),
    };

    await setDoc(doc(secondary.db, 'users', credential.user.uid), profile);
    await signOut(secondary.auth);

    return profile;
  } finally {
    await secondary.dispose().catch(() => {});
  }
}

export const authAPI = {
  async login(body, options = {}) {
    ensureFirebaseConfigured();
    const loginEmail = email(body.email);
    const password = body.password;
    const expectedRole = options.expectedRole ? normalizeRole(options.expectedRole) : '';

    if (!loginEmail || !password) {
      throw new Error('Email and password are required.');
    }

    let credential;
    try {
      credential = await signInWithEmailAndPassword(auth, loginEmail, password);
    } catch (error) {
      throw new Error(friendlyAuthError(error, 'Unable to sign in.'));
    }

    let user;
    try {
      user = normalizeProfile(
        await getUserProfile(credential.user.uid),
        {
          id: credential.user.uid,
          email: credential.user.email || loginEmail,
          name: credential.user.displayName || '',
        }
      );
    } catch (error) {
      await signOut(auth).catch(() => {});
      throw new Error('Signed in, but your account profile could not be loaded. Please try again.');
    }

    if (expectedRole && user.role !== expectedRole) {
      await signOut(auth);
      throw new Error(
        expectedRole === USER_ROLES.CLIENT
          ? 'This sign-in is only for client portal accounts.'
          : 'This sign-in is only for studio accounts.'
      );
    }

    return {
      user,
      redirectTo: user.role === USER_ROLES.CLIENT ? clientPortalRoute() : studioRoute(),
    };
  },

  async register(body) {
    ensureFirebaseConfigured();
    const registerEmail = email(body.email);
    const password = body.password;
    const name = text(body.name);

    if (!registerEmail || !password || !name) {
      throw new Error('Name, email, and password are required.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    let credential;
    try {
      credential = await createUserWithEmailAndPassword(auth, registerEmail, password);
    } catch (error) {
      throw new Error(friendlyAuthError(error, 'Unable to create the account.'));
    }
    const profile = {
      id: credential.user.uid,
      role: USER_ROLES.STUDIO,
      email: registerEmail,
      name,
      studio_name: text(body.studio_name),
      studio_tagline: '',
      website: '',
      instagram: '',
      location: '',
      currency: 'GBP',
      created_at: now(),
    };
    await setDoc(doc(db, 'users', credential.user.uid), profile);

    return {
      user: profile,
      redirectTo: studioRoute(),
    };
  },

  async resetPassword(inputEmail) {
    ensureFirebaseConfigured();
    const targetEmail = email(inputEmail);

    if (!targetEmail) {
      throw new Error('Enter your email address first.');
    }

    try {
      await sendPasswordResetEmail(auth, targetEmail);
    } catch (error) {
      throw new Error(friendlyAuthError(error, 'Unable to send a password reset email.'));
    }

    return {
      message: 'Password reset email sent. Check your inbox and spam folder.',
    };
  },

  async logout() {
    ensureFirebaseConfigured();
    await signOut(auth);
  },

  async me() {
    const session = await requireSession();
    return session.profile;
  },
};

export const clientsAPI = {
  async list() {
    const rows = await listAccessibleDocs('clients');
    return rows.sort((a, b) => compareDatesDesc(a, b, 'created_at'));
  },

  async get(id) {
    const session = await requireSession();
    return getAccessibleDoc('clients', id, session);
  },

  async create(body) {
    const session = await requireStudioSession();
    const name = text(body.name);
    if (!name) {
      throw new Error('Client name is required.');
    }

    const payload = {
      user_id: session.firebaseUser.uid,
      name,
      contact: text(body.contact),
      email: email(body.email),
      location: text(body.location),
      industry: text(body.industry) || 'Other',
      color: text(body.color) || '#1B2B4B',
      portal_enabled: false,
      portal_email: '',
      portal_name: '',
      portal_user_id: '',
      created_at: now(),
    };

    const reference = await addDoc(collection(db, 'clients'), payload);
    return { id: reference.id, ...payload };
  },

  async update(id, body) {
    const session = await requireStudioSession();
    await getAccessibleDoc('clients', id, session);
    const payload = stripUndefinedValues({
      name: body.name !== undefined ? text(body.name) : undefined,
      contact: body.contact !== undefined ? text(body.contact) : undefined,
      email: body.email !== undefined ? email(body.email) : undefined,
      location: body.location !== undefined ? text(body.location) : undefined,
      industry: body.industry !== undefined ? text(body.industry) : undefined,
      color: body.color !== undefined ? text(body.color) : undefined,
    });
    await updateDoc(doc(db, 'clients', id), payload);
    return getAccessibleDoc('clients', id, session);
  },

  async createPortalAccess(id, body) {
    const session = await requireStudioSession();
    const client = await getAccessibleDoc('clients', id, session);

    if (client.portal_user_id) {
      throw new Error('This client already has portal access.');
    }

    const portalEmail = email(body.email || client.portal_email || client.email);
    const portalName = text(body.name || client.portal_name || client.contact || client.name);
    const password = text(body.password);

    if (!portalEmail) {
      throw new Error('Portal email is required.');
    }
    if (!portalName) {
      throw new Error('Portal name is required.');
    }
    if (password.length < 6) {
      throw new Error('Portal password must be at least 6 characters.');
    }

    const portalProfile = await createPortalProfileForClient({
      client,
      emailAddress: portalEmail,
      password,
      name: portalName,
      studioOwnerId: session.firebaseUser.uid,
    });

    await updateDoc(doc(db, 'clients', id), {
      portal_user_id: portalProfile.id,
      portal_email: portalEmail,
      portal_name: portalName,
      portal_enabled: true,
      portal_created_at: now(),
    });

    return getAccessibleDoc('clients', id, session);
  },

  async remove(id) {
    return deleteStudioDoc('clients', id);
  },
};

export const projectsAPI = {
  async list() {
    const rows = await listAccessibleDocs('projects');
    return rows.sort((a, b) => compareDatesDesc(a, b, 'created_at'));
  },

  async get(id) {
    const session = await requireSession();
    const project = await getAccessibleDoc('projects', id, session);
    return {
      ...project,
      files: project.files || [],
      signoffs: project.signoffs || [],
    };
  },

  async create(body) {
    const session = await requireStudioSession();
    const service = text(body.service);
    if (!body.client_id || !service) {
      throw new Error('Client and service are required.');
    }

    const client = await getStudioClient(body.client_id, session);
    const payload = {
      user_id: session.firebaseUser.uid,
      client_id: client.id,
      client_name: client.name,
      client_color: client.color || '#1B2B4B',
      service,
      value: text(body.value),
      stage: 0,
      start_date: text(body.start_date),
      timeline: text(body.timeline),
      budget: text(body.budget),
      status: text(body.status) || 'active',
      files: [],
      signoffs: [],
      created_at: now(),
    };

    const reference = await addDoc(collection(db, 'projects'), payload);
    return { id: reference.id, ...payload };
  },

  async update(id, body) {
    const session = await requireStudioSession();
    const current = await getAccessibleDoc('projects', id, session);
    const client = body.client_id ? await getStudioClient(body.client_id, session) : null;
    const payload = stripUndefinedValues({
      client_id: body.client_id !== undefined ? client?.id || current.client_id : undefined,
      client_name: body.client_id !== undefined ? client?.name || current.client_name : undefined,
      client_color: body.client_id !== undefined ? client?.color || current.client_color : undefined,
      service: body.service !== undefined ? text(body.service) : undefined,
      value: body.value !== undefined ? text(body.value) : undefined,
      start_date: body.start_date !== undefined ? text(body.start_date) : undefined,
      timeline: body.timeline !== undefined ? text(body.timeline) : undefined,
      budget: body.budget !== undefined ? text(body.budget) : undefined,
      status: body.status !== undefined ? text(body.status) : undefined,
      workflow: body.workflow !== undefined ? sanitizeWorkflow(body.workflow) : undefined,
    });
    await updateDoc(doc(db, 'projects', id), payload);
    return getAccessibleDoc('projects', id, session);
  },

  async advStage(id, stage) {
    const session = await requireStudioSession();
    await getAccessibleDoc('projects', id, session);
    const nextStage = Number(stage);
    if (!Number.isFinite(nextStage) || nextStage < 0) {
      throw new Error('Stage must be a valid number.');
    }
    await updateDoc(doc(db, 'projects', id), { stage: nextStage });
    return { success: true, stage: nextStage };
  },

  async addFile(id, body) {
    const session = await requireStudioSession();
    const project = await getAccessibleDoc('projects', id, session);
    const stageIndex = Number(body.stage_index);
    const name = text(body.name);
    if (!name) {
      throw new Error('File name is required.');
    }
    if (!Number.isFinite(stageIndex) || stageIndex < 0) {
      throw new Error('Stage index is invalid.');
    }
    const file = {
      id: createId(),
      stage_index: stageIndex,
      name,
      file_type: text(body.file_type),
      uploaded_at: now(),
    };
    await updateDoc(doc(db, 'projects', id), { files: [...(project.files || []), file] });
    return file;
  },

  async signOff(id, stageIndex) {
    const session = await requireStudioSession();
    const project = await getAccessibleDoc('projects', id, session);
    const normalizedStageIndex = Number(stageIndex);
    if (!Number.isFinite(normalizedStageIndex) || normalizedStageIndex < 0) {
      throw new Error('Stage index is invalid.');
    }
    const nextSignoffs = Array.from(new Set([...(project.signoffs || []), normalizedStageIndex]));
    await updateDoc(doc(db, 'projects', id), { signoffs: nextSignoffs });
    return { success: true, stage_index: normalizedStageIndex };
  },

  async remove(id) {
    return deleteStudioDoc('projects', id);
  },
};

const PROFILE_TEXT_FIELDS = ['legal_name', 'business_name', 'address', 'email', 'phone', 'website', 'company_number', 'vat_number', 'currency', 'vat_label', 'invoice_prefix', 'bank_details', 'invoice_notes', 'payment_link'];

function cleanPaymentLink(value) {
  const link = text(value);
  if (!link) return '';
  const withScheme = /^https?:\/\//i.test(link) ? link : `https://${link}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

// Contract sections: title and terms (markup and placeholders are kept as typed).
function sanitizeClauses(clauses) {
  return (Array.isArray(clauses) ? clauses : [])
    .map((c, i) => ({
      id: text(c.id).slice(0, 40) || `cl-${i}-${Math.random().toString(36).slice(2, 6)}`,
      title: String(c.title || '').trim().slice(0, 120),
      body: String(c.body || '').replace(/\r\n/g, '\n').slice(0, 8000),
    }))
    .filter((c) => c.title || c.body.trim())
    .slice(0, 60);
}

const FONT_ROLES = ['heading', 'body'];
const profileCache = new Map(); // owner uid -> { at, promise }
const fontDataCache = new Map(); // `${owner}_${role}` -> data URL as last read or saved

async function readBrandFont(owner, role) {
  const snapshot = await getDoc(doc(db, 'studio_fonts', `${owner}_${role}`));
  const data = snapshot.exists() ? snapshot.data() : null;
  fontDataCache.set(`${owner}_${role}`, data?.data || '');
  return data;
}

// The studio's business details, brand kit (logo, colours, fonts) and invoice settings.
// Clients can read their studio's profile so documents show the studio's branding.
export const studioProfileAPI = {
  async get(uid, { fresh = false } = {}) {
    const session = await requireSession();
    const owner = uid || (isStudioProfile(session.profile) ? session.firebaseUser.uid : session.profile.studio_owner_id);
    if (!owner) return { ...DEFAULT_STUDIO_PROFILE, ...DEFAULT_BRAND };
    const cached = profileCache.get(owner);
    if (!fresh && cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.promise;
    const promise = (async () => {
      const snapshot = await getDoc(doc(db, 'studio_profiles', owner));
      const data = snapshot.exists() ? snapshot.data() : {};
      const profile = {
        ...DEFAULT_STUDIO_PROFILE,
        ...DEFAULT_BRAND,
        business_name: session.profile.studio_name || '',
        email: isStudioProfile(session.profile) ? session.firebaseUser.email || '' : '',
        currency: session.profile.currency || 'GBP',
        ...data,
        id: owner,
      };
      await Promise.all(FONT_ROLES.map(async (role) => {
        if (profile[`${role}_font`] !== CUSTOM) return;
        const font = await readBrandFont(owner, role).catch(() => null);
        profile[`${role}_font_data`] = font?.data || '';
      }));
      return profile;
    })();
    profileCache.set(owner, { at: Date.now(), promise });
    promise.catch(() => profileCache.delete(owner));
    return promise;
  },

  async save(body) {
    const session = await requireStudioSession();
    const uid = session.firebaseUser.uid;
    const payload = { user_id: uid, updated_at: now() };
    PROFILE_TEXT_FIELDS.forEach((key) => { if (body[key] !== undefined) payload[key] = text(body[key]).slice(0, 2000); });
    if (body.payment_link !== undefined) {
      payload.payment_link = cleanPaymentLink(body.payment_link);
      if (text(body.payment_link) && !payload.payment_link) throw new Error('The payment link must be a web address starting with https://');
    }
    ['logo', 'logo_light'].forEach((key) => {
      if (body[key] === undefined) return;
      const logo = String(body[key] || '');
      if (logo && !/^data:image\/(png|jpeg);base64,/.test(logo)) throw new Error('Upload the logo as an image.');
      if (logo.length > 290000) throw new Error('That logo is too large.');
      payload[key] = logo;
    });
    if (body.contract_cover_title !== undefined) payload.contract_cover_title = text(body.contract_cover_title).slice(0, 120);
    ['brand_primary', 'brand_accent'].forEach((key) => {
      if (body[key] === undefined) return;
      if (!isHex(body[key])) throw new Error('Brand colours need to be hex codes like #1B2B4B.');
      payload[key] = String(body[key]).toUpperCase();
    });
    for (const role of FONT_ROLES) {
      const choice = body[`${role}_font`];
      if (choice === undefined) continue;
      if (choice !== '' && choice !== CUSTOM && !fontOption(choice)) throw new Error('Choose a font from the list.');
      payload[`${role}_font`] = choice;
      payload[`${role}_font_name`] = text(body[`${role}_font_name`]).slice(0, 80);
      const data = String(body[`${role}_font_data`] || '');
      if (choice === CUSTOM) {
        if (!/^data:font\/(ttf|otf|woff2?);base64,/.test(data)) throw new Error('Upload a font file for your own font.');
        if (data.length > 850000) throw new Error('That font file is too large.');
        if (fontDataCache.get(`${uid}_${role}`) !== data) {
          await setDoc(doc(db, 'studio_fonts', `${uid}_${role}`), { user_id: uid, role, name: payload[`${role}_font_name`], data, updated_at: now() });
          fontDataCache.set(`${uid}_${role}`, data);
        }
      }
    }
    if (body.vat_rate !== undefined) payload.vat_rate = String(Math.max(0, Math.min(100, toNumber(body.vat_rate))));
    if (body.payment_terms_days !== undefined) payload.payment_terms_days = Math.max(0, Math.min(365, Math.round(toNumber(body.payment_terms_days))));
    if (body.next_invoice_number !== undefined) payload.next_invoice_number = Math.max(1, Math.round(toNumber(body.next_invoice_number)) || 1);
    if (body.card_payments !== undefined) payload.card_payments = Boolean(body.card_payments);
    if (body.contract_clauses !== undefined) payload.contract_clauses = sanitizeClauses(body.contract_clauses);
    await setDoc(doc(db, 'studio_profiles', uid), payload, { merge: true });
    if (payload.currency || payload.business_name !== undefined) {
      const profileChanges = stripUndefinedValues({ currency: payload.currency || undefined, studio_name: payload.business_name || undefined });
      if (Object.keys(profileChanges).length) await updateDoc(doc(db, 'users', uid), profileChanges);
    }
    return this.get(uid, { fresh: true });
  },
};

function cleanItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((i) => ({ description: text(i.description).slice(0, 500), quantity: toNumber(i.quantity) || 1, unit_price: toNumber(i.unit_price) }))
    .filter((i) => i.description || i.unit_price)
    .slice(0, 50);
}

// Fields an invoice form can set; totals are always worked out here, never trusted from the form.
function invoiceFields(body, current = {}) {
  const items = body.items !== undefined ? cleanItems(body.items) : undefined;
  const merged = { ...current, ...(items ? { items } : {}), ...(body.vat_rate !== undefined ? { vat_rate: body.vat_rate } : {}) };
  const totals = invoiceTotals(merged);
  const fields = stripUndefinedValues({
    description: body.description !== undefined ? text(body.description) : (items ? (items[0]?.description || current.description || '') : undefined),
    items,
    vat_rate: body.vat_rate !== undefined ? String(Math.max(0, Math.min(100, toNumber(body.vat_rate)))) : undefined,
    vat_label: body.vat_label !== undefined ? text(body.vat_label).slice(0, 20) || 'VAT' : undefined,
    currency: body.currency !== undefined ? text(body.currency).toUpperCase().slice(0, 3) || 'GBP' : undefined,
    issue_date: body.issue_date !== undefined ? text(body.issue_date) : undefined,
    due_date: body.due_date !== undefined ? text(body.due_date) : undefined,
    notes: body.notes !== undefined ? text(body.notes).slice(0, 2000) : undefined,
    payment_link: body.payment_link !== undefined ? cleanPaymentLink(body.payment_link) : undefined,
    bill_to: body.bill_to !== undefined ? {
      name: text(body.bill_to?.name).slice(0, 200),
      contact: text(body.bill_to?.contact).slice(0, 200),
      email: text(body.bill_to?.email).slice(0, 200),
      address: text(body.bill_to?.address).slice(0, 1000),
      vat_number: text(body.bill_to?.vat_number).slice(0, 100),
    } : undefined,
  });
  if (items || body.vat_rate !== undefined || body.amount !== undefined) {
    if (!items && body.amount !== undefined && !current.items) {
      // Older, single-amount invoices.
      fields.amount = String(toNumber(body.amount));
    } else {
      fields.subtotal = String(totals.subtotal);
      fields.vat_amount = String(totals.vat);
      fields.amount = String(totals.total);
    }
  }
  return fields;
}

export const invoicesAPI = {
  async list() {
    const rows = await listAccessibleDocs('invoices');
    return rows.sort((a, b) => compareDatesDesc(a, b, 'created_at'));
  },

  async get(id) {
    const session = await requireSession();
    return getAccessibleDoc('invoices', id, session);
  },

  async create(body) {
    const session = await requireStudioSession();
    if (!body.client_id) {
      throw new Error('Choose a client for this invoice.');
    }
    const client = await getStudioClient(body.client_id, session);
    const profile = await studioProfileAPI.get(session.firebaseUser.uid, { fresh: true });
    const fields = invoiceFields({
      vat_rate: profile.vat_rate,
      vat_label: profile.vat_label,
      currency: profile.currency,
      ...body,
      items: body.items || [{ description: body.description, quantity: 1, unit_price: body.amount }],
      bill_to: body.bill_to || { name: client.name, contact: client.contact, email: client.email, address: '' },
    });
    if (!toNumber(fields.amount)) {
      throw new Error('Add at least one line with a price.');
    }
    const counter = Number(profile.next_invoice_number) || 1;
    const payload = {
      user_id: session.firebaseUser.uid,
      client_id: client.id,
      client_name: client.name,
      project_id: text(body.project_id),
      number: formatInvoiceNumber(profile.invoice_prefix, counter),
      issue_date: new Date().toISOString().slice(0, 10),
      status: text(body.status) || 'unpaid',
      paid_at: '',
      created_at: now(),
      ...fields,
    };
    const reference = await addDoc(collection(db, 'invoices'), payload);
    await setDoc(doc(db, 'studio_profiles', session.firebaseUser.uid), { user_id: session.firebaseUser.uid, next_invoice_number: counter + 1 }, { merge: true });
    profileCache.delete(session.firebaseUser.uid);
    return { id: reference.id, ...payload };
  },

  async update(id, body) {
    const session = await requireStudioSession();
    const current = await getAccessibleDoc('invoices', id, session);
    const client = body.client_id ? await getStudioClient(body.client_id, session) : null;
    const payload = stripUndefinedValues({
      client_id: body.client_id !== undefined ? client?.id || current.client_id : undefined,
      client_name: body.client_id !== undefined ? client?.name || current.client_name : undefined,
      project_id: body.project_id !== undefined ? text(body.project_id) : undefined,
      status: body.status !== undefined ? text(body.status) : undefined,
      ...invoiceFields(body, current),
    });
    await updateDoc(doc(db, 'invoices', id), payload);
    return getAccessibleDoc('invoices', id, session);
  },

  async updateStatus(id, status, extra = {}) {
    const session = await requireStudioSession();
    await getAccessibleDoc('invoices', id, session);
    const nextStatus = text(status);
    if (!['paid', 'unpaid'].includes(nextStatus)) {
      throw new Error('Invoice status is invalid.');
    }
    const payload = {
      status: nextStatus,
      paid_at: nextStatus === 'paid' ? text(extra.paid_at) || now() : '',
      payment_method: nextStatus === 'paid' ? text(extra.payment_method) : '',
      payment_ref: nextStatus === 'paid' ? text(extra.payment_ref) : '',
    };
    await updateDoc(doc(db, 'invoices', id), payload);
    return { success: true, ...payload };
  },

  async remove(id) {
    return deleteStudioDoc('invoices', id);
  },
};

// Online card payments through Stripe (when the studio has set it up).
export const paymentsAPI = {
  async status() {
    try {
      const res = await fetch('/api/pay');
      return res.ok ? await res.json() : { stripe: false };
    } catch {
      return { stripe: false };
    }
  },

  async checkout(invoiceId) {
    await requireSession();
    const token = await auth.currentUser.getIdToken();
    const res = await fetch('/api/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'checkout', invoiceId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || 'Card payment isn’t available right now.');
    return data.url;
  },

  // Which of these invoices Stripe says are paid: { [id]: { paid_at, payment_ref } }.
  async check(invoiceIds, sessionId = '') {
    const ids = (invoiceIds || []).filter(Boolean).slice(0, 50);
    if (!ids.length) return {};
    await requireSession();
    const token = await auth.currentUser.getIdToken();
    const res = await fetch('/api/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'status', invoiceIds: ids, sessionId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Couldn’t check payments.');
    return data.paid || {};
  },
};

export const proposalsAPI = {
  async list() {
    const rows = await listAccessibleDocs('proposals');
    return rows.sort((a, b) => compareDatesDesc(a, b, 'created_at'));
  },

  async get(id) {
    const session = await requireSession();
    return getAccessibleDoc('proposals', id, session);
  },

  async create(body) {
    const session = await requireStudioSession();
    const client = body.client_id ? await getStudioClient(body.client_id, session) : null;
    const service = text(body.service);
    if (!service) {
      throw new Error('Service is required.');
    }

    const payload = {
      user_id: session.firebaseUser.uid,
      client_id: client?.id || '',
      client_name: client?.name || '',
      service,
      date: text(body.date),
      value: text(body.value),
      template: text(body.template) || 'A',
      primary_color: text(body.primary_color) || '#1B2B4B',
      accent_color: text(body.accent_color) || '#C9A84C',
      intro: text(body.intro),
      overview: text(body.overview),
      packages: toStringList(body.packages),
      deliverables: toStringList(body.deliverables),
      timeline: toStringList(body.timeline),
      terms: text(body.terms),
      process: text(body.process),
      status: text(body.status) || 'draft',
      created_at: now(),
    };
    const reference = await addDoc(collection(db, 'proposals'), payload);
    return { id: reference.id, ...payload };
  },

  async update(id, body) {
    const session = await requireStudioSession();
    await getAccessibleDoc('proposals', id, session);
    const client = body.client_id ? await getStudioClient(body.client_id, session) : null;
    const payload = stripUndefinedValues({
      client_id: body.client_id !== undefined ? client?.id || '' : undefined,
      client_name: body.client_id !== undefined ? client?.name || '' : undefined,
      service: body.service !== undefined ? text(body.service) : undefined,
      date: body.date !== undefined ? text(body.date) : undefined,
      value: body.value !== undefined ? text(body.value) : undefined,
      template: body.template !== undefined ? text(body.template) : undefined,
      primary_color: body.primary_color !== undefined ? text(body.primary_color) : undefined,
      accent_color: body.accent_color !== undefined ? text(body.accent_color) : undefined,
      intro: body.intro !== undefined ? text(body.intro) : undefined,
      overview: body.overview !== undefined ? text(body.overview) : undefined,
      packages: body.packages !== undefined ? toStringList(body.packages) : undefined,
      deliverables: body.deliverables !== undefined ? toStringList(body.deliverables) : undefined,
      timeline: body.timeline !== undefined ? toStringList(body.timeline) : undefined,
      terms: body.terms !== undefined ? text(body.terms) : undefined,
      process: body.process !== undefined ? text(body.process) : undefined,
      status: body.status !== undefined ? text(body.status) : undefined,
    });
    await updateDoc(doc(db, 'proposals', id), payload);
    return getAccessibleDoc('proposals', id, session);
  },

  async remove(id) {
    return deleteStudioDoc('proposals', id);
  },
};

export const contractsAPI = {
  async list() {
    const rows = await listAccessibleDocs('contracts');
    return rows.sort((a, b) => compareDatesDesc(a, b, 'created_at'));
  },

  async get(id) {
    const session = await requireSession();
    return getAccessibleDoc('contracts', id, session);
  },

  async create(body) {
    const session = await requireStudioSession();
    const client = body.client_id ? await getStudioClient(body.client_id, session) : null;
    const service = text(body.service);
    if (!service) {
      throw new Error('Service is required.');
    }

    const payload = {
      user_id: session.firebaseUser.uid,
      client_id: client?.id || '',
      client_name: client?.name || '',
      client_email: client?.email || email(body.client_email),
      client_address: text(body.client_address),
      client_contact: text(body.client_contact) || client?.contact || '',
      cover_title: text(body.cover_title).slice(0, 120),
      service,
      value: text(body.value),
      start_date: text(body.start_date),
      end_date: text(body.end_date),
      duration: text(body.duration),
      date: text(body.date),
      primary_color: text(body.primary_color) || '#1B2B4B',
      accent_color: text(body.accent_color) || '#C9A84C',
      clauses: sanitizeClauses(body.clauses),
      signed: false,
      created_at: now(),
    };
    const reference = await addDoc(collection(db, 'contracts'), payload);
    return { id: reference.id, ...payload };
  },

  async update(id, body) {
    const session = await requireStudioSession();
    await getAccessibleDoc('contracts', id, session);
    const client = body.client_id ? await getStudioClient(body.client_id, session) : null;
    const payload = stripUndefinedValues({
      client_id: body.client_id !== undefined ? client?.id || '' : undefined,
      client_name: body.client_id !== undefined ? client?.name || '' : undefined,
      client_email: body.client_id !== undefined ? client?.email || '' : (body.client_email !== undefined ? email(body.client_email) : undefined),
      client_address: body.client_address !== undefined ? text(body.client_address) : undefined,
      client_contact: body.client_contact !== undefined ? text(body.client_contact) : undefined,
      cover_title: body.cover_title !== undefined ? text(body.cover_title).slice(0, 120) : undefined,
      service: body.service !== undefined ? text(body.service) : undefined,
      value: body.value !== undefined ? text(body.value) : undefined,
      start_date: body.start_date !== undefined ? text(body.start_date) : undefined,
      end_date: body.end_date !== undefined ? text(body.end_date) : undefined,
      duration: body.duration !== undefined ? text(body.duration) : undefined,
      date: body.date !== undefined ? text(body.date) : undefined,
      primary_color: body.primary_color !== undefined ? text(body.primary_color) : undefined,
      accent_color: body.accent_color !== undefined ? text(body.accent_color) : undefined,
      clauses: body.clauses !== undefined ? sanitizeClauses(body.clauses) : undefined,
      signed: body.signed !== undefined ? Boolean(body.signed) : undefined,
    });
    await updateDoc(doc(db, 'contracts', id), payload);
    return getAccessibleDoc('contracts', id, session);
  },

  // Studio records a contract signed on paper or elsewhere.
  async sign(id) {
    const session = await requireStudioSession();
    await getAccessibleDoc('contracts', id, session);
    await updateDoc(doc(db, 'contracts', id), { signed: true, signed_at: now() });
    return { success: true };
  },

  // The studio adds its own signature (before or after the client signs).
  async signAsStudio(id, { name, image }) {
    const session = await requireStudioSession();
    await getAccessibleDoc('contracts', id, session);
    if (!text(name)) throw new Error('Type your name.');
    if (!/^data:image\/png;base64,/.test(String(image || '')) || image.length > 240000) throw new Error('Add your signature.');
    const studio_signature = { name: text(name).slice(0, 120), image, signed_at: now(), email: session.firebaseUser.email || '' };
    await updateDoc(doc(db, 'contracts', id), { studio_signature, updated_at: now() });
    return { studio_signature };
  },

  async removeStudioSignature(id) {
    const session = await requireStudioSession();
    await getAccessibleDoc('contracts', id, session);
    await updateDoc(doc(db, 'contracts', id), { studio_signature: null, updated_at: now() });
  },

  // The client accepts and signs in their portal. Records who signed, when, and a
  // fingerprint of exactly what they signed.
  async signAsClient(id, { name, title, image, method, fingerprint, agreement }) {
    const session = await requireClientSession();
    const current = await getAccessibleDoc('contracts', id, session);
    if (current.signed) throw new Error('This contract is already signed.');
    if (text(name).length < 2) throw new Error('Type your full name.');
    if (!/^data:image\/png;base64,/.test(String(image || '')) || image.length > 240000) throw new Error('Add your signature.');
    const stamp = now();
    const client_signature = {
      name: text(name).slice(0, 120),
      title: text(title).slice(0, 120),
      image,
      method: method === 'typed' ? 'typed' : 'drawn',
      signed_at: stamp,
      email: session.firebaseUser.email || '',
      agreement: text(agreement).slice(0, 500),
      user_agent: typeof navigator !== 'undefined' ? String(navigator.userAgent || '').slice(0, 300) : '',
    };
    const payload = { signed: true, signed_at: stamp, signed_hash: text(fingerprint).slice(0, 64), client_signature, updated_at: stamp };
    await updateDoc(doc(db, 'contracts', id), payload);
    notifyStudioOfSubmission(id, 'contract');
    return { ...current, ...payload };
  },

  // Live updates for the studio, so a new signature shows straight away.
  subscribe(onChange, onError = () => {}) {
    let unsubscribe = () => {};
    let cancelled = false;
    requireStudioSession()
      .then((session) => {
        if (cancelled) return;
        unsubscribe = onSnapshot(
          query(collection(db, 'contracts'), where('user_id', '==', session.firebaseUser.uid)),
          (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
          onError
        );
      })
      .catch(onError);
    return () => { cancelled = true; unsubscribe(); };
  },

  async remove(id) {
    return deleteStudioDoc('contracts', id);
  },
};

export const eventsAPI = {
  async list() {
    const rows = await listAccessibleDocs('events');
    return rows.sort(compareEventSchedule);
  },

  async get(id) {
    const session = await requireSession();
    return getAccessibleDoc('events', id, session);
  },

  async create(body) {
    const session = await requireStudioSession();
    const client = body.client_id ? await getStudioClient(body.client_id, session) : null;
    const title = text(body.title);
    if (!title || !text(body.date)) {
      throw new Error('Event title and date are required.');
    }
    const payload = {
      user_id: session.firebaseUser.uid,
      client_id: client?.id || '',
      client_name: client?.name || '',
      title,
      event_type: text(body.event_type),
      date: text(body.date),
      time: text(body.time),
      duration: text(body.duration),
      meeting_link: text(body.meeting_link),
      color: client?.color || '#3B82F6',
      created_at: now(),
    };
    const reference = await addDoc(collection(db, 'events'), payload);
    return { id: reference.id, ...payload };
  },

  async update(id, body) {
    const session = await requireStudioSession();
    await getAccessibleDoc('events', id, session);
    const client = body.client_id ? await getStudioClient(body.client_id, session) : null;
    const payload = stripUndefinedValues({
      client_id: body.client_id !== undefined ? client?.id || '' : undefined,
      client_name: body.client_id !== undefined ? client?.name || '' : undefined,
      title: body.title !== undefined ? text(body.title) : undefined,
      event_type: body.event_type !== undefined ? text(body.event_type) : undefined,
      date: body.date !== undefined ? text(body.date) : undefined,
      time: body.time !== undefined ? text(body.time) : undefined,
      duration: body.duration !== undefined ? text(body.duration) : undefined,
      meeting_link: body.meeting_link !== undefined ? text(body.meeting_link) : undefined,
      color: body.client_id !== undefined ? client?.color || '#3B82F6' : undefined,
    });
    await updateDoc(doc(db, 'events', id), payload);
    return getAccessibleDoc('events', id, session);
  },

  async remove(id) {
    return deleteStudioDoc('events', id);
  },
};

export const formsAPI = {
  async getFields() {
    const session = await requireStudioSession();
    const snapshot = await getDoc(doc(db, 'form_configs', session.firebaseUser.uid));
    if (!snapshot.exists()) {
      return DEFAULT_FORM_FIELDS;
    }
    return snapshot.data().fields || DEFAULT_FORM_FIELDS;
  },

  async saveFields(fields) {
    const session = await requireStudioSession();
    const payload = fields
      .map((field, index) => ({
        label: text(field.label),
        field_type: text(field.field_type) || 'text',
        required: field.required ? 1 : 0,
        options: Array.isArray(field.options)
          ? field.options.map((option) => text(option)).filter(Boolean).join(',')
          : text(field.options),
        sort_order: index,
      }))
      .filter((field) => field.label);

    await setDoc(doc(db, 'form_configs', session.firebaseUser.uid), {
      user_id: session.firebaseUser.uid,
      fields: payload,
      updated_at: now(),
    });

    return { success: true, fields: payload };
  },

  async submissions() {
    const rows = await listAccessibleDocs('form_submissions');
    return rows.sort((a, b) => compareDatesDesc(a, b, 'submitted_at'));
  },

  async getPublicFields(userId) {
    ensureFirebaseConfigured();
    const targetUserId = text(userId);
    if (!targetUserId) {
      throw new Error('Form owner is missing.');
    }
    const snapshot = await getDoc(doc(db, 'form_configs', targetUserId));
    if (!snapshot.exists()) {
      return DEFAULT_FORM_FIELDS;
    }
    return snapshot.data().fields || DEFAULT_FORM_FIELDS;
  },

  async submitPublic(userId, data) {
    ensureFirebaseConfigured();
    const targetUserId = text(userId);
    if (!targetUserId) {
      throw new Error('Form owner is missing.');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Submission data is invalid.');
    }
    const sanitizedData = Object.fromEntries(
      Object.entries(data)
        .map(([key, value]) => [text(key), text(value)])
        .filter(([key, value]) => key && value)
    );
    if (!Object.keys(sanitizedData).length) {
      throw new Error('Please complete the form before submitting.');
    }
    const payload = {
      user_id: targetUserId,
      data: sanitizedData,
      submitted_at: now(),
    };
    const reference = await addDoc(collection(db, 'form_submissions'), payload);
    return { id: reference.id, ...payload };
  },
};

export const analyticsAPI = {
  async revenue(months) {
    const session = await requireStudioSession();
    const [invoices, projects] = await Promise.all([invoicesAPI.list(), projectsAPI.list()]);
    const paidInvoices = invoices.filter((invoice) => invoice.status === 'paid');
    const byServiceMap = new Map();

    projects.forEach((project) => {
      byServiceMap.set(project.service || 'Uncategorised', (byServiceMap.get(project.service || 'Uncategorised') || 0) + 1);
    });

    return {
      invoices: paidInvoices,
      byService: Array.from(byServiceMap.entries()).map(([service, count]) => ({ service, count })),
      months,
      totalPaid: paidInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
      totalOutstanding: invoices
        .filter((invoice) => invoice.status !== 'paid')
        .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
      ownerId: session.firebaseUser.uid,
    };
  },

  async pipeline() {
    await requireStudioSession();
    const [submissions, proposals, contracts, projects] = await Promise.all([
      formsAPI.submissions(),
      proposalsAPI.list(),
      contractsAPI.list(),
      projectsAPI.list(),
    ]);

    return {
      enquiries: submissions.length,
      proposals_sent: proposals.length,
      contracts_signed: contracts.filter((contract) => contract.signed).length,
      active_projects: projects.filter((project) => project.status === 'active').length,
      delivered: projects.filter((project) => project.status === 'delivered').length,
    };
  },
};

export const messagesAPI = {
  async list() {
    const rows = await listAccessibleDocs('messages');
    return buildThreadList(rows);
  },

  async thread(clientId) {
    const session = await requireSession();
    const rows = await listAccessibleDocs('messages');
    const targetClientId = isClientProfile(session.profile) ? session.profile.client_id : clientId;

    if (!targetClientId) {
      return [];
    }

    if (isStudioProfile(session.profile)) {
      await getStudioClient(targetClientId, session);
    }

    return rows
      .filter((message) => message.client_id === targetClientId)
      .sort((a, b) => compareDatesAsc(a, b, 'sent_at'));
  },

  async send(clientId, message) {
    const session = await requireSession();
    const messageText = text(message);
    if (!messageText) {
      throw new Error('Message text is required.');
    }

    const client = isStudioProfile(session.profile)
      ? await getStudioClient(clientId, session)
      : await getAccessibleDoc('clients', session.profile.client_id, session);

    const payload = {
      user_id: isStudioProfile(session.profile) ? session.firebaseUser.uid : session.profile.studio_owner_id,
      client_id: client.id,
      client_name: client.name,
      color: client.color || '#1B2B4B',
      text: messageText,
      outbound: isStudioProfile(session.profile),
      sender_role: isStudioProfile(session.profile) ? USER_ROLES.STUDIO : USER_ROLES.CLIENT,
      sent_at: now(),
    };

    const reference = await addDoc(collection(db, 'messages'), payload);
    return { id: reference.id, ...payload };
  },
};

function sanitizeQuestions(questions) {
  const allowed = ['section', 'text', 'textarea', 'choice', 'checkboxes'];
  return (Array.isArray(questions) ? questions : [])
    .map((item, index) => ({
      id: text(item.id) || `q_${index}_${createId().slice(0, 6)}`,
      type: allowed.includes(item.type) ? item.type : 'textarea',
      label: text(item.label),
      help: text(item.help),
      options: Array.isArray(item.options) ? item.options.map(text).filter(Boolean).join(', ') : text(item.options),
      required: Boolean(item.required) && item.type !== 'section',
    }))
    .filter((item) => item.label);
}

function sanitizeAnswers(answers, questions) {
  const ids = new Set((questions || []).map((item) => item.id));
  return Object.fromEntries(
    Object.entries(answers || {})
      .filter(([key]) => ids.has(key))
      .map(([key, value]) => [key, Array.isArray(value) ? value.map(text).filter(Boolean) : String(value ?? '').slice(0, 10000)])
  );
}

// Lets the studio know by email when a client submits (best effort; Vela still shows it in-app).
async function notifyStudioOfSubmission(responseId, kind = 'questionnaire') {
  try {
    const token = await auth?.currentUser?.getIdToken();
    if (!token) return;
    await fetch('/api/notify-submission', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(kind === 'review' ? { reviewId: responseId } : kind === 'contract' ? { contractId: responseId } : { responseId }),
    });
  } catch {
    // Email is a convenience; the submission itself has already been saved.
  }
}

export const questionnairesAPI = {
  async listTemplates() {
    const session = await requireStudioSession();
    const snapshot = await getDocs(query(collection(db, 'questionnaires'), where('user_id', '==', session.firebaseUser.uid)));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => compareDatesDesc(a, b, 'updated_at'));
  },

  async getTemplate(id) {
    const session = await requireStudioSession();
    return getAccessibleDoc('questionnaires', id, session);
  },

  async createTemplate(body) {
    const session = await requireStudioSession();
    const payload = {
      user_id: session.firebaseUser.uid,
      title: text(body.title) || 'Untitled questionnaire',
      description: text(body.description),
      questions: sanitizeQuestions(body.questions),
      created_at: now(),
      updated_at: now(),
    };
    const reference = await addDoc(collection(db, 'questionnaires'), payload);
    return { id: reference.id, ...payload };
  },

  async updateTemplate(id, body) {
    const session = await requireStudioSession();
    await getAccessibleDoc('questionnaires', id, session);
    const payload = {
      title: text(body.title) || 'Untitled questionnaire',
      description: text(body.description),
      questions: sanitizeQuestions(body.questions),
      updated_at: now(),
    };
    await updateDoc(doc(db, 'questionnaires', id), payload);
    return { id, ...payload };
  },

  async removeTemplate(id) {
    return deleteStudioDoc('questionnaires', id);
  },

  async listResponses() {
    const rows = await listAccessibleDocs('questionnaire_responses');
    return rows.sort((a, b) => compareDatesDesc(a, b, 'updated_at'));
  },

  async getResponse(id) {
    const session = await requireSession();
    return getAccessibleDoc('questionnaire_responses', id, session);
  },

  async send({ template_id, client_id, project_id, stage_index, note, step_id }) {
    const session = await requireStudioSession();
    if (!template_id || !client_id) {
      throw new Error('Choose a questionnaire and a client.');
    }
    const template = await getAccessibleDoc('questionnaires', template_id, session);
    const client = await getStudioClient(client_id, session);
    const questions = sanitizeQuestions(template.questions);
    if (!questions.some((item) => item.type !== 'section')) {
      throw new Error('This questionnaire has no questions yet.');
    }
    let project = null;
    if (project_id) {
      project = await getAccessibleDoc('projects', project_id, session);
    }
    const payload = {
      user_id: session.firebaseUser.uid,
      studio_email: session.firebaseUser.email || '',
      client_id: client.id,
      client_name: client.name,
      contact_name: client.contact || '',
      project_id: project?.id || '',
      project_service: project?.service || '',
      stage_index: Number.isFinite(Number(stage_index)) ? Number(stage_index) : 0,
      stage_label: project ? (workflowLabels(project)[Number(stage_index) || 0] || '') : '',
      step_id: text(step_id),
      template_id: template.id,
      title: template.title,
      description: text(note) || template.description || '',
      questions,
      answers: {},
      status: 'sent',
      seen_by_studio: false,
      sent_at: now(),
      updated_at: now(),
      submitted_at: '',
    };
    const reference = await addDoc(collection(db, 'questionnaire_responses'), payload);
    return { id: reference.id, ...payload };
  },

  async saveAnswers(id, answers) {
    const session = await requireClientSession();
    const current = await getAccessibleDoc('questionnaire_responses', id, session);
    if (current.status === 'submitted') {
      throw new Error('This questionnaire has already been sent to the studio.');
    }
    const payload = { answers: sanitizeAnswers(answers, current.questions), status: 'in_progress', updated_at: now() };
    await updateDoc(doc(db, 'questionnaire_responses', id), payload);
    return { ...current, ...payload };
  },

  async submit(id, answers) {
    const session = await requireClientSession();
    const current = await getAccessibleDoc('questionnaire_responses', id, session);
    if (current.status === 'submitted') {
      return current;
    }
    const stamp = now();
    const payload = { answers: sanitizeAnswers(answers, current.questions), status: 'submitted', submitted_at: stamp, updated_at: stamp };
    await updateDoc(doc(db, 'questionnaire_responses', id), payload);
    notifyStudioOfSubmission(id);
    return { ...current, ...payload };
  },

  async markSeen(id) {
    const session = await requireStudioSession();
    await getAccessibleDoc('questionnaire_responses', id, session);
    await updateDoc(doc(db, 'questionnaire_responses', id), { seen_by_studio: true });
    return { success: true };
  },

  async reopen(id) {
    const session = await requireStudioSession();
    await getAccessibleDoc('questionnaire_responses', id, session);
    const payload = { status: 'in_progress', seen_by_studio: false, submitted_at: '', updated_at: now() };
    await updateDoc(doc(db, 'questionnaire_responses', id), payload);
    return payload;
  },

  async removeResponse(id) {
    return deleteStudioDoc('questionnaire_responses', id);
  },

  // Live updates for the studio, so a new submission shows up without reloading.
  subscribeResponses(onChange, onError = () => {}) {
    let unsubscribe = () => {};
    let cancelled = false;
    requireStudioSession()
      .then((session) => {
        if (cancelled) return;
        unsubscribe = onSnapshot(
          query(collection(db, 'questionnaire_responses'), where('user_id', '==', session.firebaseUser.uid)),
          (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
          onError
        );
      })
      .catch(onError);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  },
};

/* ── Reviews: work the studio shares with a client for comments and approval ── */

function sanitizeFiles(files) {
  return (Array.isArray(files) ? files : [])
    .map((f) => ({
      name: text(f.name).slice(0, 200) || 'File',
      url: text(f.url),
      kind: f.kind === 'link' ? 'link' : 'file',
      type: text(f.type).slice(0, 100),
      size: Number(f.size) || 0,
      ...(f.pathname ? { pathname: text(f.pathname).slice(0, 400) } : {}),
    }))
    .filter((f) => /^https?:\/\//i.test(f.url));
}

export const reviewsAPI = {
  async list() {
    const rows = await listAccessibleDocs('reviews');
    return rows.sort((a, b) => compareDatesDesc(a, b, 'sent_at'));
  },

  async get(id) {
    const session = await requireSession();
    return getAccessibleDoc('reviews', id, session);
  },

  // Studio shares files for a step. Each send is a new round, so earlier rounds stay on record.
  async send({ project_id, stage_index, step_id, title, note, files, kind = 'review' }) {
    const session = await requireStudioSession();
    const project = await getAccessibleDoc('projects', project_id, session);
    const client = await getStudioClient(project.client_id, session);
    const cleanFiles = sanitizeFiles(files);
    if (!cleanFiles.length) {
      throw new Error('Add at least one file or link.');
    }
    const previous = await getDocs(query(collection(db, 'reviews'), where('user_id', '==', session.firebaseUser.uid), where('project_id', '==', project.id)));
    const round = previous.docs.filter((d) => d.data().step_id === step_id).length + 1;
    const stamp = now();
    const payload = {
      user_id: session.firebaseUser.uid,
      studio_email: session.firebaseUser.email || '',
      client_id: client.id,
      client_name: client.name,
      contact_name: client.contact || '',
      project_id: project.id,
      project_service: project.service || '',
      stage_index: Number(stage_index) || 0,
      stage_label: workflowLabels(project)[Number(stage_index) || 0] || '',
      step_id: text(step_id),
      title: text(title) || 'Work for review',
      note: text(note),
      files: cleanFiles,
      kind: kind === 'delivery' ? 'delivery' : 'review',
      status: kind === 'delivery' ? 'delivered' : 'in_review',
      round,
      sent_at: stamp,
      updated_at: stamp,
      decided_at: '',
      decision_note: '',
      client_activity_at: '',
      studio_seen_at: stamp,
    };
    const reference = await addDoc(collection(db, 'reviews'), payload);
    return { id: reference.id, ...payload };
  },

  // Client approves or asks for changes.
  async decide(id, decision, note = '') {
    const session = await requireClientSession();
    const current = await getAccessibleDoc('reviews', id, session);
    if (current.status !== 'in_review') {
      throw new Error('This has already been answered.');
    }
    const status = decision === 'approved' ? 'approved' : 'changes_requested';
    const stamp = now();
    const payload = { status, decided_at: stamp, decision_note: text(note).slice(0, 5000), client_activity_at: stamp, updated_at: stamp };
    await updateDoc(doc(db, 'reviews', id), payload);
    if (payload.decision_note) {
      await addDoc(collection(db, 'reviews', id, 'comments'), {
        author_role: USER_ROLES.CLIENT,
        author_name: session.profile.name || current.contact_name || current.client_name,
        text: payload.decision_note,
        decision: status,
        created_at: stamp,
      });
    }
    notifyStudioOfSubmission(id, 'review');
    return { ...current, ...payload };
  },

  // Studio records an approval given elsewhere (e.g. on a call), or reopens a decision.
  async setStatus(id, status) {
    const session = await requireStudioSession();
    await getAccessibleDoc('reviews', id, session);
    const allowed = ['in_review', 'approved', 'changes_requested'];
    if (!allowed.includes(status)) throw new Error('Unknown status.');
    const payload = { status, decided_at: status === 'in_review' ? '' : now(), updated_at: now() };
    await updateDoc(doc(db, 'reviews', id), payload);
    return payload;
  },

  async markSeen(id) {
    const session = await requireStudioSession();
    await getAccessibleDoc('reviews', id, session);
    await updateDoc(doc(db, 'reviews', id), { studio_seen_at: now() });
  },

  async remove(id) {
    return deleteStudioDoc('reviews', id);
  },

  subscribeComments(id, onChange, onError = () => {}) {
    return onSnapshot(
      query(collection(db, 'reviews', id, 'comments'), orderBy('created_at', 'asc')),
      (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      onError
    );
  },

  async addComment(id, message) {
    const session = await requireSession();
    const current = await getAccessibleDoc('reviews', id, session);
    const body = text(message).slice(0, 5000);
    if (!body) throw new Error('Write a comment first.');
    const stamp = now();
    const studio = isStudioProfile(session.profile);
    const comment = {
      author_role: studio ? USER_ROLES.STUDIO : USER_ROLES.CLIENT,
      author_name: studio ? (session.profile.name || 'Studio') : (session.profile.name || current.contact_name || current.client_name),
      text: body,
      created_at: stamp,
    };
    const reference = await addDoc(collection(db, 'reviews', id, 'comments'), comment);
    if (studio) {
      await updateDoc(doc(db, 'reviews', id), { studio_seen_at: stamp, updated_at: stamp });
    } else {
      await updateDoc(doc(db, 'reviews', id), { client_activity_at: stamp, updated_at: stamp });
      notifyStudioOfSubmission(id, 'review');
    }
    return { id: reference.id, ...comment };
  },

  // Live updates for the studio (approvals, change requests and comments).
  subscribe(onChange, onError = () => {}) {
    let unsubscribe = () => {};
    let cancelled = false;
    requireStudioSession()
      .then((session) => {
        if (cancelled) return;
        unsubscribe = onSnapshot(
          query(collection(db, 'reviews'), where('user_id', '==', session.firebaseUser.uid)),
          (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
          onError
        );
      })
      .catch(onError);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  },
};

/* ── File uploads (Vercel Blob) ── */

export const uploadsAPI = {
  async status() {
    try {
      const res = await fetch('/api/upload');
      if (!res.ok) return { configured: false };
      return await res.json();
    } catch {
      return { configured: false };
    }
  },

  // Files go to a private store under the studio's own folder; they're opened through
  // short-lived links from filesAPI.links.
  async upload(file, { folder = 'uploads', onProgress } = {}) {
    const session = await requireStudioSession();
    const token = await auth.currentUser.getIdToken();
    const { uploadPresigned } = await import('@vercel/blob/client');
    const safeName = String(file.name || 'file').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+/, '').slice(-80) || 'file';
    const cleanFolder = String(folder).replace(/[^A-Za-z0-9_\-/]+/g, '-');
    const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const pathname = `studio/${session.firebaseUser.uid}/${cleanFolder}/${unique}-${safeName}`;
    const blob = await uploadPresigned(pathname, file, {
      access: 'private',
      handleUploadUrl: '/api/upload',
      clientPayload: JSON.stringify({ token }),
      multipart: file.size > 20 * 1024 * 1024,
      onUploadProgress: onProgress ? (e) => onProgress(e.percentage) : undefined,
    });
    return { name: file.name, url: blob.url, pathname: blob.pathname || pathname, type: file.type || blob.contentType || '', size: file.size, kind: 'file' };
  },
};

export const filesAPI = {
  // Short-lived links (one hour) for the private files on a review.
  async links(reviewId, urls) {
    const wanted = (urls || []).filter(Boolean);
    if (!reviewId || !wanted.length) return {};
    await requireSession();
    const token = await auth.currentUser.getIdToken();
    const res = await fetch('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reviewId, urls: wanted }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Couldn’t open these files.');
    return data.links || {};
  },
};
