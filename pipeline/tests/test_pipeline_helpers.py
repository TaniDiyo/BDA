import os
import sys

import pytest
from pyspark.ml.functions import vector_to_array
from pyspark.ml.linalg import VectorUDT, Vectors
from pyspark.sql import SparkSession
from pyspark.sql.types import DoubleType, StructField, StructType

from features import create_assembler
from preprocess import prepare_numeric_frame


@pytest.fixture(scope="module")
def spark():
    os.environ["PYSPARK_PYTHON"] = sys.executable
    session = (
        SparkSession.builder.master("local[1]")
        .appName("FraudLensPipelineTests")
        .config("spark.ui.enabled", "false")
        .config("spark.pyspark.python", sys.executable)
        .getOrCreate()
    )
    yield session
    session.stop()


def sample_frame(spark):
    schema = StructType(
        [
            StructField("Time", DoubleType(), True),
            StructField("V1", DoubleType(), True),
            StructField("Amount", DoubleType(), True),
            StructField("Class", DoubleType(), True),
        ]
    )
    rows = [
        (10.0, 0.2, 5.0, 0.0),
        (10.0, 0.2, 5.0, 0.0),
        (20.0, None, 7.0, 1.0),
        (30.0, -0.4, 2.0, 1.0),
    ]
    return spark.createDataFrame(rows, schema)


def test_cleaning_discards_null_rows_and_exact_duplicates(spark):
    cleaned, feature_columns, input_rows, valid_rows = prepare_numeric_frame(
        sample_frame(spark)
    )

    assert input_rows == 4
    assert valid_rows == 2
    assert cleaned.count() == 2
    assert feature_columns == ["Time", "V1", "Amount"]


def test_feature_vector_contains_all_validated_features(spark):
    cleaned, feature_columns, _, _ = prepare_numeric_frame(sample_frame(spark))
    assembler = create_assembler(feature_columns)
    vectorized = assembler.transform(cleaned)

    assert "assembledFeatures" in vectorized.columns
    assert vectorized.select("assembledFeatures").first()[0].size == len(feature_columns)

def test_probability_vector_can_be_converted_to_fraud_score(spark):
    frame = spark.createDataFrame(
        [(Vectors.dense([0.15, 0.85]),)],
        StructType([StructField("probability", VectorUDT(), False)]),
    )

    assert frame.select(vector_to_array("probability")[1]).first()[0] == pytest.approx(0.85)


def test_assembler_requires_at_least_one_feature():
    with pytest.raises(ValueError, match="At least one feature column"):
        create_assembler([])
