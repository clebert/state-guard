import {createStore} from './lib/index.js';

const dataStore = createStore({
  initialState: `initialized`,
  initialValue: undefined,
  transformerMap: {
    initialized: () => undefined,
    loadingData: () => undefined,
    loadedData: /** @param {string} data */ (data) => ({data}),
    error: /** @param {unknown} reason */ (reason) => ({reason}),
  },
  transitionsMap: {
    initialized: {loadData: `loadingData`},
    loadingData: {setLoadedData: `loadedData`, setError: `error`},
    loadedData: {reset: `initialized`},
    error: {reset: `initialized`},
  },
});

dataStore.subscribe(() => {
  const snapshot = dataStore.get();

  console.log(snapshot.state, snapshot.value);
});

// @ts-expect-error
const loadingDataSnapshot = dataStore.get(`initialized`).actions.loadData();

try {
  const response = await fetch(`https://example.com`);
  const data = await response.text();

  // Set data only if the snapshot is not stale.
  if (loadingDataSnapshot === dataStore.get(`loadingData`)) {
    loadingDataSnapshot.actions.setLoadedData(data);
  }
} catch (reason) {
  // Set error only if the snapshot is not stale.
  if (loadingDataSnapshot === dataStore.get(`loadingData`)) {
    loadingDataSnapshot.actions.setError(reason);
  }
}
