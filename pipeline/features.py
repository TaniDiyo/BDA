"""Feature-vector construction helpers for Spark ML pipelines."""

from pyspark.ml.feature import VectorAssembler


def create_assembler(feature_columns, output_column="assembledFeatures"):
    """Build the vector assembler from validated scalar feature columns."""
    if not feature_columns:
        raise ValueError("At least one feature column is required.")
    return VectorAssembler(inputCols=list(feature_columns), outputCol=output_column)
