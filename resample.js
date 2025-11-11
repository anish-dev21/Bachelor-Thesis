// resample.js - LTTB downsampling using the downsample library
// const downsample = require('downsample');

// function resampleData(data, column, targetPoints = 2000) {
// 	console.log(`LTTB resampling ${data.length} points to ${targetPoints} points`);
// 	console.log("Date range:", data[0].Date, "to", data[data.length - 1].Date);

// 	// If data is already smaller than target, return as is
// 	if (data.length <= targetPoints) {
// 		console.log("Data size is already smaller than target, returning original data");
// 		return data;
// 	}

// 	// Map data to points for LTTB downsampling
// 	const points = data.map(row => ({ x: row.Date.getTime(), y: row[column] }));

// 	// Downsample using LTTB algorithm
// 	const downsampledPoints = downsample.LTTB(points, targetPoints);

// 	console.log("Number of data points after LTTB downsampling:", downsampledPoints.length);
// 	console.log("Resampled trace date range:", new Date(downsampledPoints[0].x), "to", new Date(downsampledPoints[downsampledPoints.length - 1].x));

// 	// Convert back to the expected format (array of objects with Date and column properties)
// 	return downsampledPoints.map(point => ({
// 		Date: new Date(point.x),
// 		[column]: point.y
// 	}));
// }

// // Export the main resampleData function
// module.exports = {
// 	resampleData
// };

// Downsampling using the stratified approach

function timeStratifiedSampleAll(data, column, targetPoints = 2000) {
    if (data.length <= targetPoints) return data;
    const sortedData = data.slice().sort((a, b) => new Date(a.Date) - new Date(b.Date));
    const startTime = new Date(sortedData[0].Date).getTime();
    const endTime = new Date(sortedData[sortedData.length - 1].Date).getTime();
    const interval = (endTime - startTime) / targetPoints;
    const result = [];
    let bucket = [];
    let currentBucketEnd = startTime + interval;
    let i = 0;
    for (const row of sortedData) {
        const t = new Date(row.Date).getTime();
        while (t >= currentBucketEnd && i < targetPoints - 1) {
            if (bucket.length > 0) {
                // Get min, max, median, and random points
                const values = bucket.map(r => r[column]);
                const minVal = Math.min(...values);
                const maxVal = Math.max(...values);
                const minPoint = bucket.find(r => r[column] === minVal);
                const maxPoint = bucket.find(r => r[column] === maxVal);
                const sortedBucket = bucket.slice().sort((a, b) => a[column] - b[column]);
                const medianPoint = sortedBucket[Math.floor(sortedBucket.length / 2)];
                const randomPoint = bucket[Math.floor(Math.random() * bucket.length)];
                // Add unique points only
                const uniquePoints = [minPoint, maxPoint, medianPoint, randomPoint]
                    .filter((v, idx, arr) => v && arr.findIndex(p => p === v) === idx);
                result.push(...uniquePoints);
            }
            bucket = [];
            i++;
            currentBucketEnd = startTime + (i + 1) * interval;
        }
        bucket.push(row);
    }
    // Process last bucket
    if (bucket.length > 0) {
        const values = bucket.map(r => r[column]);
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const minPoint = bucket.find(r => r[column] === minVal);
        const maxPoint = bucket.find(r => r[column] === maxVal);
        const sortedBucket = bucket.slice().sort((a, b) => a[column] - b[column]);
        const medianPoint = sortedBucket[Math.floor(sortedBucket.length / 2)];
        const randomPoint = bucket[Math.floor(Math.random() * bucket.length)];
        const uniquePoints = [minPoint, maxPoint, medianPoint, randomPoint]
            .filter((v, idx, arr) => v && arr.findIndex(p => p === v) === idx);
        result.push(...uniquePoints);
    }
    return result;
}

module.exports = {
    resampleData: timeStratifiedSampleAll,
};