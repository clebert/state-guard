# StateGuard

> Type-safe, deterministic state management featuring state machines and automatic stale snapshot
> invalidation.

StateGuard is a JavaScript library for managing state with an emphasis on type safety, enabling
seamless integration with TypeScript. It facilitates deterministic behavior by offering an
encapsulated state machine, user-defined actions and state transformers, as well as automatic stale
snapshot invalidation.

_✅ 415 B with all dependencies, minified and gzipped._

## Installation

```sh
npm install state-guard
```

## Showcase

Explore some projects that use StateGuard for state machine implementations:

- [ChatCompletions](https://github.com/clebert/chat-completions): A reactive state machine
  implementation for OpenAI Chat Completions API.

_If you have a project using StateGuard that you'd like to share, consider submitting a pull request
to add it to this list._

## Usage Example

Here's how to use StateGuard to define a simple state machine for data loading:

1. Import `createStateMachine` function from the StateGuard package.

```js
import {createStateMachine} from 'state-guard';
```

2. Create a `dataStore` using the `createStateMachine` function, with the initial state, value, a
   transformer map, and transitions map.

```js
const dataStore = createStateMachine({
  initialState: `isInitialized`,
  initialValue: undefined,
  transformerMap: {
    isInitialized: () => undefined,
    isLoadingData: () => undefined,
    hasData: /** @param {string} data */ (data) => ({data}),
    hasError: /** @param {unknown} error */ (error) => ({error}),
  },
  transitionsMap: {
    isInitialized: {loadData: `isLoadingData`},
    isLoadingData: {setData: `hasData`, setError: `hasError`},
    hasData: {},
    hasError: {},
  },
});
```

3. Subscribe to `dataStore` to log the current state and value.

```js
dataStore.subscribe(() => {
  const {state, value} = dataStore.get();

  console.log(state, value);
});
```

4. Trigger the `loadData` action in the `initialized` state and start data loading.

```js
const isLoadingData = dataStore.assert(`isInitialized`).actions.loadData();

try {
  const response = await fetch(`https://example.com`);
  const data = await response.text();

  // Set data only if the snapshot is not stale.
  if (isLoadingData === dataStore.get(`isLoadingData`)) {
    isLoadingData.actions.setData(data);
  }
} catch (error) {
  // Set error only if the snapshot is not stale.
  if (isLoadingData === dataStore.get(`isLoadingData`)) {
    isLoadingData.actions.setError(error);
  }
}
```

5. Implement a React component using the `useSyncExternalStore` hook for state synchronization.

```js
import * as React from 'react';

const YourComponent = () => {
  const dataStoreSnapshot = React.useSyncExternalStore(dataStore.subscribe, () => dataStore.get());

  // Your component logic and rendering.
};
```

### Ensuring Snapshot Freshness

In some cases, a snapshot taken can become stale, for example, when used after the result of an
asynchronous operation. Using a stale snapshot will lead to exceptions being thrown, and it is
crucial to ensure that this does not happen. The StateGuard API enables you to avoid such issues by
allowing you to check the freshness of a snapshot or get an updated one before proceeding.

### Avoiding State Transitions in Subscription Listeners

Performing state transitions directly within a subscription listener is prohibited in StateGuard.
Using actions to change the state within a listener will lead to exceptions being thrown. This
enforcement helps prevent cascading updates, exponential state changes, and potential violation of
the unidirectional data flow principle.
