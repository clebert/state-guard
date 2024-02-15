/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */

export type Machine<
  TTransformerMap extends TransformerMap,
  TTransitionsMap extends TransitionsMap<TTransformerMap>,
> = {
  get(): {
    [TState in keyof TTransformerMap]: Snapshot<TTransformerMap, TTransitionsMap, TState>;
  }[keyof TTransformerMap];

  get<TExpectedState extends keyof TTransformerMap>(
    expectedState: TExpectedState,
  ): Snapshot<TTransformerMap, TTransitionsMap, TExpectedState> | undefined;

  assert<TExpectedState extends keyof TTransformerMap>(
    expectedState: TExpectedState,
  ): Snapshot<TTransformerMap, TTransitionsMap, TExpectedState>;

  subscribe(listener: () => void, options?: { readonly signal?: AbortSignal }): () => void;
};

export type TransformerMap = Readonly<Record<string, (...args: any[]) => any>>;

export type TransitionsMap<TTransformerMap extends TransformerMap> = Readonly<
  Record<keyof TTransformerMap, Readonly<Record<string, keyof TTransformerMap>>>
>;

export interface Snapshot<
  TTransformerMap extends TransformerMap,
  TTransitionsMap extends TransitionsMap<TTransformerMap>,
  TState extends keyof TTransformerMap,
> {
  readonly state: TState;
  readonly value: ReturnType<TTransformerMap[TState]>;

  readonly actions: {
    readonly [TActionName in keyof TTransitionsMap[TState]]: (
      ...args: Parameters<TTransformerMap[TTransitionsMap[TState][TActionName]]>
    ) => Snapshot<TTransformerMap, TTransitionsMap, TTransitionsMap[TState][TActionName]>;
  };
}

export type InferSnapshot<TMachine, TStateUnion = InferStateUnion<TMachine>> =
  TMachine extends Machine<infer TTransformerMap, infer TTransitionsMap>
    ? TStateUnion extends keyof TTransformerMap
      ? { [TState in TStateUnion]: Snapshot<TTransformerMap, TTransitionsMap, TState> }[TStateUnion]
      : never
    : never;

export type InferStateUnion<TMachine> =
  TMachine extends Machine<infer TTransformerMap, any> ? keyof TTransformerMap : never;

export interface MachineInit<
  TTransformerMap extends TransformerMap,
  TTransitionsMap extends TransitionsMap<TTransformerMap>,
  TInitialState extends keyof TTransformerMap,
> {
  readonly initialState: TInitialState;
  readonly initialValue: ReturnType<TTransformerMap[TInitialState]>;
  readonly transformerMap: TTransformerMap;
  readonly transitionsMap: TTransitionsMap;
}

export function createMachine<
  const TTransformerMap extends TransformerMap,
  const TTransitionsMap extends TransitionsMap<TTransformerMap>,
  const TInitialState extends keyof TTransformerMap,
>({
  initialState,
  initialValue,
  transformerMap,
  transitionsMap,
}: MachineInit<TTransformerMap, TTransitionsMap, TInitialState>): Machine<
  TTransformerMap,
  TTransitionsMap
> {
  const listeners = new Set<() => void>();

  let notifying = false;

  function notify(): void {
    notifying = true;

    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        console.error(error);
      }
    }

    notifying = false;
  }

  let currentState: keyof TTransformerMap = initialState;
  let currentValue = initialValue;
  let currentVersion = Symbol();
  let currentSnapshot = createSnapshot();

  function createSnapshot(): Snapshot<TTransformerMap, TTransitionsMap, keyof TTransformerMap> {
    const version = currentVersion;

    function assertVersion(): void {
      if (version !== currentVersion) {
        throw new Error(`Stale snapshot.`);
      }
    }

    const actions = new Proxy(
      {},
      {
        get(_, actionName) {
          assertVersion();

          const newState = transitionsMap[currentState][actionName as string]!;

          return (...args: any[]) => {
            if (notifying) {
              throw new Error(`Illegal transition.`);
            }

            assertVersion();

            const newValue = transformerMap[newState]!(...args);

            currentState = newState;
            currentValue = newValue;
            currentVersion = Symbol();
            currentSnapshot = createSnapshot();

            notify();

            return currentSnapshot;
          };
        },
      },
    ) as any;

    return {
      get state() {
        assertVersion();

        return currentState;
      },
      get value() {
        assertVersion();

        return currentValue;
      },
      get actions() {
        assertVersion();

        return actions;
      },
    };
  }

  return {
    get: ((expectedState: unknown) => {
      return expectedState === undefined || expectedState === currentState
        ? (currentSnapshot as any)
        : undefined;
    }) as any,
    assert: (expectedState) => {
      if (expectedState !== currentState) {
        throw new Error(`Unexpected state.`);
      }

      return currentSnapshot as any;
    },
    subscribe(listener, { signal } = {}) {
      listeners.add(listener);

      const unsubscribe = () => {
        listeners.delete(listener);
        signal?.removeEventListener(`abort`, unsubscribe);
      };

      signal?.addEventListener(`abort`, unsubscribe);

      return unsubscribe;
    },
  };
}
