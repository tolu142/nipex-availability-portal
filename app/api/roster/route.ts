
import { NextResponse } from 'next/server';
import { query } from '../../lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get('weekStart');
  const userDept = searchParams.get('department');
  const userRole = searchParams.get('role');

  try {
    const isHeadOfNipex = userRole?.toLowerCase() === 'head of nipex' || userDept === 'HON office';
    
    let sql = `
      SELECT u.user_id AS id, u.name, u.role, u.specific_title AS "specificTitle", u.department, 
             ws.mon, ws.tue, ws.wed, ws.thu, ws.fri,
             COALESCE(ws.absence_reasons, '{}'::jsonb) AS "absenceReasons"
      FROM users u 
      LEFT JOIN weekly_schedules ws ON u.user_id = ws.user_id ${weekStart ? 'AND ws.week_start_date = $1' : ''}
    `;

    const params: any[] = [];
    if (weekStart) params.push(weekStart);

    if (!isHeadOfNipex && userDept) {
      params.push(userDept);
      sql += weekStart ? ` WHERE u.department = $2` : ` WHERE u.department = $1`;
    }

    const result = await query(sql, params);

    const formattedData = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      specificTitle: row.specificTitle,
      department: row.department,
      schedule: {
        Mon: row.mon || 'Available',
        Tue: row.tue || 'Available',
        Wed: row.wed || 'Available',
        Thu: row.thu || 'Available',
        Fri: row.fri || 'Available',
      },
      absenceReasons: typeof row.absenceReasons === 'string' ? JSON.parse(row.absenceReasons) : (row.absenceReasons || {})
    }));

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error fetching roster:', error);
    return NextResponse.json({ error: 'Failed to fetch department roster data' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { userId, day, newStatus, weekStart, reasonType, comment } = body;

    if (!userId || !day || !newStatus) {
      return NextResponse.json({ error: 'Missing targeting parameters.' }, { status: 400 });
    }

    const dayColumn = day.toLowerCase(); // 'mon', 'tue', etc.
    const targetWeek = weekStart || new Date().toISOString().split('T')[0];

    // Combine reason type and optional comment into a payload string/JSON
    const reasonPayload = newStatus === 'Unavailable' 
      ? JSON.stringify({ reasonType: reasonType || 'General', comment: comment || '' })
      : '';

    const sql = `
      INSERT INTO weekly_schedules (user_id, week_start_date, ${dayColumn}, absence_reasons)
      VALUES (
        $1, 
        $2, 
        $3, 
        jsonb_build_object($4::text, $5::text)
      )
      ON CONFLICT (user_id, week_start_date) 
      DO UPDATE SET 
        ${dayColumn} = EXCLUDED.${dayColumn},
        absence_reasons = COALESCE(weekly_schedules.absence_reasons, '{}'::jsonb) || jsonb_build_object($4::text, $5::text);
    `;

    await query(sql, [userId, targetWeek, newStatus, day, reasonPayload]);

    return NextResponse.json({ message: 'Attendance updated successfully.' }, { status: 200 });
  } catch (error) {
    console.error('Roster PUT API Error:', error);
    return NextResponse.json({ error: 'Database update pipeline failure.' }, { status: 500 });
  }
}