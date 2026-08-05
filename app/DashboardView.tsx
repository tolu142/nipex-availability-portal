'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AuthUser, TeamMember, AvailabilityState } from './types';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface WeekRange {
  weekIndex: number;
  label: string;
  startDateStr: string;
  days: { key: string; label: string }[];
}

function getWorkWeeksInMonth(year: number, monthIndex: number): WeekRange[] {
  const weeks: WeekRange[] = [];
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);

  let current = new Date(firstDay);
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

    const startDateStr = mon.toISOString().split('T')[0];

    weeks.push({
      weekIndex: weekCount,
      label: `Week ${weekCount} (${mon.getDate()} ${MONTHS[mon.getMonth()].slice(0, 3)} - ${fri.getDate()} ${MONTHS[fri.getMonth()].slice(0, 3)})`,
      startDateStr,
      days: weekDays,
    });

    current.setDate(current.getDate() + 7);
    weekCount++;
  }

  return weeks;
}

interface DashboardViewProps {
  user: AuthUser;
  onLogout: () => void;
}

export default function DashboardView({ user, onLogout }: DashboardViewProps) {
  const today = new Date();

  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);

  const [teamData, setTeamData] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Master Roster & Unavailability Modal States
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [activeCellModal, setActiveCellModal] = useState<{ memberId: number; dayKey: string } | null>(null);
  const [reasonType, setReasonType] = useState('Work Related Issues');
  const [commentText, setCommentText] = useState('');
  const [giFile, setGiFile] = useState<File | null>(null);

  const availableWeeks = useMemo(() => {
    return getWorkWeeksInMonth(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  const currentWeek = availableWeeks[selectedWeekIndex] || availableWeeks[0];
  const isManagement = ['Manager IT', 'Deputy Manager', 'DM Application', 'DM Infrastructure'].includes(user.role);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const rosterRes = await fetch(
        `/api/roster?weekStart=${currentWeek?.startDateStr || ''}&department=${encodeURIComponent(user.department || '')}&role=${encodeURIComponent(user.role || '')}`
      );
      const rosterJson = await rosterRes.json();
      if (rosterRes.ok) setTeamData(rosterJson);
    } catch (err) {
      console.error('Error hydrating dashboard elements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentWeek?.startDateStr) {
      loadDashboardData();
    }
  }, [selectedYear, selectedMonth, selectedWeekIndex]);

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

  const handleCellClick = (memberId: number, dayKey: string) => {
    const hasEditPermission = isManagement || user.id === memberId;
    if (!hasEditPermission) {
      alert("Unauthorized. You can only adjust your own personal schedule row.");
      return;
    }

    const targetMember = teamData.find(m => m.id === memberId);
    if (!targetMember) return;

    const currentStatus = targetMember.schedule[dayKey];

    // Toggle logic: Available -> Open modal for Unavailable options | Unavailable -> Switch back to Available
    if (currentStatus === 'Available' || currentStatus === 'Present' || !currentStatus) {
      setActiveCellModal({ memberId, dayKey });
    } else {
      saveStatusUpdate(memberId, dayKey, 'Available', '', '');
    }
  };

  const saveStatusUpdate = async (
    memberId: number, 
    dayKey: string, 
    newStatus: 'Available' | 'Unavailable',
    reason: string,
    comment: string
  ) => {
    try {
      const response = await fetch('/api/roster', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: memberId, 
          day: dayKey, 
          newStatus: newStatus, 
          reasonType: reason,
          comment: comment,
          weekStart: currentWeek.startDateStr 
        }),
      });

      if (response.ok) {
        const reasonPayload = newStatus === 'Unavailable' ? JSON.stringify({ reasonType: reason, comment }) : '';
        setTeamData(prev => prev.map(m => {
          if (m.id === memberId) {
            return {
              ...m,
              schedule: { ...m.schedule, [dayKey]: newStatus },
              absenceReasons: { ...(m.absenceReasons || {}), [dayKey]: reasonPayload }
            };
          }
          return m;
        }));
        setActiveCellModal(null);
        setCommentText('');
        setGiFile(null);
      } else {
        alert('Failed to sync availability state to server.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && teamData.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', backgroundColor: '#f8fafc' }}>
        <h3 style={{ color: '#090d16' }}>Loading NipeX System Nodes Data Matrix...</h3>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* 🚀 HEADER WITH MASTER ROSTER BUTTON */}
      <header style={{ backgroundColor: '#090d16', color: '#fff', padding: '20px 4%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>NipeX Console Dashboard</h2>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
            User: <strong>{user.name}</strong> • Node Role: <span style={{ color: '#4ade80' }}><strong>{user.specificTitle}</strong></span> • Dept: <strong>{user.department}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            onClick={() => setShowRosterModal(true)}
            style={{ 
              backgroundColor: '#005A1A', 
              color: '#fff', 
              border: 'none', 
              padding: '10px 18px', 
              borderRadius: '6px', 
              fontWeight: 600, 
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            📋 Master Roster
          </button>

          <button onClick={onLogout} style={{ backgroundColor: 'transparent', color: '#fff', border: '1px solid #334155', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
            Disconnect Session
          </button>
        </div>
      </header>

      <main style={{ padding: '40px 4%' }}>
        
        {/* YEAR & MONTH CALENDAR TOOLBAR */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          marginBottom: '32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button 
                onClick={handlePrevMonth}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#090d16', cursor: 'pointer', fontWeight: 700 }}
              >
                ◀
              </button>
              
              <select 
                value={selectedMonth} 
                onChange={(e) => { setSelectedMonth(Number(e.target.value)); setSelectedWeekIndex(0); }}
                style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: '15px', color: '#090d16', backgroundColor: '#fff', cursor: 'pointer' }}
              >
                {MONTHS.map((monthName, idx) => (
                  <option key={monthName} value={idx} style={{ color: '#090d16', backgroundColor: '#ffffff' }}>{monthName}</option>
                ))}
              </select>

              <select 
                value={selectedYear} 
                onChange={(e) => { setSelectedYear(Number(e.target.value)); setSelectedWeekIndex(0); }}
                style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: '15px', color: '#090d16', backgroundColor: '#fff', cursor: 'pointer' }}
              >
                {[2025, 2026, 2027].map((yr) => (
                  <option key={yr} value={yr} style={{ color: '#090d16', backgroundColor: '#ffffff' }}>{yr}</option>
                ))}
              </select>

              <button 
                onClick={handleNextMonth}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#090d16', cursor: 'pointer', fontWeight: 700 }}
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

        {/* MAIN ATTENDANCE MATRIX */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: '#090d16' }}>Daily Availability Matrix</h3>
            {user.role === 'Head of NipeX' && <p style={{ color: '#16a34a', fontSize: '14px', fontWeight: 600, margin: '4px 0 0 0' }}>🔒 Executive Read-Only Administrative Viewport Node Mode</p>}
            {!isManagement && <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#2563eb' }}>✍️ Personal Access Mode. Click cell elements on your row to switch between Available & Unavailable.</p>}
            {isManagement && <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#2563eb' }}>✍️ Management Active Profile. Click cell elements directly to set availability states.</p>}
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
                  
                  {/* CELL RENDERING WITH TAG BADGES & AVAILABILITY TOGGLES */}
                  {currentWeek?.days.map(d => {
                    const status = m.schedule[d.key] === 'Unavailable' ? 'Unavailable' : 'Available';
                    const isAvailable = status === 'Available';

                    let reasonData: { reasonType?: string; comment?: string } = {};
                    if (m.absenceReasons && m.absenceReasons[d.key]) {
                      try {
                        reasonData = typeof m.absenceReasons[d.key] === 'string' 
                          ? JSON.parse(m.absenceReasons[d.key]) 
                          : m.absenceReasons[d.key];
                      } catch (e) {}
                    }

                    const bg = isAvailable ? '#e6f4ea' : '#fce8e6';
                    const fg = isAvailable ? '#137333' : '#c5221f';
                    const canEditCell = isManagement || user.id === m.id;

                    return (
                      <td key={d.key} style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button 
                          onClick={() => handleCellClick(m.id, d.key)} 
                          disabled={!canEditCell} 
                          style={{ 
                            backgroundColor: bg, 
                            color: fg, 
                            border: 'none', 
                            fontWeight: 700, 
                            fontSize: '12px', 
                            padding: '8px 10px', 
                            width: '100%', 
                            maxWidth: '130px', 
                            borderRadius: '6px', 
                            cursor: canEditCell ? 'pointer' : 'default',
                            opacity: canEditCell ? 1 : 0.8,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            margin: '0 auto'
                          }}
                        >
                          <span>{status}</span>
                          
                          {/* Tag badge for Unavailability reasons */}
                          {!isAvailable && (reasonData.reasonType || reasonData.comment) && (
                            <span style={{ 
                              fontSize: '10px', 
                              backgroundColor: 'rgba(197,34,31,0.15)', 
                              color: '#991b1b',
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              maxWidth: '110px', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap' 
                            }}>
                              🏷️ {reasonData.reasonType === 'Work Related Issues' ? 'Work Issue' : (reasonData.comment || 'Unavailable')}
                            </span>
                          )}
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

      {/* MASTER PREDETERMINED ROSTER MODAL */}
      {showRosterModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(9, 13, 22, 0.75)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            width: '90%',
            maxWidth: '900px',
            maxHeight: '85vh',
            borderRadius: '12px',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#090d16' }}>
                  Department Master Roster — {user.department}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Predetermined weekly duty schedules for {currentWeek?.label}
                </p>
              </div>
              <button 
                onClick={() => setShowRosterModal(false)}
                style={{ backgroundColor: '#f1f5f9', border: 'none', padding: '8px 14px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', color: '#475569' }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>Personnel</th>
                    <th style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>Role</th>
                    {currentWeek?.days.map(d => (
                      <th key={d.key} style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'center', color: '#005A1A' }}>
                        {d.key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teamData.map((member) => (
                    <tr key={member.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#090d16' }}>
                        {member.name}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748b' }}>
                        {member.specificTitle}
                      </td>
                      {currentWeek?.days.map(d => (
                        <td key={d.key} style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: '#f1f5f9',
                            color: '#334155'
                          }}>
                            {member.schedule[d.key] || 'Available'}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <button 
                onClick={() => setShowRosterModal(false)}
                style={{ backgroundColor: '#090d16', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNAVAILABILITY REASON POPUP MODAL */}
      {activeCellModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: '#fff', width: '90%', maxWidth: '440px', padding: '24px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700, color: '#090d16' }}>Specify Unavailability Reason</h3>
            
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>Reason Category</label>
              <select 
                value={reasonType} 
                onChange={(e) => setReasonType(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  borderRadius: '6px', 
                  border: '1px solid #cbd5e1', 
                  fontSize: '14px',
                  color: '#090d16',
                  backgroundColor: '#ffffff',
                  fontWeight: 600
                }}
              >
                <option value="Official Assignment" style={{ color: '#090d16', backgroundColor: '#ffffff' }}>Official Assignment</option>
                <option value="Custom Comment" style={{ color: '#090d16', backgroundColor: '#ffffff' }}>Other / Custom Reason</option>
              </select>
            </div>

            {reasonType === 'Official Assignment' ? (
              <div style={{ marginBottom: '16px', backgroundColor: '#eff6ff', padding: '12px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#1e40af', marginBottom: '6px' }}>
                  📁 Upload Mandatory GI Document
                </label>
                <input 
                  type="file" 
                  onChange={(e) => setGiFile(e.target.files?.[0] || null)}
                  style={{ 
                    fontSize: '13px', 
                    color: '#1e293b',
                    fontWeight: 500,
                    width: '100%'
                  }}
                />
              </div>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#334155' }}>Type Unavailability Comment</label>
                <textarea 
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="State why you will be unavailable..."
                  rows={3}
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    borderRadius: '6px', 
                    border: '1px solid #cbd5e1', 
                    fontSize: '13px',
                    color: '#090d16',
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setActiveCellModal(null)}
                style={{ padding: '8px 16px', border: '1px solid #cbd5e1', backgroundColor: '#fff', borderRadius: '6px', cursor: 'pointer', color: '#475569' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (reasonType === 'Official Assignment' && !giFile) {
                    alert('Please select mandatory GI document file before submitting.');
                    return;
                  }
                  saveStatusUpdate(activeCellModal.memberId, activeCellModal.dayKey, 'Unavailable', reasonType, commentText);
                }}
                style={{ padding: '8px 16px', border: 'none', backgroundColor: '#c5221f', color: '#fff', fontWeight: 700, borderRadius: '6px', cursor: 'pointer' }}
              >
                Confirm Unavailable
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}