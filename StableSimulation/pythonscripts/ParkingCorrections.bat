@echo off
REM Pokreni ParkingCorrections skriptu

REM Aktiviraj virtuelno okruženje
call "C:\Users\Marko\Documents\Documents\TUM\SEM2 _________38\Mapping for a Sustainable World - Seminar  5\StableSimulation\.venv\Scripts\activate.bat"

REM Promeni u pythonscripts direktorijum
cd "C:\Users\Marko\Documents\Documents\TUM\SEM2 _________38\Mapping for a Sustainable World - Seminar  5\StableSimulation\pythonscripts"

REM Instaliraj pandas ako nije instaliran
pip install pandas

REM Pokreni Python skriptu
python ParkingCorrections.py

pause 