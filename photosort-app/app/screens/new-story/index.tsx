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
import { Chip, PrimaryButton, ScreenHeader, Toggle } from '../../../components/ui';
import { Colors } from '../../../lib/theme';
import { useNewStoryState } from './hooks';
import { styles } from './styles';
import { PERSONAS, formatRange } from './types';

export default function NewStoryScreen() {
  const insets = useSafeAreaInsets();
  const {
    dateFrom,
    dateTo,
    location,
    setLocation,
    storyText,
    setStoryText,
    persona,
    setPersona,
    useAi,
    setUseAi,
    identitySet,
    filterByUserFace,
    openFaceSetup,
    setFaceFilter,
    showRangePicker,
    setShowRangePicker,
    confirmRange,
    handleNext,
  } = useNewStoryState();

  const activePersona = PERSONAS.find((p) => p.id === persona);

  return (
    <View style={styles.root}>
      <ScreenHeader title="New Story" onBack={() => router.back()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* What's the story? */}
          <View>
            <Text style={styles.label}>What's the story?</Text>
            <TextInput
              style={styles.textarea}
              placeholder="e.g. Three days eating through Tokyo"
              placeholderTextColor={Colors.textFaint}
              value={storyText}
              onChangeText={setStoryText}
              multiline
            />
          </View>

          {/* Dates + Place */}
          <View style={styles.pillRow}>
            <Pressable style={styles.pill} onPress={() => setShowRangePicker(true)}>
              <Text style={styles.pillLabel}>📅 Dates</Text>
              <Text style={[styles.pillValue, !dateFrom && !dateTo && styles.pillValueMuted]}>
                {formatRange(dateFrom, dateTo)}
              </Text>
            </Pressable>
            <View style={styles.pill}>
              <Text style={styles.pillLabel}>📍 Place</Text>
              <TextInput
                style={styles.pillValue}
                placeholder="Optional"
                placeholderTextColor={Colors.textFaint}
                value={location}
                onChangeText={setLocation}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Posting style */}
          <View>
            <Text style={styles.label}>Your posting style</Text>
            <View style={styles.chipWrap}>
              {PERSONAS.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name.replace('The ', '')}
                  active={persona === p.id}
                  onPress={() => setPersona(p.id)}
                />
              ))}
              <Chip
                label="No preference"
                active={persona === null}
                onPress={() => setPersona(null)}
              />
            </View>
            <View style={styles.descPanel}>
              <Text style={styles.descIcon}>✦</Text>
              {activePersona ? (
                <Text style={styles.descText}>
                  <Text style={styles.descName}>{activePersona.name} </Text>
                  {activePersona.description}
                </Text>
              ) : (
                <Text style={styles.descText}>
                  <Text style={styles.descName}>No preference. </Text>
                  The AI decides the best style from your photos and story.
                </Text>
              )}
            </View>
          </View>

          {/* Curation engine */}
          <View>
            <Text style={styles.label}>Curation engine</Text>
            <View style={styles.segment}>
              <Pressable
                style={[styles.segmentItem, !useAi && styles.segmentItemActive]}
                onPress={() => setUseAi(false)}
              >
                <Text style={[styles.segmentText, !useAi && styles.segmentTextActive]}>Auto Select</Text>
              </Pressable>
              <Pressable
                style={[styles.segmentItem, useAi && styles.segmentItemActive]}
                onPress={() => setUseAi(true)}
              >
                <Text style={[styles.segmentText, useAi && styles.segmentTextActive]}>AI · GPT-4o</Text>
              </Pressable>
            </View>
          </View>

          {/* My-face filter */}
          <Pressable style={styles.faceRow} onPress={openFaceSetup}>
            <Text style={styles.faceIcon}>☺</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.faceTitle}>My-face filter</Text>
              {identitySet ? (
                <Text style={styles.faceSub}>
                  {filterByUserFace ? 'On · tap to change your selfie' : 'Off · tap to change your selfie'}
                </Text>
              ) : (
                <Text style={[styles.faceSub, styles.faceSubAccent]}>Add a selfie to turn this on →</Text>
              )}
            </View>
            <Toggle
              value={identitySet && filterByUserFace}
              onChange={setFaceFilter}
              disabled={!identitySet}
            />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <PrimaryButton label="Find my photos →" variant="gradient" onPress={handleNext} />
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
