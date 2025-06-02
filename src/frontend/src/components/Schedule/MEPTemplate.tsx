import React from 'react';
import './MEPTemplate.css';

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
    dailySchedules: Record<string, {
      startTime: string;
      endTime: string;
      breakStart: string;
      dailySum: string;
    }>;
    weeklySum: string;
    monthlySum: string;
  }>;
  dateRangeDays: Array<{
    date: Date;
    name: string;
    dateFormatted: string;
  }>;
}

interface MEPTemplateProps {
  data: MEPData;
  onPrint?: () => void;
}

export function MEPTemplate({ data, onPrint }: MEPTemplateProps) {
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="mep-container">
      {/* Print Button - only visible on screen */}
      <div className="print-button-container no-print">
        <button onClick={handlePrint} className="print-button">
          🖨️ Drucken / Als PDF speichern
        </button>
      </div>

      {/* MEP Document */}
      <div className="mep-document">
        {/* Header */}
        <div className="mep-header">
          <div className="mep-title">
            Mitarbeiter-Einsatz-Planung (MEP)
          </div>
          
          <div className="mep-info-row">
            <div className="info-item">Monat/Jahr: {data.dateInfo.monthYear}</div>
            <div className="info-item">Woche vom: {data.dateInfo.weekFrom}</div>
            <div className="info-item">bis: {data.dateInfo.weekTo}</div>
            <div className="info-item">Filiale: {data.filiale}</div>
            <div className="info-item">Aufbewahrung in der Filiale: 2 Jahre</div>
          </div>
        </div>

        {/* Main Table */}
        <div className="mep-table">
          {/* Table Header */}
          <div className="table-header">
            <div className="col-employee">Name,<br/>Vorname</div>
            <div className="col-function">Funktion</div>
            <div className="col-plan">Plan /<br/>Woche</div>
            
            {data.dateRangeDays.map((day, index) => (
              <div key={index} className="col-day">
                <div className="day-header">
                  {day.name}<br/>
                  {day.dateFormatted}
                </div>
                <div className="day-subheader">
                  <div className="subcol">Beginn</div>
                  <div className="subcol">Pause</div>
                  <div className="subcol">Ende</div>
                  <div className="subcol">Summe/Tag</div>
                </div>
              </div>
            ))}
            
            <div className="col-weekly">Summe /<br/>Woche</div>
            <div className="col-monthly">Summe /<br/>Monat</div>
          </div>

          {/* Employee Rows */}
          {data.employees.map((employee, empIndex) => (
            <div key={employee.id} className="employee-row">
              <div className="col-employee">
                {employee.firstName}<br/>
                {employee.lastName}
              </div>
              <div className="col-function">{employee.position}</div>
              <div className="col-plan"></div>
              
              {data.dateRangeDays.map((day, dayIndex) => {
                const dateStr = day.date.toISOString().split('T')[0];
                const schedule = employee.dailySchedules[dateStr] || {
                  startTime: '',
                  endTime: '',
                  breakStart: '',
                  dailySum: ''
                };
                
                return (
                  <div key={dayIndex} className="col-day">
                    <div className="day-data">
                      <div className="subcol">{schedule.startTime}</div>
                      <div className="subcol">{schedule.breakStart}</div>
                      <div className="subcol">{schedule.endTime}</div>
                      <div className="subcol">{schedule.dailySum}</div>
                    </div>
                  </div>
                );
              })}
              
              <div className="col-weekly">{employee.weeklySum}</div>
              <div className="col-monthly">{employee.monthlySum}</div>
            </div>
          ))}

          {/* Empty rows to fill the page */}
          {Array.from({ length: Math.max(0, 8 - data.employees.length) }).map((_, index) => (
            <div key={`empty-${index}`} className="employee-row empty-row">
              <div className="col-employee"></div>
              <div className="col-function"></div>
              <div className="col-plan"></div>
              
              {data.dateRangeDays.map((_, dayIndex) => (
                <div key={dayIndex} className="col-day">
                  <div className="day-data">
                    <div className="subcol"></div>
                    <div className="subcol"></div>
                    <div className="subcol"></div>
                    <div className="subcol"></div>
                  </div>
                </div>
              ))}
              
              <div className="col-weekly"></div>
              <div className="col-monthly"></div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mep-footer">
          <div className="footer-line">
            <strong>Pausenzeiten:</strong> bis 6 Stunden : keine Pause, mehr als 6 Stunden : 60 Minuten
          </div>
          
          <div className="footer-line">
            <strong>Abwesenheiten:</strong> Feiertag, Krankheit (AU-Bescheinigung), Freizeit, Schule (Führungsnachwuchskraft), Urlaub
          </div>
          
          <div className="footer-line">
            <strong>Anwesenheiten:</strong> Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten und die Tagesstunden eintragen. Am Ende der Woche: wöchentliche und monatliche Summe eintragen.
          </div>
          
          <div className="footer-date">
            Stand: {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  );
} 