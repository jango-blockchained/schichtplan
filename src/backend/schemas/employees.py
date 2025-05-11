from pydantic import BaseModel, Field, EmailStr
from typing import Optional

class EmployeeCreateRequest(BaseModel):
    """Schema for the employee creation request."""
    first_name: str = Field(..., description="First name of the employee.")
    last_name: str = Field(..., description="Last name of the employee.")
    employee_group: str = Field(..., description="Employee group or department.")
    contracted_hours: Optional[float] = Field(0, description="Contracted hours per week.")
    is_keyholder: Optional[bool] = Field(False, description="Whether the employee is a keyholder.")
    email: Optional[EmailStr] = Field(None, description="Employee's email address (optional, validated as email format).")
    phone: Optional[str] = Field(None, description="Employee's phone number (optional).")

class EmployeeUpdateRequest(BaseModel):
    """Schema for the employee update request."""
    # All fields are optional for update
    first_name: Optional[str] = Field(None, description="First name of the employee.")
    last_name: Optional[str] = Field(None, description="Last name of the employee.")
    employee_group: Optional[str] = Field(None, description="Employee group or department.")
    contracted_hours: Optional[float] = Field(None, description="Contracted hours per week.")
    is_keyholder: Optional[bool] = Field(None, description="Whether the employee is a keyholder.")
    is_active: Optional[bool] = Field(None, description="Whether the employee is active.")
    email: Optional[EmailStr] = Field(None, description="Employee's email address (optional, validated as email format).")
    phone: Optional[str] = Field(None, description="Employee's phone number (optional).")
    # employee_id is not updatable via this endpoint, so it's not included 