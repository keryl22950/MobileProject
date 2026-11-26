import { useEffect, useRef, useState } from 'react';
import { mergeFeedItems } from '../services/pagedFeed';

const empty = { items: [], hasMore: false, loading: false, error: null };

export function usePagedFeed(feed) {
  const [state, setState] = useState(empty);
  const visible = state.feed === feed ? state : empty;
  const session = useRef(null);
  useEffect(() => {
    if (!feed) return;
    const current = { cursor: null, browsingOlder: false, loading: false };
    session.current = current;
    const unsubscribe = feed.subscribe(
      (page) => {
        if (session.current !== current) return;
        if (!current.browsingOlder) current.cursor = page.cursor;
        setState((previous) => ({
          ...(previous.feed === feed ? previous : empty),
          feed,
          items:
            current.browsingOlder && previous.feed === feed ? mergeFeedItems(page.items, previous.items) : page.items,
          hasMore: current.browsingOlder ? previous.hasMore : page.hasMore,
        }));
      },
      () => {
        if (session.current === current)
          setState((previous) => ({
            ...(previous.feed === feed ? previous : empty),
            feed,
            error: 'Impossible de charger les nouveautés.',
          }));
      }
    );
    return () => {
      session.current = null;
      unsubscribe();
    };
  }, [feed]);

  async function loadOlder() {
    const current = session.current;
    if (!current?.cursor || current.loading || !visible.hasMore) return;
    current.loading = true;
    current.browsingOlder = true;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const page = await feed.loadOlder(current.cursor);
      if (session.current !== current) return;
      current.cursor = page.cursor;
      setState((previous) => ({
        feed,
        items: mergeFeedItems(previous.items, page.items),
        hasMore: page.hasMore,
        loading: false,
        error: null,
      }));
    } catch {
      if (session.current === current) {
        setState((previous) => ({ ...previous, loading: false, error: 'Impossible de charger la suite. Réessaie.' }));
      }
    } finally {
      current.loading = false;
    }
  }

  return { ...visible, loadOlder };
}
