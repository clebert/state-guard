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

const red = {color: `#FF0000`} as const;
const yellow = {color: `#FFFF00`} as const;
const green = {color: `#00FF00`} as const;

describe(`Store`, () => {
  let trafficLightStore: Store<typeof valueSchemaMap, typeof transitionsMap>;

  beforeEach(() => {
    trafficLightStore = createStore({initialState: `red`, initialValue: red, valueSchemaMap, transitionsMap});
  });

  test(`state machine snapshots and transitions`, () => {
    const redTrafficLightSnapshot = trafficLightStore.get(`red`)!;

    expect(trafficLightStore.get()).toBe(redTrafficLightSnapshot);
    expect(trafficLightStore.get(`red`)).toBe(redTrafficLightSnapshot);
    expect(trafficLightStore.get(`soonGreen`)).toBe(undefined);
    expect(trafficLightStore.get(`green`)).toBe(undefined);
    expect(trafficLightStore.get(`soonRed`)).toBe(undefined);
    expect(redTrafficLightSnapshot.state).toBe(`red`);
    expect(redTrafficLightSnapshot.value).toBe(red);
    expect(redTrafficLightSnapshot.value).toBe(redTrafficLightSnapshot.value);

    const soonGreenTrafficLightSnapshot = redTrafficLightSnapshot!.actions.requestGreen(yellow);

    expect(trafficLightStore.get()).toBe(soonGreenTrafficLightSnapshot);
    expect(trafficLightStore.get(`red`)).toBe(undefined);
    expect(trafficLightStore.get(`soonGreen`)).toBe(soonGreenTrafficLightSnapshot);
    expect(trafficLightStore.get(`green`)).toBe(undefined);
    expect(trafficLightStore.get(`soonRed`)).toBe(undefined);
    expect(soonGreenTrafficLightSnapshot.state).toBe(`soonGreen`);
    expect(soonGreenTrafficLightSnapshot.value).toBe(yellow);
    expect(soonGreenTrafficLightSnapshot.value).toBe(soonGreenTrafficLightSnapshot.value);

    const greenTrafficLightSnapshot = soonGreenTrafficLightSnapshot!.actions.setGreen(green);

    expect(trafficLightStore.get()).toBe(greenTrafficLightSnapshot);
    expect(trafficLightStore.get(`red`)).toBe(undefined);
    expect(trafficLightStore.get(`soonGreen`)).toBe(undefined);
    expect(trafficLightStore.get(`green`)).toBe(greenTrafficLightSnapshot);
    expect(trafficLightStore.get(`soonRed`)).toBe(undefined);
    expect(greenTrafficLightSnapshot.state).toBe(`green`);
    expect(greenTrafficLightSnapshot.value).toBe(green);
    expect(greenTrafficLightSnapshot.value).toBe(greenTrafficLightSnapshot.value);

    const soonRedTrafficLightSnapshot = greenTrafficLightSnapshot.actions.requestRed(yellow);

    expect(trafficLightStore.get()).toBe(soonRedTrafficLightSnapshot);
    expect(trafficLightStore.get(`red`)).toBe(undefined);
    expect(trafficLightStore.get(`soonGreen`)).toBe(undefined);
    expect(trafficLightStore.get(`green`)).toBe(undefined);
    expect(trafficLightStore.get(`soonRed`)).toBe(soonRedTrafficLightSnapshot);
    expect(soonRedTrafficLightSnapshot.state).toBe(`soonRed`);
    expect(soonRedTrafficLightSnapshot.value).toBe(yellow);
    expect(soonRedTrafficLightSnapshot.value).toBe(soonRedTrafficLightSnapshot.value);

    const redAgainTrafficLightSnapshot = soonRedTrafficLightSnapshot.actions.setRed(red);

    expect(trafficLightStore.get()).not.toBe(redTrafficLightSnapshot);
    expect(trafficLightStore.get()).toBe(redAgainTrafficLightSnapshot);
    expect(trafficLightStore.get(`red`)).toBe(redAgainTrafficLightSnapshot);
    expect(trafficLightStore.get(`soonGreen`)).toBe(undefined);
    expect(trafficLightStore.get(`green`)).toBe(undefined);
    expect(trafficLightStore.get(`soonRed`)).toBe(undefined);
    expect(redAgainTrafficLightSnapshot.state).toBe(`red`);
    expect(redAgainTrafficLightSnapshot.value).toBe(red);
    expect(redAgainTrafficLightSnapshot.value).toBe(redAgainTrafficLightSnapshot.value);
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

    expect(() => store.get().actions.set(Math.PI)).toThrow(`Invalid new value.`);
  });

  test(`stale snapshots`, () => {
    const redTrafficLightSnapshot = trafficLightStore.get(`red`)!;
    const {actions} = redTrafficLightSnapshot;
    const {requestGreen} = actions;

    requestGreen(yellow);

    const message = `Stale snapshot.`;

    expect(() => redTrafficLightSnapshot.state).toThrow(message);
    expect(() => redTrafficLightSnapshot.value).toThrow(message);
    expect(() => redTrafficLightSnapshot.actions).toThrow(message);
    expect(() => actions.requestGreen).toThrow(message);
    expect(() => requestGreen(yellow)).toThrow(message);
  });

  test(`unknown actions`, () => {
    const redTrafficLightSnapshot = trafficLightStore.get(`red`)!;
    const message = `Unknown action.`;

    expect(() => (redTrafficLightSnapshot.actions as any).requestRed).toThrow(message);
    expect(() => (redTrafficLightSnapshot.actions as any)[Symbol()]).toThrow(message);
  });

  test(`subscriptions`, () => {
    let expectedState: keyof typeof valueSchemaMap = `soonGreen`;

    const redTrafficLightSnapshot = trafficLightStore.get(`red`)!;

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

    const soonGreenTrafficLight = redTrafficLightSnapshot.actions.requestGreen(yellow);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(1);

    unsubscribe();

    expectedState = `green`;

    const greenTrafficLightSnapshot = soonGreenTrafficLight.actions.setGreen(green);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(2);

    abortController.abort();
    greenTrafficLightSnapshot.actions.requestRed(yellow);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(2);
  });

  test(`illegal state changes and rollback behavior`, () => {
    const redTrafficLightSnapshot = trafficLightStore.get(`red`)!;

    const unsubscribe = trafficLightStore.subscribe(() => {
      trafficLightStore.get(`soonGreen`)?.actions.setGreen(green);
    });

    expect(() => redTrafficLightSnapshot.actions.requestGreen(yellow)).toThrow(`Illegal state change.`);

    unsubscribe();

    expect(trafficLightStore.get()).toBe(redTrafficLightSnapshot);
    expect(trafficLightStore.get().state).toBe(`red`);
    expect(trafficLightStore.get().value).toEqual(red);

    const soonGreenTrafficLightSnapshot = redTrafficLightSnapshot.actions.requestGreen(yellow);

    expect(soonGreenTrafficLightSnapshot.state).toBe(`soonGreen`);
    expect(soonGreenTrafficLightSnapshot.value).toEqual(yellow);
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
    void (value satisfies typeof red | typeof yellow | typeof green);

    void (actions satisfies
      | {requestGreen: (newValue: typeof yellow) => InferSnapshot<typeof trafficLightStore, 'soonGreen'>}
      | {setGreen: (newValue: typeof green) => InferSnapshot<typeof trafficLightStore, 'green'>}
      | {requestRed: (newValue: typeof yellow) => InferSnapshot<typeof trafficLightStore, 'soonRed'>}
      | {setRed: (newValue: typeof red) => InferSnapshot<typeof trafficLightStore, 'red'>});
  });

  test(`"red" snapshot types`, () => {
    const {state, value, actions} = trafficLightStore.get(`red`)!;

    void (state satisfies 'red' | undefined);
    void (value satisfies typeof red | undefined);

    void (actions satisfies
      | {requestGreen: (newValue: typeof yellow) => InferSnapshot<typeof trafficLightStore, 'soonGreen'>}
      | undefined);
  });

  test(`"soonGreen" snapshot types`, () => {
    const {state, value, actions} = trafficLightStore.get(`soonGreen`) ?? {};

    void (state satisfies 'soonGreen' | undefined);
    void (value satisfies typeof yellow | undefined);

    void (actions satisfies
      | {setGreen: (newValue: typeof green) => InferSnapshot<typeof trafficLightStore, 'green'>}
      | undefined);
  });

  test(`"green" snapshot types`, () => {
    const {state, value, actions} = trafficLightStore.get(`green`) ?? {};

    void (state satisfies 'green' | undefined);
    void (value satisfies typeof green | undefined);

    void (actions satisfies
      | {requestRed: (newValue: typeof yellow) => InferSnapshot<typeof trafficLightStore, 'soonRed'>}
      | undefined);
  });

  test(`"soonRed" snapshot types`, () => {
    const {state, value, actions} = trafficLightStore.get(`soonRed`) ?? {};

    void (state satisfies 'soonRed' | undefined);
    void (value satisfies typeof yellow | undefined);

    void (actions satisfies
      | {setRed: (newValue: typeof red) => InferSnapshot<typeof trafficLightStore, 'red'>}
      | undefined);
  });
});
