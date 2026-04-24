import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
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
import { auth, db, ensureFirebaseConfigured } from '../lib/firebase';

const DEFAULT_FORM_FIELDS = [
  { label: 'Full Name', field_type: 'text', required: 1, options: '', sort_order: 0 },
  { label: 'Email Address', field_type: 'email', required: 1, options: '', sort_order: 1 },
  { label: 'Brand / Business Name', field_type: 'text', required: 1, options: '', sort_order: 2 },
  { label: 'Service Interested In', field_type: 'select', required: 1, options: 'Brand Identity,Packaging Design,Web Design,Full Suite', sort_order: 3 },
  { label: 'Tell me about your project', field_type: 'textarea', required: 1, options: '', sort_order: 4 },
  { label: 'Project Budget', field_type: 'select', required: 0, options: '£1,500–£3,000,£3,000–£5,000,£5,000+', sort_order: 5 },
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

function requireUser() {
  ensureFirebaseConfigured();
  if (!auth?.currentUser) {
    throw new Error('You need to sign in first.');
  }
  return auth.currentUser;
}

async function getUserProfile(uid) {
  ensureFirebaseConfigured();
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...snapshot.data() };
}

async function getOwnedDoc(collectionName, id, uid) {
  const snapshot = await getDoc(doc(db, collectionName, id));
  if (!snapshot.exists()) {
    throw new Error('Not found');
  }
  const data = snapshot.data();
  if (data.user_id !== uid) {
    throw new Error('Not found');
  }
  return { id: snapshot.id, ...data };
}

async function listOwnedDocs(collectionName) {
  const user = requireUser();
  const snapshot = await getDocs(query(collection(db, collectionName), where('user_id', '==', user.uid)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function stripUndefinedValues(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
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
        });
      }
    });

  return Array.from(latestByClient.values());
}

export const authAPI = {
  async login(body) {
    ensureFirebaseConfigured();
    const loginEmail = email(body.email);
    const password = body.password;
    if (!loginEmail || !password) {
      throw new Error('Email and password are required.');
    }

    const credential = await signInWithEmailAndPassword(auth, loginEmail, password);
    const user = await getUserProfile(credential.user.uid);
    return { user };
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

    const credential = await createUserWithEmailAndPassword(auth, registerEmail, password);
    const profile = {
      id: credential.user.uid,
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
    return { user: profile };
  },

  async logout() {
    ensureFirebaseConfigured();
    await signOut(auth);
  },

  async me() {
    const user = requireUser();
    return getUserProfile(user.uid);
  },
};

export const clientsAPI = {
  async list() {
    const rows = await listOwnedDocs('clients');
    return rows.sort((a, b) => compareDatesDesc(a, b, 'created_at'));
  },

  async get(id) {
    const user = requireUser();
    return getOwnedDoc('clients', id, user.uid);
  },

  async create(body) {
    const user = requireUser();
    const name = text(body.name);
    if (!name) {
      throw new Error('Client name is required.');
    }

    const payload = {
      user_id: user.uid,
      name,
      contact: text(body.contact),
      email: email(body.email),
      location: text(body.location),
      industry: text(body.industry) || 'Other',
      color: text(body.color) || '#1B2B4B',
      created_at: now(),
    };

    const reference = await addDoc(collection(db, 'clients'), payload);
    return { id: reference.id, ...payload };
  },

  async update(id, body) {
    const user = requireUser();
    await getOwnedDoc('clients', id, user.uid);
    const payload = stripUndefinedValues({
      name: body.name !== undefined ? text(body.name) : undefined,
      contact: body.contact !== undefined ? text(body.contact) : undefined,
      email: body.email !== undefined ? email(body.email) : undefined,
      location: body.location !== undefined ? text(body.location) : undefined,
      industry: body.industry !== undefined ? text(body.industry) : undefined,
      color: body.color !== undefined ? text(body.color) : undefined,
    });
    await updateDoc(doc(db, 'clients', id), payload);
    return getOwnedDoc('clients', id, user.uid);
  },

  async remove(id) {
    const user = requireUser();
    await getOwnedDoc('clients', id, user.uid);
    await deleteDoc(doc(db, 'clients', id));
    return { success: true };
  },
};

export const projectsAPI = {
  async list() {
    const rows = await listOwnedDocs('projects');
    return rows.sort((a, b) => compareDatesDesc(a, b, 'created_at'));
  },

  async get(id) {
    const user = requireUser();
    const project = await getOwnedDoc('projects', id, user.uid);
    return {
      ...project,
      files: project.files || [],
      signoffs: project.signoffs || [],
    };
  },

  async create(body) {
    const user = requireUser();
    const service = text(body.service);
    if (!body.client_id || !service) {
      throw new Error('Client and service are required.');
    }

    const client = await getOwnedDoc('clients', body.client_id, user.uid);
    const payload = {
      user_id: user.uid,
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
    const user = requireUser();
    await getOwnedDoc('projects', id, user.uid);
    const payload = stripUndefinedValues({
      service: body.service !== undefined ? text(body.service) : undefined,
      value: body.value !== undefined ? text(body.value) : undefined,
      start_date: body.start_date !== undefined ? text(body.start_date) : undefined,
      timeline: body.timeline !== undefined ? text(body.timeline) : undefined,
      budget: body.budget !== undefined ? text(body.budget) : undefined,
      status: body.status !== undefined ? text(body.status) : undefined,
    });
    await updateDoc(doc(db, 'projects', id), payload);
    return getOwnedDoc('projects', id, user.uid);
  },

  async advStage(id, stage) {
    const user = requireUser();
    await getOwnedDoc('projects', id, user.uid);
    const nextStage = Number(stage);
    if (!Number.isFinite(nextStage) || nextStage < 0) {
      throw new Error('Stage must be a valid number.');
    }
    await updateDoc(doc(db, 'projects', id), { stage: nextStage });
    return { success: true, stage: nextStage };
  },

  async addFile(id, body) {
    const user = requireUser();
    const project = await getOwnedDoc('projects', id, user.uid);
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
    const user = requireUser();
    const project = await getOwnedDoc('projects', id, user.uid);
    const normalizedStageIndex = Number(stageIndex);
    if (!Number.isFinite(normalizedStageIndex) || normalizedStageIndex < 0) {
      throw new Error('Stage index is invalid.');
    }
    const nextSignoffs = Array.from(new Set([...(project.signoffs || []), normalizedStageIndex]));
    await updateDoc(doc(db, 'projects', id), { signoffs: nextSignoffs });
    return { success: true, stage_index: normalizedStageIndex };
  },
};

export const invoicesAPI = {
  async list() {
    const rows = await listOwnedDocs('invoices');
    return rows.sort((a, b) => compareDatesDesc(a, b, 'created_at'));
  },

  async get(id) {
    const user = requireUser();
    return getOwnedDoc('invoices', id, user.uid);
  },

  async create(body) {
    const user = requireUser();
    if (!body.client_id || !text(body.amount)) {
      throw new Error('Client and amount are required.');
    }

    const client = await getOwnedDoc('clients', body.client_id, user.uid);
    const payload = {
      user_id: user.uid,
      client_id: client.id,
      client_name: client.name,
      project_id: text(body.project_id),
      description: text(body.description),
      amount: text(body.amount),
      due_date: text(body.due_date),
      status: 'unpaid',
      created_at: now(),
    };

    const reference = await addDoc(collection(db, 'invoices'), payload);
    return { id: reference.id, ...payload };
  },

  async updateStatus(id, status) {
    const user = requireUser();
    await getOwnedDoc('invoices', id, user.uid);
    const nextStatus = text(status);
    if (!['paid', 'unpaid'].includes(nextStatus)) {
      throw new Error('Invoice status is invalid.');
    }
    await updateDoc(doc(db, 'invoices', id), { status: nextStatus });
    return { success: true, status: nextStatus };
  },
};

export const proposalsAPI = {
  async list() {
    const rows = await listOwnedDocs('proposals');
    return rows.sort((a, b) => compareDatesDesc(a, b, 'created_at'));
  },

  async get(id) {
    const user = requireUser();
    return getOwnedDoc('proposals', id, user.uid);
  },

  async create(body) {
    const user = requireUser();
    const client = body.client_id ? await getOwnedDoc('clients', body.client_id, user.uid) : null;
    const service = text(body.service);
    if (!service) {
      throw new Error('Service is required.');
    }

    const payload = {
      user_id: user.uid,
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
      packages: Array.isArray(body.packages) ? body.packages : [],
      deliverables: Array.isArray(body.deliverables) ? body.deliverables : [],
      timeline: Array.isArray(body.timeline) ? body.timeline : [],
      terms: text(body.terms),
      process: text(body.process),
      status: text(body.status) || 'draft',
      created_at: now(),
    };
    const reference = await addDoc(collection(db, 'proposals'), payload);
    return { id: reference.id, ...payload };
  },

  async update(id, body) {
    const user = requireUser();
    await getOwnedDoc('proposals', id, user.uid);
    const client = body.client_id ? await getOwnedDoc('clients', body.client_id, user.uid) : null;
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
      packages: body.packages !== undefined ? (Array.isArray(body.packages) ? body.packages : []) : undefined,
      deliverables: body.deliverables !== undefined ? (Array.isArray(body.deliverables) ? body.deliverables : []) : undefined,
      timeline: body.timeline !== undefined ? (Array.isArray(body.timeline) ? body.timeline : []) : undefined,
      terms: body.terms !== undefined ? text(body.terms) : undefined,
      process: body.process !== undefined ? text(body.process) : undefined,
      status: body.status !== undefined ? text(body.status) : undefined,
    });
    await updateDoc(doc(db, 'proposals', id), payload);
    return { success: true };
  },
};

export const contractsAPI = {
  async list() {
    const rows = await listOwnedDocs('contracts');
    return rows.sort((a, b) => compareDatesDesc(a, b, 'created_at'));
  },

  async get(id) {
    const user = requireUser();
    return getOwnedDoc('contracts', id, user.uid);
  },

  async create(body) {
    const user = requireUser();
    const client = body.client_id ? await getOwnedDoc('clients', body.client_id, user.uid) : null;
    const service = text(body.service);
    if (!service) {
      throw new Error('Service is required.');
    }

    const payload = {
      user_id: user.uid,
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
    const user = requireUser();
    await getOwnedDoc('contracts', id, user.uid);
    const client = body.client_id ? await getOwnedDoc('clients', body.client_id, user.uid) : null;
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
    });
    await updateDoc(doc(db, 'contracts', id), payload);
    return { success: true };
  },

  async sign(id) {
    const user = requireUser();
    await getOwnedDoc('contracts', id, user.uid);
    await updateDoc(doc(db, 'contracts', id), { signed: true });
    return { success: true };
  },
};

export const eventsAPI = {
  async list() {
    const rows = await listOwnedDocs('events');
    return rows.sort(compareEventSchedule);
  },

  async create(body) {
    const user = requireUser();
    const client = body.client_id ? await getOwnedDoc('clients', body.client_id, user.uid) : null;
    const title = text(body.title);
    if (!title || !text(body.date)) {
      throw new Error('Event title and date are required.');
    }
    const payload = {
      user_id: user.uid,
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

  async remove(id) {
    const user = requireUser();
    await getOwnedDoc('events', id, user.uid);
    await deleteDoc(doc(db, 'events', id));
    return { success: true };
  },
};

export const formsAPI = {
  async getFields() {
    const user = requireUser();
    const snapshot = await getDoc(doc(db, 'form_configs', user.uid));
    if (!snapshot.exists()) {
      return DEFAULT_FORM_FIELDS;
    }
    return snapshot.data().fields || DEFAULT_FORM_FIELDS;
  },

  async saveFields(fields) {
    const user = requireUser();
    const payload = fields.map((field, index) => ({
      label: text(field.label),
      field_type: text(field.field_type) || 'text',
      required: field.required ? 1 : 0,
      options: Array.isArray(field.options) ? field.options.map((option) => text(option)).filter(Boolean).join(',') : text(field.options),
      sort_order: index,
    })).filter((field) => field.label);

    await setDoc(doc(db, 'form_configs', user.uid), {
      user_id: user.uid,
      fields: payload,
      updated_at: now(),
    });

    return { success: true };
  },

  async submissions() {
    const rows = await listOwnedDocs('form_submissions');
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
    const [invoices, projects] = await Promise.all([invoicesAPI.list(), projectsAPI.list()]);
    const paidInvoices = invoices.filter((invoice) => invoice.status === 'paid');
    const byServiceMap = new Map();

    projects.forEach((project) => {
      byServiceMap.set(project.service, (byServiceMap.get(project.service) || 0) + 1);
    });

    return {
      invoices: paidInvoices,
      byService: Array.from(byServiceMap.entries()).map(([service, count]) => ({ service, count })),
      months,
    };
  },

  async pipeline() {
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
      delivered: projects.filter((project) => project.status === 'delivered').length,
    };
  },
};

export const messagesAPI = {
  async list() {
    const rows = await listOwnedDocs('messages');
    return buildThreadList(rows);
  },

  async thread(clientId) {
    const user = requireUser();
    const rows = await listOwnedDocs('messages');
    const client = await getOwnedDoc('clients', clientId, user.uid);
    return rows
      .filter((message) => message.client_id === client.id)
      .sort((a, b) => compareDatesAsc(a, b, 'sent_at'));
  },

  async send(clientId, message) {
    const user = requireUser();
    const client = await getOwnedDoc('clients', clientId, user.uid);
    const messageText = text(message);
    if (!messageText) {
      throw new Error('Message text is required.');
    }
    const payload = {
      user_id: user.uid,
      client_id: client.id,
      client_name: client.name,
      color: client.color || '#1B2B4B',
      text: messageText,
      outbound: true,
      sent_at: now(),
    };
    const reference = await addDoc(collection(db, 'messages'), payload);
    return { id: reference.id, ...payload };
  },
};
