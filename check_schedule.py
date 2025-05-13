from models import db, Schedule
from utils.db_utils import session_manager
from pprint import pprint

def check_schedules():
    with session_manager() as session:
        # Query for version 2 schedules
        schedules = session.query(Schedule).filter(Schedule.version == 2).all()
        
        print(f"Found {len(schedules)} schedule entries for version 2")
        
        # Display the first 5 entries if any exist
        if schedules:
            for i, schedule in enumerate(schedules[:5]):
                print(f"\nSchedule {i+1}:")
                print(f"  ID: {schedule.id}")
                print(f"  Employee ID: {schedule.employee_id}")
                print(f"  Shift ID: {schedule.shift_id}")
                print(f"  Date: {schedule.date}")
                print(f"  Status: {schedule.status}")
                print(f"  Version: {schedule.version}")
                print(f"  Shift Type: {schedule.shift_type}")
        else:
            print("No schedule entries found for version 2")
            
            # Check if there are entries for any version
            all_schedules = session.query(Schedule).all()
            print(f"Total schedule entries in database: {len(all_schedules)}")
            
            if all_schedules:
                print("\nVersions found in database:")
                versions = {s.version for s in all_schedules}
                print(versions)
                
                # Show a few samples from other versions
                print("\nSample entries from other versions:")
                samples = session.query(Schedule).limit(3).all()
                for i, schedule in enumerate(samples):
                    print(f"\nSample {i+1} (Version {schedule.version}):")
                    print(f"  ID: {schedule.id}")
                    print(f"  Employee ID: {schedule.employee_id}")
                    print(f"  Shift ID: {schedule.shift_id}")
                    print(f"  Date: {schedule.date}")
                    print(f"  Status: {schedule.status}")
        
if __name__ == "__main__":
    check_schedules() 