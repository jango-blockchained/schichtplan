from src.backend.app import create_app
from src.backend.services.schedule_generator import ScheduleGenerator


def test_schedule_generation():
    app = create_app()
    with app.app_context():
        print("Creating ScheduleGenerator...")
        generator = ScheduleGenerator()

        print("Generating schedule...")
        start_date = "2025-03-10"
        end_date = "2025-03-16"
        create_empty_schedules = True

        try:
            result = generator.generate_schedule(
                start_date, end_date, create_empty_schedules
            )
            print("Schedule generation completed successfully!")
            print(f"Generated {len(result.get('schedule', []))} schedule entries")
            print(f"Errors: {result.get('errors', [])}")
            return result
        except Exception as e:
            print(f"Error generating schedule: {str(e)}")
            raise


if __name__ == "__main__":
    test_schedule_generation()
