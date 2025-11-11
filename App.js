import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Select from 'react-select';
import Datetime from 'react-datetime';
import moment from 'moment';
import 'react-datetime/css/react-datetime.css';
import './App.css';
import useScreenSize from './useScreenSize';
import PlotlyChart from './PlotlyChart';
import AnomalyDetection from './AnomalyDetection';
import { fetchColumns, fetchData, fetchAnomalyData, fetchBaselineData } from './thunks';
import {
  setSelectedColumn,
  setTempStartDate,
  setTempStartTime,
  setTempEndDate,
  setTempEndTime,
  addExcludeRange,
  removeExcludeRange
} from './actions';

const App = () => {
  const dispatch = useDispatch();
  const [excludeStartDate, setExcludeStartDate] = useState('');
  const [excludeStartTime, setExcludeStartTime] = useState('');
  const [excludeEndDate, setExcludeEndDate] = useState('');
  const [excludeEndTime, setExcludeEndTime] = useState('');

  const {
    columns,
    selectedColumn,
    graph,
    tempStartDate,
    tempStartTime,
    tempEndDate,
    tempEndTime,
    loading,
    anomalyDetection
  } = useSelector(state => ({
    columns: state.columns,
    selectedColumn: state.selectedColumn,
    graph: state.graph,
    tempStartDate: state.tempStartDate,
    tempStartTime: state.tempStartTime,
    tempEndDate: state.tempEndDate,
    tempEndTime: state.tempEndTime,
    loading: state.loading,
    anomalyDetection: state.anomalyDetection
  }));

  const screenSize = useScreenSize();

  useEffect(() => {
    dispatch(fetchColumns());
  }, [dispatch]);

  const handleFetchData = (append = false) => {
    if (!selectedColumn) return;

    dispatch(fetchData({
      column: selectedColumn,
      startDate: moment(tempStartDate, 'YYYY-MM-DD'),
      startTime: moment(tempStartTime, 'HH:mm'),
      endDate: moment(tempEndDate, 'YYYY-MM-DD'),
      endTime: moment(tempEndTime, 'HH:mm'),
      append
    }));
  };

  const handleRelayout = (newLayout) => {
    const newStartDate = newLayout['xaxis.range[0]'];
    const newEndDate = newLayout['xaxis.range[1]'];

    if (newStartDate && newEndDate) {
      const formattedStartDate = moment(newStartDate).format('YYYY-MM-DD');
      const formattedStartTime = moment(newStartDate).format('HH:mm');
      const formattedEndDate = moment(newEndDate).format('YYYY-MM-DD');
      const formattedEndTime = moment(newEndDate).format('HH:mm');

      // Update the date/time state to reflect the new selection
      dispatch(setTempStartDate(formattedStartDate));
      dispatch(setTempStartTime(formattedStartTime));
      dispatch(setTempEndDate(formattedEndDate));
      dispatch(setTempEndTime(formattedEndTime));

      // Update the main data
      dispatch(fetchData({
        column: selectedColumn,
        startDate: moment(newStartDate).format('YYYY-MM-DD HH:mm'),
        endDate: moment(newEndDate).format('YYYY-MM-DD HH:mm'),
      }));

      // If anomaly detection is enabled, also re-run anomaly detection for the new range
      if (anomalyDetection.isEnabled && selectedColumn) {
        console.log('Auto-rerunning anomaly detection for selected range:', formattedStartDate, 'to', formattedEndDate);
        
        dispatch(fetchAnomalyData({
          column: selectedColumn,
          startDate: { format: () => formattedStartDate },
          startTime: { format: () => formattedStartTime },
          endDate: { format: () => formattedEndDate },
          endTime: { format: () => formattedEndTime },
          excludeRanges: anomalyDetection.excludeRanges || [],
        }));

        dispatch(fetchBaselineData({
          column: selectedColumn,
          startDate: { format: () => formattedStartDate },
          startTime: { format: () => formattedStartTime },
          endDate: { format: () => formattedEndDate },
          endTime: { format: () => formattedEndTime },
          excludeRanges: anomalyDetection.excludeRanges || [],
        }));
      }
    }
  };

  const handleAddExcludeRange = (startDateTime = null, endDateTime = null) => {
    let start, end;
    
    if (startDateTime && endDateTime) {
      // Called from graph selection
      start = startDateTime;
      end = endDateTime;
    } else {
      // Called from form
      if (excludeStartDate && excludeStartTime && excludeEndDate && excludeEndTime) {
        start = `${excludeStartDate}T${excludeStartTime}`;
        end = `${excludeEndDate}T${excludeEndTime}`;
      } else {
        return; // Invalid form data
      }
    }

    const excludeRange = { start, end };
    dispatch(addExcludeRange(excludeRange));
    
    // Re-run anomaly detection if it's enabled and we have a selected column
    if (anomalyDetection.isEnabled && selectedColumn) {
      console.log('Re-running anomaly detection with updated exclusions');
      dispatch(fetchAnomalyData({
        column: selectedColumn,
        startDate: { format: () => tempStartDate },
        startTime: { format: () => tempStartTime },
        endDate: { format: () => tempEndDate },
        endTime: { format: () => tempEndTime },
        excludeRanges: [...(anomalyDetection.excludeRanges || []), excludeRange],
      }));

      dispatch(fetchBaselineData({
        column: selectedColumn,
        startDate: { format: () => tempStartDate },
        startTime: { format: () => tempStartTime },
        endDate: { format: () => tempEndDate },
        endTime: { format: () => tempEndTime },
        excludeRanges: [...(anomalyDetection.excludeRanges || []), excludeRange],
      }));
    }
    
    // Clear form only if called from form
    if (!startDateTime && !endDateTime) {
      setExcludeStartDate('');
      setExcludeStartTime('');
      setExcludeEndDate('');
      setExcludeEndTime('');
    }
  };

  const handleRemoveExcludeRange = (index) => {
    dispatch(removeExcludeRange(index));
    
    // Re-run anomaly detection if it's enabled and we have a selected column
    if (anomalyDetection.isEnabled && selectedColumn) {
      const updatedExcludeRanges = anomalyDetection.excludeRanges.filter((_, i) => i !== index);
      
      console.log('Re-running anomaly detection after removing exclusion');
      dispatch(fetchAnomalyData({
        column: selectedColumn,
        startDate: { format: () => tempStartDate },
        startTime: { format: () => tempStartTime },
        endDate: { format: () => tempEndDate },
        endTime: { format: () => tempEndTime },
        excludeRanges: updatedExcludeRanges,
      }));

      dispatch(fetchBaselineData({
        column: selectedColumn,
        startDate: { format: () => tempStartDate },
        startTime: { format: () => tempStartTime },
        endDate: { format: () => tempEndDate },
        endTime: { format: () => tempEndTime },
        excludeRanges: updatedExcludeRanges,
      }));
    }
  };

  return (
    <div className={`app-container ${screenSize}`}>
      <h1 style={{ fontSize: '2em' }}>Time Series Dashboard</h1>

      <div className="controls">
        <Select
          options={columns}
          onChange={option => dispatch(setSelectedColumn(option))}
          placeholder="Select a Sensor"
          styles={{
            container: (provided) => ({ ...provided, width: '100%' }),
            control: (provided) => ({ ...provided, height: '55px' }),
            singleValue: (provided) => ({ ...provided, fontSize: '1.2em' }),
            menu: (provided) => ({ ...provided, fontSize: '1.2em' }),
            placeholder: (provided) => ({ ...provided, fontSize: '1.2em' }),
          }}
        />
        <div className="datetime-container">
          <label style={{ fontSize: '1.1em' }}>
            Start Date:
            <Datetime
              value={moment(tempStartDate, 'YYYY-MM-DD')}
              onChange={date => dispatch(setTempStartDate(moment(date)))}
              dateFormat="YYYY-MM-DD"
              timeFormat={false}
            />
          </label>
          <label style={{ fontSize: '1.1em' }}>
            Start Time:
            <Datetime
              value={moment(tempStartTime, 'HH:mm')}
              onChange={time => dispatch(setTempStartTime(moment(time)))}
              dateFormat={false}
              timeFormat="HH:mm"
            />
          </label>
          <label style={{ fontSize: '1.1em' }}>
            End Date:
            <Datetime
              value={moment(tempEndDate, 'YYYY-MM-DD')}
              onChange={date => dispatch(setTempEndDate(moment(date)))}
              dateFormat="YYYY-MM-DD"
              timeFormat={false}
            />
          </label>
          <label style={{ fontSize: '1.1em' }}>
            End Time:
            <Datetime
              value={moment(tempEndTime, 'HH:mm')}
              onChange={time => dispatch(setTempEndTime(moment(time)))}
              dateFormat={false}
              timeFormat="HH:mm"
            />
          </label>
        </div>
        <div className="button-group" style={{ display: 'flex', gap: '10px' }}>
          <button style={{ fontSize: '1.1em' }} onClick={() => handleFetchData(false)}>Fetch data</button>
          <button style={{ fontSize: '1.1em' }} onClick={() => handleFetchData(true)}>Compare data</button>
        </div>

        {/* Exclude Ranges Section */}
        <div className="exclude-ranges-section" style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
          <h4 style={{ margin: '0 0 15px 0', fontSize: '1.2em' }}>Exclude Time Periods (for Anomaly Analysis)</h4>
          <div className="exclude-form">
            <div className="form-row" style={{ display: 'flex', gap: '10px', alignItems: 'end', flexWrap: 'wrap' }}>
              <div className="input-group">
                <label htmlFor="excludeStartDate" style={{ display: 'block', marginBottom: '5px', fontSize: '1em' }}>Begin Date:</label>
                <input
                  id="excludeStartDate"
                  type="date"
                  value={excludeStartDate}
                  onChange={(e) => setExcludeStartDate(e.target.value)}
                  style={{ padding: '8px', fontSize: '1em', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div className="input-group">
                <label htmlFor="excludeStartTime" style={{ display: 'block', marginBottom: '5px', fontSize: '1em' }}>Begin Time:</label>
                <input
                  id="excludeStartTime"
                  type="time"
                  value={excludeStartTime}
                  onChange={(e) => setExcludeStartTime(e.target.value)}
                  style={{ padding: '8px', fontSize: '1em', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div className="input-group">
                <label htmlFor="excludeEndDate" style={{ display: 'block', marginBottom: '5px', fontSize: '1em' }}>End Date:</label>
                <input
                  id="excludeEndDate"
                  type="date"
                  value={excludeEndDate}
                  onChange={(e) => setExcludeEndDate(e.target.value)}
                  style={{ padding: '8px', fontSize: '1em', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <div className="input-group">
                <label htmlFor="excludeEndTime" style={{ display: 'block', marginBottom: '5px', fontSize: '1em' }}>End Time:</label>
                <input
                  id="excludeEndTime"
                  type="time"
                  value={excludeEndTime}
                  onChange={(e) => setExcludeEndTime(e.target.value)}
                  style={{ padding: '8px', fontSize: '1em', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              <button 
                onClick={handleAddExcludeRange} 
                style={{ 
                  fontSize: '1.1em',
                  padding: '8px 16px',
                  height: 'fit-content'
                }}
              >
                Add Exclude Range
              </button>
            </div>
          </div>

          {/* Display current exclude ranges */}
          {anomalyDetection.excludeRanges && anomalyDetection.excludeRanges.length > 0 && (
            <div className="exclude-ranges-list" style={{ marginTop: '15px' }}>
              <h5 style={{ margin: '0 0 10px 0', fontSize: '1.1em' }}>Current Exclusions:</h5>
              {anomalyDetection.excludeRanges.map((range, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '8px 12px', 
                  margin: '5px 0', 
                  backgroundColor: '#f8f9fa', 
                  border: '1px solid #e9ecef', 
                  borderRadius: '4px' 
                }}>
                  <span style={{ fontSize: '1em' }}>{range.start} → {range.end}</span>
                  <button 
                    onClick={() => handleRemoveExcludeRange(index)}
                    style={{ 
                      fontSize: '1.1em',
                      padding: '4px 8px'
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Anomaly Detection Panel */}
      <AnomalyDetection />

      {graph && graph.datasets && graph.datasets.length > 0 && (
        <PlotlyChart
          datasets={graph.datasets}
          startDate={graph.startDate}
          endDate={graph.endDate}
          onRelayout={handleRelayout}
          anomalyData={anomalyDetection.data}
          anomalyEnabled={anomalyDetection.isEnabled}
          baselineData={anomalyDetection.baselineData}
          excludeRanges={anomalyDetection.excludeRanges}
          onAddExcludeRange={handleAddExcludeRange}
        />
      )}

      {loading && <div className="loading-circle"></div>}
    </div>
  );
};

export default App;

