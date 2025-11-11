/**
 * Simple Statistical Anomaly Detection 
 * Uses mean deviation and moving averages to detect anomalies
 */

class SimpleAnomalyDetector {
    /**
     * Mean and standard deviation based anomaly detection
     */
    detectMeanStdAnomalies(data, threshold = 2) {
        console.log(`Running mean+std+mad anomaly detection on ${data.length} points`);
        const values = data.map(d => d.value);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const std = Math.sqrt(values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length);
        
        // Calculate Mean Absolute Deviation (MAD)
        const mad = values.reduce((acc, val) => acc + Math.abs(val - mean), 0) / values.length;
        
        console.log(`Data statistics: mean=${mean.toFixed(2)}, std=${std.toFixed(2)}, mad=${mad.toFixed(2)}, threshold=${threshold}`);
        const meanAnomalies = [];
        const stdAnomalies = [];
        const madAnomalies = [];
        const results = data.map(point => {
            const deviation = Math.abs(point.value - mean);
            const z = (point.value - mean) / std;
            const madScore = deviation / mad;
            
            const isMeanAnomaly = deviation > threshold * std;
            const isStdAnomaly = Math.abs(z) > threshold;
            const isMadAnomaly = madScore > threshold;
            
            if (isMeanAnomaly) meanAnomalies.push({ timestamp: point.timestamp, value: point.value, mean, std, mad, zScore: z, madScore });
            if (isStdAnomaly) stdAnomalies.push({ timestamp: point.timestamp, value: point.value, mean, std, mad, zScore: z, madScore });
            if (isMadAnomaly) madAnomalies.push({ timestamp: point.timestamp, value: point.value, mean, std, mad, zScore: z, madScore });
            
            return {
                timestamp: point.timestamp,
                originalValue: point.value,
                mean: mean,
                std: std,
                mad: mad,
                zScore: z,
                madScore: madScore,
                isMeanAnomaly,
                isStdAnomaly,
                isMadAnomaly,
                anomalyScore: Math.max(Math.abs(z) / threshold, madScore / threshold)
            };
        });
        console.log(`Mean anomalies: ${meanAnomalies.length}, Std anomalies: ${stdAnomalies.length}, MAD anomalies: ${madAnomalies.length}`);
        return {
            anomalies: results,
            meanAnomalies,
            stdAnomalies,
            madAnomalies,
            threshold: threshold,
            method: 'mean+std+mad',
            totalPoints: results.length,
            meanAnomalyCount: meanAnomalies.length,
            stdAnomalyCount: stdAnomalies.length,
            madAnomalyCount: madAnomalies.length,
            mean: mean,
            std: std,
            mad: mad
        };
    }
    dispose() {
        console.log('Statistical anomaly detector disposed');
    }
}
module.exports = SimpleAnomalyDetector;
