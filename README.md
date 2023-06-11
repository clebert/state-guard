# StateGuard

> Type-safe, deterministic state management with state machines and automatic
> snapshot invalidation.

StateGuard is a library for managing state in TypeScript web projects, focusing
on type safety and deterministic behavior. It provides a state machine with
encapsulated actions, allows you to define transformers for each state and
offers automatic invalidation of stale snapshots, helping you avoid errors and
enforce proper design patterns.

_✅ 424 B with all dependencies, minified and gzipped._

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

1. Import `createStore` function from the StateGuard package.

```js
import {createStore} from 'state-guard';
```

2. Create a `dataStore` using the `createStore` function, with the initial
   state, value, a transformer map, and transitions map.

```js
const dataStore = createStore({
  initialState: `idle`,
  initialValue: undefined,
  transformerMap: {
    idle: () => undefined,
    loadingData: () => undefined,
    loadedData: /** @param {string} data */ (data) => ({data}),
    error: /** @param {unknown} reason */ (reason) => ({reason}),
  },
  transitionsMap: {
    idle: {loadData: `loadingData`},
    loadingData: {setLoadedData: `loadedData`, setError: `error`},
    loadedData: {reset: `idle`},
    error: {reset: `idle`},
  },
});
```

3. Subscribe to `dataStore` for data loading, ensuring the proper handling of
   valid and error cases.

```js
dataStore.subscribe(() => {
  const loadingDataSnapshot = dataStore.get(`loadingData`);

  if (!loadingDataSnapshot) {
    return;
  }

  fetch(`https://example.com`)
    .then(async (response) => {
      const data = await response.text();

      // Set data only if the snapshot is not stale.
      if (loadingDataSnapshot === dataStore.get(`loadingData`)) {
        loadingDataSnapshot.actions.setLoadedData(data);
      }
    })
    .catch((reason) => {
      // Set error only if the snapshot is not stale.
      if (loadingDataSnapshot === dataStore.get(`loadingData`)) {
        loadingDataSnapshot.actions.setError(reason);
      }
    });
});
```

4. Subscribe to `dataStore` to log the current state and value.

```js
dataStore.subscribe(() => {
  const snapshot = dataStore.get();

  console.log(snapshot.state, snapshot.value);
});
```

5. Trigger the `loadData` action in the `idle` state.

```js
dataStore.get(`idle`)?.actions.loadData();
```

6. Implement a React component using the `useSyncExternalStore` hook for state
   synchronization.

```js
import * as React from 'react';

const YourComponent = () => {
  const snapshot = React.useSyncExternalStore(
    dataStore.subscribe,
    dataStore.get,
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
