const { getDB, initDB } = require('./database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

initDB();
const db = getDB();

const userId = uuidv4();
const hash = bcrypt.hashSync('password123', 10);

db.prepare(`INSERT OR IGNORE INTO users (id,email,password,name,studio_name,studio_tagline,website,instagram,location)
  VALUES (?,?,?,?,?,?,?,?,?)`).run(userId,'hello@creativemayaa.com',hash,'Mayaa','Creative Mayaa Studio','Strategic branding and design for businesses done being overlooked.','creativemayaa.com','@creative.mayaa','London / Riyadh');

const clients = [
  {id:uuidv4(),name:'Maison Noir',contact:'Sophie Leblanc',email:'hello@maison.com',location:'Paris',industry:'Beauty',color:'#1B2B4B'},
  {id:uuidv4(),name:'Blanc Atelier',contact:'Ines Martin',email:'ines@blanc.co',location:'London',industry:'Fashion',color:'#3D1A00'},
  {id:uuidv4(),name:'Lumiere Beauty',contact:'Camille Dupont',email:'cd@lumiere.fr',location:'Paris',industry:'Beauty',color:'#1A3A2A'},
];
clients.forEach(c => {
  db.prepare(`INSERT OR IGNORE INTO clients (id,user_id,name,contact,email,location,industry,color) VALUES (?,?,?,?,?,?,?,?)`).run(c.id,userId,c.name,c.contact,c.email,c.location,c.industry,c.color);
});

console.log('Seed complete. Login: hello@creativemayaa.com / password123');
