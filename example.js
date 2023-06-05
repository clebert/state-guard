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
