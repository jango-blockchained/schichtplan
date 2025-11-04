import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import DataTable from 'frappe-datatable';
import 'frappe-datatable/dist/frappe-datatable.css';
import { FrappeDataTableOptions, FrappeDataTableInstance } from './types';
import './frappe-table.css';

export interface FrappeDataTableProps extends Partial<FrappeDataTableOptions> {
  className?: string;
}

export interface FrappeDataTableRef {
  instance: FrappeDataTableInstance | null;
  refresh: (data?: any[][], columns?: any[]) => void;
}

export const FrappeDataTable = forwardRef<FrappeDataTableRef, FrappeDataTableProps>(
  ({ columns = [], data = [], className = '', ...options }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const datatableRef = useRef<FrappeDataTableInstance | null>(null);

    useImperativeHandle(ref, () => ({
      instance: datatableRef.current,
      refresh: (newData?: any[][], newColumns?: any[]) => {
        if (datatableRef.current) {
          datatableRef.current.refresh(newData, newColumns);
        }
      },
    }));

    useEffect(() => {
      if (!containerRef.current || columns.length === 0) return;

      // Initialize DataTable
      try {
        datatableRef.current = new DataTable(containerRef.current, {
          columns,
          data,
          serialNoColumn: true,
          checkboxColumn: options.checkboxColumn !== undefined ? options.checkboxColumn : false,
          clusterize: options.clusterize !== undefined ? options.clusterize : true,
          layout: options.layout || 'fluid',
          noDataMessage: options.noDataMessage || 'No data available',
          dynamicRowHeight: options.dynamicRowHeight !== undefined ? options.dynamicRowHeight : false,
          inlineFilters: options.inlineFilters !== undefined ? options.inlineFilters : false,
          treeView: options.treeView !== undefined ? options.treeView : false,
          checkedRowStatus: options.checkedRowStatus !== undefined ? options.checkedRowStatus : false,
          ...options,
        }) as FrappeDataTableInstance;
      } catch (error) {
        console.error('Error initializing Frappe DataTable:', error);
      }

      // Cleanup on unmount
      return () => {
        if (datatableRef.current) {
          try {
            datatableRef.current.destroy();
          } catch (error) {
            console.error('Error destroying Frappe DataTable:', error);
          }
          datatableRef.current = null;
        }
      };
    }, []); // Only initialize once

    // Update data when it changes
    useEffect(() => {
      if (datatableRef.current && data) {
        try {
          datatableRef.current.refresh(data, columns);
        } catch (error) {
          console.error('Error refreshing Frappe DataTable:', error);
        }
      }
    }, [data, columns]);

    return (
      <div 
        ref={containerRef} 
        className={`frappe-datatable-wrapper ${className}`}
      />
    );
  }
);

FrappeDataTable.displayName = 'FrappeDataTable';

export default FrappeDataTable;
