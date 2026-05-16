import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFA' },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
    backgroundColor: '#FFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DBDBDB',
  },
  headerBack: { color: '#262626', fontSize: 16, width: 50 },
  headerTitle: { color: '#262626', fontSize: 16, fontWeight: '600' },

  scroll: { padding: 16, gap: 16 },

  // Current identity card
  currentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F0FFF4', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#BBDDC8',
  },
  currentThumb: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#DDD' },
  currentTitle: { fontSize: 14, fontWeight: '600', color: '#1A472A' },
  currentSub: { fontSize: 12, color: '#4A7C59', marginTop: 2 },
  clearBtn: { color: '#FF3B30', fontSize: 13, fontWeight: '500' },

  // Success state
  successCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#F0FFF4', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#BBDDC8',
  },
  successIcon: { fontSize: 28, color: '#34C759' },
  successTitle: { fontSize: 15, fontWeight: '700', color: '#1A472A', marginBottom: 4 },
  successSub: { fontSize: 13, color: '#4A7C59', lineHeight: 19 },

  // Explainer
  explainerCard: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB',
  },
  explainerTitle: { fontSize: 13, fontWeight: '700', color: '#262626', marginBottom: 8 },
  explainerBody: { fontSize: 13, color: '#6E6E6E', lineHeight: 20 },

  // Preview
  previewSection: { alignItems: 'center', gap: 8 },
  previewImage: { width: 220, height: 220, borderRadius: 12, backgroundColor: '#EEE' },
  previewHint: { fontSize: 12, color: '#8E8E8E', textAlign: 'center' },

  // Error
  errorCard: { backgroundColor: '#FFF0F0', borderRadius: 10, padding: 14 },
  errorText: { color: '#FF3B30', fontSize: 13, lineHeight: 18 },

  // Buttons
  pickBtn: {
    backgroundColor: '#F5F5F5', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#DBDBDB',
  },
  pickBtnText: { fontSize: 15, fontWeight: '600', color: '#262626' },

  confirmBtn: {
    backgroundColor: '#0095F6', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },

  doneBtn: {
    backgroundColor: '#34C759', borderRadius: 12, paddingVertical: 15, alignItems: 'center',
  },
  doneBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
