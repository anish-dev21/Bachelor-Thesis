import { handleActions } from 'redux-actions';
import {
  addColumns,
  setSelectedColumn,
  setGraph,
  appendGraphDataset,
  setLoading,
  setTempStartDate,
  setTempStartTime,
  setTempEndDate,
  setTempEndTime,
  setAnomalyDetectionMode,
  setAnomalyData,
  setAnomalyLoading,
  setBaselineData,
  setExcludeRanges,
  addExcludeRange,
  removeExcludeRange,
  setAnomalyStats,
} from './actions';

const initialState = {
  columns: [],
  selectedColumn: null,
  graph: {
    datasets: [],
    startDate: null,
    endDate: null,
  },
  tempStartDate: '2024-01-01',
  tempStartTime: '00:00',
  tempEndDate: '2024-01-02',
  tempEndTime: '00:00',
  loading: false,
  // NEW: Anomaly Detection State
  anomalyDetection: {
    isEnabled: false,
    loading: false,
    data: null,
    baselineData: null,
    stats: null,
    excludeRanges: [],
  },
};

const rootReducer = handleActions(
  {
    [addColumns]: (state, { payload }) => ({ ...state, columns: payload }),

    [setSelectedColumn]: (state, { payload }) => ({ ...state, selectedColumn: payload }),

    [setGraph]: (state, { payload }) => ({
      ...state,
      graph: {
        datasets: [payload],
        startDate: payload.startDate,
        endDate: payload.endDate,
      },
    }),

    [appendGraphDataset]: (state, { payload }) => ({
      ...state,
      graph: {
        ...state.graph,
        datasets: [...state.graph.datasets, payload],
      },
    }),

    [setLoading]: (state, { payload }) => ({ ...state, loading: payload }),

    [setTempStartDate]: (state, { payload }) => ({ ...state, tempStartDate: payload }),
    [setTempStartTime]: (state, { payload }) => ({ ...state, tempStartTime: payload }),
    [setTempEndDate]: (state, { payload }) => ({ ...state, tempEndDate: payload }),
    [setTempEndTime]: (state, { payload }) => ({ ...state, tempEndTime: payload }),

    // NEW: Anomaly Detection Reducers
    [setAnomalyDetectionMode]: (state, { payload }) => ({
      ...state,
      anomalyDetection: { ...state.anomalyDetection, isEnabled: payload },
    }),

    [setAnomalyData]: (state, { payload }) => ({
      ...state,
      anomalyDetection: { ...state.anomalyDetection, data: payload },
    }),

    [setAnomalyLoading]: (state, { payload }) => ({
      ...state,
      anomalyDetection: { ...state.anomalyDetection, loading: payload },
    }),

    [setBaselineData]: (state, { payload }) => ({
      ...state,
      anomalyDetection: { ...state.anomalyDetection, baselineData: payload },
    }),

    [setExcludeRanges]: (state, { payload }) => ({
      ...state,
      anomalyDetection: { ...state.anomalyDetection, excludeRanges: payload },
    }),

    [addExcludeRange]: (state, { payload }) => ({
      ...state,
      anomalyDetection: {
        ...state.anomalyDetection,
        excludeRanges: [...state.anomalyDetection.excludeRanges, payload],
      },
    }),

    [removeExcludeRange]: (state, { payload }) => ({
      ...state,
      anomalyDetection: {
        ...state.anomalyDetection,
        excludeRanges: state.anomalyDetection.excludeRanges.filter((_, index) => index !== payload),
      },
    }),

    [setAnomalyStats]: (state, { payload }) => ({
      ...state,
      anomalyDetection: { ...state.anomalyDetection, stats: payload },
    }),
  },
  initialState
);

export default rootReducer;

