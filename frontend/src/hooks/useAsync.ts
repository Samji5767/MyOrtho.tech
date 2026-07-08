"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type DependencyList,
} from "react";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface AsyncResult<T> extends AsyncState<T> {
  reload: () => void;
}

export interface AsyncCallbackState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface AsyncCallbackResult<TArgs extends unknown[], TResult>
  extends AsyncCallbackState<TResult> {
  execute: (...args: TArgs) => Promise<void>;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

// ─── useAsync ─────────────────────────────────────────────────────────────────
//
// Runs `asyncFn` on mount and whenever `deps` change. A generation counter
// prevents stale promise resolutions from overwriting newer state — the counter
// is incremented both in the effect cleanup (dep change / unmount) and at the
// start of each run, so a racing promise that resolves after a dep change or
// unmount is silently discarded.

export function useAsync<T>(
  asyncFn: () => Promise<T>,
  deps: DependencyList,
): AsyncResult<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  // Stable refs — mutations never trigger re-renders.
  const generationRef = useRef(0);
  const asyncFnRef = useRef(asyncFn);

  // Keep asyncFnRef current after every render so `run` always calls the
  // latest closure without being listed as a dependency itself.
  useEffect(() => {
    asyncFnRef.current = asyncFn;
  });

  // `run` is intentionally stable (empty dep array). It reads asyncFn via
  // ref and uses the generation counter to cancel stale resolutions.
  const run = useCallback((): void => {
    const generation = ++generationRef.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    asyncFnRef.current().then(
      (data: T) => {
        if (generation !== generationRef.current) return;
        setState({ data, loading: false, error: null });
      },
      (err: unknown) => {
        if (generation !== generationRef.current) return;
        setState((prev) => ({ ...prev, loading: false, error: toError(err) }));
      },
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    run();
    const ref = generationRef;
    return () => {
      // Invalidate any in-flight request when deps change or component unmounts.
      ref.current++;
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, reload: run };
}

// ─── useAsyncCallback ─────────────────────────────────────────────────────────
//
// One-shot variant for operations triggered by user interaction (form submit,
// button click, etc.). Does NOT auto-run. `execute` is a stable reference safe
// to pass as an event handler without wrapping in useCallback at the call site.

export function useAsyncCallback<TArgs extends unknown[], TResult>(
  asyncFn: (...args: TArgs) => Promise<TResult>,
): AsyncCallbackResult<TArgs, TResult> {
  const [state, setState] = useState<AsyncCallbackState<TResult>>({
    data: null,
    loading: false,
    error: null,
  });

  const mountedRef = useRef(true);
  const asyncFnRef = useRef(asyncFn);

  useEffect(() => {
    asyncFnRef.current = asyncFn;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async (...args: TArgs): Promise<void> => {
    setState({ data: null, loading: true, error: null });
    try {
      const result = await asyncFnRef.current(...args);
      if (mountedRef.current) {
        setState({ data: result, loading: false, error: null });
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setState((prev) => ({ ...prev, loading: false, error: toError(err) }));
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, execute };
}
