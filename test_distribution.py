from datetime import date
from collections import defaultdict

class MockEmployee:
    def __init__(self, id, is_active=True, is_keyholder=False):
        self.id = id
        self.is_active = is_active
        self.is_keyholder = is_keyholder

class MockShift:
    def __init__(self, id, start_time, end_time, shift_type=None):
        self.id = id
        self.start_time = start_time
        self.end_time = end_time
        self.shift_type_id = shift_type or 'MIDDLE'

class MockResource:
    def __init__(self, employees, shifts):
        self.employees = employees
        self.shifts = shifts
        
    def get_shift(self, shift_id):
        for shift in self.shifts:
            if shift.id == shift_id:
                return shift
        return None

# Test function to simulate the assignment logic
def test_assign_employees(shifts, employees, current_date, shift_type):
    print(f"\nAssigning employees for shift type {shift_type} on {current_date}")
    print(f"Available shifts: {len(shifts)}")
    print(f"Available employees: {len(employees)}")
    
    assignments = []
    assignments_by_employee = defaultdict(list)
    
    for shift in shifts:
        if shift.shift_type_id == shift_type:
            for employee in employees:
                # Check if employee can be assigned
                if len(assignments_by_employee.get(employee.id, [])) < 5:
                    assignment = {
                        "employee_id": employee.id,
                        "shift_id": shift.id,
                        "date": current_date,
                        "start_time": shift.start_time,
                        "end_time": shift.end_time,
                        "shift_type": shift_type,
                        "status": "GENERATED"
                    }
                    
                    assignments.append(assignment)
                    assignments_by_employee[employee.id].append(assignment)
                    print(f"Assigned employee {employee.id} to shift {shift.id}")
                    break
    
    print(f"Made {len(assignments)} assignments for shift type {shift_type}")
    return assignments, assignments_by_employee

# Create test data
employees = [
    MockEmployee(1),
    MockEmployee(2),
    MockEmployee(3, is_keyholder=True)
]

shifts = [
    MockShift(1, "08:00", "16:00", "EARLY"),
    MockShift(2, "12:00", "20:00", "MIDDLE"),
    MockShift(3, "16:00", "22:00", "LATE")
]

# Run test
resource = MockResource(employees, shifts)
current_date = date(2025, 4, 1)
shift_type = "EARLY"

# Test assignment
filtered_shifts = [shift for shift in shifts if shift.shift_type_id == shift_type]
assignments, assignments_by_employee = test_assign_employees(
    filtered_shifts, 
    employees,
    current_date,
    shift_type
)

print("\nAssignments created:", len(assignments))
for assignment in assignments:
    print(f"Employee {assignment['employee_id']} assigned to shift {assignment['shift_id']} on {assignment['date']}")

print("\nAssignments by employee:")
for employee_id, employee_assignments in assignments_by_employee.items():
    print(f"Employee {employee_id}: {len(employee_assignments)} assignments")

if __name__ == "__main__":
    print("Test complete!") 