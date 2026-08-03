/**
 * Upload sheet — uses transparentModal presentation so iOS never applies
 * UISheetPresentationController scroll-inset adjustments to our content.
 * The sheet is a plain View panel positioned at the bottom of a transparent
 * overlay; we drive the slide-up animation ourselves via Reanimated.
 */
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useState } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { format } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../src/constants/theme';
import { uploadReportFile } from '../src/lib/storage';
import { createReport, getPrimaryFamilyMember } from '../src/lib/reports';
import { supabase } from '../src/lib/supabase';

// Sheet takes 88 % of the screen — calculated once at module level.
const SHEET_HEIGHT = Dimensions.get('window').height * 0.88;
const SPRING = { damping: 20, stiffness: 220 };

type SourceType = 'camera' | 'library' | 'pdf';
interface SelectedFile { uri: string; type: 'image' | 'pdf'; name?: string }

// ─── Icons ───────────────────────────────────────────────────

function CameraIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Rect x="2" y="6" width="16" height="12" rx="2" stroke={colors.primary} strokeWidth="1.5" />
      <Circle cx="10" cy="12" r="3" stroke={colors.primary} strokeWidth="1.5" />
      <Path d="M7.5 6L8.5 4H11.5L12.5 6" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PhotoIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Rect x="5" y="3" width="11" height="9" rx="1.5" stroke={colors.primary} strokeWidth="1.5" />
      <Rect x="4" y="7" width="11" height="9" rx="1.5" stroke={colors.primary} strokeWidth="1.5" fill={colors.primaryLight} />
    </Svg>
  );
}

function DocumentIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M5 2H13L17 6V18H5V2Z" stroke={colors.primary} strokeWidth="1.5" strokeLinejoin="round" />
      <Path d="M13 2V6H17" stroke={colors.primary} strokeWidth="1.5" strokeLinejoin="round" />
      <Path d="M8 10H14" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M8 13H14" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

function CalendarIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Rect x="1" y="3" width="14" height="12" rx="2" stroke={colors.textTertiary} strokeWidth="1.5" />
      <Path d="M1 7H15" stroke={colors.textTertiary} strokeWidth="1.5" />
      <Path d="M5 1V4" stroke={colors.textTertiary} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M11 1V4" stroke={colors.textTertiary} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

// ─── Source card ─────────────────────────────────────────────

function SourceCard({ selected, onPress, icon, title, subtitle }: {
  selected: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={anim}>
      <Pressable
        style={[s.card, selected && s.cardSelected]}
        onPressIn={() => { scale.value = withSpring(0.97, SPRING); }}
        onPressOut={() => { scale.value = withSpring(1, SPRING); }}
        onPress={onPress}
      >
        <View style={s.iconCircle}>{icon}</View>
        <View style={s.cardText}>
          <Text style={s.cardTitle}>{title}</Text>
          <Text style={s.cardSub}>{subtitle}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Fade-in section wrapper ──────────────────────────────────

function FadeIn({ children }: { children: React.ReactNode }) {
  const opacity = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));
  useEffect(() => { opacity.value = withTiming(1, { duration: 250 }); }, []);
  return <Animated.View style={anim}>{children}</Animated.View>;
}

// ─── Screen ──────────────────────────────────────────────────

export default function UploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Animate the overlay dim and the panel sliding up independently.
  const overlayOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(SHEET_HEIGHT);

  useEffect(() => {
    overlayOpacity.value = withTiming(1, { duration: 200 });
    sheetTranslateY.value = withTiming(0, { duration: 280 });
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const [file, setFile] = useState<SelectedFile | null>(null);
  const [source, setSource] = useState<SourceType | null>(null);
  const [labName, setLabName] = useState('');
  const [reportDate, setReportDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [labFocused, setLabFocused] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [primaryMember, setPrimaryMember] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { member } = await getPrimaryFamilyMember(session.user.id);
        if (member) setPrimaryMember(member);
      }
    })();
  }, []);

  async function pickCamera() {
    if (!Device.isDevice) {
      Alert.alert('Simulator detected', 'Camera is not available in the iOS Simulator. Use "Photo library" instead.');
      return;
    }
    setSource('camera');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required. Please enable it in Settings.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!r.canceled && r.assets.length > 0) setFile({ uri: r.assets[0].uri, type: 'image' });
  }

  async function pickLibrary() {
    setSource('library');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required. Please enable it in Settings.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!r.canceled && r.assets.length > 0) setFile({ uri: r.assets[0].uri, type: 'image' });
  }

  async function pickPdf() {
    setSource('pdf');
    const r = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (!r.canceled && r.assets.length > 0)
      setFile({ uri: r.assets[0].uri, type: 'pdf', name: r.assets[0].name });
  }

  async function analyse() {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('Uploading...');

    try {
      // 1. Get session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Session expired', 'Please log in again.');
        setIsUploading(false);
        return;
      }

      // 2. Generate report ID
      const reportId = Crypto.randomUUID();

      // 3. Upload file to storage
      const { filePath, error: uploadError } = await uploadReportFile({
        userId: session.user.id,
        familyMemberId: primaryMember.id,
        reportId,
        fileUri: file.uri,
        fileType: file.type,
      });
      if (uploadError || !filePath) {
        Alert.alert('Upload failed', uploadError ?? 'Could not upload file.');
        setIsUploading(false);
        return;
      }

      // 4. Create report row
      setUploadStatus('Saving report...');
      const reportDateStr = format(reportDate, 'yyyy-MM-dd');
      const { error: createError } = await createReport({
        ownerId: session.user.id,
        familyMemberId: primaryMember.id,
        filePath,
        fileType: file.type,
        reportDate: reportDateStr,
        labName: labName || undefined,
        reportId,
      });
      if (createError) {
        Alert.alert('Error', createError);
        setIsUploading(false);
        return;
      }

      // 5. Fire edge function — don't await, let it run in background.
      //    The report detail screen will listen for status via realtime.
      supabase.functions.invoke('extract-report', {
        body: { report_id: reportId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      // 6. Navigate immediately to the report screen
      setIsUploading(false);
      router.replace(`/(app)/report/${reportId}`);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong.');
      setIsUploading(false);
    }
  }

  const bottomPad = Math.max(insets.bottom, 16) + 16;

  return (
    // Full-screen transparent overlay — sits above the home screen.
    // Because this is NOT a UISheetPresentationController, iOS never
    // injects content insets into our ScrollView.
    <Animated.View style={[s.overlay, overlayStyle]} pointerEvents="box-none">

      {/* Dimmed backdrop — tap anywhere above the sheet to dismiss */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />

      {/* ── Sheet panel ── */}
      <Animated.View style={[s.sheet, sheetStyle]}>

        {/* Handle */}
        <View style={s.handleRow}>
          <View style={s.handle} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => !isUploading && router.back()} style={s.closeBtn} hitSlop={12} disabled={isUploading}>
            <Text style={[s.closeText, isUploading && { opacity: 0.3 }]}>✕</Text>
          </Pressable>
          <Text style={s.title}>Add report</Text>
          <View style={s.headerSpacer} />
        </View>

        {/* Scrollable body */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.sectionLabel}>How would you like to add it?</Text>

          <View style={[s.stack, isUploading && { opacity: 0.5 }]} pointerEvents={isUploading ? 'none' : 'auto'}>
            <SourceCard selected={source === 'camera'}  onPress={pickCamera}  icon={<CameraIcon />}   title="Take a photo"    subtitle="Photograph your report"   />
            <SourceCard selected={source === 'library'} onPress={pickLibrary} icon={<PhotoIcon />}    title="Photo library"   subtitle="Choose an existing photo" />
            <SourceCard selected={source === 'pdf'}     onPress={pickPdf}     icon={<DocumentIcon />} title="Upload PDF"      subtitle="From your files app"      />
          </View>

          {/* File preview */}
          {file && (
            <FadeIn>
              <View style={s.section}>
                {file.type === 'image' ? (
                  <>
                    <View style={s.imgWrap}>
                      <Image source={{ uri: file.uri }} style={s.img} resizeMode="cover" />
                    </View>
                    <Pressable onPress={() => setFile(null)} style={s.removeRow}>
                      <Text style={s.removeText}>Remove</Text>
                    </Pressable>
                  </>
                ) : (
                  <View style={s.pdfCard}>
                    <View style={s.pdfIcon}><DocumentIcon /></View>
                    <View style={s.pdfInfo}>
                      <Text style={s.pdfName} numberOfLines={1}>{file.name ?? 'document.pdf'}</Text>
                      <Text style={s.pdfSub}>PDF document</Text>
                    </View>
                    <Pressable onPress={() => setFile(null)}>
                      <Text style={s.removeText}>Remove</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </FadeIn>
          )}

          {/* Report details form */}
          {file && (
            <FadeIn>
              <View style={s.section}>
                <Text style={s.sectionLabel}>Report details</Text>
                <TextInput
                  style={[s.input, labFocused && s.inputFocused]}
                  placeholder="Lab name (e.g. Thyrocare, SRL, Apollo)"
                  placeholderTextColor={colors.textTertiary}
                  value={labName}
                  onChangeText={setLabName}
                  onFocus={() => setLabFocused(true)}
                  onBlur={() => setLabFocused(false)}
                  returnKeyType="done"
                />
                <View style={{ height: 10 }} />
                <Pressable style={s.dateRow} onPress={() => setShowPicker(v => !v)}>
                  <Text style={s.dateText}>{format(reportDate, 'd MMMM yyyy')}</Text>
                  <CalendarIcon />
                </Pressable>
                {showPicker && (
                  <DateTimePicker
                    value={reportDate}
                    mode="date"
                    display="inline"
                    maximumDate={new Date()}
                    onChange={(_, d) => { if (d) setReportDate(d); }}
                    style={{ marginTop: 8 }}
                  />
                )}
              </View>
            </FadeIn>
          )}
        </ScrollView>

        {/* Bottom CTA */}
        <View style={[s.bottom, { paddingBottom: bottomPad }]}>
          <Pressable
            style={[s.btn, file && s.btnActive]}
            onPress={file && !isUploading ? analyse : undefined}
            disabled={isUploading}
          >
            {isUploading ? (
              <View style={s.btnLoading}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={[s.btnTextActive, { marginLeft: 10 }]}>{uploadStatus}</Text>
              </View>
            ) : (
              <Text style={[s.btnText, file && s.btnTextActive]}>Analyse report</Text>
            )}
          </Pressable>
        </View>

      </Animated.View>
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  // Transparent full-screen overlay
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },

  // The white sheet panel
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },

  // Handle
  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },

  // Header row
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  closeBtn: { width: 32 },
  closeText: { fontSize: 18, color: colors.textSecondary },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSpacer: { width: 32 },

  // Scroll body
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 24,
  },

  // Section label
  sectionLabel: {
    fontSize: typography.sm,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },

  // Source cards
  stack: { gap: 10 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 14,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: '#F7FDFB',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: typography.base, fontWeight: '500', color: colors.textPrimary },
  cardSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },

  // Section wrapper
  section: { marginTop: spacing.lg },

  // Image preview
  imgWrap: { borderRadius: 12, overflow: 'hidden' },
  img: { width: '100%', height: 180 },
  removeRow: { alignItems: 'flex-end', marginTop: 8 },
  removeText: { fontSize: typography.sm, color: colors.danger },

  // PDF card
  pdfCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pdfIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfInfo: { flex: 1 },
  pdfName: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  pdfSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },

  // Form fields
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: typography.base,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  inputFocused: { borderWidth: 2, borderColor: colors.primary },
  dateRow: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
  },
  dateText: { fontSize: typography.base, color: colors.textPrimary },

  // Bottom bar
  bottom: {
    borderTopWidth: 1,
    borderTopColor: '#F0EEE9',
    paddingTop: 16,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  btn: {
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: { backgroundColor: colors.primary },
  btnText: { fontSize: typography.base, fontWeight: '600', color: colors.textTertiary },
  btnTextActive: { color: '#fff' },
  btnLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
