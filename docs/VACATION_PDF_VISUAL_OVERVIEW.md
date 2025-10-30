# Vacation PDF Forms - Visual Overview

## Generated PDF Forms

### 1. Admin Yearly Form (`admin_yearly_2025.pdf`)
```
┌─────────────────────────────────────────────────────────────────────┐
│             Urlaubsplanung 2025 - Administratorformular             │
├─────────────────────────────────────────────────────────────────────┤
│  Filiale: TEDi Testfiliale                                         │
├───────────┬──────────┬────────┬─────────┬────────┬───────────┬──────┤
│Mitarbeiter│Pers.-Nr. │Jahres- │Genommen │Geplant │Verbleibend│Status│
│           │          │anspruch│         │        │           │      │
├───────────┼──────────┼────────┼─────────┼────────┼───────────┼──────┤
│Fischer,   │   FIS    │   30   │    0    │   0    │    30     │  OK  │
│Thomas     │          │        │         │        │           │      │
├───────────┼──────────┼────────┼─────────┼────────┼───────────┼──────┤
│Müller,    │   MUE    │   28   │   10    │   0    │    18     │  OK  │
│Lisa       │          │        │         │        │           │      │
├───────────┼──────────┼────────┼─────────┼────────┼───────────┼──────┤
│Mustermann,│   MUS    │   30   │   14    │   8    │     8     │  OK  │
│Max        │          │        │         │        │           │      │
├───────────┼──────────┼────────┼─────────┼────────┼───────────┼──────┤
│Schmidt,   │   SCH    │   25   │    0    │   7    │    18     │  OK  │
│Anna       │          │        │         │        │           │      │
├───────────┼──────────┼────────┼─────────┼────────┼───────────┼──────┤
│Weber,     │   WEB    │   30   │    7    │   0    │    23     │  OK  │
│Peter      │          │        │         │        │           │      │
└───────────┴──────────┴────────┴─────────┴────────┴───────────┴──────┘

Hinweise:
• Jahresanspruch gemäß Arbeitsvertrag
• Genommen: Bereits genommener Urlaub (genehmigt und vergangen)
• Geplant: Genehmigter aber zukünftiger Urlaub
• Verbleibend: Noch verfügbare Urlaubstage
```

### 2. Employee Request Form - Filled (`employee_request_MUS_filled.pdf`)
```
┌─────────────────────────────────────────────────────────────────────┐
│                         Urlaubsantrag                               │
├─────────────────────────────────────────────────────────────────────┤
│  Filiale: TEDi Testfiliale                                         │
│                                                                      │
│  Mitarbeiterdaten                                                   │
│  Name:                    Max Mustermann                            │
│  Personal-Nr.:            MUS                                       │
│  E-Mail:                  max.mustermann@example.com               │
│  Jahresurlaubsanspruch:   30 Tage                                  │
│                                                                      │
│  Urlaubsantrag                                                      │
│  Von:        01.07.2025       Bis:        14.07.2025              │
│  Anzahl Tage: 14                                                    │
│  Bemerkungen: Sommerurlaub                                         │
│                                                                      │
│  Unterschriften                                                     │
│                                                                      │
│  _______________________        _______________________             │
│  Ort, Datum                     Unterschrift Mitarbeiter           │
│                                                                      │
│  Genehmigung durch Vorgesetzten                                    │
│  ☐ Genehmigt    ☐ Abgelehnt                                       │
│                                                                      │
│  _______________________        _______________________             │
│  Ort, Datum                     Unterschrift Vorgesetzter          │
│                                                                      │
│  Hinweis: Dieser Antrag muss mindestens 2 Wochen vor               │
│  Urlaubsbeginn eingereicht werden.                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 3. Employee Request Form - Blank (`employee_request_SCH_blank.pdf`)
```
┌─────────────────────────────────────────────────────────────────────┐
│                         Urlaubsantrag                               │
├─────────────────────────────────────────────────────────────────────┤
│  Filiale: TEDi Testfiliale                                         │
│                                                                      │
│  Mitarbeiterdaten                                                   │
│  Name:                    Anna Schmidt                              │
│  Personal-Nr.:            SCH                                       │
│  E-Mail:                  sch@example.com                          │
│  Jahresurlaubsanspruch:   25 Tage                                  │
│                                                                      │
│  Urlaubsantrag                                                      │
│  Von:        _______________  Bis:        _______________          │
│  Anzahl Tage: ____                                                  │
│  Bemerkungen:                                                       │
│                                                                      │
│  Unterschriften                                                     │
│  [Same as filled form but with blank fields]                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 4. Overview Form (`overview_2025.pdf`)
```
┌──────────────────────────────────────────────────────────────────────┐
│        Urlaubsübersicht 2025 - Alle Mitarbeiter                     │
│  Filiale: TEDi Testfiliale | Erstellt am: 30.10.2025 12:48         │
├───┬──────────┬──────┬────────┬────────┬────────┬────┬─────────┬─────┤
│Nr.│Mitarb.   │Pers.-│Anspruch│Von     │Bis     │Tage│Status   │Verb.│
│   │          │Nr.   │        │        │        │    │         │     │
├───┼──────────┼──────┼────────┼────────┼────────┼────┼─────────┼─────┤
│ 1 │Fischer,  │ FIS  │   30   │   -    │   -    │ 0  │    -    │ 30  │
│   │Thomas    │      │        │        │        │    │         │     │
├───┼──────────┼──────┼────────┼────────┼────────┼────┼─────────┼─────┤
│ 2 │Müller,   │ MUE  │   28   │01.09.25│10.09.25│ 10 │Genehmigt│ 18  │
│   │Lisa      │      │        │        │        │    │         │     │
├───┼──────────┼──────┼────────┼────────┼────────┼────┼─────────┼─────┤
│ 3 │Mustermann│ MUS  │   30   │01.07.25│14.07.25│ 14 │Genehmigt│  8  │
│   │Max       │      │        │        │        │    │         │     │
│   │          │      │        │23.12.25│30.12.25│  8 │Beantragt│     │
├───┼──────────┼──────┼────────┼────────┼────────┼────┼─────────┼─────┤
│ 4 │Schmidt,  │ SCH  │   25   │01.08.25│07.08.25│  7 │Beantragt│ 18  │
│   │Anna      │      │        │        │        │    │         │     │
├───┼──────────┼──────┼────────┼────────┼────────┼────┼─────────┼─────┤
│ 5 │Weber,    │ WEB  │   30   │15.07.25│21.07.25│  7 │Genehmigt│ 23  │
│   │Peter     │      │        │        │        │    │         │     │
└───┴──────────┴──────┴────────┴────────┴────────┴────┴─────────┴─────┘

Zusammenfassung: 5 Mitarbeiter | 46 genehmigte Urlaubstage
```

### 5. Yearly Calendar (`calendar_2025.pdf`) - Page 1
```
┌────────────────────────────────────────────────────────────────────┐
│           Urlaubskalender 2025 - Januar bis Juni                   │
│  Filiale: TEDi Testfiliale                                        │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│ Januar   │ Februar  │   März   │  April   │   Mai    │   Juni   │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│Mo Di Mi..│Mo Di Mi..│Mo Di Mi..│Mo Di Mi..│Mo Di Mi..│Mo Di Mi..│
│       1 2│          │          │    1 2 3 │       1  │          1│
│ 3  4  5 6│ ...      │ ...      │ 4  5  6 7│ 2  3  4 5│ 2  3  4 5│
│ ...      │          │          │ ...      │ ...      │ ...      │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

### Visual Features Demonstrated

#### Admin Form
- ✓ Tracks vacation entitlement vs. usage
- ✓ Shows taken (past approved) and planned (future approved) separately
- ✓ Calculates remaining days automatically
- ✓ Status indicators for quick assessment
- ✓ Landscape layout for better readability

#### Employee Request Form
- ✓ Pre-filled version shows existing absence data
- ✓ Blank version ready for manual completion
- ✓ Signature lines for employee and supervisor
- ✓ Approval checkboxes (Genehmigt/Abgelehnt)
- ✓ Legal compliance note at bottom
- ✓ Portrait layout (standard form format)

#### Overview Form
- ✓ Comprehensive listing of all employees
- ✓ Multiple vacation periods per employee
- ✓ German status translations
- ✓ Summary statistics at bottom
- ✓ Generation timestamp for version control
- ✓ Landscape layout for wide table

#### Yearly Calendar
- ✓ 6 months per page (2 pages total)
- ✓ Visual calendar grid for each month
- ✓ Employee IDs on vacation days
- ✓ **90° rotated text when multiple employees overlap**
- ✓ Wall-mountable format
- ✓ Easy visual planning and conflict detection

### German Language Elements
All forms use proper German terminology:
- Urlaubsplanung (Vacation Planning)
- Mitarbeiter (Employee)
- Genehmigt (Approved)
- Beantragt (Requested)
- Abgelehnt (Declined)
- Unterschrift (Signature)
- Vorgesetzter (Supervisor)
