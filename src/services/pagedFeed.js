import { getDocsFromServer, limit, onSnapshot, orderBy, query, startAfter } from 'firebase/firestore';

export function createPagedFeed(collection, pageSize) {
  const ordered = query(collection, orderBy('createdAt', 'desc'));
  const page = (snapshot) => ({
    items: snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })),
    cursor: snapshot.docs.at(-1),
    hasMore: snapshot.docs.length === pageSize,
  });
  return {
    subscribe: (callback, onError) =>
      onSnapshot(query(ordered, limit(pageSize)), (snapshot) => callback(page(snapshot)), onError),
    loadOlder: async (cursor) => page(await getDocsFromServer(query(ordered, startAfter(cursor), limit(pageSize)))),
  };
}

export function mergeFeedItems(first, second) {
  const ids = new Set(first.map((item) => item.id));
  return [...first, ...second.filter((item) => !ids.has(item.id))];
}
