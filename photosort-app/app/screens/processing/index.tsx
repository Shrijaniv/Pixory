import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../../components/ui';
import { Gradients } from '../../../lib/theme';
import { useProcessingState } from './hooks';
import { styles } from './styles';

export default function ProcessingScreen() {
  const insets = useSafeAreaInsets();
  const { steps, error, progress, scrollRef, handleCancel, staleIdentity } = useProcessingState();

  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true }),
    ).start();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ringStyle = { transform: [{ rotate }] };

  const latest = steps.length > 0 ? steps[steps.length - 1].message : 'Getting started…';

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={handleCancel} hitSlop={12}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Curating</Text>
        <View style={{ width: 60 }} />
      </View>

      {staleIdentity ? (
        <View style={styles.staleBox}>
          <Text style={styles.staleTitle}>Your saved selfie needs updating</Text>
          <Text style={styles.staleMsg}>
            It was registered with an older face model, so the my-face filter can&apos;t use it.
            This run keeps every photo.
          </Text>
          <PrimaryButton
            label="Add your selfie again"
            variant="secondary"
            onPress={() => router.push('/face-setup')}
          />
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <PrimaryButton label="Go back" variant="secondary" onPress={handleCancel} />
        </View>
      ) : (
        <>
          <View style={styles.loaderSection}>
            <View style={styles.ringWrap}>
              <Animated.View style={[styles.ring, ringStyle]}>
                <LinearGradient
                  colors={Gradients.ring}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ringGradient}
                />
              </Animated.View>
              <View style={styles.ringHole} />
              <View style={styles.ringCenter}>
                <Text style={styles.pct}>{progress}</Text>
                <Text style={styles.pctSign}>%</Text>
              </View>
            </View>
            <Text style={styles.heading}>Reading your story</Text>
            <Text style={styles.subtitle} numberOfLines={2}>{latest}</Text>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.stepsScroll}
            contentContainerStyle={styles.stepsContent}
            showsVerticalScrollIndicator={false}
          >
            {steps.map((step, i) => {
              const isCurrent = i === steps.length - 1 && !step.done;
              return (
                <View key={step.id} style={styles.stepRow}>
                  <View
                    style={[
                      styles.stepDot,
                      step.done && styles.stepDotDone,
                      isCurrent && styles.stepDotCurrent,
                    ]}
                  >
                    {step.done && <Text style={styles.stepCheck}>✓</Text>}
                  </View>
                  <Text
                    style={[
                      styles.stepText,
                      step.done && styles.stepTextDone,
                      isCurrent && styles.stepTextCurrent,
                    ]}
                  >
                    {step.message}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </>
      )}
    </View>
  );
}
