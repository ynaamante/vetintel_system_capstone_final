const db = require('../config/db');
const bcrypt = require('bcryptjs');
const verification = require('../services/emailVerification');
const auth = require('../middleware/auth');
const normalizeEmail = email => String(email || '').trim().toLowerCase();

exports.register = async (req, res, next) => {
  const { name, email, password, phone, accepted_terms } = req.body;
  const address = normalizeEmail(email);
  if (!String(name || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || typeof password !== 'string' || password.length < 8 || password.length > 72)
    return res.status(400).json({ error: 'Enter your name, a valid email, and a password of 8–72 characters.' });
  if (accepted_terms !== true) return res.status(400).json({ error: 'Please agree to the Terms of Service and Privacy Policy.' });
  try {
    const existing = await db.query('SELECT id FROM users WHERE lower(trim(email))=$1 LIMIT 1', [address]);
    if (existing.rows.length) return res.status(409).json({ error: 'This email already has an account. Sign in to continue or verify your email.' });
    const clinicOwner = await db.query(`SELECT c.id FROM clients c JOIN clinics cl ON cl.id=c.clinic_id
      WHERE lower(trim(c.email))=$1 AND COALESCE(cl.archived,false)=false LIMIT 1`, [address]);
    if (!clinicOwner.rows.length) return res.status(422).json({ code: 'CLINIC_EMAIL_REQUIRED', error: 'Use the same email you gave your veterinary clinic. Ask your clinic to register or correct your owner email before creating your PetWatch account.' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = (await db.query(`INSERT INTO users(name,email,password_hash,phone,email_verification_required,terms_accepted_at,metadata)
      VALUES($1,$2,$3,$4,true,now(),'{}'::jsonb || '{"account_type":"pet_owner"}'::jsonb) RETURNING id,email`,
    [String(name).trim(), address, passwordHash, String(phone || '').trim() || null])).rows[0];
    const delivery = await verification.sendCode(user);
    return res.status(201).json({ email: user.email, verification_required: true, ...delivery,
      message: delivery.email_sent ? 'Verify this email to connect to your clinic pet records.' : 'Account pending verification. We could not send your code. Please request a new code.' });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'This email already has an account. Sign in to continue or verify your email.' });
    return next(error);
  }
};
exports.verify = async (req, res, next) => {
  try {
    const user = await verification.verify(normalizeEmail(req.body.email), req.body.code);
    const token = auth.signUserToken({ ...user, exp: Date.now() + 86400000 });
    return res.json({ ...user, token });
  } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message, retry_after: error.retryAfter }); return next(error); }
};
exports.resend = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    const user = (await db.query(`SELECT id,email FROM users WHERE lower(trim(email))=$1 AND email_verification_required=true AND email_verified_at IS NULL AND is_active IS NOT FALSE`, [email])).rows[0];
    if (!user) return res.json({ message: 'If your account needs verification, a code will be sent.', retry_after: 60 });
    const delivery = await verification.sendCode(user);
    return res.status(delivery.email_sent ? 200 : 503).json({ ...delivery,
      ...(delivery.email_sent ? { message: 'A new verification code has been sent.' } : { error: 'Email could not be sent. Please try again shortly.' }) });
  } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message, retry_after: error.retryAfter }); return next(error); }
};
const owner = (req, res) => {
  if (!req.user?.id || !['', 'user', 'pet_owner'].includes(req.user.role || '')) {
    res.status(403).json({ error: 'A pet-owner account is required.' }); return false;
  }
  return true;
};
exports.pets = async (req, res, next) => {
  if (!owner(req, res)) return;
  try { return res.json((await db.query(`SELECT p.id,p.name,p.species,p.breed,p.age,p.weight,p.color,p.photo_url,p.created_at FROM pet_owner_pets p
    WHERE p.owner_id=$1 AND NOT EXISTS(SELECT 1 FROM owner_pet_archives a WHERE a.owner_id=$1 AND a.source='account' AND a.pet_id=p.id)
    ORDER BY p.id DESC`, [req.user.id])).rows); }
  catch (error) { return next(error); }
};
exports.getPet = async (req, res, next) => {
  if (!owner(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid pet ID.' });
  try {
    const pet = (await db.query('SELECT id,name,species,breed,age,weight,color,photo_url,created_at FROM pet_owner_pets WHERE id=$1 AND owner_id=$2', [id, req.user.id])).rows[0];
    if (!pet) return res.status(404).json({ error: 'This pet was not found in your account.' });
    return res.json(pet);
  } catch (error) { return next(error); }
};
exports.updatePet = async (req, res, next) => {
  if (!owner(req, res)) return;
  const id = Number(req.params.id);
  const { name, breed, age, weight, color, species } = req.body;
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid pet ID.' });
  if (name != null && !String(name).trim()) return res.status(400).json({ error: 'Enter a pet name.' });
  if (species != null && !['dog','cat','bird','rabbit','hamster','other'].includes(species)) return res.status(400).json({ error: 'Choose a valid species.' });
  if (weight != null && weight !== '' && (!Number.isFinite(Number(weight)) || Number(weight) < 0 || Number(weight) > 999999)) return res.status(400).json({ error: 'Enter a valid weight.' });
  try {
    const pet = (await db.query(`UPDATE pet_owner_pets SET name=COALESCE($3,name),breed=COALESCE($4,breed),age=COALESCE($5,age),
      weight=CASE WHEN $6::text IS NULL THEN weight WHEN $6='' THEN NULL ELSE $6::numeric END,
      color=COALESCE($7,color),species=COALESCE($8,species) WHERE id=$1 AND owner_id=$2
      RETURNING id,name,species,breed,age,weight,color,photo_url,created_at`,
    [id, req.user.id, name == null ? null : String(name).trim(), breed == null ? null : String(breed).trim(),
      age == null ? null : String(age).trim(), weight == null ? null : String(weight), color == null ? null : String(color).trim(), species || null])).rows[0];
    if (!pet) return res.status(404).json({ error: 'This pet was not found in your account.' });
    return res.json(pet);
  } catch (error) { return next(error); }
};
exports.addPet = async (req, res, next) => {
  if (!owner(req, res)) return;
  const { name, species, breed, age, weight, color } = req.body;
  if (!String(name || '').trim() || !['dog','cat','bird','rabbit','hamster','other'].includes(species)) return res.status(400).json({ error: 'Enter a pet name and valid species.' });
  if (weight !== undefined && weight !== null && weight !== '' && (!Number.isFinite(Number(weight)) || Number(weight) < 0 || Number(weight) > 999999)) return res.status(400).json({ error: 'Enter a valid weight.' });
  try {
    const pet = (await db.query(`INSERT INTO pet_owner_pets(owner_id,name,species,breed,age,weight,color) VALUES($1,$2,$3,$4,$5,$6,$7)
      RETURNING id,name,species,breed,age,weight,color,photo_url,created_at`, [req.user.id, String(name).trim(), species, String(breed || '').trim(), String(age || '').trim(), weight === '' || weight == null ? null : Number(weight), String(color || '').trim()])).rows[0];
    return res.status(201).json(pet);
  } catch (error) { return next(error); }
};
