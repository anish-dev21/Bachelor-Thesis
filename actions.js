//actions.js
import { createAction } from 'redux-actions';

// Action to add columns to the state
export const addColumns = createAction('ADD_COLUMNS');

// Action to set the selected column
export const setSelectedColumn = createAction('SET_SELECTED_COLUMN');

// Action to set the graph data
export const setGraph = createAction('SET_GRAPH');

// Action to set the loading state
export const setLoading = createAction('SET_LOADING');

// Action to set the temporary start date
export const setTempStartDate = createAction('SET_TEMP_START_DATE', date => date.format('YYYY-MM-DD'));

// Action to set the temporary start time
export const setTempStartTime = createAction('SET_TEMP_START_TIME', time => time.format('HH:mm'));

// Action to set the temporary end date
export const setTempEndDate = createAction('SET_TEMP_END_DATE', date => date.format('YYYY-MM-DD'));

// Action to set the temporary end time
export const setTempEndTime = createAction('SET_TEMP_END_TIME', time => time.format('HH:mm'));

// Action to append a dataset to the graph
export const appendGraphDataset = createAction('APPEND_GRAPH_DATASET');

// Anomaly Detection Actions
export const setAnomalyDetectionMode = createAction('SET_ANOMALY_DETECTION_MODE');
export const setAnomalyData = createAction('SET_ANOMALY_DATA');
export const setAnomalyLoading = createAction('SET_ANOMALY_LOADING');
export const setBaselineData = createAction('SET_BASELINE_DATA');
export const setExcludeRanges = createAction('SET_EXCLUDE_RANGES');
export const addExcludeRange = createAction('ADD_EXCLUDE_RANGE');
export const removeExcludeRange = createAction('REMOVE_EXCLUDE_RANGE');
export const setAnomalyStats = createAction('SET_ANOMALY_STATS');
