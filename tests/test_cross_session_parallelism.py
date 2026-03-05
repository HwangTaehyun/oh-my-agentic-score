"""Tests for compute_cross_session_parallelism()."""

from datetime import datetime

from omas.metrics.parallelism import compute_cross_session_parallelism


def test_empty_sessions():
    assert compute_cross_session_parallelism([]) == {}


def test_single_session():
    result = compute_cross_session_parallelism([
        ("s1", datetime(2024, 1, 1, 10, 0), datetime(2024, 1, 1, 11, 0))
    ])
    assert result == {"s1": 1}


def test_three_overlapping_sessions():
    result = compute_cross_session_parallelism([
        ("s1", datetime(2024, 1, 1, 10, 0), datetime(2024, 1, 1, 11, 0)),
        ("s2", datetime(2024, 1, 1, 10, 30), datetime(2024, 1, 1, 11, 30)),
        ("s3", datetime(2024, 1, 1, 10, 45), datetime(2024, 1, 1, 11, 15)),
    ])
    assert result["s1"] == 3  # overlaps with s2 and s3
    assert result["s2"] == 3
    assert result["s3"] == 3


def test_non_overlapping_sessions():
    result = compute_cross_session_parallelism([
        ("s1", datetime(2024, 1, 1, 10, 0), datetime(2024, 1, 1, 11, 0)),
        ("s2", datetime(2024, 1, 1, 12, 0), datetime(2024, 1, 1, 13, 0)),
    ])
    assert result["s1"] == 1
    assert result["s2"] == 1


def test_partial_overlap():
    # s1 and s2 overlap, s3 doesn't overlap with either
    result = compute_cross_session_parallelism([
        ("s1", datetime(2024, 1, 1, 10, 0), datetime(2024, 1, 1, 11, 0)),
        ("s2", datetime(2024, 1, 1, 10, 30), datetime(2024, 1, 1, 11, 30)),
        ("s3", datetime(2024, 1, 1, 14, 0), datetime(2024, 1, 1, 15, 0)),
    ])
    assert result["s1"] == 2
    assert result["s2"] == 2
    assert result["s3"] == 1
