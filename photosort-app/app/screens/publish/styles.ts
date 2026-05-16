import { Dimensions, StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
    backgroundColor: '#FFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DBDBDB',
  },
  headerBack: { color: '#262626', fontSize: 16, width: 50 },
  headerTitle: { color: '#262626', fontSize: 16, fontWeight: '600' },
  scroll: { gap: 0 },

  previewSection: { backgroundColor: '#000' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: '#FFF', width: 18 },
  carouselHint: { color: '#8E8E8E', fontSize: 12, textAlign: 'center', paddingBottom: 10 },

  captionCard: {
    backgroundColor: '#FFF', margin: 12, borderRadius: 12,
    padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB',
  },
  captionLabel: { fontSize: 10, fontWeight: '700', color: '#8E8E8E', letterSpacing: 0.8, marginBottom: 8 },
  captionText: { fontSize: 14, color: '#262626', lineHeight: 21, marginBottom: 12 },
  copyBtn: {
    borderWidth: 1.5, borderColor: '#0095F6', borderRadius: 8,
    paddingVertical: 9, alignItems: 'center',
  },
  copyBtnText: { color: '#0095F6', fontSize: 14, fontWeight: '600' },

  section: {
    backgroundColor: '#FFF', marginHorizontal: 12, marginBottom: 12, borderRadius: 12,
    padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB', gap: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#262626' },
  sectionHint: { fontSize: 13, color: '#8E8E8E', lineHeight: 19 },
  bold: { fontWeight: '700', color: '#262626' },

  errorBox: { backgroundColor: '#FFF0F0', borderRadius: 8, padding: 12 },
  errorText: { color: '#FF3B30', fontSize: 13, lineHeight: 18 },

  primaryBtn: {
    backgroundColor: '#0095F6', borderRadius: 10,
    paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // Instagram gradient-ish button
  igBtn: {
    borderRadius: 10, paddingVertical: 15, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center',
    backgroundColor: '#C13584', // Instagram brand purple-pink
  },
  igBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  btnDisabled: { opacity: 0.5 },

  // Connected state
  connectedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F5F5F5', borderRadius: 10, padding: 12,
  },
  connectedAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#C13584', alignItems: 'center', justifyContent: 'center',
  },
  connectedAvatarText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  connectedName: { color: '#262626', fontSize: 14, fontWeight: '600' },
  connectedSub: { color: '#8E8E8E', fontSize: 12, marginTop: 1 },
  disconnectBtn: { color: '#FF3B30', fontSize: 13, fontWeight: '500' },

  // Credential inputs
  credFields: { gap: 10 },
  input: {
    backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 13, fontSize: 14, color: '#262626',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB',
  },

  privacyNote: { fontSize: 11, color: '#AAAAAA', lineHeight: 16, textAlign: 'center' },

  // Inline success
  successInline: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  successInlineIcon: { fontSize: 22, color: '#34C759' },
  successInlineTitle: { fontSize: 14, fontWeight: '600', color: '#262626', flex: 1, flexWrap: 'wrap' },
  successInlineSub: { fontSize: 12, color: '#8E8E8E', marginTop: 3, lineHeight: 17 },

  doneBtn: {
    marginHorizontal: 12, marginTop: 4,
    backgroundColor: '#34C759', borderRadius: 10, paddingVertical: 15, alignItems: 'center',
  },
  doneBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
