import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import axios from 'axios';
import { useSelector } from 'react-redux';

const colors = ['#87CEEB', '#FF7F50', '#32CD32', '#FFD700', '#BA55D3'];

const PlotlyChart = ({ datasets, startDate, endDate, onRelayout }) => {
  const [loading, setLoading] = useState(false);
  const [resampledData, setResampledData] = useState({});
  const [resampleStartDate, setResampleStartDate] = useState(startDate);
  const [resampleEndDate, setResampleEndDate] = useState(endDate);

  // Get anomaly detection data from Redux store
  const { anomalyDetection } = useSelector(state => ({
    anomalyDetection: state.anomalyDetection,
  }));

  const fetchResampledData = (start, end, columnName) => {
    setLoading(true);
    axios
      .get('http://localhost:5000/data', {
        params: {
          column: columnName,
          start_date: start,
          end_date: end,
        },
      })
      .then((response) => {
        const rawData = response.data;
        if (!rawData || !rawData.x || !rawData.y) {
          console.error('Invalid data format:', rawData);
          setLoading(false);
          return;
        }

        setResampledData((prevData) => ({
          ...prevData,
          [columnName]: {
            x: rawData.x,
            y: rawData.y,
          },
        }));
        setResampleStartDate(start);
        setResampleEndDate(end);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
        setLoading(false);
      });
  };

  const handleRelayout = (event) => {
    if (event['xaxis.range[0]'] && event['xaxis.range[1]']) {
      const newStartDate = new Date(event['xaxis.range[0]']).toISOString();
      const newEndDate = new Date(event['xaxis.range[1]']).toISOString();

      datasets.forEach((ds) => {
        fetchResampledData(newStartDate, newEndDate, ds.columnName);
      });
    }
  };

  useEffect(() => {
    setResampledData({});
  }, [datasets, startDate, endDate]);

  // Function to wrap long sensor names for better display
  const wrapSensorName = (name, maxLength = 25) => {
    if (name.length <= maxLength) return name;
    
    // Try to break at common separators
    const separators = [' - ', '_', ' '];
    for (const sep of separators) {
      const parts = name.split(sep);
      if (parts.length > 1) {
        let line1 = parts[0];
        let line2 = parts.slice(1).join(sep);
        
        // Adjust if first line is too short or second line is too long
        if (line1.length < 10 && parts.length > 2) {
          line1 = parts.slice(0, 2).join(sep);
          line2 = parts.slice(2).join(sep);
        }
        
        if (line2.length > maxLength) {
          line2 = line2.substring(0, maxLength - 3) + '...';
        }
        
        return `${line1}<br>${line2}`;
      }
    }
    
    // Fallback: split at roughly half point
    const midPoint = Math.floor(name.length / 2);
    return `${name.substring(0, midPoint)}<br>${name.substring(midPoint)}`;
  };

  // Function to calculate moving average for resampled data
  const calculateMovingAverage = (data, windowSize = 10) => {
    if (!data || !data.x || !data.y || data.x.length < windowSize) {
      return { x: [], y: [] };
    }
    const movingAvgX = [];
    const movingAvgY = [];
    for (let i = windowSize - 1; i < data.y.length; i++) {
      let sum = 0;
      for (let j = i - windowSize + 1; j <= i; j++) {
        sum += data.y[j];
      }
      const avg = sum / windowSize;
      movingAvgX.push(data.x[i]);
      movingAvgY.push(avg);
    }
    return { x: movingAvgX, y: movingAvgY };
  };

  // Generate main data traces
  const traces = datasets.map((ds, index) => {
    const data = resampledData[ds.columnName] || ds.data;
    
    return {
      x: data.x,
      y: data.y,
      name: 'Resampled Sensor Data',
      type: 'scatter',
      mode: 'lines+markers',
      marker: { color: colors[index % colors.length], size: 2.5 },
      line: { width: 2, color: colors[index % colors.length] },
      yaxis: index === 1 ? 'y2' : 'y',
      hovertemplate: `<b>${ds.columnName}</b><br>` +
                    `Time: %{x}<br>` +
                    `Value: %{y:.2f}°C<extra></extra>`,
    };
  });

  // Add moving average traces for resampled data
  datasets.forEach((ds, index) => {
    const data = resampledData[ds.columnName] || ds.data;
    if (data && data.x && data.y && data.x.length > 10) {
      const movingAvg = calculateMovingAverage(data, 10);
      if (movingAvg.x.length > 0) {
        traces.push({
          x: movingAvg.x,
          y: movingAvg.y,
          name: 'Resampled Moving Average',
          type: 'scatter',
          mode: 'lines',
          line: { 
            color: '#003366', 
            width: 3, 
            dash: 'solid',
            opacity: 0.8 
          },
          yaxis: index === 1 ? 'y2' : 'y',
          hovertemplate: `<b>${ds.columnName} Moving Average</b><br>` +
                        `Time: %{x}<br>` +
                        `MA(10): %{y:.2f}°C<br>` +
                        `Window: 10 points<extra></extra>`,
        });
      }
    }
  });

  // Add anomaly detection traces if enabled
  if (anomalyDetection.isEnabled && anomalyDetection.data) {
    const anomalyData = anomalyDetection.data;

    // Add ALL baseline lines 
    if (anomalyData.baseline) {
      const baselineX = [anomalyData.originalData.x[0], anomalyData.originalData.x[anomalyData.originalData.x.length - 1]];
      
      // 5th percentile (very conservative)
      if (anomalyData.baseline.percentile5th) {
        traces.push({
          x: baselineX,
          y: [anomalyData.baseline.percentile5th.value, anomalyData.baseline.percentile5th.value],
          type: 'scatter',
          mode: 'lines',
          name: `5th %ile (${anomalyData.baseline.percentile5th.value.toFixed(2)}°C)`,
          line: { color: '#17a2b8', width: 2, dash: 'dot' },
          yaxis: 'y',
          hovertemplate: `<b>5th Percentile: ${anomalyData.baseline.percentile5th.value.toFixed(2)}°C</b><br>` +
                        `Extreme low temperature detection threshold<extra></extra>`,
        });
      }
      
      // 10th percentile baseline (recommended lower)
      if (anomalyData.baseline.percentile10th) {
        traces.push({
          x: baselineX,
          y: [anomalyData.baseline.percentile10th.value, anomalyData.baseline.percentile10th.value],
          type: 'scatter',
          mode: 'lines',
          name: `10th %ile (${anomalyData.baseline.percentile10th.value.toFixed(2)}°C)`,
          line: { color: '#dc3545', width: 4, dash: 'dash' },
          yaxis: 'y',
          hovertemplate: `<b>10th Percentile: ${anomalyData.baseline.percentile10th.value.toFixed(2)}°C</b><br>` +
                        `Shutdown/idle detection threshold<extra></extra>`,
        });
      }

      // 15th percentile (more inclusive)
      if (anomalyData.baseline.percentile15th) {
        traces.push({
          x: baselineX,
          y: [anomalyData.baseline.percentile15th.value, anomalyData.baseline.percentile15th.value],
          type: 'scatter',
          mode: 'lines',
          name: `15th %ile (${anomalyData.baseline.percentile15th.value.toFixed(2)}°C)`,
          line: { color: '#ffc107', width: 2, dash: 'dashdot' },
          yaxis: 'y',
          hovertemplate: `<b>15th Percentile: ${anomalyData.baseline.percentile15th.value.toFixed(2)}°C</b><br>` +
                        `Low operation detection threshold<extra></extra>`,
        });
      }

      // 85th percentile (upper baseline start)
      if (anomalyData.baseline.percentile85th) {
        traces.push({
          x: baselineX,
          y: [anomalyData.baseline.percentile85th.value, anomalyData.baseline.percentile85th.value],
          type: 'scatter',
          mode: 'lines',
          name: `85th %ile (${anomalyData.baseline.percentile85th.value.toFixed(2)}°C)`,
          line: { color: '#fd7e14', width: 2, dash: 'dashdot' },
          yaxis: 'y',
          hovertemplate: `<b>85th Percentile: ${anomalyData.baseline.percentile85th.value.toFixed(2)}°C</b><br>` +
                        `High operation detection threshold<extra></extra>`,
        });
      }

      // 90th percentile baseline (recommended upper)
      if (anomalyData.baseline.percentile90th) {
        traces.push({
          x: baselineX,
          y: [anomalyData.baseline.percentile90th.value, anomalyData.baseline.percentile90th.value],
          type: 'scatter',
          mode: 'lines',
          name: `90th %ile (${anomalyData.baseline.percentile90th.value.toFixed(2)}°C)`,
          line: { color: '#800000', width: 4, dash: 'dash' },
          yaxis: 'y',
          hovertemplate: `<b>90th Percentile: ${anomalyData.baseline.percentile90th.value.toFixed(2)}°C</b><br>` +
                        `Overheating/high load detection threshold<extra></extra>`,
        });
      }

      // 95th percentile (very high threshold)
      if (anomalyData.baseline.percentile95th) {
        traces.push({
          x: baselineX,
          y: [anomalyData.baseline.percentile95th.value, anomalyData.baseline.percentile95th.value],
          type: 'scatter',
          mode: 'lines',
          name: `95th %ile (${anomalyData.baseline.percentile95th.value.toFixed(2)}°C)`,
          line: { color: '#6f42c1', width: 2, dash: 'dot' },
          yaxis: 'y',
          hovertemplate: `<b>95th Percentile: ${anomalyData.baseline.percentile95th.value.toFixed(2)}°C</b><br>` +
                        `Extreme high temperature detection threshold<extra></extra>`,
        });
      }
    }

    // Add median line
    if (anomalyData.median !== undefined) {
      const baselineX = [anomalyData.originalData.x[0], anomalyData.originalData.x[anomalyData.originalData.x.length - 1]];
      traces.push({
        x: baselineX,
        y: [anomalyData.median, anomalyData.median],
        type: 'scatter',
        mode: 'lines',
        name: `Median (${anomalyData.median.toFixed(2)}°C)`,
        line: { color: '#28a745', width: 3, dash: 'solid' },
        yaxis: 'y',
        hovertemplate: `<b>Median: ${anomalyData.median.toFixed(2)}°C</b><br>` +
                      `Middle value of all sensor readings<extra></extra>`,
      });
    }

    // Add anomaly points
    if (anomalyData.meanAnomalies && anomalyData.meanAnomalies.length > 0) {
      traces.push({
        x: anomalyData.meanAnomalies.map(a => a.timestamp),
        y: anomalyData.meanAnomalies.map(a => a.value),
        type: 'scatter',
        mode: 'markers',
        name: `Mean Anomalies (${anomalyData.meanAnomalyCount})`,
        marker: { color: '#FF0000', size: 8, symbol: 'circle' },
        yaxis: 'y',
        hovertemplate: `<b>Mean Anomaly</b><br>` +
                      `Time: %{x}<br>` +
                      `Value: %{y:.2f}°C<br>` +
                      `Detected by mean-based algorithm<extra></extra>`,
      });
    }

    if (anomalyData.stdAnomalies && anomalyData.stdAnomalies.length > 0) {
      traces.push({
        x: anomalyData.stdAnomalies.map(a => a.timestamp),
        y: anomalyData.stdAnomalies.map(a => a.value),
        type: 'scatter',
        mode: 'markers',
        name: `Std Anomalies (${anomalyData.stdAnomalyCount})`,
        marker: { color: '#FFA500', size: 8, symbol: 'circle' },
        yaxis: 'y',
        hovertemplate: `<b>Standard Deviation Anomaly</b><br>` +
                      `Time: %{x}<br>` +
                      `Value: %{y:.2f}°C<br>` +
                      `Detected by standard deviation algorithm<extra></extra>`,
      });
    }

    if (anomalyData.madAnomalies && anomalyData.madAnomalies.length > 0) {
      traces.push({
        x: anomalyData.madAnomalies.map(a => a.timestamp),
        y: anomalyData.madAnomalies.map(a => a.value),
        type: 'scatter',
        mode: 'markers',
        name: `MAD Anomalies (${anomalyData.madAnomalyCount})`,
        marker: { color: '#8A2BE2', size: 8, symbol: 'circle' },
        yaxis: 'y',
        hovertemplate: `<b>MAD Anomaly</b><br>` +
                      `Time: %{x}<br>` +
                      `Value: %{y:.2f}°C<br>` +
                      `Detected by Median Absolute Deviation algorithm<extra></extra>`,
      });
    }

    // Add trend line if available
    if (anomalyData.advancedStats && anomalyData.advancedStats.trendRSquared !== undefined) {
      const dataLength = anomalyData.originalData.x.length;
      const startTime = anomalyData.originalData.x[0];
      const endTime = anomalyData.originalData.x[dataLength - 1];
      const xMean = (dataLength - 1) / 2;
      
      const trendStartY = anomalyData.mean + anomalyData.advancedStats.trendSlope * (0 - xMean);
      const trendEndY = anomalyData.mean + anomalyData.advancedStats.trendSlope * ((dataLength - 1) - xMean);
      
      traces.push({
        x: [startTime, endTime],
        y: [trendStartY, trendEndY],
        type: 'scatter',
        mode: 'lines',
        name: `Trend (R²=${anomalyData.advancedStats.trendRSquared.toFixed(3)})`,
        line: { color: '#fd7e14', width: 3, dash: 'solid' },
        yaxis: 'y',
        hovertemplate: `<b>Trend Line</b><br>` +
                      `R-squared: ${anomalyData.advancedStats.trendRSquared.toFixed(3)}<br>` +
                      `Direction: ${anomalyData.advancedStats.trendDirection}<br>` +
                      `Strength: ${anomalyData.advancedStats.trendStrength}<extra></extra>`,
      });
    }
  }

  // Create layout shapes for exclusion ranges (red background)
  const layoutShapes = [];
  if (anomalyDetection.isEnabled && anomalyDetection.excludeRanges && anomalyDetection.excludeRanges.length > 0) {
    anomalyDetection.excludeRanges.forEach((range, index) => {
      layoutShapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'paper',
        x0: range.start,
        y0: 0,
        x1: range.end,
        y1: 1,
        fillcolor: 'rgba(255, 0, 0, 0.15)',
        line: {
          width: 0,
        },
        layer: 'below',
      });
    });
  }

  return (
    <div className="plotly-chart-container">
      {loading ? (
        <div className="loading-circle"></div>
      ) : (
        <Plot
          data={traces}
          layout={{
            autosize: true,
            title: {
              text: `Sensor: ${datasets.map((ds) => ds.columnName).join(' vs ')}`,
              font: { size: 30, color: '#1a1a1a', family: 'Arial, sans-serif' },
              xref: 'paper',
              x: 0.5,
            },
            shapes: layoutShapes,
            xaxis: {
              title: { 
                text: 'Time', 
                font: { size: 35, color: '#1a1a1a', family: 'Arial, sans-serif' },
                standoff: 1
              },
              type: 'date',
              autorange: true,
              gridcolor: 'rgba(0, 0, 0, 0.3)',
              tickfont: { color: '#1a1a1a', size: 35 },
              nticks: 10,
            },
            yaxis: {
              title: { 
                text: 'Sensor Values', 
                font: { size: 35, color: '#1a1a1a', family: 'Arial, sans-serif' },
                standoff: 10
              },
              tickfont: { color: '#1a1a1a', size: 35 },
              gridcolor: 'rgba(0, 0, 0, 0.3)',
              autorange: true,
            },
            yaxis2: {
              title: { text: 'Sensor Values', font: { size: 35, color: '#1a1a1a', family: 'Arial, sans-serif' } },
              tickfont: { color: '#1a1a1a', size: 35 },
              overlaying: 'y',
              side: 'right',
              showgrid: false,
              autorange: true,
            },
            legend: {
              orientation: 'h',
              x: 0.5,
              y: -0.22,
              xanchor: 'center',
              yanchor: 'top',
              font: { color: '#1a1a1a', size: 21, family: 'Arial, sans-serif', weight: 'bold' },
              bgcolor: 'rgba(240, 248, 255, 0.90)',
              bordercolor: '#000000ff',
              borderwidth: 1,
              itemclick: 'toggleothers',
              itemdoubleclick: 'toggle',
              itemsizing: 'trace',
              tracegroupgap: 12,
              traceorder: 'normal',
              valign: 'middle',
              rowgap: 25,
              itemwidth: 30,
            },
            paper_bgcolor: 'white',
            plot_bgcolor: 'white',
            font: { color: '#1a1a1a', size: 12, family: 'Arial, sans-serif' },
            hoverlabel: {
              font: { size: 18, family: 'Arial, sans-serif', color: '#000000' },
              bgcolor: 'rgba(255, 255, 255, 0.95)',
              bordercolor: '#333333',
              align: 'left'
            },
            margin: {
              l: 125,
              r: 40,
              t: 100,
              b: 350
            },
          }}
          config={{
            displayModeBar: true,
            scrollZoom: false,
            responsive: true,
            toImageButtonOptions: {
              format: 'svg',
              filename: 'sensor_chart',
              scale: 1
            },
            plotlyServerURL: "https://chart-studio.plotly.com"
          }}
          onRelayout={handleRelayout}
          useResizeHandler={true}
          style={{ width: '100%', height: '1000px' }}
        />
      )}
    </div>
  );
};

export default PlotlyChart;
