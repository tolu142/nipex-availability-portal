'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AuthUser, TeamMember, EmergencyRequest, AvailabilityState } from './types';


const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface WeekRange {
  weekIndex: number;
  label: string;
  startDateStr: string; // YYYY-MM-DD format for API query
  days: { key: string; label: string }[]; // e.g. { key: 'Mon', label: 'Mon Jul 20' }
}

function getWorkWeeksInMonth(year: number, monthIndex: number): WeekRange[] {
  const weeks: WeekRange[] = [];
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);

  let current = new Date(firstDay);

  // Roll back to the Monday of the starting week if 1st isn't Monday
  const dayOfWeek = current.getDay();
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  current.setDate(current.getDate() + diffToMon);

  let weekCount = 1;

  while (current <= lastDay) {
    const weekDays: { key: string; label: string }[] = [];
    const mon = new Date(current);
    const dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

    for (let i = 0; i < 5; i++) {
      const day = new Date(mon);
      day.setDate(mon.getDate() + i);
      const formatted = day.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      weekDays.push({ key: dayKeys[i], label: formatted });
    }

    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);

    // Format YYYY-MM-DD for database query
    const startDateStr = mon.toISOString().split('T')[0];

    weeks.push({
      weekIndex: weekCount,
      label: `Week ${weekCount} (${mon.getDate()} ${MONTHS[mon.getMonth()].slice(0,3)} - ${fri.getDate()} ${MONTHS[fri.getMonth()].slice(0,3)})`,
      startDateStr,
      days: weekDays,
    });

    current.setDate(current.getDate() + 7);
    weekCount++;
  }

  return weeks;
}

// --- MAIN COMPONENT ---
interface DashboardViewProps {
  user: AuthUser;
  onLogout: () => void;
}

export default function DashboardView({ user, onLogout }: DashboardViewProps) {
  const today = new Date();

  // --- CALENDAR STATE ---
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);

  // --- DATA STATE ---
  const [teamData, setTeamData] = useState<TeamMember[]>([]);
  const [emergencyLog, setEmergencyLog] = useState<EmergencyRequest[]>([]);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [emergencyDay, setEmergencyDay] = useState('Mon');
  const [loading, setLoading] = useState(true);

  // Compute work weeks for current month/year selection
  const availableWeeks = useMemo(() => {
    return getWorkWeeksInMonth(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  const currentWeek = availableWeeks[selectedWeekIndex] || availableWeeks[0];
  const isManagement = ['Manager IT', 'Deputy Manager', 'DM Application', 'DM Infrastructure'].includes(user.role);

  // --- API DATA HYDRATION ---
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch roster passing selected week start date
      const rosterRes = await fetch(`/api/roster?weekStart=${currentWeek?.startDateStr || ''}`);
      const rosterJson = await rosterRes.json();
      if (rosterRes.ok) setTeamData(rosterJson);

      const emergencyRes = await fetch('/api/emergency');
      const emergencyJson = await emergencyRes.json();
      if (emergencyRes.ok) setEmergencyLog(emergencyJson);
    } catch (err) {
      console.error('Error hydrating dashboard elements:', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch data whenever week selection changes
  useEffect(() => {
    if (currentWeek?.startDateStr) {
      loadDashboardData();
    }
  }, [selectedYear, selectedMonth, selectedWeekIndex]);

  // --- CALENDAR NAVIGATION HANDLERS ---
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
    setSelectedWeekIndex(0);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
    setSelectedWeekIndex(0);
  };

  const handleJumpToToday = () => {
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);

    const currentMonthWeeks = getWorkWeeksInMonth(currentYear, currentMonth);

    const activeIndex = currentMonthWeeks.findIndex((wk) => {
      const start = new Date(wk.startDateStr);
      const end = new Date(start);
      end.setDate(start.getDate() + 6); 
      return today >= start && today <= end;
    });

    setSelectedWeekIndex(activeIndex !== -1 ? activeIndex : 0);
  };

  const cycleStatus = async (memberId: number, dayKey: string) => {
    const hasEditPermission = isManagement || user.id === memberId;

    if (!hasEditPermission) {
      alert("Unauthorized. You can only adjust your own personal schedule row.");
      return;
    }

    const targetMember = teamData.find(m => m.id === memberId);
    if (!targetMember) return;

    const currentStatus = targetMember.schedule[dayKey] || 'Off-Duty';
    const nextMap: { [key: string]: AvailabilityState } = {
      'On-Site': 'Remote', 'Remote': 'Off-Duty', 'Off-Duty': 'Emergency Pass', 'Emergency Pass': 'On-Site'
    };
    const newStatus = nextMap[currentStatus];

    try {
      const response = await fetch('/api/roster', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: memberId, 
          day: dayKey, 
          newStatus, 
          weekStart: currentWeek.startDateStr 
        }),
      });

      if (response.ok) {
        setTeamData(prev => prev.map(m => m.id === memberId ? { ...m, schedule: { ...m.schedule, [dayKey]: newStatus } } : m));
      } else {
        alert('Failed to sync cell changes to server.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const submitEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergencyReason.trim()) return;

    try {
      const response = await fetch('/api/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, day: emergencyDay, reason: emergencyReason }),
      });

      if (response.ok) {
        alert('Emergency pass logged. Grid context updated.');
        setEmergencyReason('');
        loadDashboardData();
      } else {
        alert('Failed to submit emergency pass.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resolveEmergency = async (requestId: string, action: 'Approved' | 'Declined') => {
    try {
      const response = await fetch('/api/emergency', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });

      if (response.ok) {
        alert(`Request has been marked as ${action.toLowerCase()}`);
        loadDashboardData();
      } else {
        alert('Could not update application status processing.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && teamData.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', backgroundColor: '#f8fafc' }}>
        <h3>Loading NipeX System Nodes Data Matrix...</h3>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ backgroundColor: '#090d16', color: '#fff', padding: '20px 4%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>NipeX Console Dashboard</h2>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
            User: <strong>{user.name}</strong> • Node Role: <span style={{ color: '#4ade80' }}><strong>{user.specificTitle}</strong></span>
          </div>
        </div>
        <button onClick={onLogout} style={{ backgroundColor: 'transparent', color: '#fff', border: '1px solid #334155', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Disconnect Session</button>
      </header>

      <main style={{ padding: '40px 4%' }}>
        
        {/* 🗓️ YEAR & MONTH CALENDAR TOOLBAR */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          marginBottom: '32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            
            {/* Month & Year Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button 
                onClick={handlePrevMonth}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 700 }}
              >
                ◀
              </button>
              
              <select 
                value={selectedMonth} 
                onChange={(e) => { setSelectedMonth(Number(e.target.value)); setSelectedWeekIndex(0); }}
                style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: '15px', color: '#090d16', backgroundColor: '#fff', cursor: 'pointer' }}
              >
                {MONTHS.map((monthName, idx) => (
                  <option key={monthName} value={idx}>{monthName}</option>
                ))}
              </select>

              <select 
                value={selectedYear} 
                onChange={(e) => { setSelectedYear(Number(e.target.value)); setSelectedWeekIndex(0); }}
                style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: '15px', color: '#090d16', backgroundColor: '#fff', cursor: 'pointer' }}
              >
                {[2025, 2026, 2027].map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>

              <button 
                onClick={handleNextMonth}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', cursor: 'pointer', fontWeight: 700 }}
              >
                ▶
              </button>

              <button 
                onClick={handleJumpToToday}
                style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'rgba(0, 90, 26, 0.1)', color: '#005A1A', fontWeight: 700, cursor: 'pointer', marginLeft: '6px' }}
              >
                Jump to Today
              </button>
            </div>

            {/* Week Selector Chips */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {availableWeeks.map((wk, idx) => (
                <button
                  key={wk.weekIndex}
                  onClick={() => setSelectedWeekIndex(idx)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '20px',
                    border: idx === selectedWeekIndex ? 'none' : '1px solid #cbd5e1',
                    backgroundColor: idx === selectedWeekIndex ? '#005A1A' : '#ffffff',
                    color: idx === selectedWeekIndex ? '#ffffff' : '#475569',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {wk.label}
                </button>
              ))}
            </div>

          </div>
        </div>

        {/* EMERGENCY MANAGEMENT CONTROL PANEL (INTERNS & GENERAL STAFF) */}
        {(user.role === 'Intern' || user.role === 'Staff') && (
          <div style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '12px', border: '1px solid #fda4af', marginBottom: '32px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#be123c', fontSize: '18px', fontWeight: 700 }}>🚨 Report Duty Absence / Emergency Pass</h4>
            <form onSubmit={submitEmergency} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 150px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Target Day</label>
                <select value={emergencyDay} onChange={(e) => setEmergencyDay(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#090d16' }}>
                  {currentWeek?.days.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </div>
              <div style={{ flex: '3 1 350px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Reason Statement</label>
                <input type="text" placeholder="Detail active reason..." value={emergencyReason} onChange={(e) => setEmergencyReason(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', color: '#090d16' }} />
              </div>
              <button type="submit" style={{ backgroundColor: '#e11d48', color: '#fff', border: 'none', padding: '11px 24px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Transmit Request</button>
            </form>
          </div>
        )}

        {/* MANAGERIAL REVIEW INTERFACE */}
        {isManagement && (
          <div style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '32px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: '#090d16' }}>Auditable Incidents Pending Pass Review</h4>
            {emergencyLog.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>No active emergency incidents reported.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {emergencyLog.map(req => (
                  <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '8px', backgroundColor: '#fff5f5', border: '1px solid #fee2e2' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: '#991b1b' }}>{req.memberName}</span> ({req.day}) — <span style={{ fontSize: '14px', fontStyle: 'italic' }}>"{req.reason}"</span>
                      <div style={{ marginTop: '4px', fontSize: '12px', color: '#475569' }}>Status: <strong style={{ color: req.status === 'Approved' ? '#16a34a' : req.status === 'Declined' ? '#b91c1c' : '#d97706' }}>{req.status}</strong></div>
                    </div>
                    {req.status === 'Pending' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => resolveEmergency(req.id, 'Approved')} style={{ backgroundColor: '#005A1A', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Approve</button>
                        <button onClick={() => resolveEmergency(req.id, 'Declined')} style={{ backgroundColor: '#b91c1c', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Decline</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MAIN ATTENDANCE MATRIX */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: '#090d16' }}>Availability Log Grid</h3>
            {user.role === 'Head of NipeX' && <p style={{ color: '#16a34a', fontSize: '14px', fontWeight: 600, margin: '4px 0 0 0' }}>🔒 Executive Read-Only Administrative Viewport Node Mode</p>}
            {!isManagement && <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#2563eb' }}>✍️ Personal Access Mode. Click cell elements on your own row to cycle your availability.</p>}
            {isManagement && <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#2563eb' }}>✍️ Management Level Active Profile. Click cell elements directly to cycle availability profiles.</p>}
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#475569' }}>Personnel Item</th>
                <th style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: '#475569' }}>Attached Designation</th>
                {currentWeek?.days.map(d => (
                  <th key={d.key} style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, textAlign: 'center', color: '#005A1A' }}>
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teamData.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#090d16' }}>{m.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{m.department}</div>
                  </td>
                  <td style={{ padding: '20px 24px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#005A1A' }}>{m.specificTitle}</div>
                  </td>
                  {currentWeek?.days.map(d => {
                    const status = m.schedule[d.key] || 'Off-Duty';
                    let bg = '#f1f3f4', fg = '#5f6368';
                    if (status === 'On-Site') { bg = '#e6f4ea'; fg = '#137333'; }
                    else if (status === 'Remote') { bg = '#feeed3'; fg = '#b06000'; }
                    else if (status === 'Emergency Pass') { bg = '#fce8e6'; fg = '#c5221f'; }

                    const canEditCell = isManagement || user.id === m.id;

                    return (
                      <td key={d.key} style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button 
                          onClick={() => cycleStatus(m.id, d.key)} 
                          disabled={!canEditCell} 
                          style={{ 
                            backgroundColor: bg, 
                            color: fg, 
                            border: 'none', 
                            fontWeight: 700, 
                            fontSize: '12px', 
                            padding: '10px 0', 
                            width: '100%', 
                            maxWidth: '120px', 
                            borderRadius: '6px', 
                            cursor: canEditCell ? 'pointer' : 'default',
                            opacity: canEditCell ? 1 : 0.75
                          }}
                        >
                          {status}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}