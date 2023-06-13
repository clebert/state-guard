export type StateMachine<
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

  readonly assert: <TExpectedState extends keyof TTransformerMap>(
    expectedState: TExpectedState,
  ) => Snapshot<TTransformerMap, TTransitionsMap, TExpectedState>;

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

  readonly actions: {
    readonly [TActionName in keyof TTransitionsMap[TState]]: (
      ...args: Parameters<TTransformerMap[TTransitionsMap[TState][TActionName]]>
    ) => Snapshot<
      TTransformerMap,
      TTransitionsMap,
      TTransitionsMap[TState][TActionName]
    >;
  };
}

export type InferSnapshot<TStateMachine, TState> =
  TStateMachine extends StateMachine<
    infer TTransformerMap,
    infer TTransitionsMap
  >
    ? TState extends keyof TTransformerMap
      ? Snapshot<TTransformerMap, TTransitionsMap, TState>
      : never
    : never;

export type InferState<TStateMachine> = TStateMachine extends StateMachine<
  infer TTransformerMap,
  any
>
  ? keyof TTransformerMap
  : never;

export interface StateMachineInit<
  TTransformerMap extends TransformerMap,
  TTransitionsMap extends TransitionsMap<TTransformerMap>,
  TInitialState extends keyof TTransformerMap,
> {
  readonly initialState: TInitialState;
  readonly initialValue: ReturnType<TTransformerMap[TInitialState]>;
  readonly transformerMap: TTransformerMap;
  readonly transitionsMap: TTransitionsMap;
}

export function createStateMachine<
  const TTransformerMap extends TransformerMap,
  const TTransitionsMap extends TransitionsMap<TTransformerMap>,
  const TInitialState extends keyof TTransformerMap,
>({
  initialState,
  initialValue,
  transformerMap,
  transitionsMap,
}: StateMachineInit<
  TTransformerMap,
  TTransitionsMap,
  TInitialState
>): StateMachine<TTransformerMap, TTransitionsMap> {
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

  function createSnapshot(): Snapshot<
    TTransformerMap,
    TTransitionsMap,
    keyof TTransformerMap
  > {
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
    get: (expectedState) => {
      return expectedState === undefined || expectedState === currentState
        ? (currentSnapshot as any)
        : undefined;
    },
    assert: (expectedState) => {
      if (expectedState !== currentState) {
        throw new Error(`Unexpected state.`);
      }

      return currentSnapshot as any;
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
