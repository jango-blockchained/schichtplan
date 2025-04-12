import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";

export default function ShiftsPage() {
  useEffect(() => {
    console.log("ShiftsPage is deprecated. Redirecting to ShiftTemplatesPage.");
  }, []);

  return <Navigate to="/shift-templates" replace />;
}
