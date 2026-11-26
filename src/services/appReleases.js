import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// Les versions correspondent à runtimeVersion.policy = appVersion.
export function newerNativeRelease(release, installedVersion) {
  const parse = (value) =>
    typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value) ? value.split('.').map(Number) : null;
  const current = parse(installedVersion);
  const next = parse(release?.version);
  if (!current || !next || !next.every(Number.isSafeInteger) || !current.every(Number.isSafeInteger)) return null;
  const different = next.findIndex((part, index) => part !== current[index]);
  if (different < 0 || next[different] < current[different]) return null;
  try {
    const url = new URL(release.installUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
  } catch {
    return null;
  }
  return { version: release.version, installUrl: release.installUrl };
}

export function subscribeToAppRelease(channel, platform, callback) {
  if (!['preview', 'production'].includes(channel) || !['android', 'ios'].includes(platform)) return () => {};
  return onSnapshot(
    doc(db, 'appReleases', `${channel}_${platform}`),
    (snapshot) => callback(snapshot.exists() ? snapshot.data() : null),
    () => callback(null)
  );
}
