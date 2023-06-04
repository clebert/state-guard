import type {InferSnapshot, Store} from './create-store.js';

import {createStore} from './create-store.js';
import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import {z} from 'zod';

const valueSchemaMap = {
  red: z.object({color: z.literal(`#FF0000`)}),
  soonGreen: z.object({color: z.literal(`#FFFF00`)}),
  green: z.object({color: z.literal(`#00FF00`)}),
  soonRed: z.object({color: z.literal(`#FFFF00`)}),
} as const;

const transitionsMap = {
  red: {requestGreen: `soonGreen`},
  soonGreen: {setGreen: `green`},
  green: {requestRed: `soonRed`},
  soonRed: {setRed: `red`},
} as const;

const redValue = {color: `#FF0000`} as const;
const yellowValue = {color: `#FFFF00`} as const;
const greenValue = {color: `#00FF00`} as const;

describe(`Store`, () => {
  let trafficLightStore: Store<typeof valueSchemaMap, typeof transitionsMap>;

  beforeEach(() => {
    trafficLightStore = createStore({
      initialState: `red`,
      initialValue: redValue,
      valueSchemaMap,
      transitionsMap,
    });
  });

  test(`state machine snapshots and transitions`, () => {
    const redTrafficLight = trafficLightStore.get(`red`)!;

    expect(trafficLightStore.get()).toBe(redTrafficLight);
    expect(trafficLightStore.get(`red`)).toBe(redTrafficLight);
    expect(trafficLightStore.get(`soonGreen`)).toBe(undefined);
    expect(trafficLightStore.get(`green`)).toBe(undefined);
    expect(trafficLightStore.get(`soonRed`)).toBe(undefined);
    expect(redTrafficLight.state).toBe(`red`);
    expect(redTrafficLight.value).toBe(redValue);
    expect(redTrafficLight.value).toBe(redTrafficLight.value);

    const soonGreenTrafficLight =
      redTrafficLight!.actions.requestGreen(yellowValue);

    expect(trafficLightStore.get()).toBe(soonGreenTrafficLight);
    expect(trafficLightStore.get(`red`)).toBe(undefined);
    expect(trafficLightStore.get(`soonGreen`)).toBe(soonGreenTrafficLight);
    expect(trafficLightStore.get(`green`)).toBe(undefined);
    expect(trafficLightStore.get(`soonRed`)).toBe(undefined);
    expect(soonGreenTrafficLight.state).toBe(`soonGreen`);
    expect(soonGreenTrafficLight.value).toBe(yellowValue);
    expect(soonGreenTrafficLight.value).toBe(soonGreenTrafficLight.value);

    const greenTrafficLight =
      soonGreenTrafficLight!.actions.setGreen(greenValue);

    expect(trafficLightStore.get()).toBe(greenTrafficLight);
    expect(trafficLightStore.get(`red`)).toBe(undefined);
    expect(trafficLightStore.get(`soonGreen`)).toBe(undefined);
    expect(trafficLightStore.get(`green`)).toBe(greenTrafficLight);
    expect(trafficLightStore.get(`soonRed`)).toBe(undefined);
    expect(greenTrafficLight.state).toBe(`green`);
    expect(greenTrafficLight.value).toBe(greenValue);
    expect(greenTrafficLight.value).toBe(greenTrafficLight.value);

    const soonRedTrafficLight =
      greenTrafficLight.actions.requestRed(yellowValue);

    expect(trafficLightStore.get()).toBe(soonRedTrafficLight);
    expect(trafficLightStore.get(`red`)).toBe(undefined);
    expect(trafficLightStore.get(`soonGreen`)).toBe(undefined);
    expect(trafficLightStore.get(`green`)).toBe(undefined);
    expect(trafficLightStore.get(`soonRed`)).toBe(soonRedTrafficLight);
    expect(soonRedTrafficLight.state).toBe(`soonRed`);
    expect(soonRedTrafficLight.value).toBe(yellowValue);
    expect(soonRedTrafficLight.value).toBe(soonRedTrafficLight.value);

    const redAgainTrafficLight = soonRedTrafficLight.actions.setRed(redValue);

    expect(trafficLightStore.get()).not.toBe(redTrafficLight);
    expect(trafficLightStore.get()).toBe(redAgainTrafficLight);
    expect(trafficLightStore.get(`red`)).toBe(redAgainTrafficLight);
    expect(trafficLightStore.get(`soonGreen`)).toBe(undefined);
    expect(trafficLightStore.get(`green`)).toBe(undefined);
    expect(trafficLightStore.get(`soonRed`)).toBe(undefined);
    expect(redAgainTrafficLight.state).toBe(`red`);
    expect(redAgainTrafficLight.value).toBe(redValue);
    expect(redAgainTrafficLight.value).toBe(redAgainTrafficLight.value);
  });

  test(`invalid values`, () => {
    expect(() =>
      createStore({
        initialState: `current`,
        initialValue: 42.01,
        valueSchemaMap: {current: z.number().int()},
        transitionsMap: {current: {set: `current`}},
      }),
    ).toThrow(`Invalid initial value.`);

    const store = createStore({
      initialState: `current`,
      initialValue: 42,
      valueSchemaMap: {current: z.number().int()},
      transitionsMap: {current: {set: `current`}},
    });

    expect(() => store.get().actions.set(Math.PI)).toThrow(
      `Invalid new value.`,
    );
  });

  test(`stale snapshots`, () => {
    const redTrafficLight = trafficLightStore.get(`red`)!;
    const {actions} = redTrafficLight;
    const {requestGreen} = actions;

    requestGreen(yellowValue);

    const message = `Stale snapshot.`;

    expect(() => redTrafficLight.state).toThrow(message);
    expect(() => redTrafficLight.value).toThrow(message);
    expect(() => redTrafficLight.actions).toThrow(message);
    expect(() => actions.requestGreen).toThrow(message);
    expect(() => requestGreen(yellowValue)).toThrow(message);
  });

  test(`unknown actions`, () => {
    const redTrafficLight = trafficLightStore.get(`red`)!;
    const message = `Unknown action.`;

    expect(() => (redTrafficLight.actions as any).requestRed).toThrow(message);
    expect(() => (redTrafficLight.actions as any)[Symbol()]).toThrow(message);
  });

  test(`subscriptions`, () => {
    let expectedState: keyof typeof valueSchemaMap = `soonGreen`;

    const redTrafficLight = trafficLightStore.get(`red`)!;

    const listener1 = jest.fn(() => {
      expect(trafficLightStore.get().state).toBe(expectedState);
    });

    const unsubscribe = trafficLightStore.subscribe(listener1);

    const listener2 = jest.fn(() => {
      expect(trafficLightStore.get().state).toBe(expectedState);
    });

    const abortController = new AbortController();

    trafficLightStore.subscribe(listener2, {signal: abortController.signal});

    expect(listener1).toBeCalledTimes(0);
    expect(listener2).toBeCalledTimes(0);

    const soonGreenTrafficLight =
      redTrafficLight.actions.requestGreen(yellowValue);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(1);

    unsubscribe();

    expectedState = `green`;

    const greenTrafficLight =
      soonGreenTrafficLight.actions.setGreen(greenValue);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(2);

    abortController.abort();
    greenTrafficLight.actions.requestRed(yellowValue);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(2);
  });

  test(`illegal state changes and rollback behavior`, () => {
    const redTrafficLight = trafficLightStore.get(`red`)!;

    const unsubscribe = trafficLightStore.subscribe(() => {
      trafficLightStore.get(`soonGreen`)?.actions.setGreen(greenValue);
    });

    expect(() => redTrafficLight.actions.requestGreen(yellowValue)).toThrow(
      `Illegal state change.`,
    );

    unsubscribe();

    expect(trafficLightStore.get()).toBe(redTrafficLight);
    expect(trafficLightStore.get().state).toBe(`red`);
    expect(trafficLightStore.get().value).toEqual(redValue);

    const soonGreenTrafficLight =
      redTrafficLight.actions.requestGreen(yellowValue);

    expect(soonGreenTrafficLight.state).toBe(`soonGreen`);
    expect(soonGreenTrafficLight.value).toEqual(yellowValue);
  });

  test(`empty state edge case`, () => {
    const store = createStore({
      initialState: `full`,
      initialValue: undefined,
      valueSchemaMap: {'full': z.void(), '': z.void()},
      transitionsMap: {'full': {empty: ``}, '': {fill: `full`}},
    });

    expect(store.get(``)).toBe(undefined);

    store.get(`full`)!.actions.empty();
  });

  test(`unspecific snapshot types`, () => {
    const {state, value, actions} = trafficLightStore.get();

    void (state satisfies 'red' | 'soonGreen' | 'green' | 'soonRed');

    void (value satisfies
      | typeof redValue
      | typeof yellowValue
      | typeof greenValue);

    void (actions satisfies
      | {
          requestGreen: (
            newValue: typeof yellowValue,
          ) => InferSnapshot<typeof trafficLightStore, 'soonGreen'>;
        }
      | {
          setGreen: (
            newValue: typeof greenValue,
          ) => InferSnapshot<typeof trafficLightStore, 'green'>;
        }
      | {
          requestRed: (
            newValue: typeof yellowValue,
          ) => InferSnapshot<typeof trafficLightStore, 'soonRed'>;
        }
      | {
          setRed: (
            newValue: typeof redValue,
          ) => InferSnapshot<typeof trafficLightStore, 'red'>;
        });
  });

  test(`"red" snapshot types`, () => {
    const {state, value, actions} = trafficLightStore.get(`red`)!;

    void (state satisfies 'red' | undefined);
    void (value satisfies typeof redValue | undefined);

    void (actions satisfies
      | {
          requestGreen: (
            newValue: typeof yellowValue,
          ) => InferSnapshot<typeof trafficLightStore, 'soonGreen'>;
        }
      | undefined);
  });

  test(`"soonGreen" snapshot types`, () => {
    const {state, value, actions} = trafficLightStore.get(`soonGreen`) ?? {};

    void (state satisfies 'soonGreen' | undefined);
    void (value satisfies typeof yellowValue | undefined);

    void (actions satisfies
      | {
          setGreen: (
            newValue: typeof greenValue,
          ) => InferSnapshot<typeof trafficLightStore, 'green'>;
        }
      | undefined);
  });

  test(`"green" snapshot types`, () => {
    const {state, value, actions} = trafficLightStore.get(`green`) ?? {};

    void (state satisfies 'green' | undefined);
    void (value satisfies typeof greenValue | undefined);

    void (actions satisfies
      | {
          requestRed: (
            newValue: typeof yellowValue,
          ) => InferSnapshot<typeof trafficLightStore, 'soonRed'>;
        }
      | undefined);
  });

  test(`"soonRed" snapshot types`, () => {
    const {state, value, actions} = trafficLightStore.get(`soonRed`) ?? {};

    void (state satisfies 'soonRed' | undefined);
    void (value satisfies typeof yellowValue | undefined);

    void (actions satisfies
      | {
          setRed: (
            newValue: typeof redValue,
          ) => InferSnapshot<typeof trafficLightStore, 'red'>;
        }
      | undefined);
  });
});
