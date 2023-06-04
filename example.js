import {createStore} from './lib/index.js';
import {z} from 'zod';

const store = createStore({
  initialState: `idle`,
  initialValue: undefined,
  valueSchemaMap: {
    idle: z.void(),
    loading: z.void(),
    loaded: z.object({data: z.string()}).strict(),
  },
  transitionsMap: {
    idle: {startLoading: `loading`},
    loading: {finishLoading: `loaded`},
    loaded: {reset: `idle`},
  },
});

const unsubscribe = store.subscribe(() => {
  const snapshot = store.get();

  if (snapshot.state === `loaded`) {
    console.log(`Data loaded:`, snapshot.value);
  } else {
    console.log(`State changed:`, snapshot.state);
  }
});

const idle = store.get(`idle`);

if (idle) {
  const loading = idle.actions.startLoading();
  const loaded = loading.actions.finishLoading({data: `Hello, World!`});

  loaded.actions.reset();
}

unsubscribe();
