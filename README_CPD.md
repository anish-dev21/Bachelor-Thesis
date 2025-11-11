# Change-Point Detection using PELT L1 Algorithm

## Overview

This script implements change-point detection on industrial temperature data using the PELT algorithm with L1 cost function. The method detects regime transitions in furnace operations with high accuracy and noise tolerance.

**Key Features:**
- PELT L1 algorithm for robust change-point detection
- Stratified resampling for computational efficiency
- Interactive web dashboard for visualization
- Validates against 10-period moving average data

## Method Performance

| Method | Assessment |
|--------|------------|
| PELT (L1) | **Most robust; suitable for predictive monitoring** |
| Bayesian Mean-Shift | Adequate for slow transitions; limited precision |
| PELT (Mean/Variance) | Baseline approach; low robustness |

**Result**: PELT L1 provides the most reliable performance, capturing both abrupt and gradual changes with strong alignment to operational events.

## Configuration

### Database Settings
```python
DB_CONFIG = {
    'server': 'server',
    'database': 'Company Database',
    'username': 'Username',
    'password': 'Password',
    'driver': '{ODBC Driver 17 for SQL Server}',
    'port': 1433
}

SCHEMA_NAME = 'Schema'  
```

### Analysis Parameters
```python
# Sensor and time period selection
SENSOR_NAME = '2TempSuctionVWO - VWO Absaugung / Temperatur (=830+VWO-B21)'
START_DATE = '2024-03-01'
END_DATE = '2024-12-15'

# Stratified sampling configuration
TARGET_POINTS = 2000  # Target number of resampled points

# PELT algorithm parameters
PENALTY = 100  # Lower penalty for resampled data (adaptive)
```

## Validation

**Temporal Consistency**: Change points between raw and moving-average data align within 1-2 days, confirming robust detection across different data representations.

## Usage

```bash
pip install pandas ruptures pyodbc plotly
python change-point-detection_data_ruptures_l1.py
```

**Configuration**: Update database settings and sensor parameters in the script.

**Output**: Interactive HTML dashboard with change-point visualization and analysis results.