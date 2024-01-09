'use strict'
/*
  Open Rowing Monitor, https://github.com/laberning/openrowingmonitor

  This tests the Quadratic Theil-Senn Regression algorithm. As regression is an estimation and methods have biasses,
  we need to accept some slack with respect to real-life examples
*/
import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { createTSQuadraticSeries } from './FullTSQuadraticSeries.js'

test('Quadratic Approximation startup behaviour', () => {
  const dataSeries = createTSQuadraticSeries(10)
  testCoefficientA(dataSeries, 0)
  testCoefficientB(dataSeries, 0)
  testCoefficientC(dataSeries, 0)
  dataSeries.push(-1, 2)
  testCoefficientA(dataSeries, 0)
  testCoefficientB(dataSeries, 0)
  testCoefficientC(dataSeries, 0)
  dataSeries.push(0, 2)
  testCoefficientA(dataSeries, 0)
  testCoefficientB(dataSeries, 0)
  testCoefficientC(dataSeries, 0)
  dataSeries.push(1, 6)
  testCoefficientA(dataSeries, 2)
  testCoefficientB(dataSeries, 2)
  testCoefficientC(dataSeries, 2)
})

test('Quadratic Approximation on a perfect noisefree function y = 2 * Math.pow(x, 2) + 2 * x + 2, 21 datapoints', () => {
  // Data based on 2 x^2 + 2 x + 2
  const dataSeries = createTSQuadraticSeries(21)
  dataSeries.push(-10, 182)
  dataSeries.push(-9, 146)
  dataSeries.push(-8, 114)
  dataSeries.push(-7, 86)
  dataSeries.push(-6, 62)
  dataSeries.push(-5, 42)
  dataSeries.push(-4, 26)
  dataSeries.push(-3, 14) // Pi ;)
  dataSeries.push(-2, 6)
  dataSeries.push(-1, 2)
  dataSeries.push(0, 2)
  dataSeries.push(1, 6)
  dataSeries.push(2, 14)
  dataSeries.push(3, 26)
  dataSeries.push(4, 42)
  dataSeries.push(5, 62)
  dataSeries.push(6, 86)
  dataSeries.push(7, 114)
  dataSeries.push(8, 146)
  dataSeries.push(9, 182)
  dataSeries.push(10, 222)
  testCoefficientA(dataSeries, 2)
  testCoefficientB(dataSeries, 2)
  testCoefficientC(dataSeries, 2)
})

test('Quadratic Approximation on a perfect noisefree function y = 2 * Math.pow(x, 2) + 2 * x + 2, with 10 datapoints and some shifting in the series', () => {
  // Data based on 2 x^2 + 2 x + 2, split the dataset in two to see its behaviour when it is around the Vertex
  const dataSeries = createTSQuadraticSeries(10)
  dataSeries.push(-10, 182)
  dataSeries.push(-9, 146)
  dataSeries.push(-8, 114)
  dataSeries.push(-7, 86)
  dataSeries.push(-6, 62)
  dataSeries.push(-5, 42)
  dataSeries.push(-4, 26)
  dataSeries.push(-3, 14) // Pi ;)
  dataSeries.push(-2, 6)
  dataSeries.push(-1, 2)
  dataSeries.push(0, 2)
  testCoefficientA(dataSeries, 2)
  testCoefficientB(dataSeries, 2)
  testCoefficientC(dataSeries, 2)
  dataSeries.push(1, 6)
  dataSeries.push(2, 14)
  dataSeries.push(3, 26)
  dataSeries.push(4, 42)
  dataSeries.push(5, 62)
  dataSeries.push(6, 86)
  dataSeries.push(7, 114)
  dataSeries.push(8, 146)
  dataSeries.push(9, 182)
  dataSeries.push(10, 222)
  testCoefficientA(dataSeries, 2)
  testCoefficientB(dataSeries, 2)
  testCoefficientC(dataSeries, 2)
})

test('Quadratic Approximation on function y = 4 * Math.pow(x, 2) + 4 * x + 4, noisefree', () => {
  // Data based on 4 x^2 + 4 x + 4
  const dataSeries = createTSQuadraticSeries(11)
  dataSeries.push(-11, 444)
  dataSeries.push(-10, 364)
  dataSeries.push(-9, 292)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(-8, 228)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(-7, 172)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(-6, 124)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(-5, 84)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(-4, 52)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(-3, 28)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(-2, 12)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(-1, 4)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(0, 4)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(1, 12)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(2, 28)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(3, 52)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(4, 84)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(5, 124)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(6, 172)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(7, 228)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(8, 292)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(9, 364)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(10, 444)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
})

test('Quadratic Approximation on function y = 4 * Math.pow(x, 2) + 4 * x + 4, with some noise (+/- 1)', () => {
  // Data based on 4 x^2 + 4 x + 4
  const dataSeries = createTSQuadraticSeries(11)
  dataSeries.push(-11, 443)
  dataSeries.push(-10, 365)
  dataSeries.push(-9, 291)
  testCoefficientA(dataSeries, 2)
  testCoefficientB(dataSeries, -36)
  testCoefficientC(dataSeries, -195)
  dataSeries.push(-8, 229)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(-7, 171)
  testCoefficientA(dataSeries, 3.3333333333333335)
  testCoefficientB(dataSeries, -7.999999999999995)
  testCoefficientC(dataSeries, -48.333333333333314)
  dataSeries.push(-6, 125)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(-5, 83)
  testCoefficientA(dataSeries, 3.8666666666666667)
  testCoefficientB(dataSeries, 1.8666666666666742)
  testCoefficientC(dataSeries, -4.3333333333332575)
  dataSeries.push(-4, 53)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 3.8571428571428577) // This is quite acceptable as ORM ignores the C
  dataSeries.push(-3, 27)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(-2, 13)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 3.8888888888888893) // This is quite acceptable as ORM ignores the C
  dataSeries.push(-1, 3)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(0, 5)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(1, 11)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(2, 29)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(3, 51)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(4, 85)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(5, 123)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(6, 173)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(7, 227)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(8, 293)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(9, 363)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(10, 444)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
})

test('Quadratic Approximation on function y = 4 * Math.pow(x, 2) + 4 * x + 4, with some noise (+/- 1) and spikes (+/- 9)', () => {
  // Data based on 4 x^2 + 4 x + 4
  const dataSeries = createTSQuadraticSeries(11)
  dataSeries.push(-11, 443)
  dataSeries.push(-10, 365)
  dataSeries.push(-9, 291)
  dataSeries.push(-8, 229)
  dataSeries.push(-7, 171)
  dataSeries.push(-6, 125)
  dataSeries.push(-5, 83)
  dataSeries.push(-4, 53)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(-3, 37) // FIRST SPIKE +9
  testCoefficientA(dataSeries, 4.215277777777778)
  testCoefficientB(dataSeries, 7.321527777777776)
  testCoefficientC(dataSeries, 15.70208333333332)
  dataSeries.push(-2, 3) // SECOND SPIKE -9
  testCoefficientA(dataSeries, 3.9714285714285715)
  testCoefficientB(dataSeries, 3.78571428571429) // Coefficient B seems to take a hit anyway
  testCoefficientC(dataSeries, 4.35000000000003) // We get a 4.35000000000003 instead of 4, which is quite acceptable (especially since ORM ignores the C)
  dataSeries.push(-1, 3)
  testCoefficientA(dataSeries, 3.9555555555555557)
  testCoefficientB(dataSeries, 3.37777777777778)
  testCoefficientC(dataSeries, 2.8666666666666742)
  dataSeries.push(0, 5)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(1, 11)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(2, 29)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(3, 51)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(4, 85)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(5, 123)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(6, 173)
  testCoefficientA(dataSeries, 4.044444444444444)
  testCoefficientB(dataSeries, 3.8222222222222215)
  testCoefficientC(dataSeries, 3.711111111111112)
  dataSeries.push(7, 227)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
  dataSeries.push(8, 293)
  testCoefficientA(dataSeries, 3.9047619047619047)
  testCoefficientB(dataSeries, 4.761904761904762)
  testCoefficientC(dataSeries, 2.47619047619048) // This is quite acceptable as ORM ignores the C
  dataSeries.push(9, 363)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4) // We get a 3 instead of 4, which is quite acceptable (especially since ORM ignores the C)
  dataSeries.push(10, 444)
  testCoefficientA(dataSeries, 4)
  testCoefficientB(dataSeries, 4)
  testCoefficientC(dataSeries, 4)
})

test('Quadratic TS Estimation should be decent for standard real-life example from MathBits with some noise', () => {
  // Data based on https://mathbits.com/MathBits/TISection/Statistics2/quadratic.html
  const dataSeries = createTSQuadraticSeries(13)
  dataSeries.push(10, 115.6)
  dataSeries.push(15, 157.2)
  dataSeries.push(20, 189.2)
  dataSeries.push(24, 220.8)
  dataSeries.push(30, 253.8)
  dataSeries.push(34, 269.2)
  dataSeries.push(40, 284.8)
  dataSeries.push(45, 285.0)
  dataSeries.push(48, 277.4)
  dataSeries.push(50, 269.2)
  dataSeries.push(58, 244.2)
  dataSeries.push(60, 231.4)
  dataSeries.push(64, 180.4)
  testCoefficientA(dataSeries, -0.17702838827838824) // In the example, the TI084 results in -0.1737141137, which we consider acceptably close
  testCoefficientB(dataSeries, 15.059093406593405) // In the example, the TI084 results in 14.52117133, which we consider acceptably close
  testCoefficientC(dataSeries, -37.563076923077006) // In the example, the TI084 results in -21.89774466, which we consider acceptably close
})

test('Quadratic TS Estimation should be decent for standard real-life example from VarsityTutors with some noise', () => {
  // Test based on https://www.varsitytutors.com/hotmath/hotmath_help/topics/quadratic-regression
  const dataSeries = createTSQuadraticSeries(7)
  dataSeries.push(-3, 7.5)
  dataSeries.push(-2, 3)
  dataSeries.push(-1, 0.5)
  dataSeries.push(0, 1)
  dataSeries.push(1, 3)
  dataSeries.push(2, 6)
  dataSeries.push(3, 14)
  testCoefficientA(dataSeries, 1.0833333333333333) // The example results in 1.1071 for OLS, which we consider acceptably close
  testCoefficientB(dataSeries, 0.9166666666666667) // The example results in 1 for OLS, which we consider acceptably close
  testCoefficientC(dataSeries, 0.5000000000000004) // The example results in 0.5714 for OLS, which we consider acceptably close
})

test('Quadratic TS Estimation should be decent for standard example from VTUPulse with some noise, without the vertex being part of the dataset', () => {
  // Test based on https://www.vtupulse.com/machine-learning/quadratic-polynomial-regression-model-solved-example/
  const dataSeries = createTSQuadraticSeries(5)
  dataSeries.push(3, 2.5)
  dataSeries.push(4, 3.3)
  dataSeries.push(5, 3.8)
  dataSeries.push(6, 6.5)
  dataSeries.push(7, 11.5)
  testCoefficientA(dataSeries, 0.8583333333333334) // The example results in 0.7642857 for OLS, which we consider acceptably close given the small sample size
  testCoefficientB(dataSeries, -6.566666666666666) // The example results in -5.5128571 for OLS, which we consider acceptably close given the small sample size
  testCoefficientC(dataSeries, 15.174999999999994) // The example results in 12.4285714 for OLS, which we consider acceptably close given the small sample size
})

test('Quadratic TS Estimation should be decent for standard real-life example from Uni Berlin with some noise without the vertex being part of the dataset', () => {
  // Test based on https://www.geo.fu-berlin.de/en/v/soga/Basics-of-statistics/Linear-Regression/Polynomial-Regression/Polynomial-Regression---An-example/index.html
  const dataSeries = createTSQuadraticSeries(25)
  dataSeries.push(0.001399613, -0.23436656)
  dataSeries.push(0.971629779, 0.64689524)
  dataSeries.push(0.579119475, -0.92635765)
  dataSeries.push(0.335693937, 0.13000706)
  dataSeries.push(0.736736086, -0.89294863)
  dataSeries.push(0.492572335, 0.33854780)
  dataSeries.push(0.737133774, -1.24171910)
  dataSeries.push(0.563693769, -0.22523318)
  dataSeries.push(0.877603280, -0.12962722)
  dataSeries.push(0.141426545, 0.37632006)
  dataSeries.push(0.307203910, 0.30299077)
  dataSeries.push(0.024509308, -0.21162739)
  dataSeries.push(0.843665029, -0.76468719)
  dataSeries.push(0.771206067, -0.90455412)
  dataSeries.push(0.149670258, 0.77097952)
  dataSeries.push(0.359605608, 0.56466366)
  dataSeries.push(0.049612895, 0.18897607)
  dataSeries.push(0.409898906, 0.32531750)
  dataSeries.push(0.935457898, -0.78703491)
  dataSeries.push(0.149476207, 0.80585375)
  dataSeries.push(0.234315216, 0.62944986)
  dataSeries.push(0.455297119, 0.02353327)
  dataSeries.push(0.102696671, 0.27621694)
  dataSeries.push(0.715372314, -1.20379729)
  dataSeries.push(0.681745393, -0.83059624)
  testCoefficientA(dataSeries, -2.030477132951317)
  testCoefficientB(dataSeries, 0.6253742507247935)
  testCoefficientC(dataSeries, 0.2334077291108024)
})

test('Quadratic TS Estimation should be decent for standard real-life example from Statology.org with some noise and chaotic X values', () => {
  // Test based on https://www.statology.org/quadratic-regression-r/
  const dataSeries = createTSQuadraticSeries(11)
  dataSeries.push(6, 14)
  dataSeries.push(9, 28)
  dataSeries.push(12, 50)
  dataSeries.push(14, 70)
  dataSeries.push(30, 89)
  dataSeries.push(35, 94)
  dataSeries.push(40, 90)
  dataSeries.push(47, 75)
  dataSeries.push(51, 59)
  dataSeries.push(55, 44)
  dataSeries.push(60, 27)
  testCoefficientA(dataSeries, -0.10119047619047619) // The example results in -0.1012 for R after two rounds, which we consider acceptably close
  testCoefficientB(dataSeries, 6.767857142857142) // The example results in 6.7444 for R after two rounds, which we consider acceptably close
  testCoefficientC(dataSeries, -19.55952380952374) // The example results in 18.2536 for R after two rounds, but for ORM, this factor is irrelevant
})

test('Quadratic TS Estimation should be decent for standard real-life example from StatsDirect.com with some noise and chaotic X values', () => {
  // Test based on https://www.statsdirect.com/help/regression_and_correlation/polynomial.htm
  const dataSeries = createTSQuadraticSeries(10)
  dataSeries.push(1290, 1182)
  dataSeries.push(1350, 1172)
  dataSeries.push(1470, 1264)
  dataSeries.push(1600, 1493)
  dataSeries.push(1710, 1571)
  dataSeries.push(1840, 1711)
  dataSeries.push(1980, 1804)
  dataSeries.push(2230, 1840)
  dataSeries.push(2400, 1956)
  dataSeries.push(2930, 1954)
  testCoefficientA(dataSeries, -0.00046251263566907585) // The example results in -0.00045 through QR decomposition by Givens rotations, which we consider acceptably close
  testCoefficientB(dataSeries, 2.429942262608943) // The example results in 2.39893 for QR decomposition by Givens rotations, which we consider acceptably close
  testCoefficientC(dataSeries, -1221.3216719814116) // The example results in -1216.143887 for QR decomposition by Givens rotations, but for ORM, this factor is irrelevant
})

test('Quadratic Approximation with a clean function and a reset', () => {
  // Data based on 2 x^2 + 2 x + 2
  const dataSeries = createTSQuadraticSeries(10)
  dataSeries.push(-10, 182)
  dataSeries.push(-9, 146)
  dataSeries.push(-8, 114)
  dataSeries.push(-7, 86)
  dataSeries.push(-6, 62)
  dataSeries.push(-5, 42)
  testCoefficientA(dataSeries, 2)
  testCoefficientB(dataSeries, 2)
  testCoefficientC(dataSeries, 2)
  dataSeries.push(-4, 26)
  dataSeries.push(-3, 14) // Pi ;)
  dataSeries.push(-2, 6)
  dataSeries.push(-1, 2)
  dataSeries.push(0, 2)
  dataSeries.push(1, 6)
  dataSeries.push(2, 14)
  testCoefficientA(dataSeries, 2)
  testCoefficientB(dataSeries, 2)
  testCoefficientC(dataSeries, 2)
  dataSeries.push(3, 26)
  dataSeries.push(4, 42)
  dataSeries.push(5, 62)
  dataSeries.push(6, 86)
  dataSeries.push(7, 114)
  dataSeries.push(8, 146)
  dataSeries.push(9, 182)
  dataSeries.push(10, 222)
  testCoefficientA(dataSeries, 2)
  testCoefficientB(dataSeries, 2)
  testCoefficientC(dataSeries, 2)
  dataSeries.reset()
  testCoefficientA(dataSeries, 0)
  testCoefficientB(dataSeries, 0)
  testCoefficientC(dataSeries, 0)
  dataSeries.push(-1, 2)
  testCoefficientA(dataSeries, 0)
  testCoefficientB(dataSeries, 0)
  testCoefficientC(dataSeries, 0)
  dataSeries.push(0, 2)
  testCoefficientA(dataSeries, 0)
  testCoefficientB(dataSeries, 0)
  testCoefficientC(dataSeries, 0)
  dataSeries.push(1, 6)
  testCoefficientA(dataSeries, 2)
  testCoefficientB(dataSeries, 2)
  testCoefficientC(dataSeries, 2)
})

test('Quadratic TS Estimation should result in a straight line for function y = x', () => {
  // As ORM will encounter straight lines (when forces are balanced on the flywheel, there is no acceleration/deceleration), so we need to test this as well
  const dataSeries = createTSQuadraticSeries(7)
  dataSeries.push(0, 0)
  dataSeries.push(1, 1)
  dataSeries.push(2, 2)
  dataSeries.push(3, 3)
  dataSeries.push(4, 4)
  dataSeries.push(5, 5)
  dataSeries.push(6, 6)
  testCoefficientA(dataSeries, 0)
  testCoefficientB(dataSeries, 1)
  testCoefficientC(dataSeries, 0)
})

function testCoefficientA (series, expectedValue) {
  assert.ok(series.coefficientA() === expectedValue, `Expected value for coefficientA at X-position ${series.xAtSeriesEnd()} is ${expectedValue}, encountered a ${series.coefficientA()}`)
}

function testCoefficientB (series, expectedValue) {
  assert.ok(series.coefficientB() === expectedValue, `Expected value for coefficientB at X-position ${series.xAtSeriesEnd()} is ${expectedValue}, encountered a ${series.coefficientB()}`)
}

function testCoefficientC (series, expectedValue) {
  assert.ok(series.coefficientC() === expectedValue, `Expected value for coefficientC at X-position ${series.xAtSeriesEnd()} is ${expectedValue}, encountered a ${series.coefficientC()}`)
}

/*
function testSlope (series, position, expectedValue) {
  assert.ok(series.slope(position) === expectedValue, `Expected value for Slope-${position} at X-position ${series.xAtSeriesEnd()} (slope at X-position ${series.xAtPosition(position)}) is ${expectedValue}, encountered a ${series.slope(position)}`)
}

function reportAll (series) {
  assert.ok(series.coefficientA() === 99, `time: ${series.xAtSeriesEnd()}, coefficientA: ${series.coefficientA()}, coefficientB: ${series.coefficientB()}, coefficientC: ${series.coefficientC()}, Slope-10: ${series.slope(10)}, Slope-9: ${series.slope(9)}, Slope-8: ${series.slope(8)}, Slope-7: ${series.slope(7)}, Slope-6: ${series.slope(6)}, Slope-5: ${series.slope(5)}, Slope-4: ${series.slope(4)}, Slope-3: ${series.slope(3)}, Slope-2: ${series.slope(2)}, Slope-1: ${series.slope(1)}, Slope-0: ${series.slope(0)}`)
}
*/

test.run()
