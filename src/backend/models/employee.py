from . import db
from enum import Enum

class EmployeeGroup(str, Enum):
    VL = "VL"  # Vollzeit
    TZ = "TZ"  # Teilzeit
    GFB = "GfB"  # Geringfügig Beschäftigt
    TL = "TL"  # Team Leader

class Employee(db.Model):
    __tablename__ = 'employees'

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.String(3), unique=True, nullable=False)  # 3-letter identifier
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    employee_group = db.Column(db.Enum(EmployeeGroup), nullable=False)
    contracted_hours = db.Column(db.Float, nullable=False)
    is_keyholder = db.Column(db.Boolean, default=False)
    
    # Relationships
    shifts = db.relationship('Schedule', back_populates='employee')

    def __init__(self, first_name, last_name, employee_group, contracted_hours, is_keyholder=False):
        self.employee_id = self._generate_employee_id(first_name, last_name)
        self.first_name = first_name
        self.last_name = last_name
        self.employee_group = employee_group
        self.contracted_hours = contracted_hours
        self.is_keyholder = is_keyholder

    def _generate_employee_id(self, first_name, last_name):
        """Generate a unique 3-letter identifier based on name"""
        # Handle short names by padding with 'X'
        first = first_name[0] if first_name else 'X'
        last = last_name[:2] if len(last_name) >= 2 else (last_name + 'X' * 2)[:2]
        return (first + last).upper()

    def validate_hours(self):
        """Validate contracted hours based on employee group"""
        if self.employee_group == EmployeeGroup.VL or self.employee_group == EmployeeGroup.TL:
            return self.contracted_hours == 40
        elif self.employee_group == EmployeeGroup.TZ:
            return self.contracted_hours in [10, 20, 30]
        elif self.employee_group == EmployeeGroup.GFB:
            return self.contracted_hours <= 40  # Monthly hours
        return False

    def to_dict(self):
        """Convert employee object to dictionary for JSON serialization"""
        try:
            return {
                'id': self.id,
                'employee_id': self.employee_id,
                'first_name': self.first_name,
                'last_name': self.last_name,
                'employee_group': self.employee_group.value if self.employee_group else None,
                'contracted_hours': self.contracted_hours,
                'is_keyholder': self.is_keyholder
            }
        except Exception as e:
            # Log the error but re-raise it to be handled by the route
            print(f"Error in Employee.to_dict for employee {self.id}: {str(e)}")
            raise

    def __repr__(self):
        return f"<Employee {self.employee_id}: {self.first_name} {self.last_name}>" 