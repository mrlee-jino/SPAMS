/** OLS on equally spaced hourly means. Returns a one-hour-ahead estimate. */
export interface HourlyMean {
  time: string;
  temperature: number;
}
export function forecastTemperature<T extends HourlyMean>(
  points: readonly T[],
) {
  if (
    points.length < 2 ||
    points.some((p) => !Number.isFinite(p.temperature))
  ) {
    throw new RangeError(
      "Forecast requires at least two finite hourly mean temperatures.",
    );
  }
  const n = points.length;
  const sx = points.reduce((sum, _, i) => sum + i, 0);
  const sy = points.reduce((sum, p) => sum + p.temperature, 0);
  const sxx = points.reduce((sum, _, i) => sum + i * i, 0);
  const sxy = points.reduce((sum, p, i) => sum + i * p.temperature, 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const intercept = (sy - slope * sx) / n;
  return {
    value: intercept + slope * n,
    slope,
    points: points.map((p, i) => ({ ...p, fit: intercept + slope * i })),
  };
}
