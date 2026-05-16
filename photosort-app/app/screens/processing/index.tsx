import React from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProcessingState } from './hooks';
import { styles } from './styles';

export default function ProcessingScreen() {
  const insets = useSafeAreaInsets();
  const { steps, error, progress, scrollRef, pulseAnim, handleCancel, methodLabel } = useProcessingState();

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={handleCancel} hitSlop={12}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{methodLabel}</Text>
        <View style={{ width: 60 }} />
      </View>

      {!error && (
        <View style={styles.loaderSection}>
          <View style={styles.loaderRing}>
            <ActivityIndicator size="large" color="#0095F6" />
            <Text style={styles.progressPct}>{progress}%</Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progress}%` as any }]} />
          </View>
          <Animated.Text style={[styles.loaderLabel, { opacity: pulseAnim }]}>
            Analyzing your photos...
          </Animated.Text>
        </View>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={handleCancel}>
            <Text style={styles.retryText}>Go Back</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView ref={scrollRef} style={styles.stepsScroll} contentContainerStyle={styles.stepsContent} showsVerticalScrollIndicator={false}>
        {steps.map((step) => (
          <View key={step.id} style={styles.stepRow}>
            <View style={[styles.stepDot, step.done && styles.stepDotDone]}>
              {step.done && <Text style={styles.stepCheck}>✓</Text>}
            </View>
            <Text style={[styles.stepText, step.done && styles.stepTextDone]}>{step.message}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
