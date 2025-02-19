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
    availabilities = db.relationship('EmployeeAvailability', back_populates='employee')

    def __init__(self, first_name, last_name, employee_group, contracted_hours, is_keyholder=False):
        self.employee_id = self._generate_employee_id(first_name, last_name)
        self.first_name = first_name
        self.last_name = last_name
        self.employee_group = employee_group
        self.contracted_hours = contracted_hours
        self.is_keyholder = is_keyholder
        
        # Validate the employee data
        if not self.validate_hours():
            raise ValueError("Invalid contracted hours for employee group")

    def _generate_employee_id(self, first_name, last_name):
        """Generate a unique 3-letter identifier based on name"""
        # Handle short names by padding with 'X'
        first = first_name[0] if first_name else 'X'
        last = last_name[:2] if len(last_name) >= 2 else (last_name + 'X' * 2)[:2]
        base_id = (first + last).upper()
        
        # Check if ID exists and generate alternative if needed
        counter = 1
        temp_id = base_id
        while Employee.query.filter_by(employee_id=temp_id).first() is not None:
            temp_id = f"{base_id[0]}{counter:02d}"
            counter += 1
        return temp_id

    def validate_hours(self) -> bool:
        """Validate contracted hours based on employee group and legal limits"""
        if not 0 <= self.contracted_hours <= 48:  # German labor law maximum
            return False
            
        if self.employee_group == EmployeeGroup.VL or self.employee_group == EmployeeGroup.TL:
            # Full-time employees should work between 35 and 48 hours
            return 35 <= self.contracted_hours <= 48
        elif self.employee_group == EmployeeGroup.TZ:
            # Part-time employees can work up to 35 hours
            return 0 < self.contracted_hours < 35
        elif self.employee_group == EmployeeGroup.GFB:
            # Minijob employees must stay under the monthly limit (556 EUR / 12.41 EUR minimum wage)
            max_monthly_hours = 556 / 12.41  # ~44.8 hours per month
            max_weekly_hours = max_monthly_hours / 4.33  # Convert to weekly hours
            return 0 <= self.contracted_hours <= max_weekly_hours
        return False

    def get_max_daily_hours(self) -> float:
        """Get maximum allowed daily hours"""
        return 10.0  # Maximum 10 hours per day according to German law

    def get_max_weekly_hours(self) -> float:
        """Get maximum allowed weekly hours based on employment type"""
        if self.employee_group in [EmployeeGroup.VL, EmployeeGroup.TL]:
            return 48.0  # Maximum 48 hours per week for full-time
        elif self.employee_group == EmployeeGroup.TZ:
            return self.contracted_hours
        else:  # GFB
            # Convert monthly limit to weekly (assuming 4.33 weeks per month)
            max_monthly_hours = 556 / 12.41
            return max_monthly_hours / 4.33

    def to_dict(self):
        """Convert employee object to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'employee_group': self.employee_group.value,
            'contracted_hours': self.contracted_hours,
            'is_keyholder': self.is_keyholder,
            'max_daily_hours': self.get_max_daily_hours(),
            'max_weekly_hours': self.get_max_weekly_hours()
        }

    def __repr__(self):
        return f"<Employee {self.employee_id}: {self.first_name} {self.last_name}>" 