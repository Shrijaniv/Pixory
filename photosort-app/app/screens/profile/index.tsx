import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBar, Toggle } from '../../../components/ui';
import { PersonaType, Story } from '../../../lib/store';
import { Colors } from '../../../lib/theme';
import { PERSONAS } from '../new-story/types';
import { useProfileState } from './hooks';
import { styles } from './styles';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const {
    tab, setTab, stories, counts, identitySet,
    filterByUserFace, toggleFaceFilter, openFaceSetup,
    igHandle, persona, personaName, choosePersona,
    methodLabel, cycleMethod,
    faceEngineLabel, cycleFaceEngine,
    backendUrl, updateBackendUrl,
    notifications, setNotifications,
    displayName, handle, avatarUri,
    openInstagram,
  } = useProfileState();

  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);
  const initials = (displayName || 'You').trim().slice(0, 1).toUpperCase();
  const gridStories: Story[] = tab === 'saved' ? stories.filter((s) => s.savedToAlbum) : stories;

  function pickPersona(id: PersonaType | null) {
    choosePersona(id);
    setPersonaPickerOpen(false);
  }

  function openStory(s: Story) {
    if (s.status === 'published') router.push(`/story-detail?id=${s.id}`);
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Pressable onPress={() => setTab('settings')} hitSlop={8}>
            <Text style={styles.gear}>⚙</Text>
          </Pressable>
        </View>

        {/* Identity */}
        <View style={styles.identity}>
          <View style={styles.avatarRing}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarInitials}>
                <Text style={styles.avatarInitialsText}>{initials}</Text>
              </View>
            )}
          </View>
          <View>
            <Text style={styles.name}>{displayName || 'Your name'}</Text>
            <Text style={styles.handle}>@{handle || (igHandle ?? 'your_handle')}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{counts.stories}</Text>
            <Text style={styles.statLabel}>Stories</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{counts.published}</Text>
            <Text style={styles.statLabel}>Published</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{counts.saved}</Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>
        </View>

        {/* Your taste */}
        <Pressable style={styles.tasteCard} onPress={() => router.push('/taste')}>
          <Text style={styles.tasteIcon}>✨</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.tasteTitle}>Your taste</Text>
            <Text style={styles.tasteSub}>See what we’ve learned about your style</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['stories', 'saved', 'settings'] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)}>
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        {tab === 'settings' ? (
          <View>
            <Pressable style={styles.settingRow} onPress={openInstagram}>
              <Text style={styles.settingIcon}>📷</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Instagram account</Text>
                <Text style={styles.settingSub}>
                  {igHandle ? `@${igHandle} connected` : 'Not connected — tap to link'}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            <Pressable style={styles.settingRow} onPress={openFaceSetup}>
              <Text style={styles.settingIcon}>☺</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>My-face filter</Text>
                <Text style={styles.settingSub}>
                  {identitySet ? 'Tap to change your selfie' : 'Tap to add a selfie'}
                </Text>
              </View>
              <Toggle value={filterByUserFace} onChange={toggleFaceFilter} />
            </Pressable>

            <Pressable style={styles.settingRow} onPress={() => setPersonaPickerOpen(true)}>
              <Text style={styles.settingIcon}>✦</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Default posting style</Text>
                <Text style={styles.settingSub}>{personaName}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            <Pressable style={styles.settingRow} onPress={cycleMethod}>
              <Text style={styles.settingIcon}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Curation engine</Text>
                <Text style={styles.settingSub}>{methodLabel}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            <Pressable style={styles.settingRow} onPress={cycleFaceEngine}>
              <Text style={styles.settingIcon}>🧪</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Face engine (experimental)</Text>
                <Text style={styles.settingSub}>{faceEngineLabel}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            <View style={styles.settingRow}>
              <Text style={styles.settingIcon}>🖥</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Backend server</Text>
                <TextInput
                  style={styles.settingSub}
                  value={backendUrl}
                  onChangeText={updateBackendUrl}
                  placeholder="https://…"
                  placeholderTextColor={Colors.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingIcon}>🔔</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>Notifications</Text>
              </View>
              <Toggle value={notifications} onChange={setNotifications} />
            </View>

            <Pressable onPress={() => router.replace('/')}>
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
          </View>
        ) : gridStories.length === 0 ? (
          <Text style={styles.emptyGrid}>Nothing here yet.</Text>
        ) : (
          <View style={styles.grid}>
            {gridStories.map((s) => (
              <Pressable key={s.id} onPress={() => openStory(s)}>
                {s.coverUri ? (
                  <Image source={{ uri: s.coverUri }} style={styles.tile} contentFit="cover" />
                ) : (
                  <View style={styles.tile} />
                )}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <TabBar active="profile" />

      {/* Posting-style picker */}
      <Modal visible={personaPickerOpen} transparent animationType="slide" onRequestClose={() => setPersonaPickerOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPersonaPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Default posting style</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {PERSONAS.map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.personaOption, persona === p.id && styles.personaOptionActive]}
                  onPress={() => pickPersona(p.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personaOptionName}>{p.name}</Text>
                    <Text style={styles.personaOptionDesc}>{p.description}</Text>
                  </View>
                  {persona === p.id ? <Text style={styles.personaCheck}>✓</Text> : null}
                </Pressable>
              ))}
              <Pressable
                style={[styles.personaOption, persona === null && styles.personaOptionActive]}
                onPress={() => pickPersona(null)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.personaOptionName}>No preference</Text>
                  <Text style={styles.personaOptionDesc}>Let the AI decide the best style from your photos and story.</Text>
                </View>
                {persona === null ? <Text style={styles.personaCheck}>✓</Text> : null}
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
