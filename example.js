import {createStore} from './lib/index.js';

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

dataStore.subscribe(() => {
  const snapshot = dataStore.get();

  console.log(snapshot.state, snapshot.value);
});

dataStore.get(`idle`)?.actions.loadData();
