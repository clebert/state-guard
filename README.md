# StateGuard

> Type-safe, deterministic state management featuring state machines and automatic stale snapshot
> invalidation.

StateGuard is a JavaScript library for managing state with an emphasis on type safety, enabling
seamless integration with TypeScript. It facilitates deterministic behavior by offering an
encapsulated state machine, user-defined actions and state transformers, as well as automatic stale
snapshot invalidation.

_✅ 536 B with all dependencies, minified and gzipped._

## Installation

```sh
npm install state-guard
```

## Usage Example

Here's how to use StateGuard to define a simple state machine for fetching website content:

1. Import `createMachine` function from the StateGuard package.

```ts
import { createMachine } from 'state-guard';
```

2. Create a `websiteContent` machine using the `createMachine` function, with the initial state,
   value, a transformer map, and transitions map.

```ts
const websiteContent = createMachine({
  initialState: `resetted`,
  initialValue: undefined,

  transformerMap: {
    resetted: () => undefined,
    fetching: (url: string) => ({ url }),
    resolved: (text: string) => ({ text }),
    rejected: (error: unknown) => ({ error }),
  },

  transitionsMap: {
    resetted: { fetch: `fetching` },
    fetching: { resolve: `resolved`, reject: `rejected` },
    resolved: { reset: `resetted` },
    rejected: { reset: `resetted` },
  },
});
```

3. Subscribe to `websiteContent` to start fetching if in the `fetching` state.

```ts
websiteContent.subscribe(async () => {
  const fetching = websiteContent.get(`fetching`);

  if (fetching) {
    try {
      const response = await fetch(fetching.value.url);
      const text = await response.text();

      if (fetching.isFresh()) {
        fetching.actions.resolve(text);
      }
    } catch (error) {
      if (fetching.isFresh()) {
        fetching.actions.reject(error);
      }
    }
  }
});
```

4. Subscribe to `websiteContent` to log the current state and value.

```ts
websiteContent.subscribe(() => {
  const { state, value } = websiteContent.get();

  console.log(state, value);
});
```

5. Trigger the `fetch` action in the `resetted` state.

```ts
websiteContent.assert(`resetted`).actions.fetch(`https://example.com`);
```

6. Implement a React component using the `useSyncExternalStore` hook for state synchronization.

```ts
import * as React from 'react';

const YourComponent = () => {
  const websiteContentSnapshot = React.useSyncExternalStore(websiteContent.subscribe, () =>
    websiteContent.get(),
  );

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
