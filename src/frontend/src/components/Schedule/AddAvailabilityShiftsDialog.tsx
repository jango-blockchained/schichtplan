import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Availability, Employee } from '../../lib/types';

interface ApiError {
  message: string;
}

interface NewScheduleEntry {
  employee_id: number;
  start_time: string;
  end_time: string;
  type: 'FIXED' | 'UNAVAILABLE' | 'PREFERRED';
}

interface AddAvailabilityShiftsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  type: 'FIXED' | 'UNAVAILABLE' | 'PREFERRED';
}

const AddAvailabilityShiftsDialog: React.FC<AddAvailabilityShiftsDialogProps> = ({
  isOpen,
  onOpenChange,
  type,
}) => {
  const queryClient = useQueryClient();
  const { data: employees } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees').then((res) => res.data),
  });

  const { data: availabilities } = useQuery<Availability[]>({
    queryKey: ['availabilities', { type }],
    queryFn: () => api.get(`/availabilities?type=${type}`).then((res) => res.data),
    enabled: !!type,
  });

  const createShiftsMutation = useMutation<
    void,
    ApiError,
    { shifts: NewScheduleEntry[] }
  >({
    mutationFn: (shifts) => api.post('/schedule_entries/bulk', shifts),
    onSuccess: () => {
      toast.success('Shifts created successfully');
      queryClient.invalidateQueries({ queryKey: ['scheduleEntries'] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Failed to create shifts', {
        description: (error.response?.data as ApiError)?.message || error.message,
      });
    },
  });

  const handleAddShifts = () => {
    if (!availabilities) return;

    const shifts: NewScheduleEntry[] = availabilities.map((availability) => ({
      employee_id: availability.employee_id,
      start_time: availability.start_time,
      end_time: availability.end_time,
      type: type,
    }));

    createShiftsMutation.mutate({ shifts });
  };

  const getEmployeeName = (employeeId: number) => {
    const employee = employees?.find((e) => e.id === employeeId);
    return employee ? `${employee.first_name} ${employee.last_name}` : '';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add {type} Shifts</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {availabilities?.map((availability) => (
                <TableRow key={availability.id}>
                  <TableCell>
                    {getEmployeeName(availability.employee_id)}
                  </TableCell>
                  <TableCell>{new Date(availability.start_time).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(availability.start_time).toLocaleTimeString()}</TableCell>
                  <TableCell>{new Date(availability.end_time).toLocaleTimeString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddShifts} disabled={createShiftsMutation.isPending}>
            {createShiftsMutation.isPending ? 'Adding...' : 'Add Shifts'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddAvailabilityShiftsDialog;
