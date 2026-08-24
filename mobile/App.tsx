import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const COLS = 8;
const ROWS = 11;
const GAP = 4;
const COLORS = ['coral', 'lemon', 'aqua', 'violet'] as const;
const COLOR_HEX = { coral: '#FF6B55', lemon: '#F6CF46', aqua: '#45D7C5', violet: '#AA83EE' } as const;
const BEST_SCORE_KEY = '@yukari/best-score';
type Color = (typeof COLORS)[number];
type Cell = Color | null;

const STARTING_ROWS: Cell[][] = [
  [null, 'coral', null, null, 'aqua', null, null, 'violet'],
  ['lemon', null, null, 'violet', null, null, 'coral', null],
  [null, 'aqua', null, null, 'lemon', null, null, null],
];

function newBoard(): Cell[][] {
  return Array.from({ length: ROWS - STARTING_ROWS.length }, () => Array<Cell>(COLS).fill(null))
    .concat(STARTING_ROWS.map((row) => [...row]));
}

function createIncoming(): Cell[] {
  const row = Array<Cell>(COLS).fill(null);
  const available = Array.from({ length: COLS }, (_, index) => index);
  const count = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i += 1) {
    const column = available.splice(Math.floor(Math.random() * available.length), 1)[0];
    row[column] = COLORS[Math.floor(Math.random() * COLORS.length)];
  }
  return row;
}

function shift(row: Cell[], direction: -1 | 1): Cell[] {
  const next = Array<Cell>(COLS).fill(null);
  row.forEach((cell, index) => {
    if (cell) next[(index + direction + COLS) % COLS] = cell;
  });
  return next;
}

function Block({ cell, size, preview = false }: { cell: Cell; size: number; preview?: boolean }) {
  return <View style={[styles.cell, { width: size, height: size }, preview && styles.previewCell, cell && { backgroundColor: COLOR_HEX[cell], borderColor: '#FFFFFF32', shadowOpacity: 0.22 }]}>{cell ? <View style={styles.shine} /> : null}</View>;
}

function Game() {
  const { width, height } = useWindowDimensions();
  const boardWidth = Math.min(width - 28, 410, Math.max(252, (height - 330) * (COLS / ROWS)));
  const cellSize = (boardWidth - 18 - GAP * (COLS - 1)) / COLS;
  const previewCellSize = (boardWidth - 14 - GAP * (COLS - 1)) / COLS;
  const [board, setBoard] = useState<Cell[][]>(() => newBoard());
  const [incoming, setIncoming] = useState<Cell[]>([null, 'aqua', 'coral', null, 'lemon', null, 'violet', null]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [turn, setTurn] = useState(1);
  const [combo, setCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [adLoading, setAdLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(BEST_SCORE_KEY).then((value) => setBest(Number(value ?? 0))).catch(() => undefined);
  }, []);

  const filled = useMemo(() => board.flat().filter(Boolean).length, [board]);
  const danger = board.slice(0, 3).some((row) => row.some(Boolean));
  const saveBest = useCallback((value: number) => {
    setBest((current) => {
      const next = Math.max(current, value);
      if (next !== current) AsyncStorage.setItem(BEST_SCORE_KEY, String(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const raise = () => {
    if (gameOver) return;
    const stacked = board.map((row) => [...row]);
    let overflow = false;
    incoming.forEach((cell, column) => {
      if (!cell) return;
      let target = ROWS - 1;
      while (target >= 0 && stacked[target][column]) target -= 1;
      if (target < 0) overflow = true;
      else stacked[target][column] = cell;
    });
    const fullRows = stacked.reduce<number[]>((result, row, index) => row.every(Boolean) ? [...result, index] : result, []);
    const remaining = stacked.filter((_, index) => !fullRows.includes(index));
    const nextBoard = Array.from({ length: fullRows.length }, () => Array<Cell>(COLS).fill(null)).concat(remaining);
    const nextCombo = fullRows.length ? combo + 1 : 0;
    const nextScore = score + (fullRows.length ? fullRows.length * 800 * nextCombo : 25);
    setBoard(nextBoard); setIncoming(createIncoming()); setScore(nextScore); setCombo(nextCombo); setTurn((value) => value + 1); saveBest(nextScore);
    if (overflow) setGameOver(true);
  };

  const reset = () => {
    setBoard(newBoard()); setIncoming(createIncoming()); setScore(0); setTurn(1); setCombo(0); setGameOver(false);
  };

  const rewardedContinue = () => {
    setAdLoading(true);
    // Production AdMob/mediation SDK's rewarded callback connects here.
    setTimeout(() => {
      setBoard((current) => {
        const highest = current.findIndex((row) => row.some(Boolean));
        return current.map((row, index) => index === highest ? Array<Cell>(COLS).fill(null) : row);
      });
      setAdLoading(false); setGameOver(false); setCombo(0);
    }, 900);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <StatusBar style="light" />
      <View style={[styles.content, { width: boardWidth }]}>
        <View style={styles.header}>
          <View style={styles.brandRow}><View style={styles.brandMark}><View style={[styles.bar, styles.barOne]} /><View style={[styles.bar, styles.barTwo]} /><View style={[styles.bar, styles.barThree]} /></View><View><Text style={styles.brand}>YUKARI</Text><Text style={styles.tagline}>BİR SIRA DAHA.</Text></View></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Nasıl oynanır" onPress={() => setHelpVisible(true)} style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}><Text style={styles.roundButtonText}>?</Text></Pressable>
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.label}>SKOR</Text><Text style={styles.statValue}>{score.toLocaleString('tr-TR')}</Text></View>
          <View style={[styles.stat, styles.turnStat]}><Text style={styles.label}>HAMLE</Text><Text style={styles.statValue}>{String(turn).padStart(2, '0')}</Text></View>
          <View style={[styles.stat, styles.rightStat]}><Text style={styles.label}>REKOR</Text><Text style={styles.statValue}>{best.toLocaleString('tr-TR')}</Text></View>
        </View>
        <View style={[styles.boardFrame, danger && styles.dangerBoard]} accessibilityLabel={`${filled} blok bulunan oyun tahtası`}>
          <View style={styles.dangerLine}><Text style={styles.dangerText}>TEHLİKE SINIRI</Text></View>
          <View style={styles.grid}>{board.flatMap((row, rowIndex) => row.map((cell, columnIndex) => <Block key={`${rowIndex}-${columnIndex}`} cell={cell} size={cellSize} />))}</View>
          {combo > 0 ? <View style={styles.combo}><Text style={styles.comboText}>×{combo} KOMBO</Text></View> : null}
        </View>
        <View style={styles.sectionTitle}><Text style={styles.label}>SIRADAKİ</Text><View style={styles.rule} /></View>
        <View style={styles.preview}>{incoming.map((cell, index) => <Block key={index} cell={cell} size={previewCellSize} preview />)}</View>
        <View style={styles.controls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Sırayı sola kaydır" onPress={() => setIncoming((row) => shift(row, -1))} style={({ pressed }) => [styles.controlButton, pressed && styles.pressed]}><Text style={styles.arrow}>←</Text><Text style={styles.controlLabel}>SOLA</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Blokları yükselt" onPress={raise} style={({ pressed }) => [styles.controlButton, styles.raiseButton, pressed && styles.pressed]}><Text style={[styles.arrow, styles.raiseText]}>↑</Text><Text style={[styles.controlLabel, styles.raiseText]}>YÜKSELT</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Sırayı sağa kaydır" onPress={() => setIncoming((row) => shift(row, 1))} style={({ pressed }) => [styles.controlButton, pressed && styles.pressed]}><Text style={styles.arrow}>→</Text><Text style={styles.controlLabel}>SAĞA</Text></Pressable>
        </View>
        <Text style={styles.hint}>SIRAYI KAYDIR · BOŞLUKLARI HİZALA · YUKARI İT</Text>
      </View>

      <Modal transparent visible={helpVisible} animationType="fade" onRequestClose={() => setHelpVisible(false)}><View style={styles.modalBackdrop}><View style={styles.modalCard}>
        <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={() => setHelpVisible(false)} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
        <Text style={styles.modalEyebrow}>NASIL OYNANIR?</Text><Text style={styles.modalTitle}>Boşluğu gör.{`\n`}Sırayı kaydır.</Text>
        <View style={styles.steps}><Text style={styles.stepNumber}>01</Text><Text style={styles.stepText}>Alttaki renkli sırayı sağa veya sola kaydır.</Text><Text style={styles.stepNumber}>02</Text><Text style={styles.stepText}>Yükselt ile blokları sütunlara gönder.</Text><Text style={styles.stepNumber}>03</Text><Text style={styles.stepText}>Eksiksiz yatay sıra oluştur ve patlat.</Text></View>
        <Pressable accessibilityRole="button" onPress={() => setHelpVisible(false)} style={styles.modalPrimary}><Text style={styles.modalPrimaryText}>ANLADIM, OYNA</Text></Pressable>
      </View></View></Modal>

      <Modal transparent visible={gameOver} animationType="fade" onRequestClose={() => undefined}><View style={styles.modalBackdrop}><View style={styles.modalCard}>
        <Text style={styles.modalEyebrow}>TEPEYE ULAŞTIN</Text><Text style={styles.modalTitle}>İyi gittin!</Text>
        <View style={styles.finalScore}><Text style={styles.finalScoreLabel}>SKORUN</Text><Text style={styles.finalScoreValue}>{score.toLocaleString('tr-TR')}</Text></View>
        <Pressable accessibilityRole="button" disabled={adLoading} onPress={rewardedContinue} style={[styles.rewardButton, adLoading && styles.disabled]}><View style={styles.playCircle}><Text style={styles.play}>▶</Text></View><View><Text style={styles.rewardTitle}>{adLoading ? 'REKLAM YÜKLENİYOR…' : '1 SIRA SİLEREK DEVAM ET'}</Text><Text style={styles.rewardSub}>Ödüllü reklamı izle</Text></View></Pressable>
        <Pressable accessibilityRole="button" onPress={reset} style={styles.restartButton}><Text style={styles.restartText}>YENİDEN BAŞLA</Text></Pressable><Text style={styles.adNote}>TAM EKRAN REKLAM ENTEGRASYON NOKTASI</Text>
      </View></View></Modal>
    </SafeAreaView>
  );
}

export default function App() { return <SafeAreaProvider><Game /></SafeAreaProvider>; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#07111F', alignItems: 'center' }, content: { flex: 1, justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }, brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 34, height: 34, borderWidth: 1, borderColor: '#304154', padding: 7, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 }, bar: { width: 4 }, barOne: { height: 8, backgroundColor: '#FF6B55' }, barTwo: { height: 14, backgroundColor: '#F6CF46' }, barThree: { height: 20, backgroundColor: '#45D7C5' },
  brand: { color: '#F3F0E7', fontSize: 23, lineHeight: 24, fontWeight: '900', letterSpacing: 3.5 }, tagline: { color: '#8292A4', fontSize: 8, marginTop: 3, fontWeight: '800', letterSpacing: 1.4 },
  roundButton: { width: 35, height: 35, borderRadius: 18, borderWidth: 1, borderColor: '#2D4052', backgroundColor: '#0B1928', alignItems: 'center', justifyContent: 'center' }, roundButtonText: { color: '#A8B4C0', fontSize: 16, fontWeight: '900' }, pressed: { opacity: 0.68, transform: [{ translateY: 2 }] },
  stats: { flexDirection: 'row', borderWidth: 1, borderColor: '#243547', borderBottomWidth: 0, backgroundColor: '#091725' }, stat: { flex: 1, paddingHorizontal: 13, paddingVertical: 8 }, turnStat: { alignItems: 'center', borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#243547' }, rightStat: { alignItems: 'flex-end' }, label: { color: '#75889B', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 }, statValue: { color: '#F3F0E7', fontSize: 16, fontWeight: '900', marginTop: 2, letterSpacing: 0.7 },
  boardFrame: { position: 'relative', padding: 8, borderWidth: 1, borderColor: '#2A3D4E', backgroundColor: '#0A1724', shadowColor: '#000', shadowOffset: { width: 0, height: 18 }, shadowRadius: 25, shadowOpacity: 0.45, elevation: 12 }, dangerBoard: { borderTopColor: '#FF6B5588' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: { backgroundColor: '#101F2D', borderWidth: 1, borderColor: '#192B3B', borderRadius: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowRadius: 4, shadowOpacity: 0, elevation: 2 }, previewCell: { backgroundColor: '#0D1B28' }, shine: { position: 'absolute', left: 4, top: 4, width: 5, height: 5, backgroundColor: '#FFFFFF70' },
  dangerLine: { position: 'absolute', zIndex: 3, left: -5, right: -5, top: '27.4%', borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#FF6B5577', alignItems: 'flex-end' }, dangerText: { color: '#FF8978', backgroundColor: '#0A1724', fontSize: 6, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 4, transform: [{ translateY: -10 }] }, combo: { position: 'absolute', zIndex: 5, alignSelf: 'center', top: '48%', backgroundColor: '#F6CF46', paddingHorizontal: 13, paddingVertical: 8, transform: [{ rotate: '-4deg' }] }, comboText: { color: '#07111F', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 6 }, rule: { height: 1, backgroundColor: '#223548', flex: 1 }, preview: { flexDirection: 'row', gap: GAP, padding: 6, borderWidth: 1, borderColor: '#25384A', backgroundColor: '#07131F' },
  controls: { flexDirection: 'row', gap: 8, marginTop: 9 }, controlButton: { height: 54, flex: 1, borderRadius: 4, borderWidth: 1, borderColor: '#31465A', backgroundColor: '#0E1D2C', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, raiseButton: { flex: 1.28, backgroundColor: '#F3F0E7', borderColor: '#F3F0E7' }, arrow: { color: '#DCE4E8', fontSize: 24, lineHeight: 26, fontWeight: '500' }, controlLabel: { color: '#DCE4E8', fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }, raiseText: { color: '#07111F' }, hint: { color: '#697D90', textAlign: 'center', fontSize: 7, fontWeight: '800', letterSpacing: 0.7, marginTop: 9 },
  modalBackdrop: { flex: 1, backgroundColor: '#020812E8', alignItems: 'center', justifyContent: 'center', padding: 22 }, modalCard: { width: '100%', maxWidth: 380, backgroundColor: '#F3F0E7', padding: 28, shadowColor: '#45D7C5', shadowOffset: { width: 8, height: 8 }, shadowOpacity: 1, shadowRadius: 0, elevation: 20 }, close: { position: 'absolute', right: 14, top: 10, padding: 6, zIndex: 2 }, closeText: { color: '#081523', fontSize: 27 }, modalEyebrow: { color: '#DB5845', fontSize: 9, fontWeight: '900', letterSpacing: 1.7 }, modalTitle: { color: '#081523', fontSize: 33, lineHeight: 35, fontWeight: '900', letterSpacing: -1.3, marginTop: 9, marginBottom: 18 },
  steps: { borderTopWidth: 1, borderColor: '#C9C5BA', flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 4, marginBottom: 21 }, stepNumber: { width: 35, color: '#DF5E4B', fontSize: 11, fontWeight: '900', paddingVertical: 10 }, stepText: { width: '86%', color: '#26313A', fontSize: 12, lineHeight: 17, paddingVertical: 10 }, modalPrimary: { minHeight: 51, backgroundColor: '#081523', alignItems: 'center', justifyContent: 'center' }, modalPrimaryText: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  finalScore: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#D2CEC3', paddingVertical: 13 }, finalScoreLabel: { color: '#6E716E', fontSize: 8, fontWeight: '900', letterSpacing: 1.4 }, finalScoreValue: { color: '#081523', fontSize: 29, fontWeight: '900' },
  rewardButton: { minHeight: 57, marginTop: 18, backgroundColor: '#FF6B55', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11 }, disabled: { opacity: 0.65 }, playCircle: { width: 29, height: 29, borderRadius: 15, backgroundColor: '#081523', alignItems: 'center', justifyContent: 'center' }, play: { color: '#FFF', fontSize: 10 }, rewardTitle: { color: '#07111F', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 }, rewardSub: { color: '#27313A', fontSize: 8, fontWeight: '700', marginTop: 2 }, restartButton: { minHeight: 48, marginTop: 8, borderWidth: 1, borderColor: '#9D9B94', alignItems: 'center', justifyContent: 'center' }, restartText: { color: '#081523', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, adNote: { color: '#8D8B84', textAlign: 'center', fontSize: 7, fontWeight: '800', letterSpacing: 1.1, marginTop: 12 },
});
