import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';

/**
 * 1. GET ROUTE: Fetch All Emergency Requests
 * Used by managers to review logs, joining user information to see who filed it.
 */
export async function GET() {
  try {
    const result = await query(`
      SELECT 
        er.request_id AS id,
        u.name AS "memberName",
        er.target_day AS day,
        er.reason,
        er.status
      FROM emergency_requests er
      JOIN users u ON er.user_id = u.user_id
      ORDER BY er.submitted_at DESC
    `);

    return NextResponse.json(result.rows, { status: 200 });
  } catch (error) {
    console.error('Emergency GET API Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve emergency logs.' }, { status: 500 });
  }
}

/**
 * 2. POST ROUTE: Submit an Emergency Pass
 * Used by Interns and Staff to log an active incident.
 */
export async function POST(request: Request) {
  try {
    const { userId, day, reason } = await request.json();

    if (!userId || !day || !reason) {
      return NextResponse.json({ error: 'Missing emergency log parameters.' }, { status: 400 });
    }

    // Insert request record into database
    const insertResult = await query(
      `INSERT INTO emergency_requests (user_id, target_day, reason, status)
       VALUES ($1, $2, $3, 'Pending')
       RETURNING request_id AS id`,
      [userId, day, reason]
    );

    // Automatically flip that day's column to 'Emergency Pass' in the schedule grid right away
    const targetDayColumn = day.toLowerCase().trim();
    const validDays = ['mon', 'tue', 'wed', 'thu', 'fri'];
    
    if (validDays.includes(targetDayColumn)) {
      await query(
        `UPDATE weekly_schedules SET ${targetDayColumn} = 'Emergency Pass' WHERE user_id = $1`,
        [userId]
      );
    }

    return NextResponse.json({ 
      message: 'Emergency pass submitted successfully.', 
      requestId: insertResult.rows[0].id 
    }, { status: 201 });

  } catch (error) {
    console.error('Emergency POST API Error:', error);
    return NextResponse.json({ error: 'Failed to file emergency pass transaction.' }, { status: 500 });
  }
}

/**
 * 3. PATCH ROUTE: Approve or Decline Request
 * Used by managers to change state status updates.
 */
export async function PATCH(request: Request) {
  try {
    const { requestId, action } = await request.json(); // action is 'Approved' or 'Declined'

    if (!requestId || !action) {
      return NextResponse.json({ error: 'Missing evaluation criteria parameters.' }, { status: 400 });
    }

    if (!['Approved', 'Declined'].includes(action)) {
      return NextResponse.json({ error: 'Invalid management action target.' }, { status: 400 });
    }

    // 1. Update the request status
    const updateResult = await query(
      `UPDATE emergency_requests 
       SET status = $1 
       WHERE request_id = $2 
       RETURNING user_id, target_day`,
      [action, requestId]
    );

    if (updateResult.rows.length === 0) {
      return NextResponse.json({ error: 'Target request record not found.' }, { status: 404 });
    }

    const { user_id, target_day } = updateResult.rows[0];
    const targetDayColumn = target_day.toLowerCase().trim();

    // 2. If management DECLINES, restore that specific day block back to 'Off-Duty' (or another default state)
    if (action === 'Declined') {
      await query(
        `UPDATE weekly_schedules SET ${targetDayColumn} = 'Off-Duty' WHERE user_id = $1`,
        [user_id]
      );
    }

    return NextResponse.json({ message: `Pass has been successfully ${action.toLowerCase()}.` }, { status: 200 });
  } catch (error) {
    console.error('Emergency PATCH API Error:', error);
    return NextResponse.json({ error: 'Failed to compile management decision processing.' }, { status: 500 });
  }
}