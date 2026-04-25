const { getDB } = require('../config/database');
const revenue = (req,res,next)=>{
  try {
    const months = parseInt(req.query.months)||6;
    const invoices = getDB().prepare("SELECT amount, created_at FROM invoices WHERE user_id=? AND status='paid' ORDER BY created_at DESC LIMIT 200").all(req.user.id);
    const byService = getDB().prepare('SELECT service, COUNT(*) as count FROM projects WHERE user_id=? GROUP BY service').all(req.user.id);
    res.json({ invoices, byService, months });
  } catch(e){next(e);}
};
const pipeline = (req,res,next)=>{
  try {
    const db = getDB();
    const submissions = db.prepare('SELECT COUNT(*) as n FROM form_submissions WHERE user_id=?').get(req.user.id)?.n||0;
    const proposals = db.prepare('SELECT COUNT(*) as n FROM proposals WHERE user_id=?').get(req.user.id)?.n||0;
    const contracts = db.prepare("SELECT COUNT(*) as n FROM contracts WHERE user_id=? AND signed=1").get(req.user.id)?.n||0;
    const delivered = db.prepare("SELECT COUNT(*) as n FROM projects WHERE user_id=? AND status='delivered'").get(req.user.id)?.n||0;
    res.json({ enquiries: submissions, proposals_sent: proposals, contracts_signed: contracts, delivered });
  } catch(e){next(e);}
};
module.exports = { revenue, pipeline };
