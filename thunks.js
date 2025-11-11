import axios from 'axios';
import {
  addColumns,
  setGraph,
  appendGraphDataset,
  setLoading,
  setAnomalyData,
  setAnomalyLoading,
  setBaselineData,
  setAnomalyStats,
} from './actions';

export const fetchColumns = () => async dispatch => {
  try {
    const response = await axios.get('http://localhost:5000/columns');
    const options = response.data.map(column => ({
      label: column,
      value: column,
    }));
    dispatch(addColumns(options));
  } catch (error) {
    console.error('Error fetching columns:', error);
  }
};

export const fetchData = ({ column, startDate, startTime, endDate, endTime, append = false }) => async dispatch => {
  if (column) {
    dispatch(setLoading(true));
    const startDateTime = `${startDate.format('YYYY-MM-DD')} ${startTime.format('HH:mm')}`;
    const endDateTime = `${endDate.format('YYYY-MM-DD')} ${endTime.format('HH:mm')}`;

    try {
      const response = await axios.get('http://localhost:5000/data', {
        params: {
          column: column.value,
          start_date: startDateTime,
          end_date: endDateTime,
        },
      });

      const rawData = response.data;
      if (rawData.error || !rawData.x || !rawData.y) {
        console.error('Error fetching data:', rawData.error || 'Invalid data format');
        dispatch(setLoading(false));
        return;
      }

      const downsampledData = {
        x: rawData.x.map(x => new Date(x).toISOString().slice(0, 16).replace('T', ' ')),
        y: rawData.y,
        movingAverage: rawData.movingAverage || null
      };

      const dataset = {
        data: downsampledData,
        startDate: startDateTime,
        endDate: endDateTime,
        columnName: column.label,
      };

      if (append) {
        dispatch(appendGraphDataset(dataset));
      } else {
        dispatch(setGraph(dataset));
      }

      dispatch(setLoading(false));
    } catch (error) {
      console.error('Error fetching data:', error);
      dispatch(setLoading(false));
    }
  }
};

// NEW: Anomaly Detection Thunks
export const fetchAnomalyData = ({ column, startDate, startTime, endDate, endTime, excludeRanges = [] }) => async dispatch => {
  if (column) {
    dispatch(setAnomalyLoading(true));
    const startDateTime = `${startDate.format('YYYY-MM-DD')} ${startTime.format('HH:mm')}`;
    const endDateTime = `${endDate.format('YYYY-MM-DD')} ${endTime.format('HH:mm')}`;

    try {
      const params = {
        column: column.value,
        start_date: startDateTime,
        end_date: endDateTime,
        resample_points: 2000,
      };

      // Add exclude ranges if any
      if (excludeRanges.length > 0) {
        params.exclude_ranges = JSON.stringify(excludeRanges);
      }

      // Fetch anomaly detection data from main server
      const response = await axios.get('http://localhost:5000/anomaly-detection', { params });

      if (response.data.success) {
        dispatch(setAnomalyData(response.data));
        dispatch(setAnomalyStats(response.data.metadata));
      } else {
        console.error('Anomaly detection failed:', response.data.error);
      }

      dispatch(setAnomalyLoading(false));
    } catch (error) {
      console.error('Error fetching anomaly data:', error);
      dispatch(setAnomalyLoading(false));
    }
  }
};

export const fetchBaselineData = ({ column, startDate, startTime, endDate, endTime, excludeRanges = [] }) => async dispatch => {
  if (column) {
    const startDateTime = `${startDate.format('YYYY-MM-DD')} ${startTime.format('HH:mm')}`;
    const endDateTime = `${endDate.format('YYYY-MM-DD')} ${endTime.format('HH:mm')}`;

    try {
      const params = {
        column: column.value,
        start_date: startDateTime,
        end_date: endDateTime,
        percentiles: '5,10,15,85,90,95',
      };

      if (excludeRanges.length > 0) {
        params.exclude_ranges = JSON.stringify(excludeRanges);
      }

      const response = await axios.get('http://localhost:5000/baseline-detection', { params });

      if (response.data.success) {
        dispatch(setBaselineData(response.data));
      }
    } catch (error) {
      console.error('Error fetching baseline data:', error);
    }
  }
};
