import { NextResponse } from 'next/server';
import { getFirebaseRequestUser } from '../../../../../lib/serverAuth';
import { getGitHubAccessToken } from '../../../../../lib/githubAccess';

export async function POST(request: Request) {
  const user = await getFirebaseRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const sealedBundle = String(body?.sealedBundle || '');
    const token = await getGitHubAccessToken(sealedBundle);

    if (String(token.bundle.uid || '') !== user.uid) {
      return NextResponse.json({ error: 'Connection owner mismatch.' }, { status: 403 });
    }

    const response = await fetch(
      'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member',
      {
        headers: {
          Authorization: 'Bearer ' + token.accessToken,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2026-03-10',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Could not read repositories from GitHub.' },
        { status: response.status }
      );
    }

    const repositories = (await response.json())
      .map((repo: any) => ({
        id: repo.id,
        fullName: repo.full_name,
        private: Boolean(repo.private),
        archived: Boolean(repo.archived),
        defaultBranch: repo.default_branch || '',
        updatedAt: repo.updated_at || '',
        htmlUrl: repo.html_url || '',
      }))
      .slice(0, 100);

    return NextResponse.json({
      ok: true,
      repositories,
      sealedBundle: token.sealedBundle,
      refreshed: token.refreshed,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'GitHub repository lookup failed.',
      },
      { status: 400 }
    );
  }
}
