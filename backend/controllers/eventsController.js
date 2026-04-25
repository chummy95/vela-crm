const { getDB } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const list = (req,res,next)=>{ try{ res.json(getDB().prepare('SELECT e.*,c.name as client_name FROM events e LEFT JOIN clients c ON e.client_id=c.id WHERE e.user_id=? ORDER BY e.date').all(req.user.id)); }catch(e){next(e);} };
const create = (req,res,next)=>{ try{ const {client_id,title,event_type,date,time,duration,meeting_link,color}=req.body; const id=uuidv4(); getDB().prepare('INSERT INTO events (id,user_id,client_id,title,event_type,date,time,duration,meeting_link,color) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,req.user.id,client_id,title,event_type,date,time,duration,meeting_link,color||'#3B82F6'); res.status(201).json(getDB().prepare('SELECT * FROM events WHERE id=?').get(id)); }catch(e){next(e);} };
const remove = (req,res,next)=>{ try{ getDB().prepare('DELETE FROM events WHERE id=? AND user_id=?').run(req.params.id,req.user.id); res.json({success:true}); }catch(e){next(e);} };
module.exports = { list, create, remove };
