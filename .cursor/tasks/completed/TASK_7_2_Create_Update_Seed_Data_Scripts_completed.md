# Task: Create/Update Seed Data Scripts

**ID:** TASK_7_2_Create_Update_Seed_Data_Scripts
**Status:** completed
**Priority:** Medium
**Category:** Database Management

**Description:**
Develop or update scripts to populate the development database with realistic sample data for all core entities (employees, shift templates, coverage rules, etc.) to facilitate development and testing.

**Outcome:**
- Updated the existing script at `$WORKSPACE/src/backend/tools/data_generators/update_demo_data.py` to serve as the main seed data script.
- The script now orchestrates the generation of data for Settings, Employees, Users (default admin), Shift Templates, Coverage rules, Employee Availability, and Absences.
- It leverages data generation functions from `$WORKSPACE/src/backend/api/demo_data.py`.
- Added command-line arguments:
    - `--clear`: Clears relevant database tables (excluding settings and admin user by default) before seeding.
    - `--num-employees <N>`: Specifies the number of employees to generate.
- Improved logging for better feedback during execution.

**To Run the Seed Script:**
```bash
cd $WORKSPACE
python src/backend/tools/data_generators/update_demo_data.py --clear --num-employees 30
```
(Adjust arguments as needed)
