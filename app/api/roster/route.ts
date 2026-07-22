import { NextResponse } from 'next/server';
import { query } from '../../lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get('weekStart');

  try {
    // Select individual day columns directly from weekly_schedules (ws)
    const sql = weekStart 
      ? `SELECT u.user_id AS id, u.name, u.role, u.specific_title AS "specificTitle", u.department, 
                ws.mon, ws.tue, ws.wed, ws.thu, ws.fri
         FROM users u 
         LEFT JOIN weekly_schedules ws ON u.user_id = ws.user_id AND ws.week_start_date = $1`
      : `SELECT u.user_id AS id, u.name, u.role, u.specific_title AS "specificTitle", u.department, 
                ws.mon, ws.tue, ws.wed, ws.thu, ws.fri
         FROM users u 
         LEFT JOIN weekly_schedules ws ON u.user_id = ws.user_id`;

    const params = weekStart ? [weekStart] : [];
    const result = await query(sql, params);

    // Map individual day columns into the schedule object the UI expects
    const formattedData = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      specificTitle: row.specificTitle,
      department: row.department,
      schedule: {
        Mon: row.mon || 'On-Site',
        Tue: row.tue || 'On-Site',
        Wed: row.wed || 'On-Site',
        Thu: row.thu || 'On-Site',
        Fri: row.fri || 'On-Site',
      }
    }));

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error fetching roster:', error);
    return NextResponse.json({ error: 'Failed to fetch roster data' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { userId, day, newStatus, weekStart } = await request.json();

    if (!userId || !day || !newStatus) {
      return NextResponse.json({ error: 'Missing targeting parameters.' }, { status: 400 });
    }

    const targetDayColumn = day.toLowerCase().trim(); // 'mon', 'tue', etc.
    const validDays = ['mon', 'tue', 'wed', 'thu', 'fri'];

    if (!validDays.includes(targetDayColumn)) {
      return NextResponse.json({ error: 'Invalid calendar target day.' }, { status: 400 });
    }

    const validStates = ['On-Site', 'Remote', 'Off-Duty', 'Emergency Pass'];
    if (!validStates.includes(newStatus)) {
      return NextResponse.json({ error: 'Unauthorized status state designation input.' }, { status: 400 });
    }

    const targetWeek = weekStart || new Date().toISOString().split('T')[0];

    // Native UPSERT targeting the composite constraint (user_id, week_start_date)
    const sql = `
      INSERT INTO weekly_schedules (user_id, week_start_date, ${targetDayColumn})
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, week_start_date) 
      DO UPDATE SET ${targetDayColumn} = EXCLUDED.${targetDayColumn};
    `;

    await query(sql, [userId, targetWeek, newStatus]);

    return NextResponse.json({ message: 'Roster cell sync completed.' }, { status: 200 });
  } catch (error) {
    console.error('Roster PUT API Error details:', error);
    return NextResponse.json({ error: 'Database update pipeline failure.' }, { status: 500 });
  }
}