import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFaceSetupState } from './hooks';
import { styles } from './styles';

export default function FaceSetupScreen() {
  const insets = useSafeAreaInsets();
  const {
    status,
    errorMsg,
    currentIdentity,
    pickedUri,
    pickPhoto,
    confirmIdentity,
    clearIdentityHandler,
    goBack,
  } = useFaceSetupState();

  if (status === 'loading') {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#0095F6" />
      </View>
    );
  }

  const showPreview = pickedUri && status !== 'success';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={12}>
          <Text style={styles.headerBack}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Who Are You?</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Current identity */}
        {currentIdentity && status !== 'success' && (
          <View style={styles.currentCard}>
            <Image
              source={{ uri: currentIdentity.refPhotoUri }}
              style={styles.currentThumb}
              contentFit="cover"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.currentTitle}>Identity set ✓</Text>
              <Text style={styles.currentSub}>
                Set {new Date(currentIdentity.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
              <Text style={styles.currentSub}>Tap "Change photo" to update it</Text>
            </View>
            <Pressable onPress={clearIdentityHandler} hitSlop={8}>
              <Text style={styles.clearBtn}>Clear</Text>
            </Pressable>
          </View>
        )}

        {/* Success state */}
        {status === 'success' && (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✓</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>You're all set!</Text>
              <Text style={styles.successSub}>
                Pixory now knows what you look like. Turn on "Only photos with me" on the home screen to filter your curations.
              </Text>
            </View>
          </View>
        )}

        {/* Explainer */}
        <View style={styles.explainerCard}>
          <Text style={styles.explainerTitle}>How it works</Text>
          <Text style={styles.explainerBody}>
            Pick a photo where your face is clearly visible. Pixory extracts a face signature
            and stores it only on this device — it's never uploaded or shared.{'\n\n'}
            During curation, photos that contain faces but not yours are automatically removed.
            Landscapes, food, and no-face photos are always kept.
          </Text>
        </View>

        {/* Photo preview */}
        {showPreview && (
          <View style={styles.previewSection}>
            <Image
              source={{ uri: pickedUri }}
              style={styles.previewImage}
              contentFit="cover"
            />
            <Text style={styles.previewHint}>Make sure your face is clearly visible and well-lit</Text>
          </View>
        )}

        {/* Error */}
        {status === 'error' && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>⚠ {errorMsg}</Text>
          </View>
        )}

        {/* Actions */}
        {status !== 'success' && (
          <>
            <Pressable style={styles.pickBtn} onPress={pickPhoto} disabled={status === 'processing'}>
              <Text style={styles.pickBtnText}>
                {currentIdentity ? '📷  Change photo' : '📷  Pick a photo of yourself'}
              </Text>
            </Pressable>

            {showPreview && (
              <Pressable
                style={[styles.confirmBtn, status === 'processing' && styles.btnDisabled]}
                onPress={status === 'processing' ? undefined : confirmIdentity}
              >
                {status === 'processing' ? (
                  <><ActivityIndicator color="#FFF" /><Text style={styles.confirmBtnText}>  Analysing...</Text></>
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm — That's Me</Text>
                )}
              </Pressable>
            )}
          </>
        )}

        {status === 'success' && (
          <Pressable style={styles.doneBtn} onPress={goBack}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
