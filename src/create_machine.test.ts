import type { InferSnapshot, InferStateUnion, Machine } from './create_machine.js';

import { createMachine } from './create_machine.js';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

const transformerMap = {
  red: (color: '#FF0000') => ({ color }),
  turningGreen: (color: '#FFFF00') => ({ color }),
  green: (color: '#00FF00') => ({ color }),
  turningRed: (color: '#FFFF00') => ({ color }),
} as const;

const transitionsMap = {
  red: { turnGreen: `turningGreen` },
  turningGreen: { setGreen: `green` },
  green: { turnRed: `turningRed` },
  turningRed: { setRed: `red` },
} as const;

type TrafficLight = Machine<typeof transformerMap, typeof transitionsMap>;

describe(`createMachine()`, () => {
  let trafficLight: Machine<typeof transformerMap, typeof transitionsMap>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    trafficLight = createMachine({
      initialState: `red`,
      initialValue: { color: `#FF0000` },
      transformerMap,
      transitionsMap,
    });

    consoleErrorSpy = jest.spyOn(console, `error`).mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test(`snapshots and transitions`, () => {
    const red = trafficLight.assert(`red`);

    expect(trafficLight.get()).toBe(red);
    expect(trafficLight.get(`red`)).toBe(red);
    expect(trafficLight.get(`turningGreen`)).toBe(undefined);
    expect(trafficLight.get(`green`)).toBe(undefined);
    expect(trafficLight.get(`turningRed`)).toBe(undefined);
    expect(red.state).toBe(`red`);
    expect(red.value).toEqual({ color: `#FF0000` });
    expect(red.value).toBe(red.value);

    const turningGreen = red.actions.turnGreen(`#FFFF00`);

    expect(trafficLight.get()).toBe(turningGreen);
    expect(trafficLight.get(`red`)).toBe(undefined);
    expect(trafficLight.get(`turningGreen`)).toBe(turningGreen);
    expect(trafficLight.get(`green`)).toBe(undefined);
    expect(trafficLight.get(`turningRed`)).toBe(undefined);
    expect(turningGreen.state).toBe(`turningGreen`);
    expect(turningGreen.value).toEqual({ color: `#FFFF00` });
    expect(turningGreen.value).toBe(turningGreen.value);

    const green = turningGreen.actions.setGreen(`#00FF00`);

    expect(trafficLight.get()).toBe(green);
    expect(trafficLight.get(`red`)).toBe(undefined);
    expect(trafficLight.get(`turningGreen`)).toBe(undefined);
    expect(trafficLight.get(`green`)).toBe(green);
    expect(trafficLight.get(`turningRed`)).toBe(undefined);
    expect(green.state).toBe(`green`);
    expect(green.value).toEqual({ color: `#00FF00` });
    expect(green.value).toBe(green.value);

    const turningRed = green.actions.turnRed(`#FFFF00`);

    expect(trafficLight.get()).toBe(turningRed);
    expect(trafficLight.get(`red`)).toBe(undefined);
    expect(trafficLight.get(`turningGreen`)).toBe(undefined);
    expect(trafficLight.get(`green`)).toBe(undefined);
    expect(trafficLight.get(`turningRed`)).toBe(turningRed);
    expect(turningRed.state).toBe(`turningRed`);
    expect(turningRed.value).toEqual({ color: `#FFFF00` });
    expect(turningRed.value).toBe(turningRed.value);

    const redAgain = turningRed.actions.setRed(`#FF0000`);

    expect(trafficLight.get()).not.toBe(red);
    expect(trafficLight.get()).toBe(redAgain);
    expect(trafficLight.get(`red`)).toBe(redAgain);
    expect(trafficLight.get(`turningGreen`)).toBe(undefined);
    expect(trafficLight.get(`green`)).toBe(undefined);
    expect(trafficLight.get(`turningRed`)).toBe(undefined);
    expect(redAgain.state).toBe(`red`);
    expect(redAgain.value).toEqual({ color: `#FF0000` });
    expect(redAgain.value).toBe(redAgain.value);
  });

  test(`prev states`, () => {
    const prevStates = trafficLight.getPrevStates(`red`);

    void (prevStates satisfies ReadonlyArray<'turningRed'>);

    expect(prevStates).toEqual([`turningRed`]);
  });

  test(`subscriptions`, () => {
    let expectedState: keyof typeof transformerMap = `turningGreen`;

    const red = trafficLight.assert(`red`);

    const listener1 = jest.fn(() => {
      expect(trafficLight.get().state).toBe(expectedState);
    });

    const unsubscribe = trafficLight.subscribe(listener1);

    const listener2 = jest.fn(() => {
      expect(trafficLight.get().state).toBe(expectedState);
    });

    const abortController = new AbortController();

    trafficLight.subscribe(listener2, { signal: abortController.signal });

    expect(listener1).toBeCalledTimes(0);
    expect(listener2).toBeCalledTimes(0);

    const turningGreen = red.actions.turnGreen(`#FFFF00`);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(1);

    unsubscribe();

    expectedState = `green`;

    const green = turningGreen.actions.setGreen(`#00FF00`);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(2);

    abortController.abort();
    green.actions.turnRed(`#FFFF00`);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(2);
  });

  test(`unexpected states`, () => {
    const red = trafficLight.assert(`red`);

    expect(() => trafficLight.assert(`turningGreen`)).toThrow(`unexpected state`);
    expect(() => trafficLight.assert(`green`)).toThrow(`unexpected state`);
    expect(() => trafficLight.assert(`turningRed`)).toThrow(`unexpected state`);

    red.actions.turnGreen(`#FFFF00`);

    expect(() => trafficLight.assert(`red`)).toThrow(`unexpected state`);
    expect(() => trafficLight.assert(`turningGreen`)).not.toThrow();
    expect(() => trafficLight.assert(`green`)).toThrow(`unexpected state`);
    expect(() => trafficLight.assert(`turningRed`)).toThrow(`unexpected state`);

    const turningGreenOrRed = trafficLight.assert(`turningGreen`, `turningRed`);

    expect(turningGreenOrRed.state === `turningGreen`).toBe(true);
    expect(turningGreenOrRed.state === `turningRed`).toBe(false);

    if (turningGreenOrRed.state === `turningGreen`) {
      turningGreenOrRed.actions.setGreen(`#00FF00`);
    }

    expect(() => trafficLight.assert(`turningGreen`, `turningRed`)).toThrow(`unexpected state`);
  });

  test(`stale snapshots`, () => {
    const red = trafficLight.assert(`red`);
    const { actions } = red;
    const { turnGreen } = actions;

    turnGreen(`#FFFF00`);

    const errorMessage = `stale snapshot`;

    expect(() => red.state).toThrow(errorMessage);
    expect(() => red.value).toThrow(errorMessage);
    expect(() => red.actions).toThrow(errorMessage);
    expect(() => actions.turnGreen).toThrow(errorMessage);
    expect(() => turnGreen(`#FFFF00`)).toThrow(errorMessage);
  });

  test(`illegal transitions`, () => {
    const red = trafficLight.assert(`red`);

    trafficLight.subscribe(() => {
      trafficLight.assert(`turningGreen`).actions.setGreen(`#00FF00`);
    });

    const turningGreen = red.actions.turnGreen(`#FFFF00`);

    expect(turningGreen.state).toBe(`turningGreen`);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, new Error(`illegal transition`));
  });

  test(`errors in listener functions do not prevent other listeners from being called subsequently`, () => {
    const red = trafficLight.assert(`red`);

    const listener1 = jest.fn(() => {
      throw new Error(`oops1`);
    });

    const listener2 = jest.fn(() => {
      throw new Error(`oops2`);
    });

    const listener3 = jest.fn();

    trafficLight.subscribe(listener1);
    trafficLight.subscribe(listener2);
    trafficLight.subscribe(listener3);

    expect(listener1).toBeCalledTimes(0);
    expect(listener2).toBeCalledTimes(0);
    expect(listener3).toBeCalledTimes(0);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);

    const turningGreen = red.actions.turnGreen(`#FFFF00`);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(1);
    expect(listener3).toBeCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, new Error(`oops1`));
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, new Error(`oops2`));

    turningGreen.actions.setGreen(`#00FF00`);

    expect(listener1).toBeCalledTimes(2);
    expect(listener2).toBeCalledTimes(2);
    expect(listener3).toBeCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(4);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(3, new Error(`oops1`));
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(4, new Error(`oops2`));
  });

  test(`transformer errors do not affect the current snapshot`, () => {
    const machine = createMachine({
      initialState: `isFoo`,
      initialValue: `foo`,
      transformerMap: {
        isFoo: () => `foo`,
        isBar: () => {
          throw new Error(`oops`);
        },
      },
      transitionsMap: {
        isFoo: { setBar: `isBar` },
        isBar: { setFoo: `isFoo` },
      },
    });

    const isFoo = machine.assert(`isFoo`);

    expect(() => {
      isFoo.actions.setBar();
    }).toThrow(`oops`);

    expect(machine.get()).toBe(isFoo);
    expect(isFoo.state).toBe(`isFoo`);
    expect(isFoo.value).toBe(`foo`);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
  });

  test(`empty state edge case`, () => {
    const machine = createMachine({
      initialState: `_`,
      initialValue: undefined,
      transformerMap: { '_': () => undefined, '': () => undefined },
      transitionsMap: { '_': {}, '': {} },
    });

    expect(machine.get(``)).toBe(undefined);
  });

  test(`unspecific snapshot types`, () => {
    const snapshot = trafficLight.get();

    void (snapshot.state satisfies 'red' | 'turningGreen' | 'green' | 'turningRed');
    void (snapshot.state satisfies InferStateUnion<TrafficLight>);

    void (snapshot.value satisfies
      | { color: '#FF0000' }
      | { color: '#FFFF00' }
      | { color: '#00FF00' });

    void (snapshot.actions satisfies
      | { turnGreen: (color: '#FFFF00') => InferSnapshot<TrafficLight, 'turningGreen'> }
      | { setGreen: (color: '#00FF00') => InferSnapshot<TrafficLight, 'green'> }
      | { turnRed: (color: '#FFFF00') => InferSnapshot<TrafficLight, 'turningRed'> }
      | { setRed: (color: '#FF0000') => InferSnapshot<TrafficLight, 'red'> });
  });

  test(`"red" snapshot types`, () => {
    const red = trafficLight.get(`red`);

    expect(red).not.toBe(undefined);

    void (red?.state satisfies Omit<InferStateUnion<TrafficLight>, 'red'> | undefined);
    void (red?.value satisfies { color: '#FF0000' } | undefined);

    void (red?.actions satisfies
      | { turnGreen: (color: '#FFFF00') => InferSnapshot<TrafficLight, 'turningGreen'> }
      | undefined);
  });

  test(`"turningGreen" snapshot types`, () => {
    const turningGreen = trafficLight.get(`turningGreen`);

    expect(turningGreen).toBe(undefined);

    void (turningGreen?.state satisfies 'turningGreen' | undefined);
    void (turningGreen?.value satisfies { color: '#FFFF00' } | undefined);

    void (turningGreen?.actions satisfies
      | { setGreen: (color: '#00FF00') => InferSnapshot<TrafficLight, 'green'> }
      | undefined);
  });

  test(`"green" snapshot types`, () => {
    const green = trafficLight.get(`green`);

    expect(green).toBe(undefined);

    void (green?.state satisfies 'green' | undefined);
    void (green?.value satisfies { color: '#00FF00' } | undefined);

    void (green?.actions satisfies
      | { turnRed: (color: '#FFFF00') => InferSnapshot<TrafficLight, 'turningRed'> }
      | undefined);
  });

  test(`"turningRed" snapshot types`, () => {
    const turningRed = trafficLight.get(`turningRed`);

    expect(turningRed).toBe(undefined);

    void (turningRed?.state satisfies 'turningRed' | undefined);
    void (turningRed?.value satisfies { color: '#FFFF00' } | undefined);

    void (turningRed?.actions satisfies
      | { setRed: (color: '#FF0000') => InferSnapshot<TrafficLight, 'red'> }
      | undefined);
  });
});
