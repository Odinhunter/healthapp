import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../../constants/theme';

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function FormScaffold({ title, children }: Props) {
  const router = useRouter();

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Text style={s.back}>‹</Text>
        </Pressable>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        <View style={s.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EEE9',
  },
  backBtn: { width: 32 },
  back: { fontSize: 26, color: colors.primary, lineHeight: 30 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scroll: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxxxl,
  },
});
