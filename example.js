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
