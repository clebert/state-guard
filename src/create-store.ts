export type Store<
  TTransformerMap extends TransformerMap,
  TTransitionsMap extends TransitionsMap<TTransformerMap>,
> = {
  readonly get: <
    TExpectedState extends keyof TTransformerMap | undefined = undefined,
  >(
    expectedState?: TExpectedState,
  ) => TExpectedState extends keyof TTransformerMap
    ? Snapshot<TTransformerMap, TTransitionsMap, TExpectedState> | undefined
    : {
        [TState in keyof TTransformerMap]: Snapshot<
          TTransformerMap,
          TTransitionsMap,
          TState
        >;
      }[keyof TTransformerMap];

  readonly subscribe: (
    listener: () => void,
    options?: {readonly signal?: AbortSignal},
  ) => () => void;
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
  readonly actions: InferActions<TTransformerMap, TTransitionsMap, TState>;
}

export type InferActions<
  TTransformerMap extends TransformerMap,
  TTransitionsMap extends TransitionsMap<TTransformerMap>,
  TState extends keyof TTransformerMap,
> = {
  readonly [TActionName in keyof TTransitionsMap[TState]]: (
    ...args: Parameters<TTransformerMap[TTransitionsMap[TState][TActionName]]>
  ) => Snapshot<
    TTransformerMap,
    TTransitionsMap,
    TTransitionsMap[TState][TActionName]
  >;
};

export type InferSnapshot<TStore, TState> = TStore extends Store<
  infer TTransformerMap,
  infer TTransitionsMap
>
  ? TState extends keyof TTransformerMap
    ? Snapshot<TTransformerMap, TTransitionsMap, TState>
    : never
  : never;

export interface StoreInit<
  TTransformerMap extends TransformerMap,
  TTransitionsMap extends TransitionsMap<TTransformerMap>,
  TInitialState extends keyof TTransformerMap,
> {
  readonly initialState: TInitialState;
  readonly initialValue: ReturnType<TTransformerMap[TInitialState]>;
  readonly transformerMap: TTransformerMap;
  readonly transitionsMap: TTransitionsMap;
}

export function createStore<
  const TTransformerMap extends TransformerMap,
  const TTransitionsMap extends TransitionsMap<TTransformerMap>,
  const TInitialState extends keyof TTransformerMap,
>({
  initialState,
  initialValue,
  transformerMap,
  transitionsMap,
}: StoreInit<TTransformerMap, TTransitionsMap, TInitialState>): Store<
  TTransformerMap,
  TTransitionsMap
> {
  const listeners = new Set<() => void>();

  let notifying = false;

  function notify(): void {
    notifying = true;

    try {
      for (const listener of listeners) {
        listener();
      }
    } finally {
      notifying = false;
    }
  }

  let actualState: keyof TTransformerMap = initialState;
  let actualValue = initialValue;
  let actualVersion = Symbol();
  let actualSnapshot = createSnapshot();

  function createSnapshot(): Snapshot<
    TTransformerMap,
    TTransitionsMap,
    keyof TTransformerMap
  > {
    const version = actualVersion;

    function assertVersion(): void {
      if (version !== actualVersion) {
        throw new Error(`Stale snapshot.`);
      }
    }

    const actions = new Proxy(
      {},
      {
        get(_, actionName) {
          assertVersion();

          const newState =
            typeof actionName === `string`
              ? transitionsMap[actualState]![actionName]
              : undefined;

          if (newState === undefined) {
            throw new Error(`Unknown action.`);
          }

          return (...args: any[]) => {
            if (notifying) {
              throw new Error(`Illegal state change.`);
            }

            assertVersion();

            const previousState = actualState;
            const previousValue = actualValue;
            const previousVersion = actualVersion;
            const previousSnapshot = actualSnapshot;

            actualState = newState;
            actualValue = transformerMap[newState]!(...args);
            actualVersion = Symbol();
            actualSnapshot = createSnapshot();

            try {
              notify();
            } catch (error) {
              actualState = previousState;
              actualValue = previousValue;
              actualVersion = previousVersion;
              actualSnapshot = previousSnapshot;

              throw error;
            }

            return actualSnapshot;
          };
        },
      },
    ) as any;

    return {
      get state() {
        assertVersion();

        return actualState;
      },
      get value() {
        assertVersion();

        return actualValue;
      },
      get actions() {
        assertVersion();

        return actions;
      },
    };
  }

  return {
    get: (expectedState) => {
      return expectedState === undefined || expectedState === actualState
        ? (actualSnapshot as any)
        : undefined;
    },
    subscribe(listener, {signal} = {}) {
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
