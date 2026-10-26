"""Small, testable data-cleaning helpers used by the Spark batch job."""

from pyspark.sql import functions as F


def prepare_numeric_frame(source, label_column="Class"):
    """Cast numeric inputs, discard invalid rows, and remove exact duplicates."""
    if label_column not in source.columns:
        raise ValueError(f"Required target column '{label_column}' is missing.")

    feature_columns = [column for column in source.columns if column != label_column]
    if not feature_columns:
        raise ValueError("The input must include at least one feature column.")

    frame = source.select(
        *[F.col(column).cast("double").alias(column) for column in feature_columns],
        F.col(label_column).cast("double").alias("label"),
    )
    valid = F.col("label").isin(0.0, 1.0)
    for column in feature_columns:
        value = F.col(column)
        valid = valid & value.isNotNull() & ~F.isnan(value)

    input_rows = source.count()
    cleaned = frame.filter(valid).dropDuplicates()
    valid_rows = cleaned.count()
    return cleaned, feature_columns, input_rows, valid_rows
