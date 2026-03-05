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


def test_long_session_with_short_non_overlapping():
    """A long session overlaps with 3 short ones, but they don't overlap each other.

    Session A: |==============================================|  (10:00-18:00)
    Session B: |==|                                              (10:00-10:05)
    Session C:              |==|                                 (14:00-14:05)
    Session D:                                       |==|        (17:00-17:05)

    At any point, max 2 sessions run simultaneously (A + one short).
    Old pairwise approach would give A=4 (wrong), sweep-line gives A=2 (correct).
    """
    result = compute_cross_session_parallelism([
        ("A", datetime(2024, 1, 1, 10, 0), datetime(2024, 1, 1, 18, 0)),
        ("B", datetime(2024, 1, 1, 10, 0), datetime(2024, 1, 1, 10, 5)),
        ("C", datetime(2024, 1, 1, 14, 0), datetime(2024, 1, 1, 14, 5)),
        ("D", datetime(2024, 1, 1, 17, 0), datetime(2024, 1, 1, 17, 5)),
    ])
    assert result["A"] == 2  # NOT 4
    assert result["B"] == 2
    assert result["C"] == 2
    assert result["D"] == 2
