import { scheduleLogger } from "../logger";
import type { Database } from 'bun:sqlite';
import { differenceInDays, parseISO, startOfWeek, format } from 'date-fns';

// AI Scoring Configuration
export interface AIScoringConfig {
    // Weights for different scoring factors (0-1)
    weights: {
        availability: number;      // Base availability score
        preferences: number;       // Employee preferences (day/time)
        fairness: number;         // Fair distribution of hours
        history: number;          // Historical performance
        workload: number;         // Current workload balance
        keyholder: number;        // Keyholder qualification bonus
        skills: number;           // Skill matching
        fatigue: number;          // Consecutive days/fatigue factor
        seniority: number;        // Seniority/experience level
    };
    
    // Thresholds
    fatigueThreshold: number;     // Days before fatigue penalty kicks in
    workloadBalanceTarget: number; // Target hours per week
    historicalLookbackDays: number; // Days to look back for history
}

// Default configuration
export const DEFAULT_AI_CONFIG: AIScoringConfig = {
    weights: {
        availability: 0.3,
        preferences: 0.2,
        fairness: 0.15,
        history: 0.1,
        workload: 0.1,
        keyholder: 0.05,
        skills: 0.05,
        fatigue: 0.05,
        seniority: 0.0,  // Default to 0 weight for backward compatibility
    },
    fatigueThreshold: 4,
    workloadBalanceTarget: 40,
    historicalLookbackDays: 30,
};

// Employee historical data
export interface EmployeeHistory {
    employeeId: string;
    totalShifts: number;
    totalHours: number;
    averageShiftLength: number;
    lastShiftDate: Date | null;
    shiftTypeDistribution: Map<string, number>;
    weeklyHoursHistory: Map<number, number>; // week number -> hours
    punctualityScore: number; // 0-1
    reliabilityScore: number; // 0-1
}

// AI Scoring Context
export interface ScoringContext {
    employeeId: string;
    shiftStartTime: Date;
    shiftEndTime: Date;
    shiftType?: string;
    requiredSkills?: string[];
    isKeyholderRequired: boolean;
    currentWeekHours: number;
    consecutiveDays: number;
    employeeHistory?: EmployeeHistory;
    teamAverageHours: number;
    seniority?: number; // Years of service
    coverageNeeds: {
        critical: boolean;
        understaffed: boolean;
        overstaffedRisk: boolean;
    };
}

// ML Feature extraction for future model integration
export interface MLFeatures {
    // Time-based features
    dayOfWeek: number;
    hourOfDay: number;
    isWeekend: boolean;
    isHoliday: boolean;
    
    // Employee features
    totalExperience: number;
    recentShiftCount: number;
    averageWeeklyHours: number;
    hoursVariance: number;
    
    // Shift features
    shiftDurationHours: number;
    shiftType: string;
    requiredSkillCount: number;
    
    // Context features
    teamSize: number;
    coverageRatio: number;
    daysSinceLastShift: number;
    
    // Performance features
    punctualityScore: number;
    reliabilityScore: number;
}

export class AIScheduleScorer {
    private config: AIScoringConfig;
    private db: Database | null;
    private employeeHistoryCache: Map<string, EmployeeHistory>;
    
    constructor(config: AIScoringConfig = DEFAULT_AI_CONFIG, db?: Database) {
        this.config = config;
        this.db = db || null;
        this.employeeHistoryCache = new Map();
    }
    
    /**
     * Calculate the AI score for assigning an employee to a shift
     * Returns a score between 0 and 1, where 1 is the best fit
     */
    public async calculateScore(context: ScoringContext): Promise<number> {
        scheduleLogger.debug(`Calculating AI score for employee ${context.employeeId}`);
        
        // Get or load employee history
        if (!context.employeeHistory) {
            context.employeeHistory = await this.loadEmployeeHistory(context.employeeId, context.shiftStartTime);
        }
        
        // Calculate individual component scores
        const scores = {
            availability: this.calculateAvailabilityScore(context),
            preferences: await this.calculatePreferenceScore(context),
            fairness: this.calculateFairnessScore(context),
            history: this.calculateHistoryScore(context),
            workload: this.calculateWorkloadScore(context),
            keyholder: this.calculateKeyholderScore(context),
            skills: await this.calculateSkillScore(context),
            fatigue: this.calculateFatigueScore(context),
            seniority: this.calculateSeniorityScore(context),
        };
        
        // Apply weights and calculate final score
        let totalScore = 0;
        let totalWeight = 0;
        
        for (const [factor, score] of Object.entries(scores)) {
            const weight = this.config.weights[factor as keyof typeof this.config.weights];
            totalScore += score * weight;
            totalWeight += weight;
        }
        
        const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
        
        scheduleLogger.debug(`AI Score for ${context.employeeId}: ${finalScore.toFixed(3)} - Components:`, scores);
        
        return finalScore;
    }
    
    /**
     * Extract ML features for future model training/prediction
     */
    public extractMLFeatures(context: ScoringContext): MLFeatures {
        const shiftDate = context.shiftStartTime;
        const daysSinceLastShift = context.employeeHistory?.lastShiftDate 
            ? differenceInDays(shiftDate, context.employeeHistory.lastShiftDate)
            : 999;
        
        return {
            // Time-based features
            dayOfWeek: shiftDate.getDay(),
            hourOfDay: shiftDate.getHours(),
            isWeekend: shiftDate.getDay() === 0 || shiftDate.getDay() === 6,
            isHoliday: false, // TODO: Integrate holiday calendar
            
            // Employee features
            totalExperience: context.employeeHistory?.totalShifts || 0,
            recentShiftCount: context.employeeHistory?.totalShifts || 0,
            averageWeeklyHours: context.employeeHistory?.totalHours 
                ? (context.employeeHistory.totalHours / Math.max(1, context.employeeHistory.weeklyHoursHistory.size)) 
                : 0,
            hoursVariance: this.calculateHoursVariance(context.employeeHistory),
            
            // Shift features
            shiftDurationHours: (context.shiftEndTime.getTime() - context.shiftStartTime.getTime()) / (1000 * 60 * 60),
            shiftType: context.shiftType || 'regular',
            requiredSkillCount: context.requiredSkills?.length || 0,
            
            // Context features
            teamSize: 0, // TODO: Calculate from current assignments
            coverageRatio: context.coverageNeeds.understaffed ? 0.5 : (context.coverageNeeds.overstaffedRisk ? 1.5 : 1.0),
            daysSinceLastShift,
            
            // Performance features
            punctualityScore: context.employeeHistory?.punctualityScore || 0.8,
            reliabilityScore: context.employeeHistory?.reliabilityScore || 0.8,
        };
    }
    
    // Component score calculations
    
    private calculateAvailabilityScore(context: ScoringContext): number {
        // Base availability is binary - either available (1.0) or not (0.0)
        // This is handled by the candidate filtering, so if we're here, they're available
        return 1.0;
    }
    
    private async calculatePreferenceScore(context: ScoringContext): Promise<number> {
        if (!this.db) return 0.5; // Neutral if no database
        
        try {
            // Query employee preferences
            const prefsQuery = this.db.query(`
                SELECT preference_type, day_of_week, start_time, end_time, preference_level
                FROM employee_preferences
                WHERE employee_id = ?
            `);
            const prefs = prefsQuery.all(context.employeeId) as any[];
            
            let score = 0.5; // Start neutral
            const shiftDay = context.shiftStartTime.getDay();
            const shiftHour = context.shiftStartTime.getHours();
            
            for (const pref of prefs) {
                if (pref.preference_type === 'day' && pref.day_of_week === shiftDay) {
                    // Map preference_level to score adjustment
                    // Assuming: 1=strongly dislike, 2=dislike, 3=neutral, 4=like, 5=strongly like
                    score += (pref.preference_level - 3) * 0.25;
                } else if (pref.preference_type === 'time') {
                    const prefStartHour = parseInt(pref.start_time.split(':')[0]);
                    const prefEndHour = parseInt(pref.end_time.split(':')[0]);
                    
                    if (shiftHour >= prefStartHour && shiftHour < prefEndHour) {
                        score += (pref.preference_level - 3) * 0.25;
                    }
                }
            }
            
            return Math.max(0, Math.min(1, score)); // Clamp to [0, 1]
        } catch (error) {
            scheduleLogger.error("Error loading preferences:", error);
            return 0.5; // Neutral on error
        }
    }
    
    private calculateFairnessScore(context: ScoringContext): number {
        if (!context.employeeHistory) return 0.5;
        
        // Calculate how far this employee's hours are from the team average
        const employeeAvgHours = context.employeeHistory.totalHours / Math.max(1, context.employeeHistory.weeklyHoursHistory.size);
        const hoursDifference = Math.abs(employeeAvgHours - context.teamAverageHours);
        
        // Employees with fewer hours than average get higher scores
        if (employeeAvgHours < context.teamAverageHours) {
            return 1.0 - (hoursDifference / context.teamAverageHours) * 0.5;
        } else {
            return 0.5 - (hoursDifference / context.teamAverageHours) * 0.5;
        }
    }
    
    private calculateHistoryScore(context: ScoringContext): number {
        if (!context.employeeHistory) return 0.5;
        
        // Combine punctuality and reliability scores
        const performanceScore = (context.employeeHistory.punctualityScore + context.employeeHistory.reliabilityScore) / 2;
        
        // Boost score for experienced employees
        const experienceBonus = Math.min(0.2, context.employeeHistory.totalShifts / 100 * 0.2);
        
        return Math.min(1.0, performanceScore + experienceBonus);
    }
    
    private calculateWorkloadScore(context: ScoringContext): number {
        // Penalize if employee is already over target hours
        const targetHours = this.config.workloadBalanceTarget;
        const currentHours = context.currentWeekHours;
        const shiftHours = (context.shiftEndTime.getTime() - context.shiftStartTime.getTime()) / (1000 * 60 * 60);
        const projectedHours = currentHours + shiftHours;
        
        if (projectedHours <= targetHours) {
            return 1.0; // Under target is good
        } else if (projectedHours <= targetHours * 1.25) {
            // Linear decrease from 1.0 to 0.5 for up to 25% over target
            return 1.0 - ((projectedHours - targetHours) / (targetHours * 0.25)) * 0.5;
        } else {
            return 0.3; // Heavily penalize excessive hours
        }
    }
    
    private calculateKeyholderScore(context: ScoringContext): number {
        // Simple binary score with small bonus
        return context.isKeyholderRequired ? 1.0 : 0.5;
    }
    
    private async calculateSkillScore(context: ScoringContext): Promise<number> {
        if (!context.requiredSkills || context.requiredSkills.length === 0) {
            return 1.0; // No skills required
        }
        
        if (!this.db) return 0.5;
        
        try {
            // Query employee skills/qualifications
            const skillsQuery = this.db.query(`
                SELECT COUNT(*) as matched_skills
                FROM employee_qualifications
                WHERE employee_id = ? AND qualification_id IN (${context.requiredSkills.map(() => '?').join(',')})
            `);
            const result = skillsQuery.get(context.employeeId, ...context.requiredSkills) as any;
            
            const matchRatio = result.matched_skills / context.requiredSkills.length;
            return matchRatio;
        } catch (error) {
            scheduleLogger.error("Error checking skills:", error);
            return 0.5;
        }
    }
    
    private calculateFatigueScore(context: ScoringContext): number {
        // Penalize consecutive days beyond threshold
        if (context.consecutiveDays < this.config.fatigueThreshold) {
            return 1.0;
        }
        
        // Linear decrease after threshold
        const daysOverThreshold = context.consecutiveDays - this.config.fatigueThreshold;
        return Math.max(0.2, 1.0 - (daysOverThreshold * 0.2));
    }
    
    private calculateSeniorityScore(context: ScoringContext): number {
        // If no seniority data, return neutral score
        if (context.seniority === undefined || context.seniority === null) {
            return 0.5;
        }
        
        // Score based on years of service
        // 0-1 year: 0.3
        // 1-3 years: 0.5
        // 3-5 years: 0.7
        // 5-10 years: 0.85
        // 10+ years: 1.0
        
        if (context.seniority < 1) {
            return 0.3;
        } else if (context.seniority < 3) {
            return 0.5;
        } else if (context.seniority < 5) {
            return 0.7;
        } else if (context.seniority < 10) {
            return 0.85;
        } else {
            return 1.0;
        }
    }
    
    // Helper methods
    
    private async loadEmployeeHistory(employeeId: string, referenceDate: Date): Promise<EmployeeHistory> {
        // Check cache first
        if (this.employeeHistoryCache.has(employeeId)) {
            return this.employeeHistoryCache.get(employeeId)!;
        }
        
        if (!this.db) {
            return this.createEmptyHistory(employeeId);
        }
        
        try {
            const lookbackDate = new Date(referenceDate);
            lookbackDate.setDate(lookbackDate.getDate() - this.config.historicalLookbackDays);
            
            // Query historical shifts
            const shiftsQuery = this.db.query(`
                SELECT s.date, s.shift_id, st.duration_hours, st.shift_type_id
                FROM schedules s
                LEFT JOIN shift_templates st ON s.shift_id = st.id
                WHERE s.employee_id = ? 
                AND s.date >= ? 
                AND s.shift_id IS NOT NULL
                ORDER BY s.date DESC
            `);
            
            const shifts = shiftsQuery.all(employeeId, format(lookbackDate, 'yyyy-MM-dd')) as any[];
            
            // Calculate history metrics
            const history: EmployeeHistory = {
                employeeId,
                totalShifts: shifts.length,
                totalHours: 0,
                averageShiftLength: 0,
                lastShiftDate: null,
                shiftTypeDistribution: new Map(),
                weeklyHoursHistory: new Map(),
                punctualityScore: 0.9, // TODO: Calculate from actual data
                reliabilityScore: 0.95, // TODO: Calculate from actual data
            };
            
            if (shifts.length > 0) {
                history.lastShiftDate = parseISO(shifts[0].date);
                
                // Process shifts
                for (const shift of shifts) {
                    const hours = shift.duration_hours || 8;
                    history.totalHours += hours;
                    
                    // Track shift type distribution
                    const shiftType = shift.shift_type_id || 'regular';
                    history.shiftTypeDistribution.set(
                        shiftType,
                        (history.shiftTypeDistribution.get(shiftType) || 0) + 1
                    );
                    
                    // Track weekly hours
                    const weekNum = this.getWeekNumber(parseISO(shift.date));
                    history.weeklyHoursHistory.set(
                        weekNum,
                        (history.weeklyHoursHistory.get(weekNum) || 0) + hours
                    );
                }
                
                history.averageShiftLength = history.totalHours / history.totalShifts;
            }
            
            // Cache the result
            this.employeeHistoryCache.set(employeeId, history);
            
            return history;
        } catch (error) {
            scheduleLogger.error(`Error loading history for employee ${employeeId}:`, error);
            return this.createEmptyHistory(employeeId);
        }
    }
    
    private createEmptyHistory(employeeId: string): EmployeeHistory {
        return {
            employeeId,
            totalShifts: 0,
            totalHours: 0,
            averageShiftLength: 0,
            lastShiftDate: null,
            shiftTypeDistribution: new Map(),
            weeklyHoursHistory: new Map(),
            punctualityScore: 0.8,
            reliabilityScore: 0.8,
        };
    }
    
    private calculateHoursVariance(history: EmployeeHistory | undefined): number {
        if (!history || history.weeklyHoursHistory.size < 2) return 0;
        
        const hours = Array.from(history.weeklyHoursHistory.values());
        const mean = hours.reduce((a, b) => a + b, 0) / hours.length;
        const variance = hours.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / hours.length;
        
        return Math.sqrt(variance);
    }
    
    private getWeekNumber(date: Date): number {
        return Math.floor(differenceInDays(date, startOfWeek(date)) / 7);
    }
    
    /**
     * Train or update the ML model (placeholder for future implementation)
     */
    public async trainModel(trainingData: any[]): Promise<void> {
        scheduleLogger.info("ML model training not yet implemented. Using rule-based scoring.");
        // TODO: Implement when ML framework is integrated
    }
    
    /**
     * Get scoring explanation for debugging/transparency
     */
    public async explainScore(context: ScoringContext): Promise<Record<string, any>> {
        const scores = {
            availability: this.calculateAvailabilityScore(context),
            preferences: await this.calculatePreferenceScore(context),
            fairness: this.calculateFairnessScore(context),
            history: this.calculateHistoryScore(context),
            workload: this.calculateWorkloadScore(context),
            keyholder: this.calculateKeyholderScore(context),
            skills: await this.calculateSkillScore(context),
            fatigue: this.calculateFatigueScore(context),
            seniority: this.calculateSeniorityScore(context),
        };
        
        const weightedScores: Record<string, number> = {};
        for (const [factor, score] of Object.entries(scores)) {
            const weight = this.config.weights[factor as keyof typeof this.config.weights];
            weightedScores[factor] = score * weight;
        }
        
        const totalScore = Object.values(weightedScores).reduce((a, b) => a + b, 0) / 
                          Object.values(this.config.weights).reduce((a, b) => a + b, 0);
        
        return {
            totalScore,
            componentScores: scores,
            weightedScores,
            weights: this.config.weights,
            features: this.extractMLFeatures(context),
        };
    }
}