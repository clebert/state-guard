import type {InferSnapshot, StateMachine} from './create-state-machine.js';

import {createStateMachine} from './create-state-machine.js';
import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';

const transformerMap = {
  isRed: (color: '#FF0000') => ({color}),
  isTurningGreen: (color: '#FFFF00') => ({color}),
  isGreen: (color: '#00FF00') => ({color}),
  isTurningRed: (color: '#FFFF00') => ({color}),
} as const;

const transitionsMap = {
  isRed: {turnGreen: `isTurningGreen`},
  isTurningGreen: {setGreen: `isGreen`},
  isGreen: {turnRed: `isTurningRed`},
  isTurningRed: {setRed: `isRed`},
} as const;

describe(`createStateMachine()`, () => {
  let trafficLight: StateMachine<typeof transformerMap, typeof transitionsMap>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    trafficLight = createStateMachine({
      initialState: `isRed`,
      initialValue: {color: `#FF0000`},
      transformerMap,
      transitionsMap,
    });

    consoleErrorSpy = jest.spyOn(console, `error`).mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test(`state machine snapshots and transitions`, () => {
    const isRed = trafficLight.assert(`isRed`);

    expect(trafficLight.get()).toBe(isRed);
    expect(trafficLight.get(`isRed`)).toBe(isRed);
    expect(trafficLight.get(`isTurningGreen`)).toBe(undefined);
    expect(trafficLight.get(`isGreen`)).toBe(undefined);
    expect(trafficLight.get(`isTurningRed`)).toBe(undefined);
    expect(isRed.state).toBe(`isRed`);
    expect(isRed.value).toEqual({color: `#FF0000`});
    expect(isRed.value).toBe(isRed.value);

    const isTurningGreen = isRed.actions.turnGreen(`#FFFF00`);

    expect(trafficLight.get()).toBe(isTurningGreen);
    expect(trafficLight.get(`isRed`)).toBe(undefined);
    expect(trafficLight.get(`isTurningGreen`)).toBe(isTurningGreen);
    expect(trafficLight.get(`isGreen`)).toBe(undefined);
    expect(trafficLight.get(`isTurningRed`)).toBe(undefined);
    expect(isTurningGreen.state).toBe(`isTurningGreen`);
    expect(isTurningGreen.value).toEqual({color: `#FFFF00`});
    expect(isTurningGreen.value).toBe(isTurningGreen.value);

    const isGreen = isTurningGreen.actions.setGreen(`#00FF00`);

    expect(trafficLight.get()).toBe(isGreen);
    expect(trafficLight.get(`isRed`)).toBe(undefined);
    expect(trafficLight.get(`isTurningGreen`)).toBe(undefined);
    expect(trafficLight.get(`isGreen`)).toBe(isGreen);
    expect(trafficLight.get(`isTurningRed`)).toBe(undefined);
    expect(isGreen.state).toBe(`isGreen`);
    expect(isGreen.value).toEqual({color: `#00FF00`});
    expect(isGreen.value).toBe(isGreen.value);

    const isTurningRed = isGreen.actions.turnRed(`#FFFF00`);

    expect(trafficLight.get()).toBe(isTurningRed);
    expect(trafficLight.get(`isRed`)).toBe(undefined);
    expect(trafficLight.get(`isTurningGreen`)).toBe(undefined);
    expect(trafficLight.get(`isGreen`)).toBe(undefined);
    expect(trafficLight.get(`isTurningRed`)).toBe(isTurningRed);
    expect(isTurningRed.state).toBe(`isTurningRed`);
    expect(isTurningRed.value).toEqual({color: `#FFFF00`});
    expect(isTurningRed.value).toBe(isTurningRed.value);

    const isRedAgain = isTurningRed.actions.setRed(`#FF0000`);

    expect(trafficLight.get()).not.toBe(isRed);
    expect(trafficLight.get()).toBe(isRedAgain);
    expect(trafficLight.get(`isRed`)).toBe(isRedAgain);
    expect(trafficLight.get(`isTurningGreen`)).toBe(undefined);
    expect(trafficLight.get(`isGreen`)).toBe(undefined);
    expect(trafficLight.get(`isTurningRed`)).toBe(undefined);
    expect(isRedAgain.state).toBe(`isRed`);
    expect(isRedAgain.value).toEqual({color: `#FF0000`});
    expect(isRedAgain.value).toBe(isRedAgain.value);
  });

  test(`subscriptions`, () => {
    let expectedState: keyof typeof transformerMap = `isTurningGreen`;

    const isRed = trafficLight.assert(`isRed`);

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
    const isRed = trafficLight.assert(`isRed`);

    expect(() => trafficLight.assert(`isTurningGreen`)).toThrow(`Unexpected state.`);
    expect(() => trafficLight.assert(`isGreen`)).toThrow(`Unexpected state.`);
    expect(() => trafficLight.assert(`isTurningRed`)).toThrow(`Unexpected state.`);

    isRed.actions.turnGreen(`#FFFF00`);

    expect(() => trafficLight.assert(`isRed`)).toThrow(`Unexpected state.`);
    expect(() => trafficLight.assert(`isTurningGreen`)).not.toThrow();
    expect(() => trafficLight.assert(`isGreen`)).toThrow(`Unexpected state.`);
    expect(() => trafficLight.assert(`isTurningRed`)).toThrow(`Unexpected state.`);
  });

  test(`stale snapshots`, () => {
    const isRed = trafficLight.assert(`isRed`);
    const {actions} = isRed;
    const {turnGreen} = actions;

    turnGreen(`#FFFF00`);

    const errorMessage = `Stale snapshot.`;

    expect(() => isRed.state).toThrow(errorMessage);
    expect(() => isRed.value).toThrow(errorMessage);
    expect(() => isRed.actions).toThrow(errorMessage);
    expect(() => actions.turnGreen).toThrow(errorMessage);
    expect(() => turnGreen(`#FFFF00`)).toThrow(errorMessage);
  });

  test(`illegal transitions`, () => {
    const isRed = trafficLight.assert(`isRed`);

    trafficLight.subscribe(() => {
      trafficLight.assert(`isTurningGreen`).actions.setGreen(`#00FF00`);
    });

    const isTurningGreen = isRed.actions.turnGreen(`#FFFF00`);

    expect(isTurningGreen.state).toBe(`isTurningGreen`);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, new Error(`Illegal transition.`));
  });

  test(`errors in listener functions do not prevent other listeners from being called subsequently`, () => {
    const isRed = trafficLight.assert(`isRed`);

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
    const stateMachine = createStateMachine({
      initialState: `isFoo`,
      initialValue: `foo`,
      transformerMap: {
        isFoo: () => `foo`,
        isBar: () => {
          throw new Error(`oops`);
        },
      },
      transitionsMap: {
        isFoo: {setBar: `isBar`},
        isBar: {setFoo: `isFoo`},
      },
    });

    const isFoo = stateMachine.assert(`isFoo`);

    expect(() => {
      isFoo.actions.setBar();
    }).toThrow(`oops`);

    expect(stateMachine.get()).toBe(isFoo);
    expect(isFoo.state).toBe(`isFoo`);
    expect(isFoo.value).toBe(`foo`);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);
  });

  test(`empty state edge case`, () => {
    const stateMachine = createStateMachine({
      initialState: `_`,
      initialValue: undefined,
      transformerMap: {'_': () => undefined, '': () => undefined},
      transitionsMap: {'_': {}, '': {}},
    });

    expect(stateMachine.get(``)).toBe(undefined);
  });

  test(`unspecific snapshot types`, () => {
    const {state, value, actions} = trafficLight.get();

    void (state satisfies 'isRed' | 'isTurningGreen' | 'isGreen' | 'isTurningRed');
    void (value satisfies {color: '#FF0000'} | {color: '#FFFF00'} | {color: '#00FF00'});

    void (actions satisfies
      | {turnGreen: (color: '#FFFF00') => InferSnapshot<typeof trafficLight, 'isTurningGreen'>}
      | {setGreen: (color: '#00FF00') => InferSnapshot<typeof trafficLight, 'isGreen'>}
      | {turnRed: (color: '#FFFF00') => InferSnapshot<typeof trafficLight, 'isTurningRed'>}
      | {setRed: (color: '#FF0000') => InferSnapshot<typeof trafficLight, 'isRed'>});
  });

  test(`"isRed" snapshot types`, () => {
    const {state, value, actions} = trafficLight.assert(`isRed`);

    void (state satisfies 'isRed' | undefined);
    void (value satisfies {color: '#FF0000'} | undefined);

    void (actions satisfies
      | {turnGreen: (color: '#FFFF00') => InferSnapshot<typeof trafficLight, 'isTurningGreen'>}
      | undefined);
  });

  test(`"isTurningGreen" snapshot types`, () => {
    const {state, value, actions} = trafficLight.get(`isTurningGreen`) ?? {};

    void (state satisfies 'isTurningGreen' | undefined);
    void (value satisfies {color: '#FFFF00'} | undefined);

    void (actions satisfies
      | {setGreen: (color: '#00FF00') => InferSnapshot<typeof trafficLight, 'isGreen'>}
      | undefined);
  });

  test(`"isGreen" snapshot types`, () => {
    const {state, value, actions} = trafficLight.get(`isGreen`) ?? {};

    void (state satisfies 'isGreen' | undefined);
    void (value satisfies {color: '#00FF00'} | undefined);

    void (actions satisfies
      | {turnRed: (color: '#FFFF00') => InferSnapshot<typeof trafficLight, 'isTurningRed'>}
      | undefined);
  });

  test(`"isTurningRed" snapshot types`, () => {
    const {state, value, actions} = trafficLight.get(`isTurningRed`) ?? {};

    void (state satisfies 'isTurningRed' | undefined);
    void (value satisfies {color: '#FFFF00'} | undefined);
    void (actions satisfies {setRed: (color: '#FF0000') => InferSnapshot<typeof trafficLight, 'isRed'>} | undefined);
  });
});
