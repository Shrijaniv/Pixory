import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { PrimaryButton, ScreenHeader } from '../../../components/ui';
import { Gradients } from '../../../lib/theme';
import { useFaceSetupState } from './hooks';
import { styles } from './styles';

export default function FaceSetupScreen() {
  const {
    status,
    errorMsg,
    currentIdentity,
    pickedUri,
    pickPhoto,
    takePhoto,
    confirmIdentity,
    clearIdentityHandler,
    goBack,
  } = useFaceSetupState();

  const previewUri = pickedUri ?? currentIdentity?.refPhotoUri ?? null;
  const processing = status === 'processing';

  return (
    <View style={styles.root}>
      <ScreenHeader title="Add a selfie first" onBack={goBack} />

      <View style={styles.body}>
        {/* Gradient ring around the selfie / glyph */}
        <LinearGradient
          colors={Gradients.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ring}
        >
          <View style={styles.inner}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.selfie} contentFit="cover" />
            ) : (
              <Text style={styles.glyph}>☺</Text>
            )}
          </View>
        </LinearGradient>

        <Text style={styles.title}>
          {status === 'success'
            ? 'You’re all set'
            : currentIdentity && !pickedUri
            ? 'Update your selfie'
            : 'Add a selfie first'}
        </Text>
        <Text style={styles.copy}>
          {currentIdentity && !pickedUri
            ? 'This is your saved face. Take or pick a new selfie to replace it.'
            : 'The my-face filter learns what you look like so it can keep only the photos you’re in. Your face stays on this device — landscapes and no-face photos are always kept.'}
        </Text>

        <View style={styles.privacy}>
          <Text style={styles.privacyText}>🔒  Stays on this device. Never uploaded.</Text>
        </View>

        {status === 'error' ? <Text style={styles.error}>⚠ {errorMsg}</Text> : null}
        {currentIdentity && status !== 'success' ? (
          <Pressable onPress={clearIdentityHandler} hitSlop={8}>
            <Text style={styles.clear}>Clear saved face</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.footer}>
        {status === 'success' ? (
          <PrimaryButton label="Done" variant="gradient" onPress={goBack} />
        ) : pickedUri ? (
          <>
            <PrimaryButton
              label={processing ? 'Analysing…' : 'Confirm — that’s me'}
              variant="gradient"
              loading={processing}
              onPress={confirmIdentity}
            />
            {!processing && (
              <Pressable onPress={takePhoto} hitSlop={8}>
                <Text style={styles.notNow}>Retake / pick another</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <PrimaryButton
              label={currentIdentity ? '📷  Take a new selfie' : '📷  Take a selfie'}
              variant="gradient"
              onPress={takePhoto}
            />
            <PrimaryButton
              label={currentIdentity ? 'Choose from library' : 'Choose from library'}
              variant="secondary"
              onPress={pickPhoto}
            />
          </>
        )}
        {status !== 'success' && !pickedUri && (
          <Pressable onPress={goBack} hitSlop={8} disabled={processing}>
            <Text style={styles.notNow}>Not now</Text>
          </Pressable>
        )}
        {processing && <ActivityIndicator style={{ marginTop: 8 }} color="#FFF" />}
      </View>
    </View>
  );
}
