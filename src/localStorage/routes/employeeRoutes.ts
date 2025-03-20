import { Hono } from 'hono';
import type { Context } from 'hono';
import { EmployeeService } from '../services/employeeService';
import { Employee, EmployeeAvailability } from '../models/types';

const employeeRoutes = new Hono();

// GET /employees - Get all employees
employeeRoutes.get('/', (c: Context) => {
    const employees = EmployeeService.getAll();
    return c.json(employees);
});

// GET /employees/:id - Get an employee by ID
employeeRoutes.get('/:id', (c: Context) => {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) {
        return c.json({ error: 'Invalid employee ID' }, 400);
    }

    const employee = EmployeeService.getById(id);
    if (!employee) {
        return c.json({ error: 'Employee not found' }, 404);
    }

    return c.json(employee);
});

// POST /employees - Create a new employee
employeeRoutes.post('/', async (c: Context) => {
    const data = await c.req.json();

    // Validate employee data
    const validation = EmployeeService.validate(data);
    if (!validation.valid) {
        return c.json({ errors: validation.errors }, 400);
    }

    try {
        const employee = EmployeeService.create(data);
        return c.json(employee, 201);
    } catch (error) {
        return c.json({ error: 'Failed to create employee' }, 500);
    }
});

// PUT /employees/:id - Update an employee
employeeRoutes.put('/:id', async (c: Context) => {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) {
        return c.json({ error: 'Invalid employee ID' }, 400);
    }

    const data = await c.req.json();

    // Validate employee data
    const validation = EmployeeService.validate(data);
    if (!validation.valid) {
        return c.json({ errors: validation.errors }, 400);
    }

    const updatedEmployee = EmployeeService.update(id, data);
    if (!updatedEmployee) {
        return c.json({ error: 'Employee not found' }, 404);
    }

    return c.json(updatedEmployee);
});

// DELETE /employees/:id - Delete an employee
employeeRoutes.delete('/:id', (c: Context) => {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) {
        return c.json({ error: 'Invalid employee ID' }, 400);
    }

    const deleted = EmployeeService.delete(id);
    if (!deleted) {
        return c.json({ error: 'Employee not found' }, 404);
    }

    return c.json({ message: 'Employee deleted successfully' });
});

// GET /employees/:id/availabilities - Get employee availabilities
employeeRoutes.get('/:id/availabilities', (c: Context) => {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) {
        return c.json({ error: 'Invalid employee ID' }, 400);
    }

    // Check if employee exists
    const employee = EmployeeService.getById(id);
    if (!employee) {
        return c.json({ error: 'Employee not found' }, 404);
    }

    const availabilities = EmployeeService.getAvailabilities(id);
    return c.json(availabilities);
});

// PUT /employees/:id/availabilities - Update employee availabilities
employeeRoutes.put('/:id/availabilities', async (c: Context) => {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) {
        return c.json({ error: 'Invalid employee ID' }, 400);
    }

    // Check if employee exists
    const employee = EmployeeService.getById(id);
    if (!employee) {
        return c.json({ error: 'Employee not found' }, 404);
    }

    const availabilities = await c.req.json();
    if (!Array.isArray(availabilities)) {
        return c.json({ error: 'Invalid availabilities data' }, 400);
    }

    try {
        const updatedAvailabilities = EmployeeService.setAvailabilities(id, availabilities);
        return c.json(updatedAvailabilities);
    } catch (error) {
        return c.json({ error: 'Failed to update availabilities' }, 500);
    }
});

export default employeeRoutes; 