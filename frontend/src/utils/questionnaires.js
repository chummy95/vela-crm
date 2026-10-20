// Shared helpers for questionnaires: question types, the brand strategy starter, and answer checks.

export const QUESTION_TYPES = [
  { value: 'textarea', label: 'Long answer' },
  { value: 'text', label: 'Short answer' },
  { value: 'choice', label: 'Pick one' },
  { value: 'checkboxes', label: 'Pick any' },
  { value: 'section', label: 'Section heading' },
];

export function newQuestionId() {
  if (globalThis.crypto?.randomUUID) return `q_${globalThis.crypto.randomUUID().slice(0, 8)}`;
  return `q_${Math.random().toString(36).slice(2, 10)}`;
}

export function blankQuestion(type = 'textarea') {
  return { id: newQuestionId(), type, label: '', help: '', options: '', required: false };
}

export function optionList(question) {
  return String(question?.options || '').split(',').map((o) => o.trim()).filter(Boolean);
}

export function answerableQuestions(questions = []) {
  return questions.filter((q) => q.type !== 'section' && String(q.label || '').trim());
}

export function hasAnswer(value) {
  if (Array.isArray(value)) return value.length > 0;
  return String(value ?? '').trim().length > 0;
}

export function progress(questions = [], answers = {}) {
  const list = answerableQuestions(questions);
  const done = list.filter((q) => hasAnswer(answers[q.id])).length;
  return { done, total: list.length };
}

export function missingRequired(questions = [], answers = {}) {
  return answerableQuestions(questions).filter((q) => q.required && !hasAnswer(answers[q.id]));
}

// Turn pasted text into questions: one per line. Lines starting with "#" become section headings.
export function questionsFromText(raw) {
  return String(raw || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith('#')) return { ...blankQuestion('section'), label: line.replace(/^#+\s*/, '') };
      const label = line.replace(/^(\d+[.)]|[-*•])\s*/, '');
      return { ...blankQuestion('textarea'), label };
    });
}

const q = (type, label, extra = {}) => ({ ...blankQuestion(type), label, ...extra });

export function brandStrategyStarter() {
  return {
    title: 'Brand strategy questionnaire',
    description: 'These questions help me understand your business, your audience and where you want the brand to go. Take your time. Your answers save as you go, so you can come back to it.',
    questions: [
      q('section', 'Your business'),
      q('textarea', 'In a sentence or two, what does your business do?', { required: true }),
      q('textarea', 'Why did you start it? What’s the story behind it?'),
      q('textarea', 'Where would you like the business to be in three years?'),

      q('section', 'Your audience'),
      q('textarea', 'Who is your ideal customer?', { required: true, help: 'Describe them as a person: their age, lifestyle and what they value.' }),
      q('textarea', 'What problem do you solve for them, or what desire do you meet?', { required: true }),
      q('checkboxes', 'Where do they usually discover brands like yours?', { options: 'Instagram, TikTok, Pinterest, Word of mouth, Shops and stockists, Press, Search, Events' }),

      q('section', 'Market and positioning'),
      q('textarea', 'Who do you see as your main competitors?', { help: 'Names or links, and what you think they do well or badly.' }),
      q('textarea', 'What makes you genuinely different from them?', { required: true }),
      q('choice', 'How would you describe your price point?', { options: 'Accessible, Mid-market, Premium, Luxury' }),

      q('section', 'Brand personality'),
      q('text', 'Three to five words you want people to use when they describe your brand', { required: true }),
      q('text', 'Three words you never want associated with it'),
      q('textarea', 'If your brand walked into a room, how would it come across?'),
      q('textarea', 'Which brands, in any industry, do you admire, and why?'),

      q('section', 'Visual direction'),
      q('textarea', 'Are there colours, styles or symbols you love, or want to avoid?'),
      q('text', 'Links to any mood boards or inspiration', { help: 'Pinterest, Instagram or Google Drive links all work.' }),
      q('choice', 'Where are you starting from?', { options: 'Starting fresh, Some things to keep, Evolving an existing brand' }),

      q('section', 'Practicalities'),
      q('checkboxes', 'Where will the brand appear first?', { options: 'Packaging, Website, Social media, Retail space, Print, Signage' }),
      q('text', 'Which markets and languages does the brand need to work in?', { help: 'For example: UK, Saudi Arabia and UAE; English and Arabic.' }),
      q('text', 'Is there a launch date or deadline we’re working towards?'),
      q('textarea', 'Anything else you’d like me to know?'),
    ],
  };
}

export function projectFeedbackStarter() {
  return {
    title: 'Project feedback',
    description: 'Thank you for trusting me with your brand. I’d love your honest thoughts on how the project went. Good and bad, it all helps me do better work. It takes about five minutes.',
    questions: [
      q('section', 'The result'),
      q('choice', 'How do you feel about your new brand overall?', { required: true, options: 'Delighted, Happy, It’s okay, Disappointed' }),
      q('textarea', 'What do you love most about it?'),
      q('textarea', 'Is there anything you’re unsure about, or would change?'),

      q('section', 'Working together'),
      q('choice', 'How clear was the process from start to finish?', { options: 'Very clear, Mostly clear, Sometimes confusing, Confusing' }),
      q('choice', 'How did you find communication and response times?', { options: 'Excellent, Good, Could be better, Poor' }),
      q('choice', 'Did the project stay on time and on budget?', { options: 'Yes, Mostly, No' }),
      q('textarea', 'Was there a moment where you felt especially looked after, or let down?'),
      q('textarea', 'If you could change one thing about how we worked together, what would it be?', { required: true }),

      q('section', 'Looking ahead'),
      q('choice', 'How likely are you to recommend the studio to a friend?', { options: '10 (extremely likely), 9, 8, 7, 6, 5 or lower' }),
      q('textarea', 'Would you be happy for a few words of your feedback to be shared as a testimonial? If so, write them here.', { help: 'Totally optional. I’ll always check with you before using it.' }),
      q('textarea', 'Anything else you’d like to say?'),
    ],
  };
}

export const STARTERS = {
  brand_strategy: brandStrategyStarter,
  project_feedback: projectFeedbackStarter,
};

export const RESPONSE_STATUS = {
  sent: { label: 'Not started', pill: 'pending' },
  in_progress: { label: 'In progress', pill: 'active' },
  submitted: { label: 'Submitted', pill: 'completed' },
};
