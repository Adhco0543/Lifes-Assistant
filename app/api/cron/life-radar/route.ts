import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '../../../../lib/cronAuth';
import { canRunRadarSweep } from '../../../../lib/cronRadarPolicy';
import { FirestoreRestClient, FirestoreRestError, type FirestoreDocument } from '../../../../lib/tools/firestoreRest';
import type { OpenLoop } from '../../../../lib/firebaseBackend';
import { syncWorkspaceRadar, type WorkspaceRadarStore } from '../../../../lib/workspaceRadar';
import { getFirestoreAccessToken } from '../../../../lib/serverServiceAccount';

export const runtime = 'nodejs';
export const maxDuration = 300;

type UserDocument = {
  name?: string;
};

async function listUserIds(projectId: string, accessToken: string): Promise<string[]> {
  const users: string[] = [];
  let pageToken = '';
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users`;

  do {
    const query = new URLSearchParams({
      pageSize: '1000',
      'mask.fieldPaths': 'profile.mode',
    });
    if (pageToken) query.set('pageToken', pageToken);
    const response = await fetch(`${baseUrl}?${query}`, {
      headers: { Authorization: 'Bear' + 'er ' + accessToken },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Could not list Life Radar accounts.');
    const result = await response.json() as { documents?: UserDocument[]; nextPageToken?: string };
    for (const document of result.documents || []) {
      if (typeof document.name !== 'string') continue;
      const userId = document.name.slice(document.name.lastIndexOf('/') + 1);
      if (userId && !userId.includes('/') && userId.length <= 128) users.push(userId);
    }
    pageToken = typeof result.nextPageToken === 'string' ? result.nextPageToken : '';
  } while (pageToken);

  return users;
}

function openLoopFromDocument(document: FirestoreDocument): OpenLoop {
  const data = document.data;
  return {
    id: document.id,
    title: String(data.title || 'Open loop'),
    summary: typeof data.summary === 'string' ? data.summary : undefined,
    status: data.status === 'waiting' || data.status === 'snoozed' || data.status === 'resolved' ? data.status : 'open',
    priority: data.priority === 'high' || data.priority === 'low' ? data.priority : 'medium',
    waitingOn: typeof data.waitingOn === 'string' ? data.waitingOn : undefined,
    nextAction: typeof data.nextAction === 'string' ? data.nextAction : undefined,
    dueAt: typeof data.dueAt === 'number' ? data.dueAt : null,
    source: typeof data.source === 'string' ? data.source : undefined,
    sourceId: typeof data.sourceId === 'string' ? data.sourceId : undefined,
    sourceExcerpt: typeof data.sourceExcerpt === 'string' ? data.sourceExcerpt : undefined,
    linkedView: typeof data.linkedView === 'string' ? data.linkedView : undefined,
    snoozedUntil: typeof data.snoozedUntil === 'number' ? data.snoozedUntil : null,
    userMarkedImportant: data.userMarkedImportant === true,
    archived: data.archived === true,
    createdAt: Number(data.createdAt || 0),
    updatedAt: Number(data.updatedAt || 0),
  };
}

function radarStore(store: FirestoreRestClient, userId: string): WorkspaceRadarStore {
  const userPath = `users/${encodeURIComponent(userId)}`;
  return {
    async getRecentBusinessRecords(maxCount) {
      const records = await store.query({
        parentPath: userPath,
        collectionId: 'records',
        orderBy: { field: 'updatedAt', direction: 'DESCENDING' },
        limit: maxCount,
      });
      return records.map((record) => ({ id: record.id, ...record.data }));
    },
    async getLatestDraft(kind) {
      const draft = await store.getDocument(`${userPath}/drafts/${encodeURIComponent(kind)}`);
      const data = draft?.data.data;
      return data && typeof data === 'object' && !Array.isArray(data)
        ? data as Record<string, unknown>
        : null;
    },
    async createOpenLoop(loop) {
      const now = Date.now();
      const stableId = 'workspace-' + createHash('sha256')
        .update(String(loop.source) + ':' + String(loop.sourceId))
        .digest('hex')
        .slice(0, 40);
      try {
        return await store.createDocument(`${userPath}/openLoops`, {
          ...loop,
          userId,
          createdAt: now,
          updatedAt: now,
        }, stableId);
      } catch (error) {
        if (error instanceof FirestoreRestError && error.status === 409) return stableId;
        throw error;
      }
    },
    async updateOpenLoop(id, patch) {
      const { id: _id, createdAt: _createdAt, ...fields } = patch;
      await store.patchDocument(`${userPath}/openLoops/${encodeURIComponent(id)}`, {
        ...fields,
        updatedAt: Date.now(),
      });
    },
    async resolveOpenLoop(id) {
      await store.patchDocument(`${userPath}/openLoops/${encodeURIComponent(id)}`, {
        status: 'resolved',
        snoozedUntil: null,
        updatedAt: Date.now(),
      });
    },
  };
}

async function sweepUser(projectId: string, accessToken: string, userId: string): Promise<boolean> {
  const store = new FirestoreRestClient({ projectId, idToken: accessToken });
  const userPath = `users/${encodeURIComponent(userId)}`;
  const [user, autonomy, preferences] = await Promise.all([
    store.getDocument(userPath),
    store.getDocument(`${userPath}/settings/autonomy`),
    store.getDocument(`${userPath}/drafts/assistant-preferences`),
  ]);
  if (!user || !autonomy) return false;

  const settings = autonomy.data;
  const profile = user.data.profile;
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false;
  const timeZoneValue = preferences?.data.data;
  const timeZone =
    timeZoneValue && typeof timeZoneValue === 'object' && !Array.isArray(timeZoneValue) &&
    typeof (timeZoneValue as Record<string, unknown>).timezone === 'string'
      ? String((timeZoneValue as Record<string, unknown>).timezone).slice(0, 100)
      : typeof (profile as Record<string, unknown>).timezone === 'string'
        ? String((profile as Record<string, unknown>).timezone).slice(0, 100)
        : 'UTC';
  if (!canRunRadarSweep(settings as Record<string, unknown>)) return false;

  const loops = await store.query({
    parentPath: userPath,
    collectionId: 'openLoops',
    orderBy: { field: 'updatedAt', direction: 'DESCENDING' },
    limit: 200,
  });
  await syncWorkspaceRadar(loops.map(openLoopFromDocument), radarStore(store, userId), timeZone);
  return true;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId || !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ error: 'Scheduled Life Radar is not configured.' }, { status: 503 });
  }

  try {
    const accessToken = await getFirestoreAccessToken();
    const userIds = await listUserIds(projectId, accessToken);
    let scanned = 0;
    let skipped = 0;
    let failed = 0;

    for (let index = 0; index < userIds.length; index += 20) {
      const results = await Promise.allSettled(
        userIds.slice(index, index + 20).map((userId) => sweepUser(projectId, accessToken, userId))
      );
      for (const result of results) {
        if (result.status === 'rejected') failed += 1;
        else if (result.value) scanned += 1;
        else skipped += 1;
      }
    }

    return NextResponse.json({ scanned, skipped, failed });
  } catch {
    console.warn('[life-radar-cron]', { event: 'sweep_failed' });
    return NextResponse.json({ error: 'Scheduled Life Radar could not complete.' }, { status: 503 });
  }
}
