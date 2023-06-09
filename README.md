# StateGuard

> Type-safe, deterministic state management with state machines and automatic
> snapshot invalidation.

StateGuard is a library for managing state in TypeScript web projects, focusing
on type safety and deterministic behavior. It provides a state machine with
encapsulated actions, allows you to define transformers for each state and
offers automatic invalidation of stale snapshots, helping you avoid errors and
enforce proper design patterns.

## Installation

Using npm:

```sh
npm install state-guard
```

Using Yarn:

```sh
yarn add state-guard
```

## Usage Example

Here's how to use StateGuard to define a simple state machine for data loading:

```js
import {createStore} from 'state-guard';

const dataStore = createStore({
  initialState: `unloaded`,
  initialValue: undefined,
  transformerMap: {
    unloaded: () => undefined,
    loading: () => undefined,
    loaded: /** @param {string} data */ (data) => data,
    updating: /** @param {string} data */ (data) => data,
    failed: /** @param {unknown} error */ (error) => ({error}),
  },
  transitionsMap: {
    unloaded: {load: `loading`},
    loading: {set: `loaded`, fail: `failed`},
    loaded: {update: `updating`},
    updating: {set: `loaded`, fail: `failed`},
    failed: {reset: `unloaded`},
  },
});

dataStore.subscribe(() => {
  const dataSnapshot = dataStore.get();

  if (dataSnapshot.state === `loaded`) {
    console.log(`Data loaded:`, dataSnapshot.value);
  } else {
    console.log(`State changed:`, dataSnapshot.state);
  }
});

const loadingDataSnapshot = dataStore.get(`unloaded`)?.actions.load();

if (loadingDataSnapshot) {
  try {
    const response = await fetch(`https://example.com`);
    const data = await response.text();

    // Set data only if the snapshot is not stale.
    if (loadingDataSnapshot === dataStore.get(`loading`)) {
      loadingDataSnapshot.actions.set(data);
    }
  } catch (error) {
    // Fail only if the snapshot is not stale.
    if (loadingDataSnapshot === dataStore.get(`loading`)) {
      loadingDataSnapshot.actions.fail({error});
    }
  }
}
```

### Using StateGuard with React

To use a StateGuard store in a React application, you can utilize the
`useSyncExternalStore` hook. This hook efficiently synchronizes the store state
with a React component, ensuring your component renders with the most up-to-date
state snapshot.

Call the `useSyncExternalStore` hook inside your component, passing the
`store.subscribe` function and a selector function that returns the desired
state snapshot:

```js
import * as React from 'react';

const YourComponent = () => {
  const data = React.useSyncExternalStore(dataStore.subscribe, () =>
    dataStore.get(),
  );

  // Your component logic and rendering.
};
```

### Ensuring Snapshot Freshness

In some cases, a snapshot taken can become stale, for example, when used after
the result of an asynchronous operation. Using a stale snapshot will lead to
exceptions being thrown, and it is crucial to ensure that this does not happen.
The StateGuard API enables you to avoid such issues by allowing you to check the
freshness of a snapshot or get an updated one before proceeding.

### Avoiding State Transitions in Subscription Listeners

Performing state transitions directly within a subscription listener is
prohibited in StateGuard. Using actions to change the state within a listener
will lead to exceptions being thrown. This enforcement helps prevent cascading
updates, exponential state changes, and potential violation of the
unidirectional data flow principle.
