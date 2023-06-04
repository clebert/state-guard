# StateGuard

> Type-safe, deterministic state management with state machines and automatic
> snapshot invalidation.

StateGuard is a TypeScript state management library designed for web projects,
built on top of the powerful [Zod](https://github.com/colinhacks/zod) validation
library. It provides a type-safe, deterministic, and expressive state machine
with encapsulated actions and automatic invalidation of outdated state
snapshots. StateGuard aims to reduce bugs related to state manipulation, improve
project maintainability, and ensure that your application behaves predictably.

By using StateGuard, developers can define state schemas and transition maps
with the help of Zod, allowing for a clear understanding of the possible states,
their validation, and actions within their applications. This makes it easier to
reason about and modify the state throughout the development process.
Additionally, StateGuard's type-safe actions, backed by Zod validation, minimize
the risk of runtime errors and help developers catch potential issues at
compile-time.

## Installation

Using npm:

```sh
npm install state-guard zod
```

Using Yarn:

```sh
yarn add state-guard zod
```

## Usage Example

Here's how to use StateGuard and Zod together to define a simple state machine
for data loading:

```js
import {createStore} from './lib/index.js';
import {z} from 'zod';

const dataStore = createStore({
  initialState: `unloaded`,
  initialValue: undefined,
  valueSchemaMap: {
    unloaded: z.void(),
    loading: z.void(),
    loaded: z.string(),
    updating: z.string(),
    failed: z.object({error: z.unknown()}).strict(),
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
  const data = dataStore.get();

  if (data.state === `loaded`) {
    console.log(`Data loaded:`, data.value);
  } else {
    console.log(`State changed:`, data.state);
  }
});

const loadingData = dataStore.get(`unloaded`)?.actions.load();

if (loadingData) {
  try {
    const response = await fetch(`https://example.com`);
    const dataValue = await response.text();

    // Set data only if the snapshot is not stale.
    if (loadingData === dataStore.get(`loading`)) {
      loadingData.actions.set(dataValue);
    }
  } catch (error) {
    // Fail only if the snapshot is not stale.
    if (loadingData === dataStore.get(`loading`)) {
      loadingData.actions.fail({error});
    }
  }
}
```

## Using StateGuard with React

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
