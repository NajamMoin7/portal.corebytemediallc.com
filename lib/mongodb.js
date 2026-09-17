import { MongoClient } from 'mongodb';

/**
 * MongoDB connection.
 *
 * How MongoDB fits together, for anyone new to it:
 *   - A *cluster* is the server(s) MongoDB Atlas hosts for you.
 *   - A *database* is a namespace inside it (ours is `MONGODB_DB`).
 *   - A *collection* is like a table, and a *document* is like a row, except
 *     it is plain JSON — no schema to declare up front.
 *
 * `MONGODB_URI` is the connection string from Atlas. It looks like
 *   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
 * and carries the credentials, so it is server-only and never NEXT_PUBLIC_.
 *
 * Why the caching below: a `MongoClient` holds a pool of TCP connections and
 * is expensive to build. Next.js re-evaluates modules on every hot reload in
 * `next dev`, and serverless hosts (Netlify) reuse a warm process across
 * requests. Both would leak a fresh pool per request without this, so the
 * pending connection promise is kept on `globalThis` and reused.
 *
 * Server-only module — never import it from a client component.
 */

const globalCache = globalThis;

export function isDatabaseConfigured() {
  return Boolean(process.env.MONGODB_URI);
}

function databaseName() {
  return process.env.MONGODB_DB || 'corebyte-portal';
}

function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not configured. Add the Atlas connection string to the environment.');
  }

  if (!globalCache.__cbmMongoClient) {
    const client = new MongoClient(uri, {
      // Fail fast if the cluster is unreachable or the IP is not allow-listed,
      // rather than hanging a request for the driver's 30 s default.
      serverSelectionTimeoutMS: 8_000,
      maxPoolSize: 10,
    });
    globalCache.__cbmMongoClient = client.connect().catch((error) => {
      // A failed connect must not be cached, or every later request would
      // reuse the same rejected promise.
      globalCache.__cbmMongoClient = undefined;
      throw error;
    });
  }
  return globalCache.__cbmMongoClient;
}

/** The portal's database handle. Collections are picked off this. */
export async function getDb() {
  const client = await connect();
  return client.db(databaseName());
}

/** A named collection, e.g. `await getCollection('orders')`. */
export async function getCollection(name) {
  const db = await getDb();
  return db.collection(name);
}

/**
 * Round-trips a ping to the cluster. Used by the dashboard status panel so a
 * bad URI or missing IP allow-list entry is visible without placing an order.
 */
export async function checkDatabaseConnection() {
  if (!isDatabaseConfigured()) return { ok: false, reason: 'MONGODB_URI is not set' };
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return { ok: true, database: db.databaseName };
  } catch (error) {
    return { ok: false, reason: error?.message || 'Could not connect' };
  }
}
