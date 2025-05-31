#!/usr/bin/env bun

import { getDb } from "../db";
import { scheduleLogger } from "../logger";

async function setupAIScheduling() {
    const db = getDb();
    
    try {
        console.log("🚀 Setting up AI Scheduling features...");
        
        // 1. Run the migration
        console.log("📋 Running database migration...");
        const migrationPath = new URL("../db/migrations/add_ai_schedule_tables.sql", import.meta.url).pathname;
        const file = Bun.file(migrationPath);
        const migrationSQL = await file.text();
        
        // Split by semicolon and execute each statement
        const statements = migrationSQL
            .split(";")
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0);
        
        for (const statement of statements) {
            try {
                db.run(statement + ";");
            } catch (error: any) {
                console.error(`Error executing statement: ${error.message}`);
                console.error(`Statement: ${statement.substring(0, 100)}...`);
            }
        }
        
        console.log("✅ Migration completed successfully!");
        
        // 2. Add demo employee preferences
        console.log("📝 Adding demo employee preferences...");
        
        // Get all active employees
        const employees = db.query(`
            SELECT id, first_name, last_name, employee_group 
            FROM employees 
            WHERE is_active = 1
        `).all() as any[];
        
        console.log(`Found ${employees.length} active employees`);
        
        // Add preferences for each employee
        const preferenceStmt = db.prepare(`
            INSERT OR REPLACE INTO employee_preferences 
            (employee_id, preference_type, day_of_week, start_time, end_time, preference_level)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        for (const employee of employees) {
            // Add day preferences based on employee group
            if (employee.employee_group === 'VZ') {
                // Full-time prefer weekdays
                for (let day = 1; day <= 5; day++) { // Mon-Fri
                    preferenceStmt.run(employee.id, 'day', day, null, null, 4); // Like
                }
                // Neutral on weekends
                preferenceStmt.run(employee.id, 'day', 0, null, null, 3); // Sunday - neutral
                preferenceStmt.run(employee.id, 'day', 6, null, null, 3); // Saturday - neutral
            } else if (employee.employee_group === 'TZ') {
                // Part-time - varied preferences
                const preferredDays = Math.random() > 0.5 ? [1, 3, 5] : [2, 4]; // Either MWF or TuTh
                for (const day of preferredDays) {
                    preferenceStmt.run(employee.id, 'day', day, null, null, 5); // Strongly like
                }
            }
            
            // Add time preferences
            if (employee.employee_group === 'VZ' || employee.employee_group === 'TL') {
                // Prefer morning shifts
                preferenceStmt.run(employee.id, 'time', null, '08:00', '14:00', 4); // Like morning
                preferenceStmt.run(employee.id, 'time', null, '14:00', '20:00', 2); // Dislike afternoon
            } else {
                // Part-time might prefer afternoon
                if (Math.random() > 0.5) {
                    preferenceStmt.run(employee.id, 'time', null, '14:00', '20:00', 4); // Like afternoon
                    preferenceStmt.run(employee.id, 'time', null, '08:00', '14:00', 2); // Dislike morning
                }
            }
        }
        
        console.log("✅ Added employee preferences!");
        
        // 3. Add some qualifications
        console.log("📋 Adding employee qualifications...");
        
        const qualificationStmt = db.prepare(`
            INSERT OR REPLACE INTO employee_qualifications 
            (employee_id, qualification_id, acquired_date, is_active)
            VALUES (?, ?, ?, 1)
        `);
        
        // Add keyholder qualification to those who can be keyholders
        const keyholders = db.query(`
            SELECT id FROM employees WHERE can_be_keyholder = 1
        `).all() as any[];
        
        for (const keyholder of keyholders) {
            qualificationStmt.run(keyholder.id, 'keyholder', '2023-01-01');
        }
        
        // Add cash register qualification to most employees
        for (const employee of employees) {
            if (Math.random() > 0.2) { // 80% have cash register qualification
                qualificationStmt.run(employee.id, 'cash_register', '2023-01-01');
            }
        }
        
        console.log("✅ Added employee qualifications!");
        
        // 4. Add some performance metrics
        console.log("📊 Adding performance metrics...");
        
        const metricsStmt = db.prepare(`
            INSERT OR REPLACE INTO schedule_performance_metrics 
            (employee_id, metric_date, punctuality_score, reliability_score, quality_score, attendance_rate)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        const today = new Date();
        for (const employee of employees) {
            // Add metrics for the last 30 days
            for (let i = 0; i < 30; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                
                // Generate random but realistic scores
                const punctuality = 0.8 + Math.random() * 0.2; // 0.8-1.0
                const reliability = 0.85 + Math.random() * 0.15; // 0.85-1.0
                const quality = 0.75 + Math.random() * 0.25; // 0.75-1.0
                const attendance = 0.9 + Math.random() * 0.1; // 0.9-1.0
                
                metricsStmt.run(employee.id, dateStr, punctuality, reliability, quality, attendance);
            }
        }
        
        console.log("✅ Added performance metrics!");
        
        // 5. Verify setup
        console.log("\n📊 Verification:");
        
        const prefCount = db.query("SELECT COUNT(*) as count FROM employee_preferences").get() as any;
        console.log(`  - Employee preferences: ${prefCount.count}`);
        
        const qualCount = db.query("SELECT COUNT(*) as count FROM employee_qualifications").get() as any;
        console.log(`  - Employee qualifications: ${qualCount.count}`);
        
        const metricsCount = db.query("SELECT COUNT(*) as count FROM schedule_performance_metrics").get() as any;
        console.log(`  - Performance metrics: ${metricsCount.count}`);
        
        console.log("\n✅ AI Scheduling setup completed successfully!");
        console.log("You can now use the AI-powered schedule generation feature!");
        
    } catch (error) {
        console.error("❌ Error setting up AI scheduling:", error);
        process.exit(1);
    }
}

// Run the setup
setupAIScheduling().catch(console.error);