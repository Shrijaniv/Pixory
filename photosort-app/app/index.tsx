import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DatePickerModal from '../components/DatePickerModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hasIdentity, FaceIdentity, loadIdentity } from '../lib/faceIdentity';
import { clearSession, loadPersistedPrefs, loadSession, persistPrefs, PersonaType, store } from '../lib/store';

const METHODS = [
  { id: 'classic', label: 'Auto Select', sublabel: 'Fast · on-device quality scoring' },
  { id: 'claude', label: 'Claude AI', sublabel: 'Best results · uses backend API key' },
  { id: 'openai', label: 'GPT-4o', sublabel: 'OpenAI vision · uses backend API key' },
];

const PERSONAS: { id: PersonaType; name: string; description: string }[] = [
  {
    id: 'aesthete',
    name: 'The Aesthete',
    description: 'Has a consistent grid. Will reject a perfect moment because the colors clash. Picks the photo that fits the palette, not the one where everyone\'s laughing hardest.',
  },
  {
    id: 'social',
    name: 'The Social Connector',
    description: 'Every slide needs to have people in it. Landscapes feel empty. "Tag me in that one" is the goal. They want their friends to share it.',
  },
  {
    id: 'logger',
    name: 'The Experience Logger',
    description: '"I was here, I did this." Documentary instinct. Slightly rough edges feel authentic. They\'d post the blurry photo from the boat because it was a real moment.',
  },
  {
    id: 'storyteller',
    name: 'The Storyteller',
    description: 'They think in sequences. They\'ll swap a better photo for a worse one because it transitions better to the next slide.',
  },
  {
    id: 'minimalist',
    name: 'The Minimalist',
    description: 'Would rather post 4 perfect photos than 10 good ones. Less is always more.',
  },
];

function formatDateDisplay(s: string): string {
  if (!s) return 'Select';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [dateFrom, setDateFrom] = useState(store.dateFrom);
  const [dateTo, setDateTo]     = useState(store.dateTo);
  const [location, setLocation] = useState(store.locationName);
  const [radius, setRadius]     = useState(String(store.locationRadiusKm));
  const [storyText, setStoryText] = useState(store.vibe);          // "what's the story?"
  const [persona, setPersona]   = useState<PersonaType | null>(store.persona);
  const [method, setMethod]     = useState(store.method);
  const [backendUrl, setBackendUrl] = useState(store.backendUrl);
  const [identitySet, setIdentitySet] = useState(false);
  const [identityUri, setIdentityUri] = useState<string | null>(null);
  const [filterByUserFace, setFilterByUserFace] = useState(store.filterByUserFace);

  // Date range picker modal
  const [showRangePicker, setShowRangePicker] = useState(false);

  // Load persisted prefs on mount + check for a saved session to resume
  useEffect(() => {
    loadPersistedPrefs().then(() => {
      setBackendUrl(store.backendUrl);
      setMethod(store.method);
      setPersona(store.persona);
      setFilterByUserFace(store.filterByUserFace);
    });

    // Check if face identity has been set up
    loadIdentity().then((id) => {
      setIdentitySet(!!id);
      setIdentityUri(id?.refPhotoUri ?? null);
    });

    loadSession().then((hasSession) => {
      if (hasSession) {
        Alert.alert(
          'Resume session?',
          `You have an unfinished curation from earlier (${store.selectedPhotos.length} photos selected). Resume it?`,
          [
            { text: 'Start fresh', style: 'destructive', onPress: () => clearSession() },
            { text: 'Resume', onPress: () => router.replace('/review') },
          ],
        );
      }
    });
  }, []);

  // Refresh identity state when returning from face-setup screen
  useFocusEffect(useCallback(() => {
    loadIdentity().then((id) => {
      setIdentitySet(!!id);
      setIdentityUri(id?.refPhotoUri ?? null);
      // If identity was cleared, also turn off the filter
      if (!id && store.filterByUserFace) {
        store.filterByUserFace = false;
        setFilterByUserFace(false);
        persistPrefs();
      }
    });
  }, []));

  // Persist immediately when backend URL, method, or persona changes
  useEffect(() => { store.backendUrl = backendUrl; persistPrefs(); }, [backendUrl]);
  useEffect(() => { store.method = method; persistPrefs(); }, [method]);
  useEffect(() => { store.persona = persona; persistPrefs(); }, [persona]);

  function confirmRange(from: string, to: string) {
    setDateFrom(from);
    setDateTo(to);
    setShowRangePicker(false);
  }

  function handleNext() {
    store.dateFrom          = dateFrom.trim();
    store.dateTo            = dateTo.trim();
    store.locationName      = location.trim();
    store.locationRadiusKm  = Number(radius) || 50;
    store.vibe              = storyText.trim();   // "what's the story" → vibe field
    store.persona           = persona;
    // Derive content mix from persona for backward compat with scoring pipeline
    store.contentMix        = persona === 'social' ? 'people' : 'balanced';
    store.method            = method;
    store.backendUrl        = backendUrl.trim() || 'http://localhost:8000';
    clearSession(); // start fresh
    router.push('/processing');
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}><Text style={styles.logoIconText}>Px</Text></View>
          <Text style={styles.logoTitle}>Pixory</Text>
        </View>
        <Text style={styles.logoSub}>AI-powered Instagram curation</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Date Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date Range</Text>
            <Text style={styles.sectionHint}>Photos will be pulled directly from your iOS Photos library.</Text>
            <Pressable style={styles.dateRangeBtn} onPress={() => setShowRangePicker(true)}>
              <View style={styles.datePill}>
                <Text style={styles.datePillLabel}>From</Text>
                <Text style={[styles.datePillValue, !dateFrom && styles.datePillPlaceholder]}>
                  {dateFrom ? formatDateDisplay(dateFrom) : 'Start date'}
                </Text>
              </View>
              <Text style={styles.dateSepArrow}>→</Text>
              <View style={styles.datePill}>
                <Text style={styles.datePillLabel}>To</Text>
                <Text style={[styles.datePillValue, !dateTo && styles.datePillPlaceholder]}>
                  {dateTo ? formatDateDisplay(dateTo) : 'End date'}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Location Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location Filter</Text>
            <Text style={styles.sectionHint}>Optional — filter to photos taken near a specific place.</Text>
            <TextInput style={styles.input} placeholder="e.g. Tokyo, Maldives, New York City" placeholderTextColor="#C7C7CC" value={location} onChangeText={setLocation} returnKeyType="next" />
            {location.trim() !== '' && (
              <View style={styles.radiusRow}>
                <Text style={styles.dateLabel}>Radius (km)</Text>
                <TextInput style={[styles.dateInput, { width: 80 }]} placeholder="50" placeholderTextColor="#C7C7CC" value={radius} onChangeText={setRadius} keyboardType="numeric" returnKeyType="done" />
              </View>
            )}
          </View>

          {/* Face Filter */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Face Filter</Text>
            <Text style={styles.sectionHint}>Remove photos that have faces but not yours. Landscapes and no-face photos are always kept.</Text>

            {identitySet ? (
              /* Identity set — show reference photo + toggle */
              <View style={styles.faceRow}>
                {identityUri && (
                  <Image source={{ uri: identityUri }} style={styles.faceThumb} contentFit="cover" />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.faceLabel}>Identity set</Text>
                  <Pressable onPress={() => router.push('/face-setup')} hitSlop={8}>
                    <Text style={styles.faceChangeLink}>Change photo →</Text>
                  </Pressable>
                </View>
                <Pressable
                  style={styles.toggleBtn}
                  onPress={() => {
                    const next = !filterByUserFace;
                    setFilterByUserFace(next);
                    store.filterByUserFace = next;
                    persistPrefs();
                  }}
                >
                  <View style={[styles.toggleTrack, filterByUserFace && styles.toggleTrackOn]}>
                    <View style={[styles.toggleThumb, filterByUserFace && styles.toggleThumbOn]} />
                  </View>
                </Pressable>
              </View>
            ) : (
              /* No identity — prompt to set up */
              <Pressable style={styles.faceSetupBtn} onPress={() => router.push('/face-setup')}>
                <Text style={styles.faceSetupIcon}>👤</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.faceSetupTitle}>Set up your identity</Text>
                  <Text style={styles.faceSetupSub}>Pick a photo of yourself once — Pixory remembers your face</Text>
                </View>
                <Text style={styles.faceSetupArrow}>›</Text>
              </Pressable>
            )}
          </View>

          {/* What's the story? */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What's the story?</Text>
            <Text style={styles.sectionHint}>Optional — give the AI a narrative brief for this carousel.</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Three days eating through Tokyo, or our first road trip"
              placeholderTextColor="#C7C7CC"
              value={storyText}
              onChangeText={setStoryText}
              returnKeyType="done"
              multiline
            />
          </View>

          {/* Storytelling Style */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Storytelling Style</Text>
            <Text style={styles.sectionHint}>How do you naturally post? This shapes everything — scoring, selection, captions.</Text>
            <View style={styles.personaList}>
              {PERSONAS.map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.personaCard, persona === p.id && styles.personaCardActive]}
                  onPress={() => setPersona(persona === p.id ? null : p.id)}
                >
                  <View style={[styles.methodRadio, persona === p.id && styles.methodRadioActive]}>
                    {persona === p.id && <View style={styles.methodRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.personaName, persona === p.id && styles.personaNameActive]}>{p.name}</Text>
                    <Text style={styles.personaDesc}>{p.description}</Text>
                  </View>
                </Pressable>
              ))}
              {/* "No preference" — tapping deselects */}
              <Pressable
                style={[styles.personaCard, persona === null && styles.personaCardNone]}
                onPress={() => setPersona(null)}
              >
                <View style={[styles.methodRadio, persona === null && styles.methodRadioActive]}>
                  {persona === null && <View style={styles.methodRadioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.personaName, persona === null && styles.methodLabelActive]}>No preference</Text>
                  <Text style={styles.personaDesc}>Let the AI decide based on the photos and your story.</Text>
                </View>
              </Pressable>
              {/* Coming soon chip */}
              <View style={styles.discoverChip}>
                <Text style={styles.discoverText}>✦ Discover my style — coming soon</Text>
              </View>
            </View>
          </View>

          {/* Selection Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Selection Method</Text>
            <View style={styles.methodList}>
              {METHODS.map((m) => (
                <Pressable key={m.id} style={[styles.methodCard, method === m.id && styles.methodCardActive]} onPress={() => setMethod(m.id)}>
                  <View style={[styles.methodRadio, method === m.id && styles.methodRadioActive]}>
                    {method === m.id && <View style={styles.methodRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.methodLabel, method === m.id && styles.methodLabelActive]}>{m.label}</Text>
                    <Text style={styles.methodSub}>{m.sublabel}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Backend Server */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Backend Server</Text>
            <TextInput
              style={styles.input}
              placeholder="http://localhost:8000"
              placeholderTextColor="#C7C7CC"
              value={backendUrl}
              onChangeText={setBackendUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
            />
            <Text style={styles.sectionHint}>
              On iPhone, use your Mac's local IP instead of localhost.{'\n'}
              Find it: <Text style={styles.mono}>ipconfig getifaddr en0</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>Start Curation</Text>
        </Pressable>
      </View>

      <DatePickerModal
        visible={showRangePicker}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onConfirm={confirmRange}
        onCancel={() => setShowRangePicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
