# FraudLens Spark pipeline

The pipeline is an offline PySpark batch job that reads the public credit-card fraud CSV, cleans numeric fields, trains models in Spark local mode, and writes artifacts. It is not deployed with the Express API.

## Windows environment

Use Python 3.11 and Java 17. Set `JAVA_HOME` to the JDK 17 folder and add `%JAVA_HOME%\bin` to `PATH`. Some Windows Spark distributions also require `HADOOP_HOME` with a matching `winutils.exe`; configure it only if Spark reports that it is missing. Open a new PowerShell window after changing system variables and check `python --version` and `java -version`.

Download the public credit-card fraud dataset from its publisher or an authorized mirror, review its current license/terms, and place the file at `data\creditcard.csv`. The dataset is not included or fabricated in this repository.

## Install and run

From the repository root:

```powershell
Set-Location "E:\BDA Project\pipeline"
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -c "import sys; print(sys.executable)"
python -m pip install -r requirements-dev.txt
python run_pipeline.py --input data/creditcard.csv --output output
```

The printed interpreter path should be `E:\BDA Project\pipeline\.venv\Scripts\python.exe`. If a different environment was activated, run `deactivate` first and activate this folder's `.venv`. The script also falls back to its running Python executable if an inherited `PYSPARK_PYTHON` points to a missing file.

The pipeline sets Spark's master to `local[*]`. Results are local demonstration artifacts, not cluster-scale performance claims. Spark output is not written directly to Atlas; use the Node seed script from `server/` after inspecting the generated files.

## Run focused helper tests

```powershell
Set-Location "E:\BDA Project\pipeline"
py -3.11 -m pytest
```

The tests use tiny local Spark DataFrames to check invalid/null row handling, exact duplicate removal, and feature-vector construction. They require the same Python 3.11, Java 17, and PySpark setup as the batch job.
