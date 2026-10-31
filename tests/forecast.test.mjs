import test from "node:test";
import assert from "node:assert/strict";
import { forecastTemperature } from "../src/lib/forecast.ts";
const hourly = (values) =>
  values.map((temperature, i) => ({ time: `${i}:00`, temperature }));
test("extrapolates the next hour and preserves observed values", () => {
  const result = forecastTemperature(hourly([24, 25, 26, 27]));
  assert.equal(result.value, 28);
  assert.equal(result.slope, 1);
  assert.deepEqual(
    result.points.map((p) => p.fit),
    [24, 25, 26, 27],
  );
});
test("constant temperatures predict the same temperature", () => {
  assert.equal(forecastTemperature(hourly([28, 28, 28, 28, 28, 28])).value, 28);
});
test("supports falling trends and variable training-window lengths", () => {
  assert.equal(forecastTemperature(hourly([30, 29])).value, 28);
  assert.equal(forecastTemperature(hourly([30, 29, 28])).slope, -1);
});
test("rejects insufficient or invalid observations", () => {
  for (const values of [[], [28], [28, NaN], [Infinity, 28]]) {
    assert.throws(() => forecastTemperature(hourly(values)), RangeError);
  }
});
