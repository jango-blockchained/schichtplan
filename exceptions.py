"""Custom exceptions for the Schichtplan application."""

class SchichtplanError(Exception):
    """Base exception class for Schichtplan application."""
    pass


class ImageProcessingError(SchichtplanError):
    """Raised when there is an error processing an image."""
    pass


class OCRError(ImageProcessingError):
    """Raised when there is an error during OCR processing."""
    pass


class FileUploadError(SchichtplanError):
    """Raised when there is an error handling file uploads."""
    pass


class InvalidFileTypeError(FileUploadError):
    """Raised when an invalid file type is uploaded."""
    pass


class ScheduleParsingError(SchichtplanError):
    """Raised when there is an error parsing schedule data."""
    pass


class InvalidTimeFormatError(ScheduleParsingError):
    """Raised when a time string is in an invalid format."""
    pass


class InvalidShiftTypeError(ScheduleParsingError):
    """Raised when a shift type is invalid."""
    pass


class DatabaseError(SchichtplanError):
    """Raised when there is a database-related error."""
    pass 