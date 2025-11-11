import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  setAnomalyDetectionMode
} from './actions';
import { fetchAnomalyData, fetchBaselineData } from './thunks';
import './AnomalyDetection.css';

const AnomalyDetection = () => {
  const dispatch = useDispatch();

  const {
    anomalyDetection,
    selectedColumn,
    tempStartDate,
    tempStartTime,
    tempEndDate,
    tempEndTime,
  } = useSelector(state => ({
    anomalyDetection: state.anomalyDetection,
    selectedColumn: state.selectedColumn,
    tempStartDate: state.tempStartDate,
    tempStartTime: state.tempStartTime,
    tempEndDate: state.tempEndDate,
    tempEndTime: state.tempEndTime,
  }));

  const handleToggleAnomalyDetection = () => {
    const newMode = !anomalyDetection.isEnabled;
    dispatch(setAnomalyDetectionMode(newMode));
    
    if (newMode && selectedColumn) {
      // Fetch anomaly data when enabling
      dispatch(fetchAnomalyData({
        column: selectedColumn,
        startDate: { format: () => tempStartDate },
        startTime: { format: () => tempStartTime },
        endDate: { format: () => tempEndDate },
        endTime: { format: () => tempEndTime },
        excludeRanges: anomalyDetection.excludeRanges,
      }));
      
      // Also fetch baseline data
      dispatch(fetchBaselineData({
        column: selectedColumn,
        startDate: { format: () => tempStartDate },
        startTime: { format: () => tempStartTime },
        endDate: { format: () => tempEndDate },
        endTime: { format: () => tempEndTime },
        excludeRanges: anomalyDetection.excludeRanges,
      }));
    }
  };

  const handleRunDetection = () => {
    if (selectedColumn) {
      dispatch(fetchAnomalyData({
        column: selectedColumn,
        startDate: { format: () => tempStartDate },
        startTime: { format: () => tempStartTime },
        endDate: { format: () => tempEndDate },
        endTime: { format: () => tempEndTime },
        excludeRanges: anomalyDetection.excludeRanges,
      }));
    }
  };

  return (
    <div className="anomaly-detection-panel">
      <div className="anomaly-header">
        <h3>Anomaly Analysis</h3>
        <button 
          onClick={anomalyDetection.isEnabled ? handleRunDetection : handleToggleAnomalyDetection}
          className="run-btn"
          disabled={anomalyDetection.loading || !selectedColumn}
        >
          {anomalyDetection.loading ? 'Running...' : 
           anomalyDetection.isEnabled ? 'Run Detection' : 'Enable Analysis'}
        </button>
      </div>

      {anomalyDetection.isEnabled && (
        <>
          {/* Data Statistics */}
          {anomalyDetection.data && (
            <div className="advanced-stats">
              <h5>Data Statistics</h5>
              <div className="stats-grid">
                {/* Dataset Characteristics */}
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.stats?.dataPoints?.toLocaleString() || 'N/A'}</div>
                  <div className="stat-label">Data Points</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.advancedStats?.minValue?.toFixed(2)}°C</div>
                  <div className="stat-label">Minimum</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.advancedStats?.maxValue?.toFixed(2)}°C</div>
                  <div className="stat-label">Maximum</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.mean?.toFixed(2)}°C</div>
                  <div className="stat-label">Mean</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.median?.toFixed(2)}°C</div>
                  <div className="stat-label">Median</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.std?.toFixed(2)}°C</div>
                  <div className="stat-label">Std Deviation</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.mad?.toFixed(2)}°C</div>
                  <div className="stat-label">MAD</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.advancedStats?.range?.toFixed(2)}°C</div>
                  <div className="stat-label">Range</div>
                </div>
                {/* Baseline Values - moved here after Range */}
                {anomalyDetection.data.baseline && (
                  <>
                    <div className="stat-card">
                      <div className="stat-value">{anomalyDetection.data.baseline.percentile10th?.value?.toFixed(2)}°C</div>
                      <div className="stat-label">Lower Baseline</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{anomalyDetection.data.baseline.percentile90th?.value?.toFixed(2)}°C</div>
                      <div className="stat-label">Upper Baseline</div>
                    </div>
                  </>
                )}
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.advancedStats?.skewness?.toFixed(3)}</div>
                  <div className="stat-label">Skewness</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.advancedStats?.kurtosis?.toFixed(3)}</div>
                  <div className="stat-label">Kurtosis</div>
                </div>
                {/* Advanced Statistics */}
                <div className="stat-card">
                  <div className="stat-value">{(anomalyDetection.data.advancedStats?.trendSlope > 0 ? '+' : '') + anomalyDetection.data.advancedStats?.trendSlope?.toFixed(4)}</div>
                  <div className="stat-label">Trend Slope</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.advancedStats?.autocorrelation?.toFixed(3)}</div>
                  <div className="stat-label">Autocorrelation</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.advancedStats?.trendRSquared?.toFixed(3)}</div>
                  <div className="stat-label">R² (Trend)</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.advancedStats?.trendDirection}</div>
                  <div className="stat-label">Trend Direction</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.advancedStats?.trendSignificance}</div>
                  <div className="stat-label">Trend Significance</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.advancedStats?.coefficientOfVariation?.toFixed(1)}%</div>
                  <div className="stat-label">Coeff. of Variation</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.advancedStats?.mae?.toFixed(2)}</div>
                  <div className="stat-label">MAE</div>
                </div>
                {/* Anomaly Counts */}
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.stats?.anomalyCount || 0}</div>
                  <div className="stat-label">Total Anomalies</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.stats?.anomalyPercentage || '0'}%</div>
                  <div className="stat-label">Anomaly Rate</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.meanAnomalyCount || 0}</div>
                  <div className="stat-label">Mean Anomalies</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.stdAnomalyCount || 0}</div>
                  <div className="stat-label">Std Anomalies</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{anomalyDetection.data.madAnomalyCount || 0}</div>
                  <div className="stat-label">MAD Anomalies</div>
                </div>
              </div>
            </div>
          )}




        </>
      )}
    </div>
  );
};

export default AnomalyDetection;
