@echo off
REM Transform all PCD files in all subfolders from tum_dynamic to tum_dynamic_utm
python transform_pcd_to_utm_auto.py ^
  --input_dir "C:\Users\Marko\Documents\Documents\TUM\SEM2 _________38\Mapping for a Sustainable World - Seminar  5\StableSimulation\main\PointCloudDatasets\tum_dynamic" ^
  --output_dir "C:\Users\Marko\Documents\Documents\TUM\SEM2 _________38\Mapping for a Sustainable World - Seminar  5\StableSimulation\main\PointCloudDatasets\tum_dynamic_utm"
pause 