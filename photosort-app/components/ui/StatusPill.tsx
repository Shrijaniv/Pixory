/**
 * StatusPill — story status badge. Published = green on wash; Draft = amber on wash.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Typography } from '../../lib/theme';

interface Props {
  status: 'draft' | 'published';
}

export default function StatusPill({ status }: Props) {
  const published = status === 'published';
  return (
    <View style={[styles.pill, { backgroundColor: published ? Colors.successWash : Colors.draftWash }]}>
      <Text style={[styles.label, { color: published ? Colors.success : Colors.draft }]}>
        {published ? 'PUBLISHED' : 'DRAFT'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  label: {
    ...Typography.labelMono,
    fontSize: 9,
    letterSpacing: 1,
  },
});
