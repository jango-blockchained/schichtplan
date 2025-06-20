# MCP CRUD Extension Implementation Plan

## Phase 1: Core CRUD Tools (Week 1)

### Create new MCP tools class
- File: `src/backend/services/mcp_tools/crud_operations.py`
- Implement basic CRUD for core entities
- Add to MCP service registration

### Tools to implement:
1. `manage_employees` - Employee + EmployeeAvailability CRUD
2. `manage_schedules` - Schedule entries CRUD  
3. `manage_absences` - Absence tracking CRUD
4. `manage_shift_templates` - Shift template CRUD

### Implementation structure:
```python
class CRUDOperationsTools:
    """Tools for CRUD operations on core entities."""
    
    def __init__(self, flask_app, logger=None):
        self.flask_app = flask_app
        self.logger = logger or logging.getLogger(__name__)
    
    def register_tools(self, mcp):
        """Register CRUD operation tools with the MCP service."""
        
        @mcp.tool()
        async def manage_employees(
            ctx: Context,
            operation: str,  # "create", "read", "update", "delete", "list"
            employee_data: Optional[Dict] = None,
            availability_data: Optional[List[Dict]] = None,
            filters: Optional[Dict] = None,
            include_availability: bool = True,
            dry_run: bool = False
        ) -> Dict[str, Any]:
            """Manage employee records and availability."""
            # Implementation here
            
        @mcp.tool()
        async def manage_schedules(
            ctx: Context,
            operation: str,
            schedule_data: Optional[Dict] = None,
            filters: Optional[Dict] = None,
            bulk_data: Optional[List[Dict]] = None,
            validate_conflicts: bool = True,
            dry_run: bool = False
        ) -> Dict[str, Any]:
            """Manage schedule entries."""
            # Implementation here
            
        # Additional tools...
```

## Phase 2: Workflow Tools (Week 2)

### Implement business logic workflows:
1. `execute_staffing_workflow` - Complex staffing operations
2. `execute_schedule_workflow` - Complex schedule operations  
3. `process_business_request` - Natural language processing

### Integration points:
- Connect with existing scheduler components
- Leverage AI orchestrator for complex workflows
- Add business rule validation

## Phase 3: Admin Tools (Week 3)

### System management tools:
1. `manage_system_config` - Settings and system data
2. `manage_versions` - Version and metadata management

### Security enhancements:
- Audit logging for all operations
- Permission validation
- Transaction rollback support

## Phase 4: Testing & Documentation (Week 4)

### Testing strategy:
- Unit tests for each tool
- Integration tests with existing MCP tools
- AI usage pattern testing

### Documentation:
- Update MCP documentation
- Create AI usage examples
- Tool parameter reference

## Tool Integration

### Update MCP service registration:
```python
# In src/backend/services/mcp_service.py
from src.backend.services.mcp_tools.crud_operations import CRUDOperationsTools

class SchichtplanMCPService:
    def __init__(self, flask_app: Optional[Flask] = None, logger: Optional[logging.Logger] = None):
        # ... existing code ...
        self.crud_operations_tools = CRUDOperationsTools(self.flask_app, self.logger)
        
    def _register_tools(self):
        """Register all tools with the MCP service."""
        # ... existing registrations ...
        self.crud_operations_tools.register_tools(self.mcp)
```

## Example AI Usage Patterns

### Creating a new employee:
```python
# Simple creation
await manage_employees(
    operation="create",
    employee_data={
        "first_name": "John",
        "last_name": "Smith", 
        "employee_group": "TZ",
        "contracted_hours": 20,
        "is_keyholder": False
    },
    availability_data=[
        {"day_of_week": 1, "hour": 9, "availability_type": "FIXED"},
        {"day_of_week": 1, "hour": 10, "availability_type": "FIXED"},
        # ... more availability
    ]
)

# Workflow-based creation
await execute_staffing_workflow(
    workflow_type="hire_and_schedule",
    requirements={
        "position": "part_time_cashier",
        "preferred_hours": "mornings",
        "start_date": "2025-01-01"
    }
)

# Natural language
await process_business_request(
    request_description="We need someone who can work weekends and is a keyholder"
)
```

### Updating schedules:
```python
# Single schedule update
await manage_schedules(
    operation="update", 
    schedule_data={
        "id": 123,
        "employee_id": 45,
        "shift_id": 67,
        "date": "2025-01-15"
    }
)

# Bulk schedule creation
await manage_schedules(
    operation="create",
    bulk_data=[
        {"employee_id": 1, "shift_id": 1, "date": "2025-01-01"},
        {"employee_id": 2, "shift_id": 2, "date": "2025-01-01"},
        # ... more schedules
    ]
)
```

## Benefits Summary

### For AI:
- Natural, semantic operations
- Flexible parameter structure
- Business logic integration
- Multiple ways to accomplish goals

### For System:
- Manageable tool count (9 vs 36)
- Organized, maintainable code
- Transaction safety
- Audit trail

### For Users:
- Comprehensive CRUD coverage
- Workflow automation
- Natural language support
- Conflict prevention

## Risk Mitigation

### Data integrity:
- All operations use database transactions
- Validation at multiple levels
- Rollback capabilities
- Dry-run mode for testing

### Performance:
- Bulk operations support
- Efficient queries with proper filtering
- Lazy loading of related data
- Caching where appropriate

### Security:
- Operation logging
- Permission checks
- Input validation
- SQL injection prevention

This plan provides comprehensive CRUD functionality while maintaining the MCP tool ecosystem's usability and AI-friendliness.
