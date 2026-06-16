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
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, createSecondaryFirebaseServices, db, ensureFirebaseConfigured } from '../lib/firebase';

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
  if (!targetClientId) {
    return [];
  }

  const snapshot = await getDocs(query(collection(db, collectionName), where('client_id', '==', targetClientId)));
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
    const amount = text(body.amount);
    if (!body.client_id || !amount) {
      throw new Error('Client and amount are required.');
    }

    const client = await getStudioClient(body.client_id, session);
    const payload = {
      user_id: session.firebaseUser.uid,
      client_id: client.id,
      client_name: client.name,
      project_id: text(body.project_id),
      description: text(body.description),
      amount,
      due_date: text(body.due_date),
      status: text(body.status) || 'unpaid',
      created_at: now(),
    };

    const reference = await addDoc(collection(db, 'invoices'), payload);
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
      description: body.description !== undefined ? text(body.description) : undefined,
      amount: body.amount !== undefined ? text(body.amount) : undefined,
      due_date: body.due_date !== undefined ? text(body.due_date) : undefined,
      status: body.status !== undefined ? text(body.status) : undefined,
    });
    await updateDoc(doc(db, 'invoices', id), payload);
    return getAccessibleDoc('invoices', id, session);
  },

  async updateStatus(id, status) {
    const session = await requireStudioSession();
    await getAccessibleDoc('invoices', id, session);
    const nextStatus = text(status);
    if (!['paid', 'unpaid'].includes(nextStatus)) {
      throw new Error('Invoice status is invalid.');
    }
    await updateDoc(doc(db, 'invoices', id), { status: nextStatus });
    return { success: true, status: nextStatus };
  },

  async remove(id) {
    return deleteStudioDoc('invoices', id);
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
      service,
      value: text(body.value),
      start_date: text(body.start_date),
      duration: text(body.duration),
      date: text(body.date),
      primary_color: text(body.primary_color) || '#1B2B4B',
      accent_color: text(body.accent_color) || '#C9A84C',
      clauses: Array.isArray(body.clauses) ? body.clauses : [],
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
      service: body.service !== undefined ? text(body.service) : undefined,
      value: body.value !== undefined ? text(body.value) : undefined,
      start_date: body.start_date !== undefined ? text(body.start_date) : undefined,
      duration: body.duration !== undefined ? text(body.duration) : undefined,
      date: body.date !== undefined ? text(body.date) : undefined,
      primary_color: body.primary_color !== undefined ? text(body.primary_color) : undefined,
      accent_color: body.accent_color !== undefined ? text(body.accent_color) : undefined,
      clauses: body.clauses !== undefined ? (Array.isArray(body.clauses) ? body.clauses : []) : undefined,
      signed: body.signed !== undefined ? Boolean(body.signed) : undefined,
    });
    await updateDoc(doc(db, 'contracts', id), payload);
    return getAccessibleDoc('contracts', id, session);
  },

  async sign(id) {
    const session = await requireStudioSession();
    await getAccessibleDoc('contracts', id, session);
    await updateDoc(doc(db, 'contracts', id), { signed: true });
    return { success: true };
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
