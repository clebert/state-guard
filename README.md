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

In scenarios where snapshots are used following asynchronous operations, it's critical to validate
their freshness to ensure actions are based on the current state. To achieve this, use the
`isFresh()` method on an existing snapshot instead of acquiring a new one via `get()`. This approach
is preferred because even though a new snapshot might represent a state with the same name, it might
not reflect the same execution context you're working within. A snapshot that remains fresh ensures
that your code's execution branch is still active and relevant to the current state of the
application.

Importantly, when performing such checks, avoid using `await` within blocks guarded by `isFresh()`.
The reason is that during the delay introduced by `await`, the snapshot's state could have been
altered by other operations, rendering it stale once the asynchronous operation completes. This
could potentially lead to actions being taken based on outdated information.

### Avoiding State Transitions in Subscription Listeners

Performing state transitions directly within a subscription listener is prohibited in StateGuard.
Using actions to change the state within a listener will lead to exceptions being thrown. This
enforcement helps prevent cascading updates, exponential state changes, and potential violation of
the unidirectional data flow principle.
