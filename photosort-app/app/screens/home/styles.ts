import { Platform, StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DBDBDB' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  logoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#0095F6', alignItems: 'center', justifyContent: 'center' },
  logoIconText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  logoTitle: { fontSize: 22, fontWeight: '700', color: '#262626', letterSpacing: -0.5 },
  logoSub: { fontSize: 13, color: '#8E8E8E', marginLeft: 46 },
  scroll: { paddingVertical: 8 },
  section: { backgroundColor: '#FFF', marginTop: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB' },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#8E8E8E', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  sectionHint: { fontSize: 12, color: '#8E8E8E', marginBottom: 10, lineHeight: 17 },

  // Date range picker
  dateRangeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FAFAFA' },
  datePill: { flex: 1 },
  datePillLabel: { fontSize: 10, color: '#8E8E8E', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  datePillValue: { fontSize: 14, color: '#262626', fontWeight: '500' },
  datePillPlaceholder: { color: '#C7C7CC' },
  dateSepArrow: { fontSize: 16, color: '#C7C7CC', paddingHorizontal: 4 },

  // Legacy date inputs (used for radius)
  dateLabel: { fontSize: 11, color: '#8E8E8E', marginBottom: 5, fontWeight: '500' },
  dateInput: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#262626', backgroundColor: '#FAFAFA' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#262626', backgroundColor: '#FAFAFA' },
  radiusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },

  // Method picker (also reused for persona radio)
  methodList: { gap: 8 },
  methodCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#DBDBDB', backgroundColor: '#FAFAFA' },
  methodCardActive: { borderColor: '#0095F6', backgroundColor: '#EAF5FF' },
  methodRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#DBDBDB', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  methodRadioActive: { borderColor: '#0095F6' },
  methodRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0095F6' },
  methodLabel: { fontSize: 15, fontWeight: '500', color: '#262626' },
  methodLabelActive: { color: '#0095F6', fontWeight: '600' },
  methodSub: { fontSize: 12, color: '#8E8E8E', marginTop: 1 },

  // Persona picker
  personaList: { gap: 8 },
  personaCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#DBDBDB', backgroundColor: '#FAFAFA' },
  personaCardActive: { borderColor: '#0095F6', backgroundColor: '#EAF5FF' },
  personaCardNone: { borderColor: '#0095F6', backgroundColor: '#EAF5FF' },
  personaName: { fontSize: 14, fontWeight: '600', color: '#262626', marginBottom: 3 },
  personaNameActive: { color: '#0095F6' },
  personaDesc: { fontSize: 12, color: '#8E8E8E', lineHeight: 17 },
  discoverChip: { alignItems: 'center', paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#DBDBDB', borderStyle: 'dashed', backgroundColor: '#FAFAFA', marginTop: 2 },
  discoverText: { fontSize: 12, color: '#C7C7CC', fontWeight: '500' },

  // Face filter section
  faceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  faceThumb: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DDD' },
  faceLabel: { fontSize: 14, fontWeight: '600', color: '#262626' },
  faceChangeLink: { fontSize: 12, color: '#0095F6', marginTop: 2 },
  toggleBtn: { padding: 4 },
  toggleTrack: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#E5E5EA', justifyContent: 'center', paddingHorizontal: 2 },
  toggleTrackOn: { backgroundColor: '#34C759' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  toggleThumbOn: { transform: [{ translateX: 20 }] },
  faceSetupBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#DBDBDB', borderStyle: 'dashed', backgroundColor: '#FAFAFA' },
  faceSetupIcon: { fontSize: 24 },
  faceSetupTitle: { fontSize: 14, fontWeight: '600', color: '#262626' },
  faceSetupSub: { fontSize: 12, color: '#8E8E8E', marginTop: 2, lineHeight: 17 },
  faceSetupArrow: { fontSize: 20, color: '#C7C7CC' },

  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 },
  footer: { backgroundColor: '#FFF', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DBDBDB' },
  nextBtn: { backgroundColor: '#0095F6', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  nextBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
