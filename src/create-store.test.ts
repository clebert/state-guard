import type {InferSnapshot, Store} from './create-store.js';

import {createStore} from './create-store.js';
import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';

const transformerMap = {
  red: (color: '#FF0000') => ({color}),
  soonGreen: (color: '#FFFF00') => ({color}),
  green: (color: '#00FF00') => ({color}),
  soonRed: (color: '#FFFF00') => ({color}),
} as const;

const transitionsMap = {
  red: {requestGreen: `soonGreen`},
  soonGreen: {setGreen: `green`},
  green: {requestRed: `soonRed`},
  soonRed: {setRed: `red`},
} as const;

const redColor = `#FF0000` as const;
const yellowColor = `#FFFF00` as const;
const greenColor = `#00FF00` as const;

describe(`Store`, () => {
  let trafficLightStore: Store<typeof transformerMap, typeof transitionsMap>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    trafficLightStore = createStore({
      initialState: `red`,
      initialValue: {color: redColor},
      transformerMap,
      transitionsMap,
    });

    consoleErrorSpy = jest.spyOn(console, `error`).mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test(`state machine snapshots and transitions`, () => {
    const redTrafficLightSnapshot = trafficLightStore.get(`red`)!;

    expect(trafficLightStore.get()).toBe(redTrafficLightSnapshot);
    expect(trafficLightStore.get(`red`)).toBe(redTrafficLightSnapshot);
    expect(trafficLightStore.get(`soonGreen`)).toBe(undefined);
    expect(trafficLightStore.get(`green`)).toBe(undefined);
    expect(trafficLightStore.get(`soonRed`)).toBe(undefined);
    expect(redTrafficLightSnapshot.state).toBe(`red`);
    expect(redTrafficLightSnapshot.value).toEqual({color: redColor});
    expect(redTrafficLightSnapshot.value).toBe(redTrafficLightSnapshot.value);

    const soonGreenTrafficLightSnapshot = redTrafficLightSnapshot!.actions.requestGreen(yellowColor);

    expect(trafficLightStore.get()).toBe(soonGreenTrafficLightSnapshot);
    expect(trafficLightStore.get(`red`)).toBe(undefined);
    expect(trafficLightStore.get(`soonGreen`)).toBe(soonGreenTrafficLightSnapshot);
    expect(trafficLightStore.get(`green`)).toBe(undefined);
    expect(trafficLightStore.get(`soonRed`)).toBe(undefined);
    expect(soonGreenTrafficLightSnapshot.state).toBe(`soonGreen`);
    expect(soonGreenTrafficLightSnapshot.value).toEqual({color: yellowColor});
    expect(soonGreenTrafficLightSnapshot.value).toBe(soonGreenTrafficLightSnapshot.value);

    const greenTrafficLightSnapshot = soonGreenTrafficLightSnapshot!.actions.setGreen(greenColor);

    expect(trafficLightStore.get()).toBe(greenTrafficLightSnapshot);
    expect(trafficLightStore.get(`red`)).toBe(undefined);
    expect(trafficLightStore.get(`soonGreen`)).toBe(undefined);
    expect(trafficLightStore.get(`green`)).toBe(greenTrafficLightSnapshot);
    expect(trafficLightStore.get(`soonRed`)).toBe(undefined);
    expect(greenTrafficLightSnapshot.state).toBe(`green`);
    expect(greenTrafficLightSnapshot.value).toEqual({color: greenColor});
    expect(greenTrafficLightSnapshot.value).toBe(greenTrafficLightSnapshot.value);

    const soonRedTrafficLightSnapshot = greenTrafficLightSnapshot.actions.requestRed(yellowColor);

    expect(trafficLightStore.get()).toBe(soonRedTrafficLightSnapshot);
    expect(trafficLightStore.get(`red`)).toBe(undefined);
    expect(trafficLightStore.get(`soonGreen`)).toBe(undefined);
    expect(trafficLightStore.get(`green`)).toBe(undefined);
    expect(trafficLightStore.get(`soonRed`)).toBe(soonRedTrafficLightSnapshot);
    expect(soonRedTrafficLightSnapshot.state).toBe(`soonRed`);
    expect(soonRedTrafficLightSnapshot.value).toEqual({color: yellowColor});
    expect(soonRedTrafficLightSnapshot.value).toBe(soonRedTrafficLightSnapshot.value);

    const redAgainTrafficLightSnapshot = soonRedTrafficLightSnapshot.actions.setRed(redColor);

    expect(trafficLightStore.get()).not.toBe(redTrafficLightSnapshot);
    expect(trafficLightStore.get()).toBe(redAgainTrafficLightSnapshot);
    expect(trafficLightStore.get(`red`)).toBe(redAgainTrafficLightSnapshot);
    expect(trafficLightStore.get(`soonGreen`)).toBe(undefined);
    expect(trafficLightStore.get(`green`)).toBe(undefined);
    expect(trafficLightStore.get(`soonRed`)).toBe(undefined);
    expect(redAgainTrafficLightSnapshot.state).toBe(`red`);
    expect(redAgainTrafficLightSnapshot.value).toEqual({color: redColor});
    expect(redAgainTrafficLightSnapshot.value).toBe(redAgainTrafficLightSnapshot.value);
  });

  test(`subscriptions`, () => {
    let expectedState: keyof typeof transformerMap = `soonGreen`;

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

    const soonGreenTrafficLight = redTrafficLightSnapshot.actions.requestGreen(yellowColor);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(1);

    unsubscribe();

    expectedState = `green`;

    const greenTrafficLightSnapshot = soonGreenTrafficLight.actions.setGreen(greenColor);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(2);

    abortController.abort();
    greenTrafficLightSnapshot.actions.requestRed(yellowColor);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(2);
  });

  test(`stale snapshots`, () => {
    const redTrafficLightSnapshot = trafficLightStore.get(`red`)!;
    const {actions} = redTrafficLightSnapshot;
    const {requestGreen} = actions;

    requestGreen(yellowColor);

    const message = `Stale snapshot.`;

    expect(() => redTrafficLightSnapshot.state).toThrow(message);
    expect(() => redTrafficLightSnapshot.value).toThrow(message);
    expect(() => redTrafficLightSnapshot.actions).toThrow(message);
    expect(() => actions.requestGreen).toThrow(message);
    expect(() => requestGreen(yellowColor)).toThrow(message);
  });

  test(`unknown actions`, () => {
    const redTrafficLightSnapshot = trafficLightStore.get(`red`)!;
    const message = `Unknown action.`;

    expect(() => (redTrafficLightSnapshot.actions as any).requestRed).toThrow(message);
    expect(() => (redTrafficLightSnapshot.actions as any)[Symbol()]).toThrow(message);
  });

  test(`illegal transitions`, () => {
    const redTrafficLightSnapshot = trafficLightStore.get(`red`)!;

    trafficLightStore.subscribe(() => {
      trafficLightStore.get(`soonGreen`)!.actions.setGreen(greenColor);
    });

    const soonGreenTrafficLightSnapshot = redTrafficLightSnapshot.actions.requestGreen(yellowColor);

    expect(soonGreenTrafficLightSnapshot.state).toBe(`soonGreen`);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, new Error(`Illegal transition.`));
  });

  test(`errors in listener functions do not prevent other listeners from being called subsequently`, () => {
    const redTrafficLightSnapshot = trafficLightStore.get(`red`)!;

    const listener1 = jest.fn(() => {
      throw new Error(`oops1`);
    });

    const listener2 = jest.fn(() => {
      throw new Error(`oops2`);
    });

    const listener3 = jest.fn();

    trafficLightStore.subscribe(listener1);
    trafficLightStore.subscribe(listener2);
    trafficLightStore.subscribe(listener3);

    expect(listener1).toBeCalledTimes(0);
    expect(listener2).toBeCalledTimes(0);
    expect(listener3).toBeCalledTimes(0);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);

    const soonGreenTrafficLightSnapshot = redTrafficLightSnapshot.actions.requestGreen(`#FFFF00`);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(1);
    expect(listener3).toBeCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, new Error(`oops1`));
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, new Error(`oops2`));

    soonGreenTrafficLightSnapshot.actions.setGreen(`#00FF00`);

    expect(listener1).toBeCalledTimes(2);
    expect(listener2).toBeCalledTimes(2);
    expect(listener3).toBeCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(4);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(3, new Error(`oops1`));
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(4, new Error(`oops2`));
  });

  test(`transformer errors do not affect the current snapshot`, () => {
    const store = createStore({
      initialState: `foo`,
      initialValue: `bar`,
      transformerMap: {
        foo: () => `bar`,
        baz: () => {
          throw new Error(`oops`);
        },
      },
      transitionsMap: {
        foo: {baz: `baz`},
        baz: {foo: `foo`},
      },
    });

    const fooSnapshot = store.get(`foo`)!;

    expect(() => {
      fooSnapshot.actions.baz();
    }).toThrow(`oops`);

    expect(store.get()).toBe(fooSnapshot);
    expect(fooSnapshot.state).toBe(`foo`);
    expect(fooSnapshot.value).toBe(`bar`);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
  });

  test(`empty state edge case`, () => {
    const store = createStore({
      initialState: `full`,
      initialValue: undefined,
      transformerMap: {'full': () => undefined, '': () => undefined},
      transitionsMap: {'full': {empty: ``}, '': {fill: `full`}},
    });

    expect(store.get(``)).toBe(undefined);

    store.get(`full`)!.actions.empty();
  });

  test(`unspecific snapshot types`, () => {
    const {state, value, actions} = trafficLightStore.get();

    void (state satisfies 'red' | 'soonGreen' | 'green' | 'soonRed');
    void (value satisfies {color: '#FF0000'} | {color: '#FFFF00'} | {color: '#00FF00'});

    void (actions satisfies
      | {requestGreen: (color: '#FFFF00') => InferSnapshot<typeof trafficLightStore, 'soonGreen'>}
      | {setGreen: (color: '#00FF00') => InferSnapshot<typeof trafficLightStore, 'green'>}
      | {requestRed: (color: '#FFFF00') => InferSnapshot<typeof trafficLightStore, 'soonRed'>}
      | {setRed: (color: '#FF0000') => InferSnapshot<typeof trafficLightStore, 'red'>});
  });

  test(`"red" snapshot types`, () => {
    const {state, value, actions} = trafficLightStore.get(`red`)!;

    void (state satisfies 'red' | undefined);
    void (value satisfies {color: '#FF0000'} | undefined);

    void (actions satisfies
      | {requestGreen: (color: '#FFFF00') => InferSnapshot<typeof trafficLightStore, 'soonGreen'>}
      | undefined);
  });

  test(`"soonGreen" snapshot types`, () => {
    const {state, value, actions} = trafficLightStore.get(`soonGreen`) ?? {};

    void (state satisfies 'soonGreen' | undefined);
    void (value satisfies {color: '#FFFF00'} | undefined);

    void (actions satisfies
      | {setGreen: (color: '#00FF00') => InferSnapshot<typeof trafficLightStore, 'green'>}
      | undefined);
  });

  test(`"green" snapshot types`, () => {
    const {state, value, actions} = trafficLightStore.get(`green`) ?? {};

    void (state satisfies 'green' | undefined);
    void (value satisfies {color: '#00FF00'} | undefined);

    void (actions satisfies
      | {requestRed: (color: '#FFFF00') => InferSnapshot<typeof trafficLightStore, 'soonRed'>}
      | undefined);
  });

  test(`"soonRed" snapshot types`, () => {
    const {state, value, actions} = trafficLightStore.get(`soonRed`) ?? {};

    void (state satisfies 'soonRed' | undefined);
    void (value satisfies {color: '#FFFF00'} | undefined);
    void (actions satisfies {setRed: (color: '#FF0000') => InferSnapshot<typeof trafficLightStore, 'red'>} | undefined);
  });
});
