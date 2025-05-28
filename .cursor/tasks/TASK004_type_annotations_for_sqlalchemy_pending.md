# Add Type Annotations for SQLAlchemy Models

## Description
Add proper type annotations to SQLAlchemy models to resolve linter errors like "Access to generic instance variable through class is ambiguous".

## Context
The codebase is using SQLAlchemy with both legacy query style and newer 2.0 style queries. The linter is flagging many "Access to generic instance variable through class is ambiguous" errors due to lack of proper type annotations.

## Steps to Complete
1. Research proper type annotations for SQLAlchemy 2.0
2. Add appropriate type annotations to model classes in `src/backend/models/`
3. Update imports to include necessary typing modules
4. Consider adding type ignores (`# type: ignore`) for cases where the linter can't be satisfied
5. Test the application to ensure functionality is maintained

## Notes
According to SQLAlchemy documentation:
> It should be noted that for the time being, the ORM will still accept non-SQL Core constructs for backwards compatibility. While the most common are instances of `Column` and `InstrumentedAttribute`, various ORM functions continue to invoke the "entity" registry to convert any arbitrary Python class or mapper attribute into the equivalent SQL expression construct.

The linter errors are likely due to the ambiguity in how SQLAlchemy resolves class attributes to ORM/SQL expressions. Adding proper type annotations or strategic use of `# type: ignore` comments may help.