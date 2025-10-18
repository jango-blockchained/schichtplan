import React, { useState } from "react";
import "./MEPTemplate.css";

interface MEPData {
  filiale: string;
  dateInfo: {
    monthYear: string;
    weekFrom: string;
    weekTo: string;
  };
  employees: Array<{
    id: number;
    firstName: string;
    lastName: string;
    position: string;
    dailySchedules: Record<string, DailyScheduleEntry>;
    weeklySum: string;
    monthlySum: string;
  }>;
  dateRangeDays: Array<{
    date: Date;
    name: string;
    dateFormatted: string;
  }>;
}

interface DailyScheduleEntry {
  startTime?: string;
  endTime?: string;
  breakStart?: string;
  dailySum?: string;
}

interface MEPTemplateProps {
  data: MEPData;
  onPrint?: () => void;
  onCreateNewVersion?: (weekNumber: number, versionNumber: number) => void;
}

interface NewVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (weekNumber: number, versionNumber: number) => void;
  currentWeekNumber: number;
  currentVersionNumber: number;
}

function NewVersionModal({
  isOpen,
  onClose,
  onSubmit,
  currentWeekNumber,
  currentVersionNumber,
}: NewVersionModalProps) {
  const [selectedWeekNumber, setSelectedWeekNumber] =
    useState(currentWeekNumber);
  const [newVersionNumber, setNewVersionNumber] = useState(
    currentVersionNumber + 1,
  );

  // Generate week options (current year weeks)
  const generateWeekOptions = () => {
    const weeks = [];
    const currentYear = new Date().getFullYear();
    for (let i = 1; i <= 52; i++) {
      weeks.push({
        value: i,
        label: `Woche ${i} (${currentYear})`,
      });
    }
    return weeks;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(selectedWeekNumber, newVersionNumber);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Neue Version erstellen</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="weekNumber">Wochennummer:</label>
            <select
              id="weekNumber"
              value={selectedWeekNumber}
              onChange={(e) => setSelectedWeekNumber(Number(e.target.value))}
              className="form-select"
            >
              {generateWeekOptions().map((week) => (
                <option key={week.value} value={week.value}>
                  {week.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="versionNumber">Neue Versionsnummer:</label>
            <input
              type="number"
              id="versionNumber"
              value={newVersionNumber}
              onChange={(e) => setNewVersionNumber(Number(e.target.value))}
              min="1"
              className="form-input"
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Abbrechen
            </button>
            <button type="submit" className="btn-submit">
              Version erstellen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function MEPTemplate({
  data,
  onPrint,
  onCreateNewVersion,
}: MEPTemplateProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Calculate current week number from the date range
  const getCurrentWeekNumber = () => {
    if (data.dateRangeDays && data.dateRangeDays.length > 0) {
      const firstDay = data.dateRangeDays[0].date;
      const startOfYear = new Date(firstDay.getFullYear(), 0, 1);
      const days = Math.floor(
        (firstDay.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000),
      );
      return Math.ceil((days + startOfYear.getDay() + 1) / 7);
    }
    return 1;
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const handleNewVersionSubmit = (
    weekNumber: number,
    versionNumber: number,
  ) => {
    if (onCreateNewVersion) {
      onCreateNewVersion(weekNumber, versionNumber);
    }
  };

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="mep-container">
      {/* Action Buttons - only visible on screen */}
      <div className="action-buttons-container no-print">
        <button onClick={handlePrint} className="action-button print-button">
          🖨️ Drucken / Als PDF speichern
        </button>
        <button onClick={openModal} className="action-button version-button">
          📄 Neue Version erstellen
        </button>
      </div>

      {/* New Version Modal */}
      <NewVersionModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleNewVersionSubmit}
        currentWeekNumber={getCurrentWeekNumber()}
        currentVersionNumber={1} // This could be passed as a prop or calculated
      />

      {/* MEP Document */}
      <div className="mep-document">
        {/* Header */}
        <div className="mep-header">
          <div className="mep-title">Mitarbeiter-Einsatz-Planung (MEP)</div>

          <div className="mep-info-row">
            <div className="info-item">
              Monat/Jahr: {data.dateInfo.monthYear}
            </div>
            <div className="info-item">Woche vom: {data.dateInfo.weekFrom}</div>
            <div className="info-item">bis: {data.dateInfo.weekTo}</div>
            <div className="info-item">Filiale: {data.filiale}</div>
            <div className="info-item">
              Aufbewahrung in der Filiale: 2 Jahre
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="mep-table">
          {/* Table Header */}
          <div className="table-header">
            <div className="col-employee">
              Name,
              <br />
              Vorname
            </div>
            <div className="col-function">Funktion</div>
            <div className="col-plan">
              Plan /<br />
              Woche
            </div>

            {data.dateRangeDays.map((day, index) => (
              <div key={index} className="col-day-single">
                {day.name}
                <br />
                {day.dateFormatted}
              </div>
            ))}

            <div className="col-weekly">
              Summe /<br />
              Woche
            </div>
            <div className="col-monthly">
              Summe /<br />
              Monat
            </div>
          </div>

          {/* Sub-header for row types */}
          <div className="table-subheader">
            <div className="col-employee"></div>
            <div className="col-function"></div>
            <div className="col-plan"></div>

            {data.dateRangeDays.map((_, index) => (
              <div key={index} className="col-day-single-sub">
                <div className="row-type-labels">
                  <div className="row-label">Datum</div>
                  <div className="row-label">Wer/tätig</div>
                  <div className="row-label">Beginn</div>
                  <div className="row-label">Pause</div>
                  <div className="row-label">Ende</div>
                  <div className="row-label">Summe/Tag</div>
                </div>
              </div>
            ))}

            <div className="col-weekly"></div>
            <div className="col-monthly"></div>
          </div>

          {/* Employee Rows */}
          {data.employees.map((employee) => (
            <React.Fragment key={employee.id}>
              {/* Employee Block - 6 rows per employee */}
              <div className="employee-group">
                {/* Row 1: Datum */}
                <div className="employee-row">
                  <div
                    className="col-employee employee-name-cell"
                    data-row-span={6}
                  >
                    {employee.firstName}
                    <br />
                    {employee.lastName}
                  </div>
                  <div
                    className="col-function employee-function-cell"
                    data-row-span={6}
                  >
                    {employee.position}
                  </div>
                  <div
                    className="col-plan employee-plan-cell"
                    data-row-span={6}
                  >
                    Plan /<br />
                    Woche
                  </div>

                  {data.dateRangeDays.map((day, dayIndex) => {
                    return (
                      <div key={dayIndex} className="col-day-time">
                        {day.dateFormatted}
                      </div>
                    );
                  })}

                  <div
                    className="col-weekly employee-weekly-cell"
                    data-row-span={6}
                  >
                    {employee.weeklySum}
                  </div>
                  <div
                    className="col-monthly employee-monthly-cell"
                    data-row-span={6}
                  >
                    {employee.monthlySum}
                  </div>
                </div>

                {/* Row 2: Wer/tätig */}
                <div className="employee-row">
                  <div className="col-employee-span"></div>
                  <div className="col-function-span"></div>
                  <div className="col-plan-span"></div>

                  {data.dateRangeDays.map((day, dayIndex) => {
                    const dateStr = day.date.toISOString().split("T")[0];
                    const schedule = employee.dailySchedules[dateStr] || {};

                    return (
                      <div key={dayIndex} className="col-day-time">
                        {schedule.startTime ? "X" : ""}
                      </div>
                    );
                  })}

                  <div className="col-weekly-span"></div>
                  <div className="col-monthly-span"></div>
                </div>

                {/* Row 3: Beginn */}
                <div className="employee-row">
                  <div className="col-employee-span"></div>
                  <div className="col-function-span"></div>
                  <div className="col-plan-span"></div>

                  {data.dateRangeDays.map((day, dayIndex) => {
                    const dateStr = day.date.toISOString().split("T")[0];
                    const schedule = employee.dailySchedules[dateStr] || {
                      startTime: "",
                      endTime: "",
                      breakStart: "",
                      dailySum: "",
                    };

                    return (
                      <div key={dayIndex} className="col-day-time">
                        {schedule.startTime}
                      </div>
                    );
                  })}

                  <div className="col-weekly-span"></div>
                  <div className="col-monthly-span"></div>
                </div>

                {/* Row 4: Pause */}
                <div className="employee-row">
                  <div className="col-employee-span"></div>
                  <div className="col-function-span"></div>
                  <div className="col-plan-span"></div>

                  {data.dateRangeDays.map((day, dayIndex) => {
                    const dateStr = day.date.toISOString().split("T")[0];
                    const schedule = employee.dailySchedules[dateStr] || {
                      startTime: "",
                      endTime: "",
                      breakStart: "",
                      dailySum: "",
                    };

                    return (
                      <div key={dayIndex} className="col-day-time">
                        {schedule.breakStart}
                      </div>
                    );
                  })}

                  <div className="col-weekly-span"></div>
                  <div className="col-monthly-span"></div>
                </div>

                {/* Row 5: Ende */}
                <div className="employee-row">
                  <div className="col-employee-span"></div>
                  <div className="col-function-span"></div>
                  <div className="col-plan-span"></div>

                  {data.dateRangeDays.map((day, dayIndex) => {
                    const dateStr = day.date.toISOString().split("T")[0];
                    const schedule = employee.dailySchedules[dateStr] || {
                      startTime: "",
                      endTime: "",
                      breakStart: "",
                      dailySum: "",
                    };

                    return (
                      <div key={dayIndex} className="col-day-time">
                        {schedule.endTime}
                      </div>
                    );
                  })}

                  <div className="col-weekly-span"></div>
                  <div className="col-monthly-span"></div>
                </div>

                {/* Row 6: Summe/Tag */}
                <div className="employee-row">
                  <div className="col-employee-span"></div>
                  <div className="col-function-span"></div>
                  <div className="col-plan-span"></div>

                  {data.dateRangeDays.map((day, dayIndex) => {
                    const dateStr = day.date.toISOString().split("T")[0];
                    const schedule = employee.dailySchedules[dateStr] || {
                      startTime: "",
                      endTime: "",
                      breakStart: "",
                      dailySum: "",
                    };

                    return (
                      <div key={dayIndex} className="col-day-time">
                        {schedule.dailySum}
                      </div>
                    );
                  })}

                  <div className="col-weekly-span"></div>
                  <div className="col-monthly-span"></div>
                </div>
              </div>
            </React.Fragment>
          ))}

          {/* Empty rows to fill the page */}
          {Array.from({ length: Math.max(0, 8 - data.employees.length) }).map(
            (_, index) => (
              <React.Fragment key={`empty-${index}`}>
                <div className="employee-group">
                  {/* Row 1: Datum */}
                  <div className="employee-row empty-row">
                    <div className="col-employee"></div>
                    <div className="col-function"></div>
                    <div className="col-plan"></div>

                    {data.dateRangeDays.map((_, dayIndex) => (
                      <div key={dayIndex} className="col-day-time"></div>
                    ))}

                    <div className="col-weekly"></div>
                    <div className="col-monthly"></div>
                  </div>

                  {/* Row 2: Wer/tätig */}
                  <div className="employee-row empty-row">
                    <div className="col-employee-span"></div>
                    <div className="col-function-span"></div>
                    <div className="col-plan-span"></div>

                    {data.dateRangeDays.map((_, dayIndex) => (
                      <div key={dayIndex} className="col-day-time"></div>
                    ))}

                    <div className="col-weekly-span"></div>
                    <div className="col-monthly-span"></div>
                  </div>

                  {/* Row 3: Beginn */}
                  <div className="employee-row empty-row">
                    <div className="col-employee-span"></div>
                    <div className="col-function-span"></div>
                    <div className="col-plan-span"></div>

                    {data.dateRangeDays.map((_, dayIndex) => (
                      <div key={dayIndex} className="col-day-time"></div>
                    ))}

                    <div className="col-weekly-span"></div>
                    <div className="col-monthly-span"></div>
                  </div>

                  {/* Row 4: Pause */}
                  <div className="employee-row empty-row">
                    <div className="col-employee-span"></div>
                    <div className="col-function-span"></div>
                    <div className="col-plan-span"></div>

                    {data.dateRangeDays.map((_, dayIndex) => (
                      <div key={dayIndex} className="col-day-time"></div>
                    ))}

                    <div className="col-weekly-span"></div>
                    <div className="col-monthly-span"></div>
                  </div>

                  {/* Row 5: Ende */}
                  <div className="employee-row empty-row">
                    <div className="col-employee-span"></div>
                    <div className="col-function-span"></div>
                    <div className="col-plan-span"></div>

                    {data.dateRangeDays.map((_, dayIndex) => (
                      <div key={dayIndex} className="col-day-time"></div>
                    ))}

                    <div className="col-weekly-span"></div>
                    <div className="col-monthly-span"></div>
                  </div>

                  {/* Row 6: Summe/Tag */}
                  <div className="employee-row empty-row">
                    <div className="col-employee-span"></div>
                    <div className="col-function-span"></div>
                    <div className="col-plan-span"></div>

                    {data.dateRangeDays.map((_, dayIndex) => (
                      <div key={dayIndex} className="col-day-time"></div>
                    ))}

                    <div className="col-weekly-span"></div>
                    <div className="col-monthly-span"></div>
                  </div>
                </div>
              </React.Fragment>
            ),
          )}
        </div>

        {/* Footer */}
        <div className="mep-footer">
          <div className="footer-line">
            <strong>Pausenzeiten:</strong> bis 6 Stunden : keine Pause, mehr als
            6 Stunden : 60 Minuten
          </div>

          <div className="footer-line">
            <strong>Abwesenheiten:</strong> Feiertag, Krankheit
            (AU-Bescheinigung), Freizeit, Schule (Führungsnachwuchskraft),
            Urlaub
          </div>

          <div className="footer-line">
            <strong>Anwesenheiten:</strong> Arbeitszeitbeginn bis
            Arbeitszeitende inkl. Pausenzeiten und die Tagesstunden eintragen.
            Am Ende der Woche: wöchentliche und monatliche Summe eintragen.
          </div>

          <div className="footer-date">
            Stand:{" "}
            {new Date().toLocaleDateString("de-DE", {
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
