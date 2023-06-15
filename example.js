import {createStateMachine} from './lib/index.js';

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

dataStore.subscribe(() => {
  const {state, value} = dataStore.get();

  console.log(state, value);
});

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
