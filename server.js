// Threshold-based regime change detection: mark start/end of stretches below threshold
function detectThresholdRegimes(values, threshold = 40) {
    const n = values.length;
    const changePoints = [];
    let inLow = false;
    for (let i = 0; i < n; i++) {
        if (!inLow && values[i] < threshold) {
            // Only mark as entering low regime if previous value was >= threshold (or i==0)
            if (i === 0 || values[i - 1] >= threshold) {
                changePoints.push(i);
                inLow = true;
            }
        } else if (inLow && values[i] >= threshold) {
            // Only mark as exiting low regime if previous value was < threshold
            if (i > 0 && values[i - 1] < threshold) {
                changePoints.push(i);
                inLow = false;
            }
        }
    }
    // Only add end if we are still in a low regime at the end
    if (inLow) {
        changePoints.push(n - 1);
    }
    return changePoints;
}
const express = require('express');
const cors = require('cors');
const mssql = require('mssql');
const { resampleData } = require('./resample'); // Import the resampleData function

const SimpleAnomalyDetector = require('./mean_sd_mad.js'); // Anomaly detection class

const app = express();
app.use(cors());

// Database Configuration
const config = {
    user: 'user',
    password: 'password',
    server: 'Company Server', 
    database: 'Company Database',
    options: {
        encrypt: true,
        trustServerCertificate: true,
        port: 1433,
        driver: 'ODBC Driver 17 for SQL Server',
    },
    // Timeout settings for large queries
    requestTimeout: 300000, // 5 minutes in milliseconds
    connectionTimeout: 60000, // 1 minute in milliseconds
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Define the schema name
const schemaName = 'MOD\\ab94071';

// Create a connection pool
const pool = new mssql.ConnectionPool(config);
const poolConnect = pool.connect().catch(err => {
    console.error('Database connection failed: ', err);
    process.exit(1);
});

// Define the table names
const tables = [ 'March_2023_data', 'April_2023_data', 'May_2023_data', 'June_2023_data','July_2023_data', 'August_2023_data', 'September_2023_data', 'October_2023_data',
                 'November_2023_data','December_2023_data','January_2024_data', 'February_2024_data','March_2024_data', 'April_2024_data', 'May_2024_data', 'June_2024_data',
                 'July_2024_data', 'August_2024_data', 'September_2024_data', 'October_2024_data','November_2024_data', 'December_2024_data', 'January_2025_data', 
                 'February_2025_data','March_2025_data', 'April_2025_data', 'May_2025_data'];

const parseTableDate = (tableName) => {
    const [month, year] = tableName.split('_');
    const dateStr = `${month} 1, ${year}`;
    const date = new Date(dateStr);
    return date;
};

// Function to calculate moving average
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

// Get column names from one of the tables since all tables have the same structure
app.get('/columns', function (_, res) {
    poolConnect.then(() => {
        let request = pool.request();
        request.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tables[0]}' AND COLUMN_NAME != 'Date'`, function (err, result) {
            if (err) {
                console.error('Query error: ', err);
                return res.status(500).json({ error: err.message });
            }
            const columns = result.recordset.map(row => row.COLUMN_NAME);
            console.log('Columns:', columns);
            res.json(columns);
        });
    }).catch(err => {
        console.error('Connection error: ', err);
        res.status(500).json({ error: 'Database connection failed' });
    });
});

app.get('/data', function (req, res) {
    const { column, start_date, end_date } = req.query;
    if (!start_date || !end_date) {
        return res.status(400).json({ error: 'Start date and end date are required' });
    }
    console.log(`Fetching data for column: ${column}, start_date: ${start_date}, end_date: ${end_date}`);
    poolConnect.then(async () => {
        try {
            const startDate = new Date(start_date);
            const endDate = new Date(end_date);
            let data = [];
            let startFetchTime = Date.now(), endFetchTime;
            for (const table of tables) {
                const tableStartDate = parseTableDate(table);
                const tableEndDate = new Date(tableStartDate);
                tableEndDate.setMonth(tableEndDate.getMonth() + 1);
                if (startDate <= tableEndDate && endDate >= tableStartDate) {
                    const fullTableName = `[${schemaName}].[${table}]`;
                    const query = `SELECT Date, [${column}] FROM ${fullTableName} WHERE Date BETWEEN @startDate AND @endDate`;
                    const startFetchTime = Date.now();
                    const result = await pool.request()
                        .input('startDate', mssql.DateTime, startDate)
                        .input('endDate', mssql.DateTime, endDate)
                        .query(query);
                    endFetchTime = Date.now();
                    data = data.concat(result.recordset);
                }
            }
            if (data.length > 0) {
                data = data.sort((a, b) => new Date(a.Date) - new Date(b.Date));
                data = data.filter(row => row[column] !== null && row[column] !== 0);
                const resampledArray = resampleData(data, column);
                const responseData = {
                    x: resampledArray.map(row => new Date(row.Date)),
                    y: resampledArray.map(row => row[column])
                };
                const movingAvg10 = calculateMovingAverage(responseData, 10);
                responseData.movingAverage = movingAvg10;
                res.json(responseData);
            } else {
                res.json({ error: 'No data found for the specified date range', x: [], y: [] });
            }
        } catch (err) {
            console.error('Error processing data:', err);
            res.status(500).json({ error: err.message, x: [], y: [] });
        }
    }).catch(err => {
        console.error('Connection error: ', err);
        res.status(500).json({ error: 'Database connection failed' });
    });
});


// Anomaly detection endpoint 
app.get('/anomaly-detection', async (req, res) => {
    try {
        const { 
            column, 
            start_date, 
            end_date, 
            window_size = 50, 
            resample_points = 2000,
            exclude_ranges = ''
        } = req.query;

        if (!column || !start_date || !end_date) {
            return res.status(400).json({ 
                error: 'Column, start_date, and end_date are required' 
            });
        }

        console.log(`Starting anomaly detection for column: ${column}, period: ${start_date} to ${end_date}`);
        
        // Parse exclude ranges
        let excludeRanges = [];
        if (exclude_ranges) {
            try {
                excludeRanges = JSON.parse(exclude_ranges);
            } catch (e) {
                console.log('Failed to parse exclude_ranges, using empty array');
            }
        }

        await poolConnect;
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);

        let data = [];
        let startFetchTime = Date.now(), endFetchTime;
        let totalFetchedCount = 0;
        
        // Fetch data from relevant tables with memory optimization
        for (const table of tables) {
            const tableStartDate = parseTableDate(table);
            const tableEndDate = new Date(tableStartDate);
            tableEndDate.setMonth(tableEndDate.getMonth() + 1);

            if (startDate <= tableEndDate && endDate >= tableStartDate) {
                console.log(`Fetching anomaly data from table: ${table}`);
                const fullTableName = `[${schemaName}].[${table}]`;
                
                // Fetch all data for proper resampling - no TOP limit
                const query = `SELECT Date, [${column}] FROM ${fullTableName} 
                             WHERE Date BETWEEN @startDate AND @endDate 
                             AND [${column}] IS NOT NULL AND [${column}] != 0
                             ORDER BY Date`;
                
                const queryStartTime = Date.now();
                console.log(`Starting query for ${table} at ${new Date().toISOString()}`);
                
                const result = await pool.request()
                    .input('startDate', mssql.DateTime, startDate)
                    .input('endDate', mssql.DateTime, endDate)
                    .query(query);
                
                const queryDuration = Date.now() - queryStartTime;
                console.log(`Fetched ${result.recordset.length} records from ${table} in ${queryDuration}ms`);
                
                // Log date range of fetched data for debugging
                if (result.recordset.length > 0) {
                    const firstDate = new Date(result.recordset[0].Date);
                    const lastDate = new Date(result.recordset[result.recordset.length - 1].Date);
                    console.log(`  Data range: ${firstDate.toISOString()} to ${lastDate.toISOString()}`);
                }
                
                totalFetchedCount += result.recordset.length;
                
                // Process in chunks to avoid memory issues
                data = data.concat(result.recordset);
                
                // Apply early filtering and resampling in case of too much data
                if (data.length > 1000000) {
                    console.log(`Early processing: filtering and resampling ${data.length} points`);
                    
                    // Sort and filter
                    data = data.sort((a, b) => new Date(a.Date) - new Date(b.Date));
                    
                    // Apply exclusions early
                    if (excludeRanges.length > 0) {
                        data = data.filter(row => {
                            const rowTime = new Date(row.Date);
                            return !excludeRanges.some(range => {
                                const rangeStart = new Date(range.start);
                                const rangeEnd = new Date(range.end);
                                return rowTime >= rangeStart && rowTime <= rangeEnd;
                            });
                        });
                    }
                    
                    // Early resampling to reduce memory footprint
                    if (data.length > parseInt(resample_points) * 2) {
                        const tempResampledArray = resampleData(data, column, parseInt(resample_points) * 2);
                        data = tempResampledArray.map(row => ({
                            Date: row.Date,
                            [column]: row[column]
                        }));
                    }
                }
            }
        }
        endFetchTime = Date.now();

        console.log(`Total fetched records: ${totalFetchedCount}, final dataset: ${data.length}`);
        
        // Log final date range for debugging
        if (data.length > 0) {
            data.sort((a, b) => new Date(a.Date) - new Date(b.Date));
            const firstDate = new Date(data[0].Date);
            const lastDate = new Date(data[data.length - 1].Date);
            console.log(`Final data range: ${firstDate.toISOString()} to ${lastDate.toISOString()}`);
        }

        if (data.length < parseInt(window_size) * 2) {
            return res.status(400).json({
                error: `Insufficient data points. Need at least ${parseInt(window_size) * 2} points, but got ${data.length}`,
                success: false
            });
        }

        // Final sort and filter (may already be done in early processing)
        if (!data.every((row, i, arr) => i === 0 || new Date(row.Date) >= new Date(arr[i-1].Date))) {
            data = data.sort((a, b) => new Date(a.Date) - new Date(b.Date));
        }
        
        // Apply exclusions if not already done
        if (excludeRanges.length > 0 && totalFetchedCount === data.length) {
            console.log(`Applying final exclusion of ${excludeRanges.length} time ranges`);
            data = data.filter(row => {
                const rowTime = new Date(row.Date);
                return !excludeRanges.some(range => {
                    const rangeStart = new Date(range.start);
                    const rangeEnd = new Date(range.end);
                    return rowTime >= rangeStart && rowTime <= rangeEnd;
                });
            });
        }

        // Apply resampling 
        let resampledData;
        if (data.length > parseInt(resample_points)) {
            console.log(`[RESAMPLING] Starting stratified resampling: ${data.length} points → ${resample_points} points`);
            const resampledArray = resampleData(data, column, parseInt(resample_points));
            console.log(`[RESAMPLING] Stratified resampling completed: ${resampledArray.length} output points`);
            resampledData = {
                x: resampledArray.map(row => new Date(row.Date)),
                y: resampledArray.map(row => row[column])
            };
            console.log(`[RESAMPLING] Stratified data prepared for analysis: x=${resampledData.x.length}, y=${resampledData.y.length}`);
        } else {
            console.log(`[RESAMPLING] No resampling needed: ${data.length} points ≤ ${resample_points} target`);
            resampledData = {
                x: data.map(row => row.Date),
                y: data.map(row => row[column])
            };
        }

        // Prepare data for anomaly detection
        // Using resampled data for anomaly detection 
        const processedData = resampledData.x.map((date, i) => ({
            timestamp: date,
            value: resampledData.y[i]
        }));
        console.log(`[ANOMALY-DETECTION] Prepared ${processedData.length} stratified data points for anomaly detection`);
        console.log(`[ANOMALY-DETECTION] Original dataset: ${totalFetchedCount} points → Stratified: ${processedData.length} points`);
        console.log(`[ANOMALY-DETECTION] Resampling ratio: ${(processedData.length / totalFetchedCount * 100).toFixed(1)}%`);

       
    // Using stratified resampled data for all statistics and anomaly detection
        console.log(`[STRATIFIED] Starting statistical analysis on stratified/resampled dataset`);
        const statsValues = resampledData.y;
        const statsN = statsValues.length;
        console.log(`[STRATIFIED] Dataset size for statistics: ${statsN} points (stratified from original ${totalFetchedCount})`);
        
        const statsMean = statsValues.reduce((sum, val) => sum + val, 0) / statsN;
        const statsVariance = statsValues.reduce((sum, val) => sum + Math.pow(val - statsMean, 2), 0) / statsN;
        const statsStd = Math.sqrt(statsVariance);
        const statsSortedValues = [...statsValues].sort((a, b) => a - b);
        const statsMedian = statsSortedValues.length % 2 === 0 
            ? (statsSortedValues[statsSortedValues.length / 2 - 1] + statsSortedValues[statsSortedValues.length / 2]) / 2
            : statsSortedValues[Math.floor(statsSortedValues.length / 2)];
        
        console.log(`[STRATIFIED] Basic statistics calculated: Mean=${statsMean.toFixed(2)}, Std=${statsStd.toFixed(2)}, Median=${statsMedian.toFixed(2)}`);
        console.log(`[STRATIFIED] Data range: Min=${Math.min(...statsValues).toFixed(2)}, Max=${Math.max(...statsValues).toFixed(2)}`);
        // Baseline percentiles from stratified data
        console.log(`[STRATIFIED] Calculating baseline percentiles from ${statsSortedValues.length} stratified points`);
        const baseline5th = statsSortedValues[Math.max(0, Math.ceil(0.05 * statsSortedValues.length) - 1)];
        const baseline10th = statsSortedValues[Math.max(0, Math.ceil(0.1 * statsSortedValues.length) - 1)];
        const baseline15th = statsSortedValues[Math.max(0, Math.ceil(0.15 * statsSortedValues.length) - 1)];
        const baseline85th = statsSortedValues[Math.max(0, Math.ceil(0.85 * statsSortedValues.length) - 1)];
        const baseline90th = statsSortedValues[Math.max(0, Math.ceil(0.9 * statsSortedValues.length) - 1)];
        const baseline95th = statsSortedValues[Math.max(0, Math.ceil(0.95 * statsSortedValues.length) - 1)];
        
        // Debug: Print stats and baselines from resampled (stratified) data
        console.log(`[STRATIFIED-STATS] Mean: ${statsMean.toFixed(2)}, Median: ${statsMedian.toFixed(2)}, Std: ${statsStd.toFixed(2)}, N: ${statsN}`);
        console.log(`[STRATIFIED-BASELINES] 5th: ${baseline5th.toFixed(2)}, 10th: ${baseline10th.toFixed(2)}, 15th: ${baseline15th.toFixed(2)}`);
        console.log(`[STRATIFIED-BASELINES] 85th: ${baseline85th.toFixed(2)}, 90th: ${baseline90th.toFixed(2)}, 95th: ${baseline95th.toFixed(2)}`);

        // Use resampled data for TREND ANALYSIS only (not statistics)
    const values = resampledData.y;
    const n = values.length;
    s
    const mean = statsMean;
    const variance = statsVariance;
    const std = statsStd;
    const sortedValues = statsSortedValues;
    const median = statsMedian;
    // Baselines for overlays

        const belowBaseline5th = values.filter(v => v < baseline5th).length;
        const belowBaseline10th = values.filter(v => v < baseline10th).length;
        const belowBaseline15th = values.filter(v => v < baseline15th).length;
        const aboveBaseline85th = values.filter(v => v > baseline85th).length;
        const aboveBaseline90th = values.filter(v => v > baseline90th).length;
        const aboveBaseline95th = values.filter(v => v > baseline95th).length;
        
        console.log(`Baselines - 5th: ${baseline5th.toFixed(2)}°C (${((belowBaseline5th / values.length) * 100).toFixed(1)}% below), 10th: ${baseline10th.toFixed(2)}°C (${((belowBaseline10th / values.length) * 100).toFixed(1)}% below), 15th: ${baseline15th.toFixed(2)}°C (${((belowBaseline15th / values.length) * 100).toFixed(1)}% below)`);

        // Min and Max
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        // Skewness calculation
        const skewness = values.reduce((sum, val) => sum + Math.pow((val - mean) / std, 3), 0) / n;
        // Kurtosis calculation
        const kurtosis = values.reduce((sum, val) => sum + Math.pow((val - mean) / std, 4), 0) / n - 3;
        // Advanced Trend Analysis: Change Point Detection + Segmented Regression
        console.log(`[TREND-ANALYSIS] Starting advanced trend analysis with change point detection...`);
        console.log(`[TREND-ANALYSIS] Using stratified/resampled data: ${resampledData.x.length} points (from original ${totalFetchedCount})`);
        console.log(`[TREND-ANALYSIS] Stratified data date range: ${resampledData.x[0].toISOString()} to ${resampledData.x[resampledData.x.length-1].toISOString()}`);
        // Use resampled (stratified) data for change point detection and trend analysis
        // Binary Segmentation change point detection function

// Helper function for binary segmentation change point detection
function detectChangePointsBinarySegmentation(values, minSegmentSize = Math.max(3, Math.floor(values.length * 0.05)), meanDiffThreshold = 0.15) {
    const n = values.length;
    if (n < minSegmentSize * 2) return [];
    const changePoints = [];
    function segmentSearch(start, end, depth = 0) {
        if (end - start < minSegmentSize * 2) return;
        let bestIdx = -1;
        let bestMeanDiff = 0;
        for (let i = start + minSegmentSize; i <= end - minSegmentSize; i++) {
            const left = values.slice(start, i);
            const right = values.slice(i, end);
            const leftMean = left.reduce((a, b) => a + b, 0) / left.length;
            const rightMean = right.reduce((a, b) => a + b, 0) / right.length;
            const meanDiff = Math.abs(leftMean - rightMean);
            if (meanDiff > bestMeanDiff) {
                bestMeanDiff = meanDiff;
                bestIdx = i;
            }
        }
        // Debug: log best mean diff for this segment
        console.log(`[ChangePoint] Segment [${start},${end}) bestIdx=${bestIdx}, bestMeanDiff=${bestMeanDiff.toFixed(4)}`);
        if (bestIdx !== -1 && bestMeanDiff >= meanDiffThreshold) {
            changePoints.push(bestIdx);
            segmentSearch(start, bestIdx, depth + 1);
            segmentSearch(bestIdx, end, depth + 1);
        }
    }
    segmentSearch(0, n);
    return changePoints.sort((a, b) => a - b).filter(idx => idx >= minSegmentSize && idx <= n - minSegmentSize);
}

// Sliding window mean-difference change point detector
function detectChangePointsSlidingWindow(values, windowSize = 20, meanDiffThreshold = 0.15) {
    const n = values.length;
    const changePoints = [];
    // Use a larger window and higher threshold for your data
    windowSize = Math.max(200, Math.floor(n * 0.1)); // 10% of data or at least 200
    meanDiffThreshold = Math.max(0.7, meanDiffThreshold); // at least 0.7
    for (let i = windowSize; i < n - windowSize; i++) {
        const left = values.slice(i - windowSize, i);
        const right = values.slice(i, i + windowSize);
        const leftMean = left.reduce((a, b) => a + b, 0) / windowSize;
        const rightMean = right.reduce((a, b) => a + b, 0) / windowSize;
        const meanDiff = leftMean - rightMean; // Only consider downward jumps
        // Only keep strong downward changes
        if (meanDiff > meanDiffThreshold) {
            changePoints.push({ idx: i, meanDiff });
        }
    }
    // Sort by meanDiff descending, keep only the strongest in a local window
    changePoints.sort((a, b) => b.meanDiff - a.meanDiff);
    const filtered = [];
    for (let i = 0; i < changePoints.length; i++) {
        const idx = changePoints[i].idx;
        if (filtered.every(j => Math.abs(j - idx) > windowSize)) {
            filtered.push(idx);
        }
        if (filtered.length > 5) break; // limit to 5 max
    }
    filtered.sort((a, b) => a - b);
    return filtered;
}
const valuesForChangePoint = resampledData.y;
const resampledStd = (() => {
    const vals = valuesForChangePoint;
    const mean = vals.reduce((sum, v) => sum + v, 0) / vals.length;
    const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / vals.length;
    return Math.sqrt(variance);
})();
// Parameters for both detectors
let meanDiffThreshold = Math.max(resampledStd / 20, 0.05); // keep your tuned value
let minSegmentSize = Math.max(3, Math.floor(valuesForChangePoint.length * 0.02)); // 2% of data
let slidingWindowSize = Math.max(100, Math.floor(valuesForChangePoint.length * 0.05));
console.log(`[ChangePoint] Using meanDiffThreshold=${meanDiffThreshold.toFixed(4)}, resampledStd=${resampledStd.toFixed(4)}, minSegmentSize=${minSegmentSize}, slidingWindowSize=${slidingWindowSize}`);
// Binary segmentation
const changePointsBinary = detectChangePointsBinarySegmentation(
    valuesForChangePoint,
    minSegmentSize,
    meanDiffThreshold
);
// Sliding window (parameters set inside function)
const changePointsSliding = detectChangePointsSlidingWindow(
    valuesForChangePoint,
    slidingWindowSize,
    meanDiffThreshold
);
// Merge and deduplicate (within 5 points)
function mergeChangePoints(arr1, arr2, tolerance) {
    // tolerance: minimum distance between change points
    const all = arr1.concat(arr2).sort((a, b) => a - b);
    const merged = [];
    for (let i = 0; i < all.length; i++) {
        if (merged.length === 0 || all[i] - merged[merged.length - 1] > tolerance) {
            merged.push(all[i]);
        }
    }
    return merged;
}
const mergeTolerance = Math.floor(valuesForChangePoint.length * 0.1); // 10% of data
const changePointsThreshold = detectThresholdRegimes(valuesForChangePoint, 40);
const changePoints = mergeChangePoints(
    mergeChangePoints(changePointsBinary, changePointsSliding, mergeTolerance),
    changePointsThreshold,
    mergeTolerance
);
console.log(`[ChangePoint] Binary:`, changePointsBinary);
console.log(`[ChangePoint] Sliding:`, changePointsSliding);
console.log(`[ChangePoint] Merged:`, changePoints);
        // Change Point Detection using variance-based method
        function detectChangePoints(timeSeries, minSegmentSize = Math.max(3, Math.floor(timeSeries.length * 0.1))) {
            const detectionStartTime = Date.now();
            console.log(`Change point detection starting with ${timeSeries.length} points, min segment size: ${minSegmentSize}`);
            
            const n = timeSeries.length;
            if (n < minSegmentSize * 2) {
            console.log(`Dataset too small for change point detection (${n} < ${minSegmentSize * 2})`);
            return [];
            }
            
            let bestChangePoint = -1;
            let maxVarianceReduction = 0;
            
            // Calculate overall variance
            const overallMean = timeSeries.reduce((sum, d) => sum + d.value, 0) / n;
            const overallVariance = timeSeries.reduce((sum, d) => sum + Math.pow(d.value - overallMean, 2), 0) / n;
            console.log(`Overall mean: ${overallMean.toFixed(2)}, variance: ${overallVariance.toFixed(2)}`);
            
            // Test each potential change point
            console.log(`Testing ${n - 2 * minSegmentSize} potential change points...`);
            // Prevent endless loop: Only log when a new best is found, and break if improvement is negligible
            let lastLoggedIndex = -1;
            for (let i = minSegmentSize; i < n - minSegmentSize; i++) {
                const leftSegment = timeSeries.slice(0, i);
                const rightSegment = timeSeries.slice(i);
                // Calculate variance for each segment
                const leftMean = leftSegment.reduce((sum, d) => sum + d.value, 0) / leftSegment.length;
                const rightMean = rightSegment.reduce((sum, d) => sum + d.value, 0) / rightSegment.length;
                const leftVariance = leftSegment.reduce((sum, d) => sum + Math.pow(d.value - leftMean, 2), 0) / leftSegment.length;
                const rightVariance = rightSegment.reduce((sum, d) => sum + Math.pow(d.value - rightMean, 2), 0) / rightSegment.length;
                // Weighted variance of segments
                const weightedVariance = (leftSegment.length * leftVariance + rightSegment.length * rightVariance) / n;
                // Variance reduction
                const varianceReduction = overallVariance - weightedVariance;
                // Only log if index is not consecutive and improvement is meaningful
                if (varianceReduction > maxVarianceReduction + 1e-6) {
                    maxVarianceReduction = varianceReduction;
                    bestChangePoint = i;
                    if (i !== lastLoggedIndex) {
                        console.log(`New best change point at index ${i} (${new Date(timeSeries[i].timestamp).toLocaleDateString()}) with variance reduction: ${varianceReduction.toFixed(4)}`);
                        lastLoggedIndex = i;
                    }
                }
            }
            
            // Only accept change point if it significantly reduces variance
            // ADJUSTABLE PARAMETERS:
            // 1. Variance reduction threshold (sensitivity)
            const varianceThresholdPercent = 0.05; // 5% = more sensitive, 0.15 = less sensitive
            const significanceThreshold = overallVariance * varianceThresholdPercent;
            
            // 2. Minimum variance reduction (absolute value)
            const minAbsoluteReduction = 0.5; // Minimum absolute variance reduction
            
            // 3. Mean difference threshold (detect regime changes)
            const meanDifferenceThreshold = Math.abs(overallMean) * 0.1; // 10% mean change
            
            const detectionTime = Date.now() - detectionStartTime;
            console.log(`Change point detection completed in ${detectionTime}ms`);
            console.log(`Best variance reduction: ${maxVarianceReduction.toFixed(4)}, threshold: ${significanceThreshold.toFixed(4)}`);
            console.log(`Variance threshold: ${varianceThresholdPercent * 100}%, Min absolute: ${minAbsoluteReduction}`);
            console.log(`Mean difference threshold: ${meanDifferenceThreshold.toFixed(4)}`);
            
            // Segmented Linear Regression
            function calculateSegmentTrend(segment, segmentIndex) {
                const calcStartTime = Date.now();
                console.log(`Calculating trend for segment ${segmentIndex + 1} with ${segment.length} points`);
                
                if (segment.length < 3) {
                    console.log(`Segment ${segmentIndex + 1} too small for trend calculation`);
                    return { slope: 0, intercept: 0, rSquared: 0, significant: false };
                }
                
                const n = segment.length;
                const xMean = segment.reduce((sum, d) => sum + d.days, 0) / n;
                const yMean = segment.reduce((sum, d) => sum + d.value, 0) / n;
                
                const numerator = segment.reduce((sum, d) => sum + (d.days - xMean) * (d.value - yMean), 0);
                const denominator = segment.reduce((sum, d) => sum + Math.pow(d.days - xMean, 2), 0);
                
                const slope = denominator !== 0 ? numerator / denominator : 0;
                const intercept = yMean - slope * xMean;
                
                // Calculate R-squared
                const yPredicted = segment.map(d => intercept + slope * d.days);
                const ssRes = segment.reduce((sum, d, i) => sum + Math.pow(d.value - yPredicted[i], 2), 0);
                const ssTot = segment.reduce((sum, d) => sum + Math.pow(d.value - yMean, 2), 0);
                const rSquared = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;
                
                // Statistical significance (simplified)
                const significant = Math.abs(slope) > 0.01 && rSquared > 0.1;
                
                const calcTime = Date.now() - calcStartTime;
                console.log(`Segment ${segmentIndex + 1} trend: slope=${slope.toFixed(4)}, R²=${rSquared.toFixed(3)}, significant=${significant} (${calcTime}ms)`);
                
                return { slope, intercept, rSquared, significant, n, mean: yMean };
            }
            
            // Calculate and log a single trend for the whole resampled dataset
            const nTrend = timeSeriesData.length;
            const xMeanTrend = timeSeriesData.reduce((sum, d) => sum + d.days, 0) / nTrend;
            const yMeanTrend = timeSeriesData.reduce((sum, d) => sum + d.value, 0) / nTrend;
            const numeratorTrend = timeSeriesData.reduce((sum, d) => sum + (d.days - xMeanTrend) * (d.value - yMeanTrend), 0);
            const denominatorTrend = timeSeriesData.reduce((sum, d) => sum + Math.pow(d.days - xMeanTrend, 2), 0);
            const slopeTrend = denominatorTrend !== 0 ? numeratorTrend / denominatorTrend : 0;
            const interceptTrend = yMeanTrend - slopeTrend * xMeanTrend;
            const yPredictedTrend = timeSeriesData.map(d => interceptTrend + slopeTrend * d.days);
            const ssResTrend = timeSeriesData.reduce((sum, d, i) => sum + Math.pow(d.value - yPredictedTrend[i], 2), 0);
            const ssTotTrend = timeSeriesData.reduce((sum, d) => sum + Math.pow(d.value - yMeanTrend, 2), 0);
            const rSquaredTrend = ssTotTrend !== 0 ? 1 - (ssResTrend / ssTotTrend) : 0;
            console.log(`[TREND] Whole dataset trend: slope=${slopeTrend.toFixed(4)}, R²=${rSquaredTrend.toFixed(3)}, n=${nTrend}`);
            // ...return or overlay this single trend in the response...
        }

        // Segmented Linear Regression
        function calculateSegmentTrend(segment, segmentIndex) {
            const calcStartTime = Date.now();
            console.log(`Calculating trend for segment ${segmentIndex + 1} with ${segment.length} points`);
            
            if (segment.length < 3) {
                console.log(`Segment ${segmentIndex + 1} too small for trend calculation`);
                return { slope: 0, intercept: 0, rSquared: 0, significant: false };
            }
            
            const n = segment.length;
            const xMean = segment.reduce((sum, d) => sum + d.days, 0) / n;
            const yMean = segment.reduce((sum, d) => sum + d.value, 0) / n;
            
            const numerator = segment.reduce((sum, d) => sum + (d.days - xMean) * (d.value - yMean), 0);
            const denominator = segment.reduce((sum, d) => sum + Math.pow(d.days - xMean, 2), 0);
            
            const slope = denominator !== 0 ? numerator / denominator : 0;
            const intercept = yMean - slope * xMean;
            
            // Calculate R-squared
            const yPredicted = segment.map(d => intercept + slope * d.days);
            const ssRes = segment.reduce((sum, d, i) => sum + Math.pow(d.value - yPredicted[i], 2), 0);
            const ssTot = segment.reduce((sum, d) => sum + Math.pow(d.value - yMean, 2), 0);
            const rSquared = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;
            
            // Statistical significance (simplified)
            const significant = Math.abs(slope) > 0.01 && rSquared > 0.1;
            
            const calcTime = Date.now() - calcStartTime;
            console.log(`Segment ${segmentIndex + 1} trend: slope=${slope.toFixed(4)}, R²=${rSquared.toFixed(3)}, significant=${significant} (${calcTime}ms)`);
            
            return { slope, intercept, rSquared, significant, n, mean: yMean };
        }

        
        // Use resampled data for autocorrelation calculation
        const resampledValues = resampledData.y;
        const resampledN = resampledValues.length;
        // Calculate and log a single trend for the whole resampled dataset
        const nTrend = processedData.length;
        const xMeanTrend = processedData.reduce((sum, d) => sum + ((d.days !== undefined ? d.days : 0)), 0) / nTrend;
        const yMeanTrend = processedData.reduce((sum, d) => sum + d.value, 0) / nTrend;
        const numeratorTrend = processedData.reduce((sum, d) => sum + (((d.days !== undefined ? d.days : 0) - xMeanTrend) * (d.value - yMeanTrend)), 0);
        const denominatorTrend = processedData.reduce((sum, d) => sum + Math.pow(((d.days !== undefined ? d.days : 0) - xMeanTrend), 2), 0);
        const slopeTrend = denominatorTrend !== 0 ? numeratorTrend / denominatorTrend : 0;
        const interceptTrend = yMeanTrend - slopeTrend * xMeanTrend;
        const yPredictedTrend = processedData.map(d => interceptTrend + slopeTrend * (d.days !== undefined ? d.days : 0));
        const ssResTrend = processedData.reduce((sum, d, i) => sum + Math.pow(d.value - yPredictedTrend[i], 2), 0);
        const ssTotTrend = processedData.reduce((sum, d) => sum + Math.pow(d.value - yMeanTrend, 2), 0);
        const rSquaredTrend = ssTotTrend !== 0 ? 1 - (ssResTrend / ssTotTrend) : 0;
        // Autocorrelation at lag 1
        let autocorrelation = 0;
        if (resampledN > 1) {
            const meanVal = resampledValues.reduce((sum, val) => sum + val, 0) / resampledValues.length;
            let numerator = 0;
            let denominator = 0;
            for (let i = 0; i < resampledValues.length - 1; i++) {
                numerator += (resampledValues[i] - meanVal) * (resampledValues[i + 1] - meanVal);
            }
            for (let i = 0; i < resampledValues.length; i++) {
                denominator += Math.pow(resampledValues[i] - meanVal, 2);
            }
            autocorrelation = denominator !== 0 ? numerator / denominator : 0;
        }

            // Initialize and run anomaly detector
            const detector = new SimpleAnomalyDetector();
            const startProcessingTime = Date.now();
            const results = await detector.detectMeanStdAnomalies(processedData, 2);
            const processingDuration = (Date.now() - startProcessingTime) / 1000;
            detector.dispose();
            const fetchDuration = (endFetchTime - startFetchTime) / 1000;
            
            console.log(`[PROCESSING-COMPLETE] Anomaly detection completed in ${processingDuration} seconds`);
            console.log(`[PROCESSING-COMPLETE] Found ${results.meanAnomalyCount + results.stdAnomalyCount + results.madAnomalyCount} total anomalies out of ${results.totalPoints} stratified points`);
            console.log(`[PROCESSING-SUMMARY] Pipeline: ${totalFetchedCount} raw → ${processedData.length} stratified → ${results.totalPoints} analyzed → ${results.meanAnomalyCount + results.stdAnomalyCount + results.madAnomalyCount} anomalies`);
            console.log(`[MEDIAN-COMPARISON] Stratified median: ${statsMedian.toFixed(2)}, Detector median: ${results.median ? results.median.toFixed(2) : 'N/A'}, Using stratified: ${statsMedian.toFixed(2)}`);

            // Calculate anomaly density (anomalies per unit time)
            let anomalyDensity = 0;
            if (processedData.length > 1) {
                const totalTimeSpan = new Date(processedData[processedData.length - 1].timestamp) - new Date(processedData[0].timestamp);
                const totalHours = totalTimeSpan / (1000 * 60 * 60);
                const totalAnomalies = results.meanAnomalyCount + results.stdAnomalyCount + results.madAnomalyCount;
                anomalyDensity = totalHours > 0 ? (totalAnomalies / totalHours).toFixed(2) : 0;
            }

            console.log(`Advanced Stats - Min: ${minValue.toFixed(2)}, Max: ${maxValue.toFixed(2)}, Skewness: ${skewness.toFixed(3)}, Kurtosis: ${kurtosis.toFixed(3)}, Trend: ${slopeTrend.toFixed(4)}, Autocorr: ${autocorrelation.toFixed(3)}, Anomaly Density: ${anomalyDensity}/hr`);

            // Prepare response (same structure as server_msd.js)
            // Calculate region boundaries for shading
            const regionBoundaries = [];
            const allChangePoints = [0, ...changePoints, processedData.length - 1];
            for (let i = 0; i < allChangePoints.length - 1; i++) {
                const startIdx = allChangePoints[i];
                const endIdx = allChangePoints[i + 1];
                regionBoundaries.push({
                    start: processedData[startIdx] ? processedData[startIdx].timestamp : null,
                    end: processedData[endIdx] ? processedData[endIdx].timestamp : null,
                    startIdx,
                    endIdx
                });
            }

            const response = {
                success: true,
                metadata: {
                    column: column,
                    period: { start: start_date, end: end_date },
                    excludeRanges: excludeRanges,
                    dataPoints: processedData.length,
                    method: results.method,
                    totalPoints: results.totalPoints,
                    anomalyCount: results.meanAnomalyCount + results.stdAnomalyCount + results.madAnomalyCount,
                    anomalyPercentage: (((results.meanAnomalyCount + results.stdAnomalyCount + results.madAnomalyCount) / results.totalPoints) * 100).toFixed(2),
                    threshold: results.threshold,
                    processingTime: processingDuration,
                    fetchTime: fetchDuration
                },
                anomalies: results.anomalies.map(anomaly => ({
                    timestamp: anomaly.timestamp,
                    value: anomaly.originalValue,
                    mean: anomaly.mean,
                    std: anomaly.std,
                    mad: anomaly.mad,
                    zScore: anomaly.zScore,
                    madScore: anomaly.madScore,
                    isAnomaly: anomaly.isMeanAnomaly || anomaly.isStdAnomaly || anomaly.isMadAnomaly,
                    anomalyScore: anomaly.anomalyScore
                })),
                meanAnomalies: results.meanAnomalies,
                stdAnomalies: results.stdAnomalies,
                madAnomalies: results.madAnomalies,
                meanAnomalyCount: results.meanAnomalyCount,
                stdAnomalyCount: results.stdAnomalyCount,
                madAnomalyCount: results.madAnomalyCount,
                mean: statsMean,
                median: statsMedian,
                std: statsStd,
                mad: results.mad,
                advancedStats: {
                    minValue: minValue,
                    maxValue: maxValue,
                    skewness: skewness,
                    kurtosis: kurtosis,
                    anomalyDensity: parseFloat(anomalyDensity),
                    trendSlope: slopeTrend,
                    autocorrelation: autocorrelation,
                    range: maxValue - minValue,
                    coefficientOfVariation: mean !== 0 ? (std / Math.abs(mean)) * 100 : 0,
                    trendRSquared: rSquaredTrend,
                    trendDirection: slopeTrend > 0.001 ? 'Rising' : slopeTrend < -0.001 ? 'Falling' : 'Stable',
                    trendSignificance: rSquaredTrend > 0.1 ? 'Significant' : 'Not Significant',
                    mae: 0, // Not applicable
                    mape: 0, // Not applicable
                    changePoints: changePoints,
                    trendAnalysisType: 'single',
                    regionBoundaries: regionBoundaries
                },
                baseline: {
                    percentile5th: {
                        value: baseline5th,
                        percentile: 5,
                        belowCount: belowBaseline5th,
                        percentageBelow: ((belowBaseline5th / values.length) * 100).toFixed(1),
                        interpretation: `95% of time, temperature is above ${baseline5th.toFixed(2)}°C`,
                        description: "5th Percentile (Very Conservative)",
                        purpose: "Extreme low temperature detection",
                        alertCondition: `Temperature below ${baseline5th.toFixed(2)}°C indicates potential shutdown or extreme cooling`,
                        hoverLabel: `5th Percentile Baseline: ${baseline5th.toFixed(2)}°C - Very Conservative Threshold`
                    },
                    percentile10th: {
                        value: baseline10th,
                        percentile: 10,
                        belowCount: belowBaseline10th,
                        percentageBelow: ((belowBaseline10th / values.length) * 100).toFixed(1),
                        interpretation: `90% of time, temperature is above ${baseline10th.toFixed(2)}°C`,
                        description: "10th Percentile (Recommended Lower)",
                        purpose: "Shutdown/Idle Detection",
                        alertCondition: `Temperature below ${baseline10th.toFixed(2)}°C indicates oven is likely shut down or idle`,
                        hoverLabel: `10th Percentile Baseline: ${baseline10th.toFixed(2)}°C - Recommended Lower Threshold`
                    },
                    percentile15th: {
                        value: baseline15th,
                        percentile: 15,
                        belowCount: belowBaseline15th,
                        percentageBelow: ((belowBaseline15th / values.length) * 100).toFixed(1),
                        interpretation: `85% of time, temperature is above ${baseline15th.toFixed(2)}°C`,
                        description: "15th Percentile (More Inclusive)",
                        purpose: "Low operation detection",
                        alertCondition: `Temperature below ${baseline15th.toFixed(2)}°C indicates low operation mode`,
                        hoverLabel: `15th Percentile Baseline: ${baseline15th.toFixed(2)}°C - More Inclusive Lower Threshold`
                    },
                    percentile85th: {
                        value: baseline85th,
                        percentile: 85,
                        aboveCount: aboveBaseline85th,
                        percentageAbove: ((aboveBaseline85th / values.length) * 100).toFixed(1),
                        interpretation: `85% of time, temperature is below ${baseline85th.toFixed(2)}°C`,
                        description: "85th Percentile (Upper Baseline Start)",
                        purpose: "High operation detection",
                        alertCondition: `Temperature above ${baseline85th.toFixed(2)}°C indicates high operation mode`,
                        hoverLabel: `85th Percentile Baseline: ${baseline85th.toFixed(2)}°C - Upper Baseline Start`
                    },
                    percentile90th: {
                        value: baseline90th,
                        percentile: 90,
                        aboveCount: aboveBaseline90th,
                        percentageAbove: ((aboveBaseline90th / values.length) * 100).toFixed(1),
                        interpretation: `90% of time, temperature is below ${baseline90th.toFixed(2)}°C`,
                        description: "90th Percentile (Recommended Upper)",
                        purpose: "Overheating/High Load Detection",
                        alertCondition: `Temperature above ${baseline90th.toFixed(2)}°C indicates potential overheating or heavy load`,
                        hoverLabel: `90th Percentile Baseline: ${baseline90th.toFixed(2)}°C - Recommended Upper Threshold`
                    },
                    percentile95th: {
                        value: baseline95th,
                        percentile: 95,
                        aboveCount: aboveBaseline95th,
                        percentageAbove: ((aboveBaseline95th / values.length) * 100).toFixed(1),
                        interpretation: `95% of time, temperature is below ${baseline95th.toFixed(2)}°C`,
                        description: "95th Percentile (Very High Threshold)",
                        purpose: "Extreme high temperature detection",
                        alertCondition: `Temperature above ${baseline95th.toFixed(2)}°C indicates potential overheating emergency`,
                        hoverLabel: `95th Percentile Baseline: ${baseline95th.toFixed(2)}°C - Very High Threshold`
                    },
                    recommended: {
                        lower: baseline10th,
                        upper: baseline90th
                    }
                },
                originalData: {
                    x: processedData.map(d => d.timestamp),
                    y: processedData.map(d => d.value)
                }
            };

            res.json(response);
        } catch (err) {
            console.error('Error in anomaly detection:', err);
            res.status(500).json({ 
                error: 'Anomaly detection failed', 
                details: err.message 
            });
        }
});

// Baseline detection endpoint
app.get('/baseline-detection', async (req, res) => {
    try {
        const { 
            column, 
            start_date, 
            end_date, 
            percentiles = '5,10,15,85,90,95',
            exclude_ranges = '',
            resample_points = 2000 
        } = req.query;

        if (!column || !start_date || !end_date) {
            return res.status(400).json({ 
                error: 'Column, start_date, and end_date are required' 
            });
        }

        // Parse exclude ranges
        let excludeRanges = [];
        if (exclude_ranges) {
            try {
                excludeRanges = JSON.parse(exclude_ranges);
            } catch (e) {
                console.log('Failed to parse exclude_ranges, using empty array');
            }
        }

        await poolConnect;
        const startDate = new Date(start_date);
        const endDate = new Date(end_date);

        let data = [];
        
        // Fetch data (same logic as anomaly detection)
        for (const table of tables) {
            const tableStartDate = parseTableDate(table);
            const tableEndDate = new Date(tableStartDate);
            tableEndDate.setMonth(tableEndDate.getMonth() + 1);

            if (startDate <= tableEndDate && endDate >= tableStartDate) {
                const fullTableName = `[${schemaName}].[${table}]`;
                const query = `SELECT Date, [${column}] FROM ${fullTableName} WHERE Date BETWEEN @startDate AND @endDate`;
                
                const result = await pool.request()
                    .input('startDate', mssql.DateTime, startDate)
                    .input('endDate', mssql.DateTime, endDate)
                    .query(query);
                
                data = data.concat(result.recordset);
            }
        }

        data = data.filter(row => row[column] !== null && row[column] !== 0);
        
        // Filter out excluded time ranges
        if (excludeRanges.length > 0) {
            console.log(`Excluding ${excludeRanges.length} time ranges from baseline calculation`);
            data = data.filter(row => {
                const rowTime = new Date(row.Date);
                return !excludeRanges.some(range => {
                    const rangeStart = new Date(range.start);
                    const rangeEnd = new Date(range.end);
                    return rowTime >= rangeStart && rowTime <= rangeEnd;
                });
            });
        }

        // Data resampling
        const resampledArray = resampleData(data, column, parseInt(resample_points));
        const values = resampledArray.map(row => row[column]).sort((a, b) => a - b);

        if (values.length === 0) {
            return res.status(400).json({ error: 'No valid data found', success: false });
        }

        const requestedPercentiles = percentiles.split(',').map(p => parseInt(p.trim()));
        const result = {};
        
        requestedPercentiles.forEach(p => {
            const index = Math.max(0, Math.ceil((p / 100) * values.length) - 1);
            result[`percentile${p}th`] = {
                value: values[index],
                percentile: p,
                interpretation: p <= 50 
                    ? `${100-p}% of time, temperature is above ${values[index].toFixed(2)}°C`
                    : `${p}% of time, temperature is below ${values[index].toFixed(2)}°C`
            };
        });

        // Determine recommended baselines
        result.recommendedBaselines = {
            lower: result.percentile10th,
            upper: result.percentile90th
        };

        res.json({
            success: true,
            baselines: result,
            dataPoints: values.length
        });

    } catch (err) {
        console.error('Error in baseline detection:', err);
        res.status(500).json({ 
            error: 'Baseline detection failed', 
            details: err.message 
        });
    }
});

app.listen(5000, function () {
    console.log('Server is listening at port 5000...');
    console.log('Available endpoints:');
    console.log('  GET /columns - Get available sensor columns');
    console.log('  GET /data - Get time series data with resampling');
    console.log('  GET /anomaly-detection - Perform anomaly detection');
    console.log('  GET /baseline-detection - Perform baseline detection');
});