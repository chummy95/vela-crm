// Older name for the notification route, kept so pages already open in a browser keep working.
// New code calls /api/notify with { event, id }.
const notify = require('./notify');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ configured: Boolean(process.env.RESEND_API_KEY) });
  const body = req.body || {};
  if (!body.event) {
    if (body.contractId) req.body = { event: 'contract_signed', id: body.contractId };
    else if (body.reviewId) req.body = { event: 'review_activity', id: body.reviewId };
    else req.body = { event: 'questionnaire_submitted', id: body.responseId };
  }
  return notify(req, res);
};
