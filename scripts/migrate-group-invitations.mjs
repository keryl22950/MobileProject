import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function planInvitations(groups, invitations) {
  const groupsByCode = new Map();
  const conflicts = [];
  const missing = [];
  for (const { groupId, code } of groups) {
    if (typeof code !== 'string' || !/^[A-Z2-9]{6}([A-Z2-9]{4})?$/.test(code)) {
      conflicts.push({ groupId, problem: 'code invalide' });
      continue;
    }
    const groupIds = groupsByCode.get(code) ?? [];
    groupIds.push(groupId);
    groupsByCode.set(code, groupIds);
  }
  for (const [code, groupIds] of groupsByCode) {
    const indexed = invitations.get(code);
    if (groupIds.length > 1 || (invitations.has(code) && indexed !== groupIds[0])) {
      conflicts.push({ groupIds, indexed, problem: 'code partagé ou index incohérent' });
    } else if (!invitations.has(code)) {
      missing.push({ code, groupId: groupIds[0] });
    }
  }
  return { conflicts, missing };
}

async function migration(projectId, apply) {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  if (emulator && (!/^127\.0\.0\.1:\d+$/.test(emulator) || !projectId.startsWith('demo-'))) {
    throw new Error('Pour utiliser un émulateur, indique une adresse locale et un projet demo-.');
  }
  const endpoint = emulator ? 'http://' + emulator : 'https://firestore.googleapis.com';
  const path = `projects/${projectId}/databases/(default)/documents`;
  const token = emulator
    ? 'owner'
    : execFileSync(
        process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud',
        ['auth', 'application-default', 'print-access-token'],
        { encoding: 'utf8', shell: process.platform === 'win32' }
      ).trim();
  async function rest(suffix, options) {
    const response = await fetch(`${endpoint}/v1/${path}${suffix}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`Firestore a refusé la requête (HTTP ${response.status}).`);
    return response.json();
  }
  async function list(collection, field) {
    const rows = [];
    let pageToken;
    do {
      const params = new URLSearchParams({ pageSize: '300', 'mask.fieldPaths': field });
      if (pageToken) params.set('pageToken', pageToken);
      const page = await rest(`/${collection}?${params}`);
      rows.push(...(page.documents ?? []));
      pageToken = page.nextPageToken;
    } while (pageToken);
    return rows;
  }
  const [groups, invitations] = await Promise.all([list('groups', 'inviteCode'), list('groupInvites', 'groupId')]);
  const id = (row) => row.name.split('/').at(-1);
  const { conflicts, missing } = planInvitations(
    groups.map((row) => ({ groupId: id(row), code: row.fields?.inviteCode?.stringValue })),
    new Map(invitations.map((row) => [id(row), row.fields?.groupId?.stringValue]))
  );
  console.log(
    `${projectId} · ${groups.length} groupes · ${missing.length} invitations à créer · ${conflicts.length} anomalies`
  );
  if (conflicts.length) {
    console.log(JSON.stringify(conflicts, null, 2));
    throw new Error('Corrige les anomalies avant de migrer. Aucune invitation n’a été modifiée.');
  }
  if (!apply) return;
  for (let start = 0; start < missing.length; start += 400) {
    const writes = missing.slice(start, start + 400).map(({ code, groupId }) => ({
      update: { name: `${path}/groupInvites/${code}`, fields: { groupId: { stringValue: groupId } } },
      currentDocument: { exists: false },
    }));
    await rest(':commit', { method: 'POST', body: JSON.stringify({ writes }) });
  }
  console.log(`${missing.length} invitations créées.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [projectId, option, ...rest] = process.argv.slice(2);
  if (!/^[a-z][a-z0-9-]+$/.test(projectId ?? '') || (option && option !== '--apply') || rest.length) {
    console.error('Usage : node scripts/migrate-group-invitations.mjs <project-id> [--apply]');
    process.exitCode = 1;
  } else {
    try {
      await migration(projectId, option === '--apply');
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
