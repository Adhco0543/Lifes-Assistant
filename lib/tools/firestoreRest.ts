// Minimal Firestore REST client for server routes.
//
// The server has no Firebase Admin credentials. Instead it forwards the signed-in
// user's own ID token, so every read and write is subject to the same
// firestore.rules that protect the client app. Nothing here can touch another
// user's data.

export type FirestoreValue =
  | string
  | number
  | boolean
  | null
  | FirestoreValue[]
  | { [key: string]: FirestoreValue };

type RestValue = Record<string, unknown>;

export interface FirestoreClientOptions {
  projectId: string;
  idToken: string;
  fetchImpl?: typeof fetch;
}

export interface FirestoreDocument {
  id: string;
  path: string;
  data: Record<string, FirestoreValue>;
}

const MAX_STRING_LENGTH = 20_000;

export function encodeValue(value: unknown): RestValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value.slice(0, MAX_STRING_LENGTH) };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { nullValue: null };
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.slice(0, 200).map(encodeValue) } };
  }
  if (typeof value === 'object') {
    const fields: Record<string, RestValue> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) continue;
      fields[key] = encodeValue(item);
    }
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

export function decodeValue(value: unknown): FirestoreValue {
  if (!value || typeof value !== 'object') return null;
  const record = value as RestValue;
  if ('stringValue' in record) return String(record.stringValue);
  if ('booleanValue' in record) return Boolean(record.booleanValue);
  if ('integerValue' in record) return Number(record.integerValue);
  if ('doubleValue' in record) return Number(record.doubleValue);
  if ('timestampValue' in record) return Date.parse(String(record.timestampValue));
  if ('nullValue' in record) return null;
  if ('arrayValue' in record) {
    const values = (record.arrayValue as { values?: unknown[] })?.values;
    return Array.isArray(values) ? values.map(decodeValue) : [];
  }
  if ('mapValue' in record) {
    return decodeFields((record.mapValue as { fields?: Record<string, unknown> })?.fields);
  }
  return null;
}

export function decodeFields(fields: Record<string, unknown> | undefined): Record<string, FirestoreValue> {
  const result: Record<string, FirestoreValue> = {};
  if (!fields) return result;
  for (const [key, value] of Object.entries(fields)) {
    result[key] = decodeValue(value);
  }
  return result;
}

export function encodeFields(data: Record<string, unknown>): Record<string, RestValue> {
  const fields: Record<string, RestValue> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    fields[key] = encodeValue(value);
  }
  return fields;
}

function documentIdFromName(name: string): string {
  return name.slice(name.lastIndexOf('/') + 1);
}

export class FirestoreRestClient {
  private readonly base: string;
  private readonly root: string;
  private readonly idToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: FirestoreClientOptions) {
    this.base = 'https://firestore.googleapis.com/v1';
    this.root = 'projects/' + options.projectId + '/databases/(default)/documents';
    this.idToken = options.idToken;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  private async request(method: string, url: string, body?: unknown): Promise<unknown> {
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        Authorization: 'Bearer ' + this.idToken,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    if (response.status === 404 && method === 'GET') return null;
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error('Firestore ' + method + ' failed (' + response.status + '): ' + detail.slice(0, 300));
    }
    return response.json();
  }

  async getDocument(path: string): Promise<FirestoreDocument | null> {
    const raw = (await this.request('GET', this.base + '/' + this.root + '/' + path)) as RestValue | null;
    if (!raw || typeof raw.name !== 'string') return null;
    return {
      id: documentIdFromName(raw.name),
      path,
      data: decodeFields(raw.fields as Record<string, unknown> | undefined),
    };
  }

  async createDocument(collectionPath: string, data: Record<string, unknown>): Promise<string> {
    const raw = (await this.request(
      'POST',
      this.base + '/' + this.root + '/' + collectionPath,
      { fields: encodeFields(data) }
    )) as RestValue;
    if (!raw || typeof raw.name !== 'string') throw new Error('Firestore create returned no document name.');
    return documentIdFromName(raw.name);
  }

  /** Merge-style update: only the supplied keys are written. */
  async patchDocument(path: string, data: Record<string, unknown>): Promise<void> {
    const keys = Object.keys(data).filter((key) => data[key] !== undefined);
    const mask = keys.map((key) => 'updateMask.fieldPaths=' + encodeURIComponent(key)).join('&');
    await this.request(
      'PATCH',
      this.base + '/' + this.root + '/' + path + '?' + mask,
      { fields: encodeFields(data) }
    );
  }

  /**
   * Simple structured query over one collection under a parent document.
   * Filters are ANDed. Supports equality and range operators on top-level fields.
   */
  async query(options: {
    parentPath: string;
    collectionId: string;
    filters?: Array<{ field: string; op: 'EQUAL' | 'GREATER_THAN_OR_EQUAL' | 'LESS_THAN'; value: unknown }>;
    orderBy?: { field: string; direction: 'ASCENDING' | 'DESCENDING' };
    limit?: number;
  }): Promise<FirestoreDocument[]> {
    const filters = (options.filters || []).map((filter) => ({
      fieldFilter: {
        field: { fieldPath: filter.field },
        op: filter.op,
        value: encodeValue(filter.value),
      },
    }));
    const structuredQuery: Record<string, unknown> = {
      from: [{ collectionId: options.collectionId }],
      limit: Math.max(1, Math.min(200, options.limit || 50)),
    };
    if (filters.length === 1) structuredQuery.where = filters[0];
    if (filters.length > 1) structuredQuery.where = { compositeFilter: { op: 'AND', filters } };
    if (options.orderBy) {
      structuredQuery.orderBy = [{ field: { fieldPath: options.orderBy.field }, direction: options.orderBy.direction }];
    }
    const raw = (await this.request(
      'POST',
      this.base + '/' + this.root + '/' + options.parentPath + ':runQuery',
      { structuredQuery }
    )) as Array<{ document?: RestValue }> | null;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => item.document)
      .filter((document): document is RestValue => Boolean(document && typeof document.name === 'string'))
      .map((document) => ({
        id: documentIdFromName(String(document.name)),
        path: String(document.name).slice(String(document.name).indexOf('/documents/') + '/documents/'.length),
        data: decodeFields(document.fields as Record<string, unknown> | undefined),
      }));
  }
}
