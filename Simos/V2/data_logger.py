# V2/data_logger.py
import pandas as pd
import os
import json
import asyncio

csv_writer_lock = asyncio.Lock()

def flatten_dict(d, parent_key='', sep='_'):
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        elif isinstance(v, list):
            try: items.append((new_key, json.dumps(v))) # Serialize lists to JSON strings
            except TypeError: items.append((new_key, str(v))) # Fallback for non-serializable list contents
        else: items.append((new_key, v))
    return dict(items)

def _blocking_log_to_csv(flat_data: dict, filepath: str):
    try:
        df = pd.DataFrame([flat_data])
        log_dir = os.path.dirname(filepath)
        if log_dir and not os.path.exists(log_dir): # Check if log_dir is not empty string
            os.makedirs(log_dir, exist_ok=True)

        file_exists = os.path.isfile(filepath)
        # Ensure all data is string to avoid issues with mixed types in CSV columns over time
        # This is a simple approach; more sophisticated type handling might be needed for complex cases
        # For now, direct to_csv should handle basic types reasonably.
        # df = df.astype(str) # Option: convert all to string

        df.to_csv(filepath, index=False, mode='a', header=not file_exists)
    except Exception as e:
        print(f"DataLogger: Error (blocking) en CSV ({filepath}): {e}")
        # It's often better not to raise from here if called by run_in_executor,
        # as the exception might get lost or handled by the executor's future.
        # Logging is good. If raise is needed, ensure it's handled by the caller of run_in_executor.
        # For this setup, the print is the primary error feedback from the blocking part.
        # raise # Re-raising might be desired depending on how critical CSV logging is

async def log_operation_to_csv(data_dict: dict, filepath="logs/v2_operation_logs.csv"):
    if not data_dict:
        print("DataLogger: No data provided to log.")
        return
    try:
        flat_data = flatten_dict(data_dict)
        async with csv_writer_lock:
            loop = asyncio.get_event_loop()
            # The _blocking_log_to_csv will run in a default ThreadPoolExecutor
            await loop.run_in_executor(None, _blocking_log_to_csv, flat_data, filepath)
    except Exception as e:
        # This catches errors from flatten_dict or if run_in_executor itself fails to schedule.
        print(f"DataLogger: Error al programar log CSV para {filepath}: {e}")
