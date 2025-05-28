# Add Type Annotations for SQLAlchemy Models

## Description
Add proper type annotations to SQLAlchemy models to resolve linter errors like "Access to generic instance variable through class is ambiguous".

## Context
The codebase is using SQLAlchemy with both legacy query style and newer 2.0 style queries. The linter is flagging many "Access to generic instance variable through class is ambiguous" errors due to lack of proper type annotations.

## Implementation Plan
1. Research proper type annotations for SQLAlchemy 2.0 ✅
   - Confirmed using SQLAlchemy 2.0.40 and Flask-SQLAlchemy 3.1.1
   - Need to use ClassVar annotations for column/relationship definitions

2. Create type annotation template for SQLAlchemy models ✅
   - Use ClassVar for column and relationship declarations
   - Add instance attribute type annotations
   - Add return type annotations to methods

3. Apply type annotations to models in this order:
   - Employee model (as proof of concept)
   - Simple models first (Settings, Absence, Coverage)
   - More complex models (Schedule, ShiftTemplate, EmployeeAvailability)
   - User model last

4. For each model:
   - Add necessary imports (typing, ClassVar, etc.)
   - Add ClassVar to column declarations
   - Add instance attribute type annotations
   - Add return type annotations to methods
   - Use string literals for relationship annotations to avoid circular imports

5. Test and verify:
   - Application runs without errors
   - Linter errors are resolved
   - Functionality is maintained

## Example Implementation (Employee Model)
```python
from typing import ClassVar, List, Optional, Dict, Any
from datetime import datetime, date
from . import db
from enum import Enum
from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, Date, Enum as SQLEnum

class Employee(db.Model):
    __tablename__ = "employees"

    # Column declarations as class variables
    id: ClassVar = Column(Integer, primary_key=True)
    employee_id: ClassVar = Column(String(50), unique=True, nullable=False)
    # ... other columns ...

    # Instance attribute annotations for proper type inference
    id: int
    employee_id: str
    # ... other instance attributes ...

    # Relationship declarations with ClassVar
    schedule_entries: ClassVar = relationship("Schedule", back_populates="employee")
    
    # Instance relationship annotations
    schedule_entries: List["Schedule"]

    def __init__(self, ...) -> None:
        # Existing implementation
        ...

    def to_dict(self) -> Dict[str, Any]:
        # Existing implementation
        ...
```

## Notes
According to SQLAlchemy documentation:
> It should be noted that for the time being, the ORM will still accept non-SQL Core constructs for backwards compatibility. While the most common are instances of `Column` and `InstrumentedAttribute`, various ORM functions continue to invoke the "entity" registry to convert any arbitrary Python class or mapper attribute into the equivalent SQL expression construct.

The linter errors are likely due to the ambiguity in how SQLAlchemy resolves class attributes to ORM/SQL expressions. Adding proper type annotations will help distinguish between class-level column definitions and instance-level attributes.

## Progress
- ✅ Researched SQLAlchemy 2.0 type annotation patterns
- ✅ Created type annotation template
- ⬜ Apply to Employee model
- ⬜ Apply to simple models
- ⬜ Apply to complex models
- ⬜ Apply to User model
- ⬜ Test and verify