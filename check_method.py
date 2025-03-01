import os


def check_method(file_path, method_name):
    """Check for a method and its references in a file."""
    if not os.path.exists(file_path):
        print(f"File {file_path} does not exist.")
        return

    with open(file_path, "r") as f:
        lines = f.readlines()

    # Look for method definition
    method_def = None
    method_def_line = -1

    # Look for references
    references = []

    for i, line in enumerate(lines):
        # Check for method definition
        if f"def {method_name}" in line:
            method_def = line.strip()
            method_def_line = i

        # Check for references
        if method_name in line and "def " not in line:
            references.append((i + 1, line.strip()))

    # Print results
    print(f"Checking for method: {method_name}")
    print("-" * 50)

    if method_def:
        print(f"Method definition found at line {method_def_line + 1}:")
        print(method_def)

        # Print method implementation
        print("\nMethod implementation:")
        indent = len(lines[method_def_line]) - len(lines[method_def_line].lstrip())
        j = method_def_line + 1
        while j < len(lines) and (
            len(lines[j].strip()) == 0
            or len(lines[j]) - len(lines[j].lstrip()) > indent
        ):
            print(lines[j].rstrip())
            j += 1
    else:
        print("Method definition not found.")

    print("\nReferences:")
    if references:
        for line_num, line in references:
            print(f"Line {line_num}: {line}")
    else:
        print("No references found.")


if __name__ == "__main__":
    file_path = "src/backend/services/schedule_generator.py"
    method_name = "_is_employee_absent"

    check_method(file_path, method_name)
