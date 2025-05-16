import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EmployeeFormProps {
  onSubmit: (employee: {
    name: string;
    position: string;
    contractedHours: string;
  }) => void;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ onSubmit }) => {
  const [name, setName] = React.useState("");
  const [position, setPosition] = React.useState("");
  const [contractedHours, setContractedHours] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, position, contractedHours });
    setName("");
    setPosition("");
    setContractedHours("");
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Add Employee</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter employee name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Position</Label>
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger id="position">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TZ">TZ</SelectItem>
                <SelectItem value="VZ">VZ</SelectItem>
                <SelectItem value="AZ">AZ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hours">Contracted Hours</Label>
            <Input
              id="hours"
              type="text"
              value={contractedHours}
              onChange={(e) => setContractedHours(e.target.value)}
              placeholder="Enter contracted hours (e.g. 40:00)"
              pattern="\d{1,2}:\d{2}"
              required
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit">Add Employee</Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default EmployeeForm;
