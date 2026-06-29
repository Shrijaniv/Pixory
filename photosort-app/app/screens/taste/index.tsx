import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { ScreenHeader } from '../../../components/ui';
import { TasteTrait } from '../../../lib/learning';
import { useTasteState } from './hooks';
import { styles } from './styles';

const MIN_SAMPLES = 5;

export default function TasteScreen() {
  const { profile } = useTasteState();

  return (
    <View style={styles.root}>
      <ScreenHeader title="Your taste" onBack={() => router.back()} />

      {!profile ? null : !profile.ready ? (
        <View style={styles.empty}>
          <Text style={styles.emptyGlyph}>✨</Text>
          <Text style={styles.emptyTitle}>We’re still learning your style</Text>
          <Text style={styles.emptyBody}>
            Curate {profile.remaining} more carousel{profile.remaining === 1 ? '' : 's'} and your
            taste profile unlocks — built from the photos you keep and the ones you skip.
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(profile.sampleCount / MIN_SAMPLES) * 100}%` }]} />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Narrative */}
          <View style={styles.narrativeCard}>
            <Text style={styles.narrativeLabel}>What we’ve noticed</Text>
            <Text style={styles.narrativeText}>{profile.narrative}</Text>
          </View>

          {/* Trait bars */}
          <Text style={styles.label}>Your leanings</Text>
          {profile.traits.map((t) => <TraitBar key={t.key} trait={t} />)}

          {/* Dominant group */}
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>You mostly post</Text>
            <Text style={styles.statValue}>{profile.dominantGroup}</Text>
          </View>

          <Text style={styles.footnote}>
            Based on {profile.promotedCount} pick{profile.promotedCount === 1 ? '' : 's'} across your sessions.
            The more you curate, the sharper this gets.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

function TraitBar({ trait }: { trait: TasteTrait }) {
  const pct = Math.round(Math.abs(trait.lean) * 100);
  const positive = trait.lean >= 0;
  return (
    <View style={styles.trait}>
      <View style={styles.traitHead}>
        <Text style={styles.traitLabel}>{trait.label}</Text>
        <Text style={styles.traitPct}>{positive ? '+' : '−'}{pct}%</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={styles.barCenter} />
        {positive
          ? <View style={[styles.barFillPos, { width: `${pct / 2}%` }]} />
          : <View style={[styles.barFillNeg, { width: `${pct / 2}%` }]} />}
      </View>
    </View>
  );
}
