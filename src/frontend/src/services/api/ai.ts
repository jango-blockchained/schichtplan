import { api } from "./instance";

export const previewAiData = async (
  startDate: string,
  endDate: string,
): Promise<{
  status: string;
  data_pack: {
    employees: Array<{
      id: number;
      name: string;
      role: string;
      is_keyholder: boolean;
      max_weekly_hours: number;
    }>;
    shifts: Array<{
      id: number;
      start_time: string;
      end_time: string;
      active_days: number[];
      requires_keyholder?: boolean;
    }>;
    coverage_rules: Array<{
      day_index: number;
      time_period: string;
      min_employees: number;
      max_employees: number;
      requires_keyholder: boolean;
    }>;
    schedule_period: {
      start_date: string;
      end_date: string;
      target_weekdays: number[];
    };
    availability: Array<{
      employee_id: number;
      day_index: number;
      fixed_time_range?: string;
      preferred_time_range?: string;
      available_time_range?: string;
    }>;
    absences: Array<{
      employee_id: number;
      start_date: string;
      end_date: string;
      reason: string;
    }>;
  };
  metadata: {
    start_date: string;
    end_date: string;
    optimization_applied: boolean;
    data_structure_version: string;
    total_sections: number;
    estimated_size_reduction: string;
  };
}> => {
  const response = await api.post("/api/v2/schedule/preview-ai-data", {
    start_date: startDate,
    end_date: endDate,
  });
  return response.data;
};
