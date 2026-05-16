import { StyleSheet } from 'react-native';
import { CELL_GAP, CELL_SIZE, RUNNER_UP_SIZE } from './types';

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#222' },
  headerClose: { color: '#FFF', fontSize: 18, width: 36, textAlign: 'center' },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  headerCount: { color: '#8E8E8E', fontSize: 12, marginTop: 1 },
  headerCountWarn: { color: '#FF3B30' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 100, justifyContent: 'flex-end' },
  iconBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  iconBtnActive: { backgroundColor: '#0095F6', borderColor: '#0095F6' },
  iconBtnText: { color: '#0095F6', fontSize: 15, lineHeight: 20, fontWeight: '700' },
  iconBtnTextActive: { color: '#FFF' },
  headerNext: { color: '#0095F6', fontSize: 16, fontWeight: '600' },
  headerNextDisabled: { color: '#333' },

  // Story narrative banner (AI mode — shown when story description is available)
  storyBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#0A1A0A', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1A3A1A' },
  storyIcon: { fontSize: 14, flexShrink: 0, marginTop: 1 },
  storyText: { color: '#6ECC6E', fontSize: 12, lineHeight: 18 },
  missingText: { color: '#FF9500', fontSize: 11, marginTop: 4, lineHeight: 16 },

  // AI notes banner (fallback when no story description)
  notesBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#0D1A2A', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1A2A3A' },
  notesIcon: { color: '#0095F6', fontSize: 12, flexShrink: 0 },
  notesMain: { flex: 1, color: '#8E8E8E', fontSize: 12, lineHeight: 18 },
  notesChevron: { color: '#0095F6', fontSize: 10, flexShrink: 0 },

  // Main grid
  cell: { width: CELL_SIZE, height: CELL_SIZE, backgroundColor: '#111', overflow: 'hidden' },
  cellImage: { width: '100%', height: '100%' },
  selBadgeActive: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#0095F6', borderColor: '#0095F6', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  selNum: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  roleBadge: { position: 'absolute', top: 4, left: 4, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3 },
  roleText: { color: '#FFF', fontSize: 7, fontWeight: '800', letterSpacing: 0.6 },
  deselHint: { position: 'absolute', bottom: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  deselHintText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  // Reorder list
  reorderList: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  reorderHint: { color: '#555', fontSize: 12, textAlign: 'center', marginBottom: 4 },
  reorderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#111', borderRadius: 10, padding: 10 },
  reorderNum: { color: '#0095F6', fontSize: 14, fontWeight: '700', width: 20, textAlign: 'center' },
  reorderThumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: '#222' },
  reorderArrows: { gap: 6, alignItems: 'center' },
  arrowBtn: { width: 32, height: 28, borderRadius: 6, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  arrowBtnDisabled: { opacity: 0.2 },
  arrowText: { color: '#FFF', fontSize: 13 },
  removeBtn: { marginLeft: 'auto' as any, width: 28, height: 28, borderRadius: 14, backgroundColor: '#2A0000', alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { color: '#FF3B30', fontSize: 13, fontWeight: '700' },

  // Runner-up tray
  traySection: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#222', paddingTop: 10 },
  trayHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, gap: 10 },
  trayDivider: { flex: 1, height: 1, backgroundColor: '#2A2A2A' },
  trayLabel: { color: '#8E8E8E', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  trayRow: { paddingHorizontal: 14, gap: 8, paddingBottom: 4 },
  runnerUpCell: { width: RUNNER_UP_SIZE, height: RUNNER_UP_SIZE, borderRadius: 8, overflow: 'hidden', backgroundColor: '#111' },
  runnerUpImage: { width: '100%', height: '100%' },
  runnerUpAddBtn: { position: 'absolute', bottom: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,149,246,0.85)', alignItems: 'center', justifyContent: 'center' },
  runnerUpAddIcon: { color: '#FFF', fontSize: 14, lineHeight: 20, fontWeight: '700' },

  // Favorites tray
  favTrayLabel: { color: '#FF3B5C' },
  favAddBtn: { position: 'absolute', bottom: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,59,92,0.85)', alignItems: 'center', justifyContent: 'center' },
  favHeartBadge: { position: 'absolute', top: 4, left: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  favHeartText: { color: '#FF3B5C', fontSize: 9, fontWeight: '700' },

  warnBanner: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FF3B30', paddingVertical: 10, alignItems: 'center' },
  warnText: { color: '#FFF', fontSize: 13, fontWeight: '500' },
  toast: { position: 'absolute', bottom: 60, left: 32, right: 32, backgroundColor: 'rgba(30,30,30,0.92)', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center' },
  toastText: { color: '#FFF', fontSize: 13, fontWeight: '500' },
});
