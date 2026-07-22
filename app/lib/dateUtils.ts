

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export interface WeekRange {
  weekIndex: number;
  label: string;
  startDate: Date;
  endDate: Date;
  days: string[]; 
}


export function getWorkWeeksInMonth(year: number, monthIndex: number): WeekRange[] {
  const weeks: WeekRange[] = [];
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);

  let current = new Date(firstDay);

  // Roll back to the Monday of the starting week if 1st of month isn't Monday
  const dayOfWeek = current.getDay();
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  current.setDate(current.getDate() + diffToMon);

  let weekCount = 1;

  while (current <= lastDay) {
    const weekDays: string[] = [];
    const mon = new Date(current);

    // Build Mon - Fri array
    for (let i = 0; i < 5; i++) {
      const day = new Date(mon);
      day.setDate(mon.getDate() + i);
      const formatted = day.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      weekDays.push(formatted);
    }

    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);

    weeks.push({
      weekIndex: weekCount,
      label: `Week ${weekCount} (${mon.getDate()} ${MONTHS[mon.getMonth()].slice(0,3)} - ${fri.getDate()} ${MONTHS[fri.getMonth()].slice(0,3)})`,
      startDate: mon,
      endDate: fri,
      days: weekDays,
    });

    // Advance 7 days to next Monday
    current.setDate(current.getDate() + 7);
    weekCount++;
  }

  return weeks;
}