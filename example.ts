import { createMachine } from './src/mod.js';

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

websiteContent.subscribe(() => {
  const { state, value } = websiteContent.get();

  console.log(state, value);
});

websiteContent.assert(`resetted`).actions.fetch(`https://example.com`);
