import { createMachine } from './lib/mod.js';

const dataMachine = createMachine({
  initialState: `isInitialized`,
  initialValue: undefined,
  transformerMap: {
    isInitialized: () => undefined,
    isLoadingData: () => undefined,
    hasData: /** @param {string} data */ (data) => ({ data }),
    hasError: /** @param {unknown} error */ (error) => ({ error }),
  },
  transitionsMap: {
    isInitialized: { loadData: `isLoadingData` },
    isLoadingData: { setData: `hasData`, setError: `hasError` },
    hasData: {},
    hasError: {},
  },
});

dataMachine.subscribe(() => {
  const { state, value } = dataMachine.get();

  console.log(state, value);
});

const isLoadingData = dataMachine.assert(`isInitialized`).actions.loadData();

try {
  const response = await fetch(`https://example.com`);
  const data = await response.text();

  // Set data only if the snapshot is not stale.
  if (isLoadingData === dataMachine.get(`isLoadingData`)) {
    isLoadingData.actions.setData(data);
  }
} catch (error) {
  // Set error only if the snapshot is not stale.
  if (isLoadingData === dataMachine.get(`isLoadingData`)) {
    isLoadingData.actions.setError(error);
  }
}
