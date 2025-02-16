.PHONY: install test lint format run init-db clean

install:
	python -m pip install -r requirements.txt

test:
	pytest src/backend/tests/

lint:
	flake8 src/
	mypy src/

format:
	black src/

run:
	python run.py

init-db:
	python src/backend/db_init.py

clean:
	find . -type d -name "__pycache__" -exec rm -r {} +
	find . -type d -name ".pytest_cache" -exec rm -r {} +
	find . -type d -name ".mypy_cache" -exec rm -r {} +
	find . -type f -name "*.pyc" -delete 