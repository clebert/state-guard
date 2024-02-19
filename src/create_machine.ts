export type Machine<
  TTransformerMap extends TransformerMap,
  TTransitionsMap extends TransitionsMap<TTransformerMap>,
> = {
  get(this: void): {
    [TState in keyof TTransformerMap]: Snapshot<TTransformerMap, TTransitionsMap, TState>;
  }[keyof TTransformerMap];

  get<TExpectedState extends keyof TTransformerMap>(
    this: void,
    expectedState: TExpectedState,
  ): Snapshot<TTransformerMap, TTransitionsMap, TExpectedState> | undefined;

  assert<TExpectedStates extends (keyof TTransformerMap)[]>(
    this: void,
    ...expectedStates: TExpectedStates
  ): {
    [TExpectedState in TExpectedStates[number]]: Snapshot<
      TTransformerMap,
      TTransitionsMap,
      TExpectedState
    >;
  }[TExpectedStates[number]];

  subscribe(
    this: void,
    listener: () => void,
    options?: { readonly signal?: AbortSignal | undefined },
  ): () => void;

  getPrevStates<TState extends keyof TTransformerMap>(
    state: TState,
  ): readonly InferPrevStateUnion<TTransformerMap, TTransitionsMap, TState>[];
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
      this: void,
      ...args: Parameters<TTransformerMap[TTransitionsMap[TState][TActionName]]>
    ) => Snapshot<TTransformerMap, TTransitionsMap, TTransitionsMap[TState][TActionName]>;
  };
}

export type InferPrevStateUnion<
  TTransformerMap extends TransformerMap,
  TTransitionsMap extends TransitionsMap<TTransformerMap>,
  TCurrentState,
> = {
  [TState in keyof TTransitionsMap]: TCurrentState extends InferNextStateUnion<
    TTransformerMap,
    TTransitionsMap,
    TState
  >
    ? TState
    : never;
}[keyof TTransitionsMap];

export type InferNextStateUnion<
  TTransformerMap extends TransformerMap,
  TTransitionsMap extends TransitionsMap<TTransformerMap>,
  TCurrentState,
> = TCurrentState extends keyof TTransitionsMap
  ? TTransitionsMap[TCurrentState][keyof TTransitionsMap[TCurrentState]]
  : never;

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
  const prevStatesMap: Record<string, readonly string[]> = {};

  for (const state of Object.keys(transformerMap)) {
    const prevStates: string[] = (prevStatesMap[state] = []);

    for (const [otherState, transitions] of Object.entries(transitionsMap)) {
      if (Object.values(transitions).includes(state)) {
        prevStates.push(otherState);
      }
    }
  }

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
        throw new Error(`stale snapshot`);
      }
    }

    const actions = new Proxy(
      {},
      {
        has(_, actionName) {
          assertVersion();

          return actionName in transitionsMap[currentState];
        },

        get(_, actionName) {
          assertVersion();

          const newState = transitionsMap[currentState][actionName as string]!;

          return (...args: any[]) => {
            if (notifying) {
              throw new Error(`illegal transition`);
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

    assert: (...expectedStates) => {
      if (!expectedStates.some((expectedState) => expectedState === currentState)) {
        throw new Error(`unexpected state`);
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

    getPrevStates(state) {
      return prevStatesMap[state as string] as any;
    },
  };
}
