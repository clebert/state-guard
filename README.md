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
import {createStore} from 'state-guard';
import {z} from 'zod';

const store = createStore({
  initialState: `idle`,
  initialValue: undefined,
  valueSchemaMap: {
    idle: z.void(),
    loading: z.void(),
    loaded: z.object({data: z.string()}).strict(),
  },
  transitionsMap: {
    idle: {startLoading: `loading`},
    loading: {finishLoading: `loaded`},
    loaded: {reset: `idle`},
  },
});

const unsubscribe = store.subscribe(() => {
  const snapshot = store.get();

  if (snapshot.state === `loaded`) {
    console.log(`Data loaded:`, snapshot.value);
  } else {
    console.log(`State changed:`, snapshot.state);
  }
});

const idle = store.get(`idle`);

if (idle) {
  const loading = idle.actions.startLoading();
  const loaded = loading.actions.finishLoading({data: `Hello, World!`});

  loaded.actions.reset();
}

unsubscribe();
```

This example demonstrates a simple state machine with three states:

- Idle: The application is not loading any data.
- Loading: The application is currently loading data.
- Loaded: The data has been loaded.

To change states, we use actions such as `startLoading()`, `finishLoading()`,
and `reset()` provided by the various state snapshots. When a state transition
occurs, the subscriber receives the new state snapshot, allowing you to perform
any necessary updates in response to the state change.

## Using StateGuard with React

To use a StateGuard store in a React application, you can utilize the
`useSyncExternalStore` hook. This hook efficiently synchronizes the store state
with a React component, ensuring your component renders with the most up-to-date
state snapshot.

Call the `useSyncExternalStore` hook inside your component, passing the
`store.subscribe` function and a selector function that returns the desired
state snapshot:

```js
import {myStore} from './my-store.js';
import * as React from 'react';

const YourComponent = () => {
  const snapshot = React.useSyncExternalStore(myStore.subscribe, () =>
    myStore.get(),
  );

  // Your component logic and rendering.
};
```
