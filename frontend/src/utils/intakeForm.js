// The public enquiry form: question types, the studio template, and helpers shared by
// the form builder, the public page and the enquiries inbox.

export const QUESTION_TYPES = [
  { value: 'text', label: 'Short answer' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'textarea', label: 'Paragraph' },
  { value: 'radio', label: 'Multiple choice' },
  { value: 'checkboxes', label: 'Checkboxes' },
  { value: 'select', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
];

export const CHOICE_TYPES = ['radio', 'checkboxes', 'select'];

// Creative Mayaa Studio's enquiry form, used as the starting point for every studio.
export const STUDIO_ENQUIRY_TEMPLATE = {
  title: 'Let’s Build You a Strong Foundation',
  intro: `Let’s build a brand that positions you to look premium, stand out, and confidently charge more.

This takes 2–3 minutes.
We’ll review your inquiry and get back to you within 24 hours.

We work best with brands ready to invest in strategic, intentional design.

Looking forward to creating with you,
__STUDIO_NAME__`,
  thanks: 'Thank you! Your enquiry is in. We’ll review it and get back to you within 24 hours.',
  fields: [
    { label: 'Your Name', field_type: 'text', required: true },
    { label: 'Your Location', field_type: 'text', required: true },
    { label: 'Your Email Address', field_type: 'email', required: true },
    { label: 'Instagram Handle (if any)', field_type: 'text', required: false },
    { label: 'Your Business Name', field_type: 'text', required: false },
    { label: 'Tell us more about your business, briefly describe your product or service.', field_type: 'textarea', required: true },
    { label: 'What do you need help with and what are you hoping we achieve together?', field_type: 'textarea', required: true },
    { label: 'What service are you most interested in?', field_type: 'checkboxes', required: true, choices: ['Brand Strategy + Brand Identity', 'Packaging Design', 'Website Design'], allow_other: true },
    { label: 'What investment range feels most aligned with you? Our branding packages start at $2500.', field_type: 'radio', required: true, choices: ['USD $2500 - $3500', '$3500 - $4500', '$4500 - $6000'] },
    { label: 'When are you hoping to begin working together?', field_type: 'text', required: true },
    { label: 'How did you hear about us?', field_type: 'checkboxes', required: true, choices: ['Instagram', 'Pinterest', 'Google', 'Referral'], allow_other: true },
  ],
};

// Older forms stored choices as a comma-separated string.
export function fieldChoices(field) {
  if (Array.isArray(field?.choices)) return field.choices.map((c) => String(c).trim()).filter(Boolean);
  return String(field?.options || '').split(',').map((o) => o.trim()).filter(Boolean);
}

export function normalizeField(field = {}, index = 0) {
  return {
    id: field.id || `q${index}-${Math.random().toString(36).slice(2, 7)}`,
    label: field.label || '',
    help: field.help || '',
    field_type: QUESTION_TYPES.some((t) => t.value === field.field_type) ? field.field_type : 'text',
    required: Boolean(field.required),
    choices: fieldChoices(field),
    allow_other: Boolean(field.allow_other),
  };
}

// The key an answer is stored under (kept compatible with older submissions).
export function fieldName(field, index) {
  const base = (field.label || `field_${index + 1}`).trim().toLowerCase();
  return base.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || `field_${index + 1}`;
}

export function fillIntro(text, studioName) {
  return String(text || '').split('__STUDIO_NAME__').join(studioName || 'the studio');
}

// Find an answer by meaning, so "Add as client" works whatever the questions are called.
const ROLE_PATTERNS = {
  email: [/e[-_ ]?mail/],
  name: [/^(your_)?(full_)?name$/, /^(your_)?(first_)?name/, /(^|_)name$/],
  business: [/(business|brand|company)_name/, /^(your_)?(business|brand|company)$/],
  location: [/location|city|country|based/],
  instagram: [/instagram|handle/],
  service: [/service.*interest|interest.*service|(what|which)_service/, /^(your_)?services?(_|$)/],
};

const slug = (key) => String(key).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export function pickAnswer(data, role) {
  const keys = Object.keys(data || {});
  for (const pattern of ROLE_PATTERNS[role] || []) {
    // Short answers only: a long paragraph is never a name, email or service.
    const key = keys.find((k) => pattern.test(slug(k)) && data[k] && String(data[k]).length <= 160
      && !(role === 'name' && /business|brand|company/.test(slug(k))));
    if (key && data[key]) return String(data[key]);
  }
  return '';
}

// Resize a header image to a sensible size for the web (kept in the database).
export function resizeHeader(file, maxW = 1600, maxH = 600) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) { reject(new Error('Use a PNG, JPG or WebP image.')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Couldn’t read that image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Couldn’t read that image.'));
      img.onload = () => {
        const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        let url = canvas.toDataURL('image/png');
        if (url.length > 450000) {
          const flat = document.createElement('canvas');
          flat.width = canvas.width;
          flat.height = canvas.height;
          const ctx = flat.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, flat.width, flat.height);
          ctx.drawImage(canvas, 0, 0);
          url = flat.toDataURL('image/jpeg', 0.85);
          if (url.length > 600000) url = flat.toDataURL('image/jpeg', 0.7);
        }
        if (url.length > 700000) { reject(new Error('That image is too large. Try a smaller one.')); return; }
        resolve(url);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
