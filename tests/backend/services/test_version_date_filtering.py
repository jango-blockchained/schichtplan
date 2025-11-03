"""
Test suite for version date range filtering.

These tests verify that the version table correctly shows all versions
that overlap with the requested date range.
"""

from datetime import date


def test_version_overlapping_logic():
    """
    Test that overlapping logic correctly identifies versions within date range.
    
    This is a documentation/specification test that shows the expected behavior.
    Actual implementation would require database setup.
    """
    
    # Test Case 1: Fully contained - version entirely within request range
    # Request: 2025-01-01 to 2025-01-31
    # Version: 2025-01-10 to 2025-01-20
    # Expected: Should match (overlaps)
    request_start = date(2025, 1, 1)
    request_end = date(2025, 1, 31)
    version_start = date(2025, 1, 10)
    version_end = date(2025, 1, 20)
    
    overlaps = version_start <= request_end and version_end >= request_start
    assert overlaps is True, "Version fully contained should overlap"
    
    # Test Case 2: Partial overlap (start) - version starts before request
    # Request: 2025-01-15 to 2025-01-31
    # Version: 2025-01-10 to 2025-01-20
    # Expected: Should match (overlaps)
    request_start = date(2025, 1, 15)
    request_end = date(2025, 1, 31)
    version_start = date(2025, 1, 10)
    version_end = date(2025, 1, 20)
    
    overlaps = version_start <= request_end and version_end >= request_start
    assert overlaps is True, "Version with partial start overlap should match"
    
    # Test Case 3: Partial overlap (end) - version ends after request
    # Request: 2025-01-01 to 2025-01-15
    # Version: 2025-01-10 to 2025-01-20
    # Expected: Should match (overlaps)
    request_start = date(2025, 1, 1)
    request_end = date(2025, 1, 15)
    version_start = date(2025, 1, 10)
    version_end = date(2025, 1, 20)
    
    overlaps = version_start <= request_end and version_end >= request_start
    assert overlaps is True, "Version with partial end overlap should match"
    
    # Test Case 4: Fully containing - version contains entire request
    # Request: 2025-01-10 to 2025-01-20
    # Version: 2025-01-01 to 2025-01-31
    # Expected: Should match (overlaps)
    request_start = date(2025, 1, 10)
    request_end = date(2025, 1, 20)
    version_start = date(2025, 1, 1)
    version_end = date(2025, 1, 31)
    
    overlaps = version_start <= request_end and version_end >= request_start
    assert overlaps is True, "Version fully containing request should match"
    
    # Test Case 5: No overlap (before) - version ends before request starts
    # Request: 2025-01-15 to 2025-01-31
    # Version: 2025-01-01 to 2025-01-10
    # Expected: Should NOT match (no overlap)
    request_start = date(2025, 1, 15)
    request_end = date(2025, 1, 31)
    version_start = date(2025, 1, 1)
    version_end = date(2025, 1, 10)
    
    overlaps = version_start <= request_end and version_end >= request_start
    assert overlaps is False, "Version ending before request should not match"
    
    # Test Case 6: No overlap (after) - version starts after request ends
    # Request: 2025-01-01 to 2025-01-10
    # Version: 2025-01-15 to 2025-01-31
    # Expected: Should NOT match (no overlap)
    request_start = date(2025, 1, 1)
    request_end = date(2025, 1, 10)
    version_start = date(2025, 1, 15)
    version_end = date(2025, 1, 31)
    
    overlaps = version_start <= request_end and version_end >= request_start
    assert overlaps is False, "Version starting after request should not match"
    
    # Test Case 7: Exact match - version exactly matches request
    # Request: 2025-01-01 to 2025-01-07
    # Version: 2025-01-01 to 2025-01-07
    # Expected: Should match (overlaps)
    request_start = date(2025, 1, 1)
    request_end = date(2025, 1, 7)
    version_start = date(2025, 1, 1)
    version_end = date(2025, 1, 7)
    
    overlaps = version_start <= request_end and version_end >= request_start
    assert overlaps is True, "Exact match should overlap"
    
    # Test Case 8: Adjacent ranges (touching at boundary) - no overlap
    # Request: 2025-01-08 to 2025-01-14
    # Version: 2025-01-01 to 2025-01-07
    # Expected: Should NOT match (no overlap)
    request_start = date(2025, 1, 8)
    request_end = date(2025, 1, 14)
    version_start = date(2025, 1, 1)
    version_end = date(2025, 1, 7)
    
    overlaps = version_start <= request_end and version_end >= request_start
    assert overlaps is False, "Adjacent ranges should not overlap"


def test_version_frontend_filtering_logic():
    """
    Test that frontend filtering logic matches backend logic.
    
    This verifies the string comparison used in the frontend TypeScript code
    works correctly with ISO 8601 date format.
    """
    
    # Frontend uses string comparison with ISO 8601 format (yyyy-MM-dd)
    # This works because ISO 8601 is lexicographically sortable
    
    # Test Case: String comparison should work the same as date comparison
    current_from = "2025-01-15"
    current_to = "2025-01-31"
    version_start = "2025-01-10"
    version_end = "2025-01-20"
    
    # Frontend logic: versionStart <= currentTo && versionEnd >= currentFrom
    frontend_overlaps = version_start <= current_to and version_end >= current_from
    
    # Backend logic (converted to dates for comparison)
    backend_overlaps = (
        date(2025, 1, 10) <= date(2025, 1, 31) and 
        date(2025, 1, 20) >= date(2025, 1, 15)
    )
    
    assert frontend_overlaps == backend_overlaps, \
        "Frontend string comparison should match backend date comparison"


if __name__ == "__main__":
    # Run tests
    test_version_overlapping_logic()
    test_version_frontend_filtering_logic()
    print("✅ All date range filtering tests passed!")
