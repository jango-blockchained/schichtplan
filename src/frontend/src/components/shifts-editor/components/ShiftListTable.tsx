import { Badge } from "@/components/ui/badge";
// Button not needed here
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
} from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Shift } from "@/services/api";
import { ChevronDown, ChevronUp } from "lucide-react";
import React, { useMemo, useState } from "react";

const DAY_ABBRS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export const ShiftListTable: React.FC<{
    shifts: Shift[];
    onEdit?: (shift: Shift) => void;
    onDelete?: (id: number) => void;
}> = ({ shifts, onEdit, onDelete }) => {
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState<"id" | "start" | "end">("id");
    const [sortAsc, setSortAsc] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(8);

    const normalized = useMemo(() => {
        return shifts.map((s) => ({
            ...s,
            active_days_array: Array.isArray(s.active_days)
                ? s.active_days
                : Object.entries(s.active_days || {})
                    .filter(([, v]) => v)
                    .map(([k]) => parseInt(k, 10)),
        }));
    }, [shifts]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const out = normalized.filter((s) => {
            if (!q) return true;
            return (
                String(s.id).includes(q) ||
                `schicht ${s.id}`.toLowerCase().includes(q) ||
                (s.start_time || "").toLowerCase().includes(q) ||
                (s.end_time || "").toLowerCase().includes(q) ||
                s.active_days_array.some((d) => DAY_ABBRS[d].toLowerCase().includes(q))
            );
        });

        out.sort((a, b) => {
            let cmp = 0;
            if (sortBy === "id") cmp = a.id - b.id;
            if (sortBy === "start") cmp = a.start_time.localeCompare(b.start_time || "");
            if (sortBy === "end") cmp = a.end_time.localeCompare(b.end_time || "");
            return sortAsc ? cmp : -cmp;
        });

        return out;
    }, [normalized, search, sortBy, sortAsc]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));

    const pageItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const toggleSort = (col: "id" | "start" | "end") => {
        if (sortBy === col) setSortAsc(!sortAsc);
        else {
            setSortBy(col);
            setSortAsc(true);
        }
        setCurrentPage(1);
    };

    const renderPaginationItems = () => {
        const items = [];
        const maxVisible = 5;
        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                items.push(
                    <PaginationItem key={i}>
                        <PaginationLink onClick={() => setCurrentPage(i)} isActive={currentPage === i}>
                            {i}
                        </PaginationLink>
                    </PaginationItem>,
                );
            }
        } else {
            items.push(
                <PaginationItem key={1}>
                    <PaginationLink onClick={() => setCurrentPage(1)} isActive={currentPage === 1}>
                        1
                    </PaginationLink>
                </PaginationItem>,
            );
            if (currentPage > 3) items.push(<PaginationItem key="e1"><PaginationEllipsis /></PaginationItem>);
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) {
                items.push(
                    <PaginationItem key={i}>
                        <PaginationLink onClick={() => setCurrentPage(i)} isActive={currentPage === i}>
                            {i}
                        </PaginationLink>
                    </PaginationItem>,
                );
            }
            if (currentPage < totalPages - 2) items.push(<PaginationItem key="e2"><PaginationEllipsis /></PaginationItem>);
            items.push(
                <PaginationItem key={totalPages}>
                    <PaginationLink onClick={() => setCurrentPage(totalPages)} isActive={currentPage === totalPages}>
                        {totalPages}
                    </PaginationLink>
                </PaginationItem>,
            );
        }

        return items;
    };

    return (
        <Card>
            <CardHeader className="p-4 flex items-center justify-between">
                <CardTitle>Shifts</CardTitle>
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="Search shifts..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-64"
                    />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableCell className="cursor-pointer" onClick={() => toggleSort("id")}>
                                ID {sortBy === "id" ? (sortAsc ? <ChevronUp className="inline-block h-3 w-3" /> : <ChevronDown className="inline-block h-3 w-3" />) : null}
                            </TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell className="cursor-pointer" onClick={() => toggleSort("start")}>
                                Beginn {sortBy === "start" ? (sortAsc ? <ChevronUp className="inline-block h-3 w-3" /> : <ChevronDown className="inline-block h-3 w-3" />) : null}
                            </TableCell>
                            <TableCell className="cursor-pointer" onClick={() => toggleSort("end")}>
                                Ende {sortBy === "end" ? (sortAsc ? <ChevronUp className="inline-block h-3 w-3" /> : <ChevronDown className="inline-block h-3 w-3" />) : null}
                            </TableCell>
                            <TableCell>Active Days</TableCell>
                            <TableCell className="text-right">Actions</TableCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pageItems.map((s) => (
                            <TableRow key={s.id}>
                                <TableCell>{s.id}</TableCell>
                                <TableCell>Schicht {s.id}</TableCell>
                                <TableCell>{s.start_time}</TableCell>
                                <TableCell>{s.end_time}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {s.active_days_array.map((d) => (
                                            <Badge key={d} variant="secondary" className="text-xs">
                                                {DAY_ABBRS[d] || String(d)}
                                            </Badge>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        {onDelete && (
                                            <Button variant="destructive" size="sm" onClick={() => onDelete(s.id)}>
                                                Delete
                                            </Button>
                                        )}
                                        {onEdit && (
                                            <Button size="sm" onClick={() => onEdit(s)}>
                                                Edit
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>

            <div className="p-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{filtered.length} shifts</div>
                <Pagination>
                    <PaginationContent>
                        {renderPaginationItems()}
                    </PaginationContent>
                </Pagination>
            </div>
        </Card>
    );
};

export default ShiftListTable;
