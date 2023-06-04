import type {z} from 'zod';

export type Store<
  TValueSchemaMap extends ValueSchemaMap,
  TTransitionsMap extends TransitionsMap<TValueSchemaMap>,
> = {
  readonly get: <
    TExpectedState extends keyof TValueSchemaMap | undefined = undefined,
  >(
    expectedState?: TExpectedState,
  ) => TExpectedState extends keyof TValueSchemaMap
    ? Snapshot<TValueSchemaMap, TTransitionsMap, TExpectedState> | undefined
    : {
        [TState in keyof TValueSchemaMap]: Snapshot<
          TValueSchemaMap,
          TTransitionsMap,
          TState
        >;
      }[keyof TValueSchemaMap];

  readonly subscribe: (
    listener: () => void,
    options?: {readonly signal?: AbortSignal},
  ) => () => void;
};

export type ValueSchemaMap = Readonly<Record<string, z.ZodSchema<any>>>;

export type TransitionsMap<TValueSchemaMap extends ValueSchemaMap> = Readonly<
  Record<keyof TValueSchemaMap, Readonly<Record<string, keyof TValueSchemaMap>>>
>;

export interface Snapshot<
  TValueSchemaMap extends ValueSchemaMap,
  TTransitionsMap extends TransitionsMap<TValueSchemaMap>,
  TState extends keyof TValueSchemaMap,
> {
  readonly state: TState;
  readonly value: z.TypeOf<TValueSchemaMap[TState]>;
  readonly actions: InferActions<TValueSchemaMap, TTransitionsMap, TState>;
}

export type InferActions<
  TValueSchemaMap extends ValueSchemaMap,
  TTransitionsMap extends TransitionsMap<TValueSchemaMap>,
  TState extends keyof TValueSchemaMap,
> = {
  readonly [TActionName in keyof TTransitionsMap[TState]]: (
    newValue: z.TypeOf<TValueSchemaMap[TTransitionsMap[TState][TActionName]]>,
  ) => Snapshot<
    TValueSchemaMap,
    TTransitionsMap,
    TTransitionsMap[TState][TActionName]
  >;
};

export type InferSnapshot<TStore, TState> = TStore extends Store<
  infer TValueSchemaMap,
  infer TTransitionsMap
>
  ? TState extends keyof TValueSchemaMap
    ? Snapshot<TValueSchemaMap, TTransitionsMap, TState>
    : never
  : never;

export interface StoreInit<
  TValueSchemaMap extends ValueSchemaMap,
  TTransitionsMap extends TransitionsMap<TValueSchemaMap>,
  TInitialState extends keyof TValueSchemaMap,
> {
  readonly initialState: TInitialState;
  readonly initialValue: z.TypeOf<TValueSchemaMap[TInitialState]>;
  readonly valueSchemaMap: TValueSchemaMap;
  readonly transitionsMap: TTransitionsMap;
}

export function createStore<
  const TValueSchemaMap extends ValueSchemaMap,
  const TTransitionsMap extends TransitionsMap<TValueSchemaMap>,
  const TInitialState extends keyof TValueSchemaMap,
>({
  initialState,
  initialValue,
  valueSchemaMap,
  transitionsMap,
}: StoreInit<TValueSchemaMap, TTransitionsMap, TInitialState>): Store<
  TValueSchemaMap,
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

  let actualState: keyof TValueSchemaMap = initialState;
  let actualValue = valueSchemaMap[actualState]!.parse(initialValue);
  let actualVersion = Symbol();
  let actualSnapshot = createSnapshot();

  function createSnapshot(): Snapshot<
    TValueSchemaMap,
    TTransitionsMap,
    keyof TValueSchemaMap
  > {
    const version = actualVersion;

    function assertVersion(): void {
      if (version !== actualVersion) {
        throw new Error(`Outdated snapshot.`);
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

          return (newValue: any) => {
            if (notifying) {
              throw new Error(`Illegal state change.`);
            }

            assertVersion();

            const previousState = actualState;
            const previousValue = actualValue;
            const previousVersion = actualVersion;
            const previousSnapshot = actualSnapshot;

            actualState = newState;
            actualValue = valueSchemaMap[actualState]!.parse(newValue);
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
