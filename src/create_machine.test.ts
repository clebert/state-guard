import type { InferSnapshot, InferStateUnion, Machine } from './create_machine.js';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createMachine } from './create_machine.js';

const transformerMap = {
  isRed: (color: '#FF0000') => ({ color }),
  isTurningGreen: (color: '#FFFF00') => ({ color }),
  isGreen: (color: '#00FF00') => ({ color }),
  isTurningRed: (color: '#FFFF00') => ({ color }),
} as const;

const transitionsMap = {
  isRed: { turnGreen: `isTurningGreen` },
  isTurningGreen: { setGreen: `isGreen` },
  isGreen: { turnRed: `isTurningRed` },
  isTurningRed: { setRed: `isRed` },
} as const;

describe(`createMachine()`, () => {
  let trafficLightMachine: Machine<typeof transformerMap, typeof transitionsMap>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    trafficLightMachine = createMachine({
      initialState: `isRed`,
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
    const isRed = trafficLightMachine.assert(`isRed`);

    expect(trafficLightMachine.get()).toBe(isRed);
    expect(trafficLightMachine.get(`isRed`)).toBe(isRed);
    expect(trafficLightMachine.get(`isTurningGreen`)).toBe(undefined);
    expect(trafficLightMachine.get(`isGreen`)).toBe(undefined);
    expect(trafficLightMachine.get(`isTurningRed`)).toBe(undefined);
    expect(isRed.state).toBe(`isRed`);
    expect(isRed.value).toEqual({ color: `#FF0000` });
    expect(isRed.value).toBe(isRed.value);

    const isTurningGreen = isRed.actions.turnGreen(`#FFFF00`);

    expect(trafficLightMachine.get()).toBe(isTurningGreen);
    expect(trafficLightMachine.get(`isRed`)).toBe(undefined);
    expect(trafficLightMachine.get(`isTurningGreen`)).toBe(isTurningGreen);
    expect(trafficLightMachine.get(`isGreen`)).toBe(undefined);
    expect(trafficLightMachine.get(`isTurningRed`)).toBe(undefined);
    expect(isTurningGreen.state).toBe(`isTurningGreen`);
    expect(isTurningGreen.value).toEqual({ color: `#FFFF00` });
    expect(isTurningGreen.value).toBe(isTurningGreen.value);

    const isGreen = isTurningGreen.actions.setGreen(`#00FF00`);

    expect(trafficLightMachine.get()).toBe(isGreen);
    expect(trafficLightMachine.get(`isRed`)).toBe(undefined);
    expect(trafficLightMachine.get(`isTurningGreen`)).toBe(undefined);
    expect(trafficLightMachine.get(`isGreen`)).toBe(isGreen);
    expect(trafficLightMachine.get(`isTurningRed`)).toBe(undefined);
    expect(isGreen.state).toBe(`isGreen`);
    expect(isGreen.value).toEqual({ color: `#00FF00` });
    expect(isGreen.value).toBe(isGreen.value);

    const isTurningRed = isGreen.actions.turnRed(`#FFFF00`);

    expect(trafficLightMachine.get()).toBe(isTurningRed);
    expect(trafficLightMachine.get(`isRed`)).toBe(undefined);
    expect(trafficLightMachine.get(`isTurningGreen`)).toBe(undefined);
    expect(trafficLightMachine.get(`isGreen`)).toBe(undefined);
    expect(trafficLightMachine.get(`isTurningRed`)).toBe(isTurningRed);
    expect(isTurningRed.state).toBe(`isTurningRed`);
    expect(isTurningRed.value).toEqual({ color: `#FFFF00` });
    expect(isTurningRed.value).toBe(isTurningRed.value);

    const isRedAgain = isTurningRed.actions.setRed(`#FF0000`);

    expect(trafficLightMachine.get()).not.toBe(isRed);
    expect(trafficLightMachine.get()).toBe(isRedAgain);
    expect(trafficLightMachine.get(`isRed`)).toBe(isRedAgain);
    expect(trafficLightMachine.get(`isTurningGreen`)).toBe(undefined);
    expect(trafficLightMachine.get(`isGreen`)).toBe(undefined);
    expect(trafficLightMachine.get(`isTurningRed`)).toBe(undefined);
    expect(isRedAgain.state).toBe(`isRed`);
    expect(isRedAgain.value).toEqual({ color: `#FF0000` });
    expect(isRedAgain.value).toBe(isRedAgain.value);
  });

  test(`prev states`, () => {
    const isRed = trafficLightMachine.assert(`isRed`);

    // @ts-expect-error ts(1360)
    void (isRed.prevStates satisfies ReadonlyArray<'isRed'>);
    // @ts-expect-error ts(1360)
    void (isRed.prevStates satisfies ReadonlyArray<'isTurningGreen'>);
    // @ts-expect-error ts(1360)
    void (isRed.prevStates satisfies ReadonlyArray<'isGreen'>);
    void (isRed.prevStates satisfies ReadonlyArray<'isTurningRed'>);

    expect(isRed.prevStates).toEqual([`isTurningRed`]);
  });

  test(`subscriptions`, () => {
    let expectedState: keyof typeof transformerMap = `isTurningGreen`;

    const isRed = trafficLightMachine.assert(`isRed`);

    const listener1 = jest.fn(() => {
      expect(trafficLightMachine.get().state).toBe(expectedState);
    });

    const unsubscribe = trafficLightMachine.subscribe(listener1);

    const listener2 = jest.fn(() => {
      expect(trafficLightMachine.get().state).toBe(expectedState);
    });

    const abortController = new AbortController();

    trafficLightMachine.subscribe(listener2, { signal: abortController.signal });

    expect(listener1).toBeCalledTimes(0);
    expect(listener2).toBeCalledTimes(0);

    const isTurningGreen = isRed.actions.turnGreen(`#FFFF00`);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(1);

    unsubscribe();

    expectedState = `isGreen`;

    const isGreen = isTurningGreen.actions.setGreen(`#00FF00`);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(2);

    abortController.abort();
    isGreen.actions.turnRed(`#FFFF00`);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(2);
  });

  test(`unexpected states`, () => {
    const isRed = trafficLightMachine.assert(`isRed`);

    expect(() => trafficLightMachine.assert(`isTurningGreen`)).toThrow(`unexpected state`);
    expect(() => trafficLightMachine.assert(`isGreen`)).toThrow(`unexpected state`);
    expect(() => trafficLightMachine.assert(`isTurningRed`)).toThrow(`unexpected state`);

    isRed.actions.turnGreen(`#FFFF00`);

    expect(() => trafficLightMachine.assert(`isRed`)).toThrow(`unexpected state`);
    expect(() => trafficLightMachine.assert(`isTurningGreen`)).not.toThrow();
    expect(() => trafficLightMachine.assert(`isGreen`)).toThrow(`unexpected state`);
    expect(() => trafficLightMachine.assert(`isTurningRed`)).toThrow(`unexpected state`);

    const isTurningGreenOrRed = trafficLightMachine.assert(`isTurningGreen`, `isTurningRed`);

    // @ts-expect-error ts(2367)
    expect(isTurningGreenOrRed.state === `isRed`).toBe(false);
    expect(isTurningGreenOrRed.state === `isTurningGreen`).toBe(true);
    // @ts-expect-error ts(2367)
    expect(isTurningGreenOrRed.state === `isGreen`).toBe(false);
    expect(isTurningGreenOrRed.state === `isTurningRed`).toBe(false);

    if (isTurningGreenOrRed.state === `isTurningGreen`) {
      isTurningGreenOrRed.actions.setGreen(`#00FF00`);
    }

    expect(() => trafficLightMachine.assert(`isTurningGreen`, `isTurningRed`)).toThrow(
      `unexpected state`,
    );
  });

  test(`stale snapshots`, () => {
    const isRed = trafficLightMachine.assert(`isRed`);
    const { actions } = isRed;
    const { turnGreen } = actions;

    turnGreen(`#FFFF00`);

    const errorMessage = `stale snapshot`;

    expect(() => isRed.state).toThrow(errorMessage);
    expect(() => isRed.value).toThrow(errorMessage);
    expect(() => isRed.actions).toThrow(errorMessage);
    expect(() => isRed.prevStates).toThrow(errorMessage);
    expect(() => actions.turnGreen).toThrow(errorMessage);
    expect(() => turnGreen(`#FFFF00`)).toThrow(errorMessage);
  });

  test(`illegal transitions`, () => {
    const isRed = trafficLightMachine.assert(`isRed`);

    trafficLightMachine.subscribe(() => {
      trafficLightMachine.assert(`isTurningGreen`).actions.setGreen(`#00FF00`);
    });

    const isTurningGreen = isRed.actions.turnGreen(`#FFFF00`);

    expect(isTurningGreen.state).toBe(`isTurningGreen`);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, new Error(`illegal transition`));
  });

  test(`errors in listener functions do not prevent other listeners from being called subsequently`, () => {
    const isRed = trafficLightMachine.assert(`isRed`);

    const listener1 = jest.fn(() => {
      throw new Error(`oops1`);
    });

    const listener2 = jest.fn(() => {
      throw new Error(`oops2`);
    });

    const listener3 = jest.fn();

    trafficLightMachine.subscribe(listener1);
    trafficLightMachine.subscribe(listener2);
    trafficLightMachine.subscribe(listener3);

    expect(listener1).toBeCalledTimes(0);
    expect(listener2).toBeCalledTimes(0);
    expect(listener3).toBeCalledTimes(0);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);

    const isTurningGreen = isRed.actions.turnGreen(`#FFFF00`);

    expect(listener1).toBeCalledTimes(1);
    expect(listener2).toBeCalledTimes(1);
    expect(listener3).toBeCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, new Error(`oops1`));
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, new Error(`oops2`));

    isTurningGreen.actions.setGreen(`#00FF00`);

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
    const { state, value, actions } = trafficLightMachine.get();

    void (state satisfies 'isRed' | 'isTurningGreen' | 'isGreen' | 'isTurningRed');
    void (state satisfies InferStateUnion<typeof trafficLightMachine>);
    // @ts-expect-error ts(1360)
    void (state satisfies Exclude<InferStateUnion<typeof trafficLightMachine>, 'isRed'>);
    // @ts-expect-error ts(1360)
    void (state satisfies Exclude<InferStateUnion<typeof trafficLightMachine>, 'isTurningGreen'>);
    // @ts-expect-error ts(1360)
    void (state satisfies Exclude<InferStateUnion<typeof trafficLightMachine>, 'isGreen'>);
    // @ts-expect-error ts(1360)
    void (state satisfies Exclude<InferStateUnion<typeof trafficLightMachine>, 'isTurningRed'>);
    void (value satisfies { color: '#FF0000' } | { color: '#FFFF00' } | { color: '#00FF00' });

    void (actions satisfies
      | {
          turnGreen: (
            color: '#FFFF00',
          ) => InferSnapshot<typeof trafficLightMachine, 'isTurningGreen'>;
        }
      | { setGreen: (color: '#00FF00') => InferSnapshot<typeof trafficLightMachine, 'isGreen'> }
      | { turnRed: (color: '#FFFF00') => InferSnapshot<typeof trafficLightMachine, 'isTurningRed'> }
      | { setRed: (color: '#FF0000') => InferSnapshot<typeof trafficLightMachine, 'isRed'> });
  });

  test(`"isRed" snapshot types`, () => {
    const isRed = trafficLightMachine.get(`isRed`);

    expect(isRed).not.toBe(undefined);

    // @ts-expect-error ts(18048)
    void isRed.state;

    void (isRed?.state satisfies
      | Omit<InferStateUnion<typeof trafficLightMachine>, 'isRed'>
      | undefined);

    void (isRed?.value satisfies { color: '#FF0000' } | undefined);

    void (isRed?.actions satisfies
      | {
          turnGreen: (
            color: '#FFFF00',
          ) => InferSnapshot<typeof trafficLightMachine, 'isTurningGreen'>;
        }
      | undefined);
  });

  test(`"isTurningGreen" snapshot types`, () => {
    const isTurningGreen = trafficLightMachine.get(`isTurningGreen`);

    expect(isTurningGreen).toBe(undefined);

    void (isTurningGreen?.state satisfies 'isTurningGreen' | undefined);
    void (isTurningGreen?.value satisfies { color: '#FFFF00' } | undefined);

    void (isTurningGreen?.actions satisfies
      | { setGreen: (color: '#00FF00') => InferSnapshot<typeof trafficLightMachine, 'isGreen'> }
      | undefined);
  });

  test(`"isGreen" snapshot types`, () => {
    const isGreen = trafficLightMachine.get(`isGreen`);

    expect(isGreen).toBe(undefined);

    void (isGreen?.state satisfies 'isGreen' | undefined);
    void (isGreen?.value satisfies { color: '#00FF00' } | undefined);

    void (isGreen?.actions satisfies
      | { turnRed: (color: '#FFFF00') => InferSnapshot<typeof trafficLightMachine, 'isTurningRed'> }
      | undefined);
  });

  test(`"isTurningRed" snapshot types`, () => {
    const isTurningRed = trafficLightMachine.get(`isTurningRed`);

    expect(isTurningRed).toBe(undefined);

    void (isTurningRed?.state satisfies 'isTurningRed' | undefined);
    void (isTurningRed?.value satisfies { color: '#FFFF00' } | undefined);

    void (isTurningRed?.actions satisfies
      | { setRed: (color: '#FF0000') => InferSnapshot<typeof trafficLightMachine, 'isRed'> }
      | undefined);
  });
});
