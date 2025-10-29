from pydantic import BaseModel, EmailStr, Field


class EmployeeCreateRequest(BaseModel):
    """Schema for the employee creation request."""

    first_name: str = Field(..., description="First name of the employee.")
    last_name: str = Field(..., description="Last name of the employee.")
    employee_group: str = Field(..., description="Employee group or department.")
    contracted_hours: float | None = Field(0, description="Contracted hours per week.")
    is_keyholder: bool | None = Field(
        False, description="Whether the employee is a keyholder."
    )
    email: EmailStr | None = Field(
        None,
        description="Employee's email address (optional, validated as email format).",
    )
    phone: str | None = Field(None, description="Employee's phone number (optional).")
    vacation_per_year: int | None = Field(
        30, description="Vacation entitlement per year in days."
    )


class EmployeeUpdateRequest(BaseModel):
    """Schema for the employee update request."""

    # All fields are optional for update
    first_name: str | None = Field(None, description="First name of the employee.")
    last_name: str | None = Field(None, description="Last name of the employee.")
    employee_group: str | None = Field(
        None, description="Employee group or department."
    )
    contracted_hours: float | None = Field(
        None, description="Contracted hours per week."
    )
    is_keyholder: bool | None = Field(
        None, description="Whether the employee is a keyholder."
    )
    is_active: bool | None = Field(None, description="Whether the employee is active.")
    email: EmailStr | None = Field(
        None,
        description="Employee's email address (optional, validated as email format).",
    )
    phone: str | None = Field(None, description="Employee's phone number (optional).")
    vacation_per_year: int | None = Field(
        None, description="Vacation entitlement per year in days."
    )
    # employee_id is not updatable via this endpoint, so it's not included
