/**
 * DateRangePickerModal
 *
 * A fully custom range calendar that works in Expo Go (no native modules).
 * Tap a start date, then tap an end date — the span is highlighted with a
 * connected bar. Tapping before the current start resets the selection.
 *
 * Props:
 *   dateFrom / dateTo — YYYY-MM-DD strings (empty string = nothing selected)
 *   onConfirm(from, to) — called with two YYYY-MM-DD strings when Done is tapped
 *   onCancel — called when Cancel is tapped
 */
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');
// 16px padding on each side inside the sheet
const CELL_SIZE = Math.floor((SCREEN_W - 32) / 7);

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

function parseYMD(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T12:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

interface Props {
  visible: boolean;
  dateFrom: string;   // YYYY-MM-DD or ''
  dateTo: string;     // YYYY-MM-DD or ''
  onConfirm: (from: string, to: string) => void;
  onCancel: () => void;
}

export default function DatePickerModal({ visible, dateFrom, dateTo, onConfirm, onCancel }: Props) {
  // Which month is displayed
  const today = new Date();
  const initFrom = parseYMD(dateFrom);
  const [dispYear, setDispYear]   = React.useState(initFrom?.getFullYear() ?? today.getFullYear());
  const [dispMonth, setDispMonth] = React.useState(initFrom?.getMonth() ?? today.getMonth());

  // Selection state (inside modal — not committed until Done)
  const [selFrom, setSelFrom] = React.useState<Date | null>(initFrom);
  const [selTo,   setSelTo]   = React.useState<Date | null>(parseYMD(dateTo));
  // 'from' = waiting for user to pick start, 'to' = waiting for end
  const [step, setStep] = React.useState<'from' | 'to'>(initFrom ? 'to' : 'from');

  // Re-sync internal state when modal opens with new external values
  React.useEffect(() => {
    if (visible) {
      const f = parseYMD(dateFrom);
      const t = parseYMD(dateTo);
      setSelFrom(f);
      setSelTo(t);
      setStep(f ? 'to' : 'from');
      // Navigate to the from month (or today)
      const nav = f ?? today;
      setDispYear(nav.getFullYear());
      setDispMonth(nav.getMonth());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Month navigation ──────────────────────────────────────────────────────
  function prevMonth() {
    if (dispMonth === 0) { setDispMonth(11); setDispYear((y) => y - 1); }
    else setDispMonth((m) => m - 1);
  }
  function nextMonth() {
    if (new Date(dispYear, dispMonth + 1, 1) > today) return; // can't go past today's month
    if (dispMonth === 11) { setDispMonth(0); setDispYear((y) => y + 1); }
    else setDispMonth((m) => m + 1);
  }
  function prevYear() { if (dispYear > 2000) setDispYear((y) => y - 1); }
  function nextYear() {
    if (dispYear < today.getFullYear()) setDispYear((y) => y + 1);
  }

  // ── Day tap handler ───────────────────────────────────────────────────────
  function onDayPress(day: number) {
    const tapped = new Date(dispYear, dispMonth, day, 12);
    if (step === 'from') {
      setSelFrom(tapped);
      setSelTo(null);
      setStep('to');
    } else {
      // step === 'to'
      if (selFrom && startOfDay(tapped) >= startOfDay(selFrom)) {
        setSelTo(tapped);
        // Keep step as 'to' so user can adjust if needed
      } else {
        // Tapped before current start — reset with new start
        setSelFrom(tapped);
        setSelTo(null);
      }
    }
  }

  function handleDone() {
    if (!selFrom) return; // nothing selected
    const from = toYMD(selFrom);
    const to   = selTo ? toYMD(selTo) : from; // if only start picked, use same day as end
    onConfirm(from, to);
  }

  // ── Calendar grid ─────────────────────────────────────────────────────────
  const days      = daysInMonth(dispYear, dispMonth);
  const firstDow  = new Date(dispYear, dispMonth, 1).getDay(); // 0=Sun

  // Flat cell array: null = empty, number = day
  const flatCells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) flatCells.push(null);
  for (let d = 1; d <= days; d++) flatCells.push(d);
  while (flatCells.length % 7 !== 0) flatCells.push(null);

  // Split into week rows
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < flatCells.length; i += 7) weeks.push(flatCells.slice(i, i + 7));

  // Range helpers
  const fromTs = selFrom ? startOfDay(selFrom) : null;
  const toTs   = selTo   ? startOfDay(selTo)   : null;

  function cellTs(day: number) {
    return startOfDay(new Date(dispYear, dispMonth, day, 12));
  }

  function isFrom(day: number) {
    return fromTs !== null && cellTs(day) === fromTs;
  }
  function isTo(day: number) {
    return toTs !== null && cellTs(day) === toTs;
  }
  function inRange(day: number) {
    if (!fromTs || !toTs) return false;
    const t = cellTs(day);
    return t >= fromTs && t <= toTs;
  }
  function isDisabled(day: number) {
    const t = new Date(dispYear, dispMonth, day, 12);
    return t > today;
  }

  // ── Hint text ─────────────────────────────────────────────────────────────
  function formatShort(d: Date) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  let hintText = step === 'from' ? 'Select start date' : 'Select end date';
  if (selFrom && selTo) {
    hintText = `${formatShort(selFrom)}  →  ${formatShort(selTo)}`;
  } else if (selFrom) {
    hintText = `${formatShort(selFrom)}  →  ?`;
  }

  const canConfirm = selFrom !== null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.overlay}>
        <View style={s.sheet}>

          {/* Header */}
          <View style={s.header}>
            <Pressable onPress={onCancel} hitSlop={12}>
              <Text style={s.cancel}>Cancel</Text>
            </Pressable>
            <Text style={s.title}>Select dates</Text>
            <Pressable onPress={handleDone} hitSlop={12} disabled={!canConfirm}>
              <Text style={[s.done, !canConfirm && s.doneDim]}>Done</Text>
            </Pressable>
          </View>

          {/* Range hint bar */}
          <View style={s.hintBar}>
            <Text style={s.hintText}>{hintText}</Text>
            {(selFrom || selTo) && (
              <Pressable onPress={() => { setSelFrom(null); setSelTo(null); setStep('from'); }} hitSlop={8}>
                <Text style={s.clearBtn}>Clear</Text>
              </Pressable>
            )}
          </View>

          {/* Month + Year navigation */}
          <View style={s.navRow}>
            <View style={s.navGroup}>
              <Pressable onPress={prevYear} hitSlop={10} style={s.navBtn}>
                <Text style={s.navArrow}>‹</Text>
              </Pressable>
              <Text style={s.navLabel}>{dispYear}</Text>
              <Pressable onPress={nextYear} hitSlop={10} style={s.navBtn}>
                <Text style={[s.navArrow, dispYear >= today.getFullYear() && s.navArrowDim]}>›</Text>
              </Pressable>
            </View>
            <View style={s.navGroup}>
              <Pressable onPress={prevMonth} hitSlop={10} style={s.navBtn}>
                <Text style={s.navArrow}>‹</Text>
              </Pressable>
              <Text style={[s.navLabel, s.navLabelMonth]}>{MONTHS[dispMonth]}</Text>
              <Pressable onPress={nextMonth} hitSlop={10} style={s.navBtn}>
                <Text style={[s.navArrow, new Date(dispYear, dispMonth + 1, 1) > today && s.navArrowDim]}>›</Text>
              </Pressable>
            </View>
          </View>

          {/* Day-of-week labels */}
          <View style={s.dowRow}>
            {DOW.map((d, i) => (
              <View key={i} style={s.dowCell}>
                <Text style={s.dowLabel}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid — one row per week */}
          <View style={s.grid}>
            {weeks.map((week, wi) => (
              <View key={wi} style={s.weekRow}>
                {week.map((day, di) => {
                  if (day === null) {
                    return <View key={`e${di}`} style={s.cellWrap} />;
                  }
                  const from     = isFrom(day);
                  const to       = isTo(day);
                  const inR      = inRange(day);
                  const disabled = isDisabled(day);
                  const isEndpoint = from || to;

                  // Strip logic: left and right half backgrounds for the range bar
                  // Left strip: show if inRange AND not the very first day of range
                  const showLeftStrip  = inR && !from;
                  // Right strip: show if inRange AND not the very last day of range
                  const showRightStrip = inR && !to;

                  return (
                    <Pressable
                      key={day}
                      style={s.cellWrap}
                      onPress={() => !disabled && onDayPress(day)}
                      hitSlop={0}
                    >
                      {/* Range bar strips (left + right halves) */}
                      {showLeftStrip && (
                        <View style={[s.strip, s.stripLeft]} />
                      )}
                      {showRightStrip && (
                        <View style={[s.strip, s.stripRight]} />
                      )}

                      {/* Day circle */}
                      <View style={[
                        s.circle,
                        isEndpoint && s.circleEndpoint,
                        inR && !isEndpoint && s.circleInRange,
                      ]}>
                        <Text style={[
                          s.dayText,
                          isEndpoint && s.dayTextEndpoint,
                          inR && !isEndpoint && s.dayTextInRange,
                          disabled && s.dayTextDisabled,
                        ]}>
                          {day}
                        </Text>
                      </View>

                      {/* Dot under start/end */}
                      {(from && !to) && <View style={s.dot} />}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Spacer for home indicator */}
          <View style={{ height: 32 }} />
        </View>
      </View>
    </Modal>
  );
}

// Need React for useEffect / useState
import React from 'react';

const STRIP_H = CELL_SIZE * 0.6; // height of the range bar strip

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DBDBDB',
  },
  title:  { fontSize: 16, fontWeight: '600', color: '#262626' },
  cancel: { fontSize: 16, color: '#8E8E8E' },
  done:   { fontSize: 16, color: '#0095F6', fontWeight: '600' },
  doneDim:{ color: '#C7C7CC' },

  // ── Hint bar ─────────────────────────────────────────────────────────────
  hintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DBDBDB',
  },
  hintText: { fontSize: 13, color: '#262626', fontWeight: '500', flex: 1 },
  clearBtn: { fontSize: 13, color: '#0095F6', marginLeft: 12 },

  // ── Month / Year nav ─────────────────────────────────────────────────────
  navRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    paddingVertical: 14,
  },
  navGroup:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn:    { padding: 4 },
  navArrow:  { fontSize: 22, color: '#0095F6', lineHeight: 26 },
  navArrowDim: { color: '#C7C7CC' },
  navLabel:  { fontSize: 15, fontWeight: '600', color: '#262626', minWidth: 36, textAlign: 'center' },
  navLabelMonth: { minWidth: 88 },

  // ── Day-of-week header ────────────────────────────────────────────────────
  dowRow:  { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 4 },
  dowCell: { width: CELL_SIZE, alignItems: 'center' },
  dowLabel:{ fontSize: 12, color: '#8E8E8E', fontWeight: '600' },

  // ── Grid ──────────────────────────────────────────────────────────────────
  grid:    { paddingHorizontal: 16 },
  weekRow: { flexDirection: 'row' },

  // Each day slot
  cellWrap: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  // Range bar: two half-strips
  strip: {
    position: 'absolute',
    width: '50%',
    height: STRIP_H,
    backgroundColor: '#D0E8FF',
    top: (CELL_SIZE - STRIP_H) / 2,
  },
  stripLeft:  { left: 0 },
  stripRight: { right: 0 },

  // Day circle
  circle: {
    width: CELL_SIZE - 4,
    height: CELL_SIZE - 4,
    borderRadius: (CELL_SIZE - 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleEndpoint: { backgroundColor: '#0095F6' },
  circleInRange:  { backgroundColor: '#D0E8FF' },

  // Day number text
  dayText:         { fontSize: 15, color: '#262626' },
  dayTextEndpoint: { color: '#FFF', fontWeight: '700' },
  dayTextInRange:  { color: '#0066BB', fontWeight: '500' },
  dayTextDisabled: { color: '#C7C7CC' },

  // Small dot under the from-date when to hasn't been picked yet
  dot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0095F6',
  },
});
