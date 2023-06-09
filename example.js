import {createStore} from './lib/index.js';

const dataStore = createStore({
  initialState: `unloaded`,
  initialValue: undefined,
  transformerMap: {
    unloaded: () => undefined,
    loading: () => undefined,
    loaded: /** @param {string} data */ (data) => data,
    updating: /** @param {string} data */ (data) => data,
    failed: /** @param {unknown} error */ (error) => ({error}),
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
  const dataSnapshot = dataStore.get();

  if (dataSnapshot.state === `loaded`) {
    console.log(`Data loaded:`, dataSnapshot.value);
  } else {
    console.log(`State changed:`, dataSnapshot.state);
  }
});

const loadingDataSnapshot = dataStore.get(`unloaded`)?.actions.load();

if (loadingDataSnapshot) {
  try {
    const response = await fetch(`https://example.com`);
    const data = await response.text();

    // Set data only if the snapshot is not stale.
    if (loadingDataSnapshot === dataStore.get(`loading`)) {
      loadingDataSnapshot.actions.set(data);
    }
  } catch (error) {
    // Fail only if the snapshot is not stale.
    if (loadingDataSnapshot === dataStore.get(`loading`)) {
      loadingDataSnapshot.actions.fail({error});
    }
  }
}
