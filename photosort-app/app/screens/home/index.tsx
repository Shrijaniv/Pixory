import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DatePickerModal from '../../../components/DatePickerModal';
import { persistPrefs, store } from '../../../lib/store';
import { useHomeState } from './hooks';
import { styles } from './styles';
import { METHODS, PERSONAS, formatDateDisplay } from './types';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const {
    dateFrom,
    dateTo,
    location,
    setLocation,
    radius,
    setRadius,
    storyText,
    setStoryText,
    persona,
    setPersona,
    method,
    setMethod,
    backendUrl,
    setBackendUrl,
    identitySet,
    identityUri,
    filterByUserFace,
    setFilterByUserFace,
    showRangePicker,
    setShowRangePicker,
    confirmRange,
    handleNext,
  } = useHomeState();

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
