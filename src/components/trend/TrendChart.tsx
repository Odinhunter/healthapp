import { useMemo } from 'react';
import Svg, { Circle, G, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { format } from 'date-fns';
import { colors, typography } from '../../constants/theme';
import type { BiomarkerRow } from '../../types/database';
import { statusVariant } from '../../lib/biomarkerGrouping';

const CHART_HEIGHT = 200;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;

interface Props {
  biomarkers: BiomarkerRow[];
  referenceMin: number | null;
  referenceMax: number | null;
  width: number;
}

function dotColor(status: BiomarkerRow['status']): string {
  const v = statusVariant(status);
  if (v === 'critical') return colors.danger;
  if (v === 'flagged') return colors.warning;
  return colors.primary;
}

export default function TrendChart({
  biomarkers,
  referenceMin,
  referenceMax,
  width,
}: Props) {
  const chart = useMemo(() => {
    const innerW = width - PAD_LEFT - PAD_RIGHT;
    const innerH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

    const values = biomarkers.map((b) => b.value);
    const refVals = [referenceMin, referenceMax].filter(
      (v): v is number => v != null,
    );
    const allVals = [...values, ...refVals];

    let yMin = Math.min(...allVals);
    let yMax = Math.max(...allVals);
    const span = yMax - yMin || Math.abs(yMax) || 1;
    yMin -= span * 0.12;
    yMax += span * 0.12;
    const yRange = yMax - yMin;

    const times = biomarkers.map((b) => new Date(b.report_date).getTime());
    const xMin = Math.min(...times);
    const xMax = Math.max(...times);
    const xRange = xMax - xMin || 1;

    const xPos = (t: number) =>
      PAD_LEFT + ((t - xMin) / xRange) * innerW;
    const yPos = (v: number) =>
      PAD_TOP + (1 - (v - yMin) / yRange) * innerH;

    const hasBand = referenceMin != null && referenceMax != null;
    const bandTop = hasBand ? yPos(referenceMax!) : PAD_TOP;
    const bandBottom = hasBand ? yPos(referenceMin!) : PAD_TOP + innerH;
    const bandY = Math.min(bandTop, bandBottom);
    const bandHeight = Math.abs(bandBottom - bandTop);

    const polyline = biomarkers
      .map((b) => `${xPos(new Date(b.report_date).getTime())},${yPos(b.value)}`)
      .join(' ');

    const circles = biomarkers.map((b) => ({
      cx: xPos(new Date(b.report_date).getTime()),
      cy: yPos(b.value),
      color: dotColor(b.status),
      key: b.id,
    }));

    const yTicks = [
      { y: yPos(yMax), label: formatTick(yMax) },
      { y: yPos((yMax + yMin) / 2), label: formatTick((yMax + yMin) / 2) },
      { y: yPos(yMin), label: formatTick(yMin) },
    ];

    const xTicks = [
      { x: PAD_LEFT, label: format(new Date(xMin), 'd MMM yy'), anchor: 'start' as const },
      { x: PAD_LEFT + innerW, label: format(new Date(xMax), 'd MMM yy'), anchor: 'end' as const },
    ];

    return { polyline, circles, bandY, bandHeight, hasBand, yTicks, xTicks, innerW };
  }, [biomarkers, referenceMin, referenceMax, width]);

  return (
    <Svg width={width} height={CHART_HEIGHT}>
      {chart.hasBand && (
        <Rect
          x={PAD_LEFT}
          y={chart.bandY}
          width={chart.innerW}
          height={chart.bandHeight}
          fill={colors.primaryLight}
        />
      )}

      {chart.yTicks.map((t, i) => (
        <SvgText
          key={`y-${i}`}
          x={PAD_LEFT - 8}
          y={t.y + 3}
          fontSize={typography.xs}
          fill={colors.textTertiary}
          textAnchor="end"
        >
          {t.label}
        </SvgText>
      ))}

      {chart.xTicks.map((t, i) => (
        <SvgText
          key={`x-${i}`}
          x={t.x}
          y={CHART_HEIGHT - 8}
          fontSize={typography.xs}
          fill={colors.textTertiary}
          textAnchor={t.anchor}
        >
          {t.label}
        </SvgText>
      ))}

      <Polyline
        points={chart.polyline}
        fill="none"
        stroke={colors.primary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {chart.circles.map((c) => (
        <G key={c.key}>
          <Circle cx={c.cx} cy={c.cy} r={5.5} fill={colors.surface} />
          <Circle cx={c.cx} cy={c.cy} r={4} fill={c.color} />
        </G>
      ))}
    </Svg>
  );
}

function formatTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 100) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  return v.toFixed(2);
}
