import threading
import pandas as pd
import ruptures as rpt
from datetime import datetime
import http.server
import socketserver
import webbrowser
import os
import json

PORT = 8080

DB_CONFIG = {
    'server': 'server',
    'database': 'Company Database',
    'username': 'Username',
    'password': 'Password',
    'driver': '{ODBC Driver 17 for SQL Server}',
    'port': 1433
}


SCHEMA_NAME = 'Schema'
TABLES = [
    'March_2023_data', 'April_2023_data', 'May_2023_data', 'June_2023_data',
    'July_2023_data', 'August_2023_data', 'September_2023_data', 'October_2023_data',
    'November_2023_data', 'December_2023_data', 'January_2024_data', 'February_2024_data',
    'March_2024_data', 'April_2024_data', 'May_2024_data', 'June_2024_data',
    'July_2024_data', 'August_2024_data', 'September_2024_data', 'October_2024_data',
    'November_2024_data', 'December_2024_data', 'January_2025_data', 'February_2025_data',
    'March_2025_data', 'April_2025_data', 'May_2025_data'
]

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def get_database_connection():
    """Create and return a database connection"""
    import pyodbc
    try:
        connection_string = (
            f"DRIVER={{SQL Server}};"
            f"SERVER={DB_CONFIG['server']};"
            f"DATABASE={DB_CONFIG['database']};"
            f"UID={DB_CONFIG['username']};"
            f"PWD={DB_CONFIG['password']};"
            f"Trusted_Connection=no;"
        )
        connection = pyodbc.connect(connection_string, timeout=30)
        print("Database connection established successfully")
        return connection
    except Exception as e:
        print(f"Database connection failed: {e}")
        return None

def parse_table_date(table_name):
    parts = table_name.split('_')
    if len(parts) >= 2:
        month_name = parts[0]
        year = parts[1]
        month_map = {
            'January': 1, 'February': 2, 'March': 3, 'April': 4,
            'May': 5, 'June': 6, 'July': 7, 'August': 8,
            'September': 9, 'October': 10, 'November': 11, 'December': 12
        }
        month_num = month_map.get(month_name, 1)
        try:
            return datetime(int(year), month_num, 1)
        except ValueError as e:
            print(f"Date parsing error for table {table_name}: {e}")
            return datetime.now()
    return datetime.now()

def extract_data_from_db(column, start_date, end_date):
    """Extract data from database tables for specified sensor and time period"""
    connection = get_database_connection()
    if not connection:
        print("ERROR: Cannot establish database connection")
        return pd.Series(), pd.Series()
    
    try:
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')
        
        all_data = []
        start_fetch_time = datetime.now()
        
        print(f"Fetching data for column: {column}")
        print(f"Date range: {start_date} to {end_date}")
        
        for table in TABLES:
            table_start_date = parse_table_date(table)
            # Calculate table end date (first day of next month)
            if table_start_date.month == 12:
                table_end_date = datetime(table_start_date.year + 1, 1, 1)
            else:
                table_end_date = datetime(table_start_date.year, table_start_date.month + 1, 1)
            
            print(f"Checking table: {table}, tableStartDate: {table_start_date}, tableEndDate: {table_end_date}")
            
            # Check if table overlaps with requested date range
            if start_dt <= table_end_date and end_dt >= table_start_date:
                print(f"Fetching data from table: {table}")
                
                cursor = connection.cursor()
                full_table_name = f"[{SCHEMA_NAME}].[{table}]"
                
                query = f"""
                SELECT Date, [{column}] 
                FROM {full_table_name} 
                WHERE Date BETWEEN ? AND ?
                AND [{column}] IS NOT NULL 
                AND [{column}] != 0
                ORDER BY Date
                """
                
                try:
                    table_fetch_start = datetime.now()
                    cursor.execute(query, start_dt, end_dt)
                    rows = cursor.fetchall()
                    table_fetch_end = datetime.now()
                    fetch_duration = (table_fetch_end - table_fetch_start).total_seconds() * 1000
                    
                    # Process rows and add to all_data
                    for row in rows:
                        all_data.append({
                            'Date': row[0],  
                            column: float(row[1])  # Use dynamic column name
                        })
                    
                    print(f"Fetched {len(rows)} records from table: {table} in {fetch_duration:.0f} ms")
                    
                except Exception as table_error:
                    print(f"Error fetching from {table}: {table_error}")
                    continue
        
        connection.close()
        end_fetch_time = datetime.now()
        total_fetch_duration = (end_fetch_time - start_fetch_time).total_seconds()
        
        print(f"Total fetched records: {len(all_data)}")
        
        if len(all_data) == 0:
            print("No data found for the specified parameters")
            return pd.Series(), pd.Series()
        
        print("Processing data...")
        process_start = datetime.now()
        
        # Convert to DataFrame for efficient processing of large datasets
        df = pd.DataFrame(all_data)
        
        # Convert Date column to datetime using pandas
        print("Converting dates...")
        df['Date'] = pd.to_datetime(df['Date'])
        
        # Sort by date efficiently using pandas
        print("Sorting data by date...")
        df = df.sort_values('Date').reset_index(drop=True)
        
        # Filter out null and zero values
        print("Filtering null/zero values...")
        df = df[(df[column].notna()) & (df[column] != 0)]
        
        print(f"Data points after filtering null/zero values: {len(df)}")
        
        # Extract timestamps and values 
        timestamps = df['Date']
        values = df[column]
        
        process_end = datetime.now()
        process_duration = (process_end - process_start).total_seconds()
        
        print(f"Fetching data took {total_fetch_duration:.2f} seconds")
        print(f"Processing data took {process_duration:.2f} seconds")
        print(f"Data range: {timestamps.min()} to {timestamps.max()}")
        print(f"Value range: {values.min():.3f} to {values.max():.3f}")
        
        return timestamps, values
        
    except Exception as e:
        print(f"Error fetching sensor data: {e}")
        if connection and not connection.closed:
            try:
                connection.close()
            except:
                pass  # Ignore errors when closing connection
        return pd.Series(), pd.Series()

def generate_dashboard():
    print("="*60)
    print("GENERATING DASHBOARD")

    # --- USER SELECTION: Specify sensor and time period ---
    SENSOR_NAME = '2TempSuctionVWO - VWO Absaugung / Temperatur (=830+VWO-B21)'  
    START_DATE = '2024-03-01'
    END_DATE = '2024-12-15'

    # Extract data from database
    timestamps, sensor_data = extract_data_from_db(SENSOR_NAME, START_DATE, END_DATE)
    if len(sensor_data) == 0:
        print("No data found for the specified sensor and time period")
        return False

    # Remove any NaN values
    mask = sensor_data.notna()
    timestamps = timestamps[mask]
    sensor_data = sensor_data[mask].reset_index(drop=True)

    print(f"Data points after cleaning: {len(sensor_data):,}")
    print(f"Data range: {timestamps.min()} to {timestamps.max()}")
    print()

    # Resampling with stratified sampling approach
    print("Resampling data using time-stratified sampling...")
    
    def time_stratified_sample(timestamps, values, column_name, target_points=2000):
        """
        Python implementation of timeStratifiedSampleAll function
        """
        import numpy as np
        import random
        
        if len(timestamps) <= target_points:
            return timestamps, values
        
        # Create DataFrame for easier manipulation
        df = pd.DataFrame({
            'Date': timestamps,
            column_name: values
        })
        
        # Sort by date
        df_sorted = df.sort_values('Date').reset_index(drop=True)
        
        start_time = df_sorted['Date'].iloc[0].timestamp()
        end_time = df_sorted['Date'].iloc[-1].timestamp()
        interval = (end_time - start_time) / target_points
        
        result = []
        bucket = []
        current_bucket_end = start_time + interval
        i = 0
        
        for _, row in df_sorted.iterrows():
            t = row['Date'].timestamp()
            
            # Process bucket when time exceeds current bucket end
            while t >= current_bucket_end and i < target_points - 1:
                if len(bucket) > 0:
                    # Get min, max, median, and random points
                    bucket_df = pd.DataFrame(bucket)
                    values_col = bucket_df[column_name]
                    
                    min_val = values_col.min()
                    max_val = values_col.max()
                    
                    min_point = bucket_df[bucket_df[column_name] == min_val].iloc[0]
                    max_point = bucket_df[bucket_df[column_name] == max_val].iloc[0]
                    
                    # Median point
                    sorted_bucket = bucket_df.sort_values(column_name)
                    median_idx = len(sorted_bucket) // 2
                    median_point = sorted_bucket.iloc[median_idx]
                    
                    # Random point
                    random_idx = random.randint(0, len(bucket_df) - 1)
                    random_point = bucket_df.iloc[random_idx]
                    
                    # Add unique points only
                    unique_points = []
                    seen_indices = set()
                    
                    for point in [min_point, max_point, median_point, random_point]:
                        point_key = (point['Date'].timestamp(), point[column_name])
                        if point_key not in seen_indices:
                            unique_points.append(point)
                            seen_indices.add(point_key)
                    
                    result.extend(unique_points)
                
                bucket = []
                i += 1
                current_bucket_end = start_time + (i + 1) * interval
            
            bucket.append(row.to_dict())
        
        # Process last bucket
        if len(bucket) > 0:
            bucket_df = pd.DataFrame(bucket)
            values_col = bucket_df[column_name]
            
            min_val = values_col.min()
            max_val = values_col.max()
            
            min_point = bucket_df[bucket_df[column_name] == min_val].iloc[0]
            max_point = bucket_df[bucket_df[column_name] == max_val].iloc[0]
            
            # Median point
            sorted_bucket = bucket_df.sort_values(column_name)
            median_idx = len(sorted_bucket) // 2
            median_point = sorted_bucket.iloc[median_idx]
            
            # Random point
            random_idx = random.randint(0, len(bucket_df) - 1)
            random_point = bucket_df.iloc[random_idx]
            
            # Add unique points only
            unique_points = []
            seen_indices = set()
            
            for point in [min_point, max_point, median_point, random_point]:
                point_key = (point['Date'].timestamp(), point[column_name])
                if point_key not in seen_indices:
                    unique_points.append(point)
                    seen_indices.add(point_key)
            
            result.extend(unique_points)
        
        # Convert result back to separate arrays
        if len(result) > 0:
            result_df = pd.DataFrame(result)
            result_df = result_df.sort_values('Date').reset_index(drop=True)
            return result_df['Date'], result_df[column_name].values
        else:
            return timestamps[:target_points], values[:target_points]
    
    # Apply stratified sampling
    target_points = min(2000, len(sensor_data))
    resampled_timestamps, resampled_values = time_stratified_sample(
        timestamps, 
        sensor_data.values, 
        SENSOR_NAME, 
        target_points
    )
    
    print(f"Original data points: {len(sensor_data):,}")
    print(f"Resampled data points: {len(resampled_values):,}")
    print(f"Resampling ratio: {len(resampled_values)/len(sensor_data):.4f}")
    print()

    # Change Point Detection using Ruptures on resampled data
    import time
    print("Detecting change points using Ruptures on resampled data...")
    signal = resampled_values  
    model = "l1"  # Absolute value of differences

    print(f"    [DEBUG] Starting PELT fit on {len(signal):,} resampled points...")
    fit_start = time.time()
    algo = rpt.Pelt(model=model).fit(signal)
    fit_end = time.time()
    fit_duration = fit_end - fit_start
    print(f"    [DEBUG] PELT fit complete in {fit_duration:.2f} seconds.")

    # Lower penalty since we have fewer points
    penalty = 100  # Much lower penalty for resampled data
    print(f"    [DEBUG] Predicting change points (penalty={penalty})...")
    pred_start = time.time()
    change_points = algo.predict(pen=penalty)
    pred_end = time.time()
    pred_duration = pred_end - pred_start
    print(f"    [DEBUG] Prediction complete in {pred_duration:.2f} seconds.")
    print(f"    [DEBUG] Total time for change point detection: {fit_duration + pred_duration:.2f} seconds.")
    print(f"Detected change points at indices: {change_points}")

    # Format change point timestamps for better readability using resampled timestamps
    change_point_timestamps_raw = [resampled_timestamps[idx] for idx in change_points if idx < len(resampled_timestamps)]
    change_point_timestamps_formatted = [ts.strftime('%Y-%m-%d %H:%M:%S') for ts in change_point_timestamps_raw]
    change_point_timestamps_iso = [ts.isoformat() for ts in change_point_timestamps_raw]
    
    print()
    print("CHANGE POINT DETECTION RESULTS")
    print("-" * 40)
    print(f"Change points (formatted): {change_point_timestamps_formatted}")
    print(f"Number of segments: {len(change_points)}")
    print()


    # HTML Frontend code
    html_content = f"""<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Change Point Detection Dashboard</title>
    <script src='https://cdn.plot.ly/plotly-latest.min.js'></script>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: white;
            min-height: 100vh;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }}
        .header {{
            text-align: center;
            margin-bottom: 40px;
        }}
        .header h1 {{
            color: #333;
            margin-bottom: 10px;
            font-size: 2.5em;
            font-weight: 300;
        }}
        .header p {{
            color: #666;
            font-size: 1.2em;
        }}
        .chart-container {{
            margin: 30px 0;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
        }}
        .chart-title {{
            font-size: 22px;
            font-weight: 600;
            margin-bottom: 15px;
            color: #333;
            text-align: center;
        }}
        .footer {{
            text-align: center;
            margin-top: 40px;
            color: #666;
            font-size: 14px;
        }}
        .cp-details {{
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 12px;
            padding: 25px;
            margin: 30px 0;
        }}
        .cp-details h3 {{
            color: #333;
            margin-top: 0;
            font-size: 20px;
        }}
        .cp-details ul {{
            list-style-type: none;
            padding: 0;
        }}
        .cp-details li {{
            margin: 10px 0;
            padding: 8px;
            background: #f8f9fa;
            border-radius: 5px;
        }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>
            <h1>Change Point Detection Dashboard</h1>
        </div>

        <div class='cp-details'>
            <h3>Detected Change Points</h3>
            <ul>
                <li><strong>Sensor Data Change Points:</strong> {len(change_points)}</li>
                <li><strong>Resampled data statistics:</strong> mean={resampled_values.mean():.3f}, std={resampled_values.std():.3f}</li>
                <li><strong>Original data points:</strong> {len(sensor_data):,}</li>
                <li><strong>Resampled data points:</strong> {len(resampled_values):,}</li>
            </ul>
            <div style="margin-top: 15px;">
                <h4 style="margin-bottom: 10px; color: #333;">Change Point Times:</h4>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace;">
                    {chr(10).join([f"• {ts}" for ts in change_point_timestamps_formatted])}
                </div>
            </div>
        </div>

        <div class='chart-container'>
            <div class='chart-title'>Resampled Sensor Data with Change Points</div>
            <div style="margin-bottom: 10px; text-align: center;">
                <label><input type="checkbox" id="showChangePoints" checked> Show Change Points (Red)</label>
            </div>
            <div id='sensor-chart' style='width:100%; height:500px;'></div>
        </div>
    </div>

    <script>
    const timestamps = {json.dumps([ts.isoformat() for ts in resampled_timestamps])};
    const sensorValues = {json.dumps(resampled_values.tolist())};
    const changePoints = {json.dumps(change_points)};
    const cpTimestamps = {json.dumps(change_point_timestamps_formatted)};

        // Sensor Data Chart
        const sensorTrace = {{
            x: timestamps,
            y: sensorValues,
            type: 'scatter',
            mode: 'lines',
            name: 'Resampled Sensor Data',
            line: {{ color: '#1f77b4', width: 1.5 }},
            hovertemplate: '<b>%{{x}}</b><br>Value: %{{y:.3f}}<extra></extra>'
        }};

        // Change Point Markers (vertical lines)
        function makeMarkers(indices, color) {{
            var markers = [];
            for (var i = 0; i < indices.length; i++) {{
                var idx = indices[i];
                if (idx < timestamps.length) {{
                    markers.push({{
                        type: 'line',
                        xref: 'x',
                        yref: 'paper',
                        x0: timestamps[idx],
                        y0: 0,
                        x1: timestamps[idx],
                        y1: 1,
                        line: {{
                            color: color,
                            width: 2,
                            dash: 'dash'
                        }}
                    }});
                }}
            }}
            return markers;
        }}
        const cpMarkers = makeMarkers(changePoints, '#dc3545'); // red

        // Highlight regions between change points in yellow ONLY if data is low
        var highlightShapes = [];
        var lowThreshold = 30; // 

        for (var i = 0; i < changePoints.length - 1; i++) {{
            var startIdx = changePoints[i];
            var endIdx = changePoints[i + 1];
            // Get the segment values and check if the mean is below the threshold
            var segmentValues = sensorValues.slice(startIdx, endIdx).map(Number);
            var segmentMean = segmentValues.reduce((a, b) => a + b, 0) / segmentValues.length;
            if (segmentMean < lowThreshold && startIdx < timestamps.length && endIdx < timestamps.length) {{
                highlightShapes.push({{
                    type: 'rect',
                    xref: 'x',
                    yref: 'paper',
                    x0: timestamps[startIdx],
                    y0: 0,
                    x1: timestamps[endIdx],
                    y1: 1,
                    fillcolor: 'rgba(255, 255, 0, 0.2)', // yellow with transparency
                    line: {{width: 0}}
                }});
            }}
        }}

        const sensorLayout = {{
            xaxis: {{
                title: 'Date/Time',
                type: 'date',
                gridcolor: '#e6e6e6'
            }},
            yaxis: {{
                title: 'Sensor Value',
                gridcolor: '#e6e6e6'
            }},
            showlegend: true,
            hovermode: 'x unified',
            plot_bgcolor: 'white',
            paper_bgcolor: 'white',
            shapes: [...highlightShapes, ...cpMarkers]
        }};

        Plotly.newPlot('sensor-chart', [sensorTrace], sensorLayout, {{responsive: true}});
        // Checkbox logic for selecting which change points to show
        function updateMarkers() {{
            const showChangePoints = document.getElementById('showChangePoints').checked;
            let shapes = [...highlightShapes];
            if (showChangePoints) shapes = shapes.concat(cpMarkers);
            Plotly.relayout('sensor-chart', {{ shapes }});
        }}
        document.getElementById('showChangePoints').addEventListener('change', updateMarkers);
        console.log('Dashboard loaded successfully!');
        console.log('Change points:', cpTimestamps);
    </script>
</body>
</html>"""

    # Write the HTML file
    with open('interactive_dashboard.html', 'w', encoding='utf-8') as f:
        f.write(html_content)

    print("HTML DASHBOARD GENERATED")
    print(f"Interactive dashboard saved as 'interactive_dashboard.html'")
    return True

def start_server():
    handler = CustomHTTPRequestHandler
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"Serving dashboard at http://localhost:{PORT}/interactive_dashboard.html")
        webbrowser.open(f"http://localhost:{PORT}/interactive_dashboard.html")
        httpd.serve_forever()

def main():
    dashboard_generated = generate_dashboard()
    if dashboard_generated:
        
        server_thread = threading.Thread(target=start_server, daemon=True)
        server_thread.start()
        # Keep main thread alive while server runs
        try:
            while True:
                pass
        except KeyboardInterrupt:
            print("Server stopped.")

if __name__ == "__main__":
    main()