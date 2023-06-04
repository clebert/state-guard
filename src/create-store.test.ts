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
  let trafficLight: Store<typeof valueSchemaMap, typeof transitionsMap>;

  beforeEach(() => {
    trafficLight = createStore({
      initialState: `red`,
      initialValue: redValue,
      valueSchemaMap,
      transitionsMap,
    });
  });

  test(`state machine snapshots and transitions`, () => {
    const red = trafficLight.get(`red`)!;

    expect(trafficLight.get()).toBe(red);
    expect(trafficLight.get(`red`)).toBe(red);
    expect(trafficLight.get(`soonGreen`)).toBe(undefined);
    expect(trafficLight.get(`green`)).toBe(undefined);
    expect(trafficLight.get(`soonRed`)).toBe(undefined);
    expect(red.state).toBe(`red`);
    expect(red.value).not.toBe(redValue);
    expect(red.value).toEqual(redValue);
    expect(red.value).toBe(red.value);

    const soonGreen = red!.actions.requestGreen(yellowValue);

    expect(trafficLight.get()).toBe(soonGreen);
    expect(trafficLight.get(`red`)).toBe(undefined);
    expect(trafficLight.get(`soonGreen`)).toBe(soonGreen);
    expect(trafficLight.get(`green`)).toBe(undefined);
    expect(trafficLight.get(`soonRed`)).toBe(undefined);
    expect(soonGreen.state).toBe(`soonGreen`);
    expect(soonGreen.value).not.toBe(yellowValue);
    expect(soonGreen.value).toEqual(yellowValue);
    expect(soonGreen.value).toBe(soonGreen.value);

    const green = soonGreen!.actions.setGreen(greenValue);

    expect(trafficLight.get()).toBe(green);
    expect(trafficLight.get(`red`)).toBe(undefined);
    expect(trafficLight.get(`soonGreen`)).toBe(undefined);
    expect(trafficLight.get(`green`)).toBe(green);
    expect(trafficLight.get(`soonRed`)).toBe(undefined);
    expect(green.state).toBe(`green`);
    expect(green.value).not.toBe(greenValue);
    expect(green.value).toEqual(greenValue);
    expect(green.value).toBe(green.value);

    const soonRed = green.actions.requestRed(yellowValue);

    expect(trafficLight.get()).toBe(soonRed);
    expect(trafficLight.get(`red`)).toBe(undefined);
    expect(trafficLight.get(`soonGreen`)).toBe(undefined);
    expect(trafficLight.get(`green`)).toBe(undefined);
    expect(trafficLight.get(`soonRed`)).toBe(soonRed);
    expect(soonRed.state).toBe(`soonRed`);
    expect(soonRed.value).not.toBe(yellowValue);
    expect(soonRed.value).toEqual(yellowValue);
    expect(soonRed.value).toBe(soonRed.value);

    const redAgain = soonRed.actions.setRed(redValue);

    expect(trafficLight.get()).not.toBe(red);
    expect(trafficLight.get()).toBe(redAgain);
    expect(trafficLight.get(`red`)).toBe(redAgain);
    expect(trafficLight.get(`soonGreen`)).toBe(undefined);
    expect(trafficLight.get(`green`)).toBe(undefined);
    expect(trafficLight.get(`soonRed`)).toBe(undefined);
    expect(redAgain.state).toBe(`red`);
    expect(redAgain.value).not.toBe(redValue);
    expect(redAgain.value).toEqual(redValue);
    expect(redAgain.value).toBe(redAgain.value);
  });

  test(`outdated snapshots`, () => {
    const red = trafficLight.get(`red`)!;
    const {actions} = red;
    const {requestGreen} = actions;

    requestGreen(yellowValue);

    const message = `Outdated snapshot.`;

    expect(() => red.state).toThrow(message);
    expect(() => red.value).toThrow(message);
    expect(() => red.actions).toThrow(message);
    expect(() => actions.requestGreen).toThrow(message);
    expect(() => requestGreen(yellowValue)).toThrow(message);
  });

  test(`unknown actions`, () => {
    const red = trafficLight.get(`red`)!;
    const message = `Unknown action.`;

    expect(() => (red.actions as any).requestRed).toThrow(message);
    expect(() => (red.actions as any)[Symbol()]).toThrow(message);
  });

  test(`subscriptions`, () => {
    let expectedState: keyof typeof valueSchemaMap = `soonGreen`;

    const red = trafficLight.get(`red`)!;

    const listener1 = jest.fn(() => {
      expect(trafficLight.get().state).toBe(expectedState);
    });

    const unsubscribe = trafficLight.subscribe(listener1);

    const listener2 = jest.fn(() => {
      expect(trafficLight.get().state).toBe(expectedState);
    });

    const abortController = new AbortController();

    trafficLight.subscribe(listener2, {signal: abortController.signal});

    expect(listener1).toBeCalledTimes(0);
    expect(listener2).toBeCalledTimes(0);

    const soonGreen = red.actions.requestGreen(yellowValue);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(1);

    unsubscribe();

    expectedState = `green`;

    const green = soonGreen.actions.setGreen(greenValue);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(2);

    abortController.abort();

    green.actions.requestRed(yellowValue);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(2);
  });

  test(`illegal state changes and rollback behavior`, () => {
    const red = trafficLight.get(`red`)!;

    const unsubscribe = trafficLight.subscribe(() => {
      trafficLight.get(`soonGreen`)?.actions.setGreen(greenValue);
    });

    expect(() => red.actions.requestGreen(yellowValue)).toThrow(
      `Illegal state change.`,
    );

    unsubscribe();

    expect(trafficLight.get()).toBe(red);
    expect(trafficLight.get().state).toBe(`red`);
    expect(trafficLight.get().value).toEqual(redValue);

    const soonGreen = red.actions.requestGreen(yellowValue);

    expect(soonGreen.state).toBe(`soonGreen`);
    expect(soonGreen.value).toEqual(yellowValue);
  });

  test(`empty state edge case`, () => {
    const edgeCase = createStore({
      initialState: `full`,
      initialValue: undefined,
      valueSchemaMap: {'full': z.void(), '': z.void()},
      transitionsMap: {'full': {empty: ``}, '': {fill: `full`}},
    });

    expect(edgeCase.get(``)).toBe(undefined);

    edgeCase.get(`full`)!.actions.empty();
  });

  test(`unspecific snapshot types`, () => {
    const {state, value, actions} = trafficLight.get();

    void (state satisfies 'red' | 'soonGreen' | 'green' | 'soonRed');

    void (value satisfies
      | typeof redValue
      | typeof yellowValue
      | typeof greenValue);

    void (actions satisfies
      | {
          requestGreen: (
            newValue: typeof yellowValue,
          ) => InferSnapshot<typeof trafficLight, 'soonGreen'>;
        }
      | {
          setGreen: (
            newValue: typeof greenValue,
          ) => InferSnapshot<typeof trafficLight, 'green'>;
        }
      | {
          requestRed: (
            newValue: typeof yellowValue,
          ) => InferSnapshot<typeof trafficLight, 'soonRed'>;
        }
      | {
          setRed: (
            newValue: typeof redValue,
          ) => InferSnapshot<typeof trafficLight, 'red'>;
        });
  });

  test(`"red" snapshot types`, () => {
    const {state, value, actions} = trafficLight.get(`red`)!;

    void (state satisfies 'red' | undefined);
    void (value satisfies typeof redValue | undefined);

    void (actions satisfies
      | {
          requestGreen: (
            newValue: typeof yellowValue,
          ) => InferSnapshot<typeof trafficLight, 'soonGreen'>;
        }
      | undefined);
  });

  test(`"soonGreen" snapshot types`, () => {
    const {state, value, actions} = trafficLight.get(`soonGreen`) ?? {};

    void (state satisfies 'soonGreen' | undefined);
    void (value satisfies typeof yellowValue | undefined);

    void (actions satisfies
      | {
          setGreen: (
            newValue: typeof greenValue,
          ) => InferSnapshot<typeof trafficLight, 'green'>;
        }
      | undefined);
  });

  test(`"green" snapshot types`, () => {
    const {state, value, actions} = trafficLight.get(`green`) ?? {};

    void (state satisfies 'green' | undefined);
    void (value satisfies typeof greenValue | undefined);

    void (actions satisfies
      | {
          requestRed: (
            newValue: typeof yellowValue,
          ) => InferSnapshot<typeof trafficLight, 'soonRed'>;
        }
      | undefined);
  });

  test(`"soonRed" snapshot types`, () => {
    const {state, value, actions} = trafficLight.get(`soonRed`) ?? {};

    void (state satisfies 'soonRed' | undefined);
    void (value satisfies typeof yellowValue | undefined);

    void (actions satisfies
      | {
          setRed: (
            newValue: typeof redValue,
          ) => InferSnapshot<typeof trafficLight, 'red'>;
        }
      | undefined);
  });
});
