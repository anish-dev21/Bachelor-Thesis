import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './reducers';

// Configure the Redux store
const store = configureStore({
  // Add the root reducer
  reducer: rootReducer,
  // Use default middleware (thunk is included by default)
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
});

export default store;
