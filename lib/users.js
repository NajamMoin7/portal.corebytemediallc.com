import { ObjectId } from 'mongodb';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getCollection, isDatabaseConfigured } from './mongodb';
import { isValidEmail } from './utils';

/**
 * Portal users: the super admin and the agents they create.
 *
 * Document shape in the `users` collection:
 *   {
 *     _id:         ObjectId
 *     email:       'haziq@…'        // unique, lowercase — the login id
 *     name:        'Haziq'          // shown on orders and in the totals
 *     passwordHash:'scrypt$…'       // never a plain password
 *     role:        'superadmin' | 'agent'
 *     status:      'active' | 'inactive'
 *     archivedAt:  null | Date      // set instead of deleting (see below)
 *     createdAt / updatedAt: Date
 *     createdBy:   'admin@…' | null
 *     lastLoginAt: Date | null
 *   }
 *
 * Nothing here ever removes a document. "Delete" in the UI archives the user:
 * they can no longer sign in and drop out of the active list, but the record
 * and every order they took stay in the database.
 *
 * Server-only module.
 */

const COLLECTION = 'users';

export const ROLES = ['superadmin', 'agent'];
export const STATUSES = ['active', 'inactive'];

/** Long enough to be worth typing, short enough that staff will. */
export const MIN_PASSWORD_LENGTH = 8;

const scrypt = promisify(scryptCallback);

let indexesReady;

async function usersCollection() {
  const users = await getCollection(COLLECTION);
  if (!indexesReady) {
    indexesReady = Promise.all([
      users.createIndex({ email: 1 }, { unique: true }),
      users.createIndex({ role: 1, status: 1 }),
    ]).catch((error) => {
      indexesReady = undefined;
      throw error;
    });
  }
  await indexesReady;
  return users;
}

/* -------------------------------------------------------------------------- */
/* Passwords                                                                   */
/* -------------------------------------------------------------------------- */

const SCRYPT_KEYLEN = 64;

/**
 * Hashes a password with scrypt and a per-user random salt, stored as
 * `scrypt$<salt hex>$<hash hex>`. scrypt is deliberately slow and memory-hard,
 * so a stolen database is not a list of usable passwords.
 */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(String(password), salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** Constant-time check of a password against a stored hash. */
export async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  let derived;
  try {
    derived = await scrypt(String(password), Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN);
  } catch {
    return false;
  }
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                     */
/* -------------------------------------------------------------------------- */

/** Strips the password hash and makes the document safe to send to the client. */
function toUser(document) {
  if (!document) return null;
  return {
    id: String(document._id),
    email: document.email,
    name: document.name,
    role: document.role,
    status: document.status,
    archived: Boolean(document.archivedAt),
    archivedAt: document.archivedAt ? document.archivedAt.toISOString() : null,
    createdAt: document.createdAt ? document.createdAt.toISOString() : null,
    updatedAt: document.updatedAt ? document.updatedAt.toISOString() : null,
    createdBy: document.createdBy ?? null,
    lastLoginAt: document.lastLoginAt ? document.lastLoginAt.toISOString() : null,
  };
}

const normaliseEmail = (value) => String(value ?? '').trim().toLowerCase().slice(0, 120);
const normaliseName = (value) => String(value ?? '').trim().slice(0, 60);

function toObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function findUserById(id) {
  const _id = toObjectId(id);
  if (!_id) return null;
  const users = await usersCollection();
  return toUser(await users.findOne({ _id }));
}

/** Everyone, newest first, archived users last. Super admin view. */
export async function listUsers({ includeArchived = true } = {}) {
  const users = await usersCollection();
  const filter = includeArchived ? {} : { archivedAt: null };
  const documents = await users.find(filter).sort({ archivedAt: 1, createdAt: 1 }).toArray();
  return documents.map(toUser);
}

/** Active, non-archived agents and admins — the people who can take orders. */
export async function listActiveUsers() {
  const users = await usersCollection();
  const documents = await users.find({ status: 'active', archivedAt: null }).sort({ name: 1 }).toArray();
  return documents.map(toUser);
}

/* -------------------------------------------------------------------------- */
/* Writing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Validates the fields of a create/update. Returns `{ valid, errors }` keyed
 * by field name, the same shape the order form uses.
 */
export function validateUserInput({ name, email, password, role, status }, { requirePassword = true } = {}) {
  const errors = {};

  if (!normaliseName(name)) errors.name = 'Name is required.';
  if (!normaliseEmail(email)) errors.email = 'Email is required.';
  else if (!isValidEmail(normaliseEmail(email))) errors.email = 'Enter a valid email address.';

  if (requirePassword || password) {
    if (String(password ?? '').length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
  }

  if (role !== undefined && !ROLES.includes(role)) errors.role = 'Unknown role.';
  if (status !== undefined && !STATUSES.includes(status)) errors.status = 'Unknown status.';

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Thrown when an email is already taken, so callers can return a 409. */
export class EmailTakenError extends Error {
  constructor(email) {
    super(`${email} is already in use.`);
    this.name = 'EmailTakenError';
    this.code = 'EMAIL_TAKEN';
  }
}

export async function createUser({ name, email, password, role = 'agent', status = 'active', createdBy = null }) {
  const users = await usersCollection();
  const now = new Date();
  const document = {
    email: normaliseEmail(email),
    name: normaliseName(name),
    passwordHash: await hashPassword(password),
    role: ROLES.includes(role) ? role : 'agent',
    status: STATUSES.includes(status) ? status : 'active',
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy,
    lastLoginAt: null,
  };

  try {
    const { insertedId } = await users.insertOne(document);
    return toUser({ ...document, _id: insertedId });
  } catch (error) {
    if (error?.code === 11000) throw new EmailTakenError(document.email);
    throw error;
  }
}

/**
 * Updates the fields that were supplied. Passing `password` re-hashes it;
 * omitting it leaves the existing password alone.
 */
export async function updateUser(id, { name, email, password, role, status }) {
  const _id = toObjectId(id);
  if (!_id) return null;

  const users = await usersCollection();
  const patch = { updatedAt: new Date() };

  if (name !== undefined) patch.name = normaliseName(name);
  if (email !== undefined) patch.email = normaliseEmail(email);
  if (role !== undefined && ROLES.includes(role)) patch.role = role;
  if (status !== undefined && STATUSES.includes(status)) patch.status = status;
  if (password) patch.passwordHash = await hashPassword(password);

  try {
    const document = await users.findOneAndUpdate({ _id }, { $set: patch }, { returnDocument: 'after' });
    return toUser(document);
  } catch (error) {
    if (error?.code === 11000) throw new EmailTakenError(patch.email);
    throw error;
  }
}

/**
 * Archives a user instead of deleting them: nothing leaves the database, the
 * account simply stops working and drops out of the active lists. Their orders
 * keep their name and remain in the history and the totals.
 *
 * Archiving also sets `status: 'inactive'` so a single check (`canSignIn`)
 * covers both cases.
 */
export async function archiveUser(id) {
  const _id = toObjectId(id);
  if (!_id) return null;
  const users = await usersCollection();
  const document = await users.findOneAndUpdate(
    { _id },
    { $set: { archivedAt: new Date(), status: 'inactive', updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  return toUser(document);
}

/** Undoes an archive. The account is restored inactive, so it is re-enabled deliberately. */
export async function restoreUser(id) {
  const _id = toObjectId(id);
  if (!_id) return null;
  const users = await usersCollection();
  const document = await users.findOneAndUpdate(
    { _id },
    { $set: { archivedAt: null, status: 'inactive', updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  return toUser(document);
}

export async function countSuperAdmins({ excludeId = null } = {}) {
  const users = await usersCollection();
  const filter = { role: 'superadmin', status: 'active', archivedAt: null };
  const excluded = excludeId ? toObjectId(excludeId) : null;
  if (excluded) filter._id = { $ne: excluded };
  return users.countDocuments(filter);
}

/* -------------------------------------------------------------------------- */
/* Sign-in                                                                     */
/* -------------------------------------------------------------------------- */

/** Only active, non-archived accounts may hold a session. */
export function canSignIn(user) {
  return Boolean(user) && user.status === 'active' && !user.archived;
}

/**
 * Checks an email and password against the database.
 *
 * Returns `{ user }` on success, or `{ reason }` — 'credentials' when the
 * pair is wrong and 'disabled' when the account exists but is switched off or
 * archived, so the UI can say something useful without leaking which emails
 * are registered to an attacker (the route decides what to show).
 */
export async function authenticate(email, password) {
  const users = await usersCollection();
  const document = await users.findOne({ email: normaliseEmail(email) });

  if (!document) {
    // Spend roughly the same time as a real check so the response time does
    // not reveal whether the email exists.
    await verifyPassword(password, `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`);
    return { reason: 'credentials' };
  }

  if (!(await verifyPassword(password, document.passwordHash))) {
    return { reason: 'credentials' };
  }

  const user = toUser(document);
  if (!canSignIn(user)) return { reason: 'disabled' };

  await users.updateOne({ _id: document._id }, { $set: { lastLoginAt: new Date() } });
  return { user };
}

/* -------------------------------------------------------------------------- */
/* Bootstrap                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Creates the first super admin from `PORTAL_EMAIL` / `PORTAL_PASSWORD` if no
 * super admin exists yet, so a fresh deployment has someone who can sign in
 * and add the agents.
 *
 * It only ever *creates*: once a super admin is in the database, changing the
 * environment variables does nothing, and passwords changed in the portal are
 * never overwritten on the next deploy.
 */
export async function ensureSuperAdmin() {
  if (!isDatabaseConfigured()) return { ok: false, reason: 'MONGODB_URI is not set.' };

  const email = normaliseEmail(process.env.PORTAL_EMAIL);
  const password = process.env.PORTAL_PASSWORD || '';
  if (!email || !password) {
    return { ok: false, reason: 'PORTAL_EMAIL and PORTAL_PASSWORD are not set.' };
  }

  const users = await usersCollection();
  if ((await users.countDocuments({ role: 'superadmin' })) > 0) {
    return { ok: true, created: false };
  }

  // An agent may already own that email from an earlier setup — promote them
  // rather than failing on the unique index.
  const existing = await users.findOne({ email });
  if (existing) {
    await users.updateOne(
      { _id: existing._id },
      { $set: { role: 'superadmin', status: 'active', archivedAt: null, updatedAt: new Date() } },
    );
    return { ok: true, created: false, promoted: true };
  }

  await createUser({ name: 'Super Admin', email, password, role: 'superadmin', createdBy: 'bootstrap' });
  return { ok: true, created: true };
}
