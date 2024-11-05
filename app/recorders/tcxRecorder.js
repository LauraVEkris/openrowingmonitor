'use strict'
/*
  Open Rowing Monitor, https://github.com/JaapvanEkris/openrowingmonitor

  This Module captures the metrics of a rowing session and persists them in the tcx format.
*/
import log from 'loglevel'
import zlib from 'zlib'
import fs from 'fs/promises'
import { createSeries } from '../engine/utils/Series.js'
import { createVO2max } from './VO2max.js'
import { promisify } from 'util'
const gzip = promisify(zlib.gzip)

export function createTCXRecorder (config) {
  const powerSeries = createSeries()
  const speedSeries = createSeries()
  const heartrateSeries = createSeries()
  let filename
  let heartRate = 0
  let sessionData
  let lapnumber = 0
  let postExerciseHR = []
  let lastMetrics
  let allDataHasBeenWritten

  // This function handles all incomming commands. Here, the recordingmanager will have filtered
  // all unneccessary commands for us, so we only need to react to 'reset' and 'shutdown'
  async function handleCommand (commandName) {
    switch (commandName) {
      case ('reset'):
        if (lastMetrics.totalMovingTime > sessionData.lap[lapnumber].strokes[sessionData.lap[lapnumber].strokes.length - 1].totalMovingTime) {
          updateLapMetrics(lastMetrics)
          addMetricsToStrokesArray(lastMetrics)
        }
        await createTcxFile()
        heartRate = 0
        sessionData = null
        lapnumber = 0
        postExerciseHR = null
        postExerciseHR = []
        powerSeries.reset()
        speedSeries.reset()
        heartrateSeries.reset()
        break
      case 'shutdown':
        if (lastMetrics.totalMovingTime > sessionData.lap[lapnumber].strokes[sessionData.lap[lapnumber].strokes.length - 1].totalMovingTime) {
          updateLapMetrics(lastMetrics)
          addMetricsToStrokesArray(lastMetrics)
        }
        await createTcxFile()
        break
      default:
        log.error(`tcxRecorder: Recieved unknown command: ${commandName}`)
    }
  }

  function setBaseFileName (baseFileName) {
    filename = `${baseFileName}_rowing.tcx`
    log.info(`Garmin tcx-file will be saved as ${filename} (after the session)`)
  }

  function recordRowingMetrics (metrics) {
    const currentTime = new Date()
    let startTime
    let intervalEndMetrics
    switch (true) {
      case (metrics.metricsContext.isSessionStart):
        sessionData = { startTime: currentTime }
        sessionData.lap = []
        lapnumber = 0
        sessionData.lap[lapnumber] = { startTime: currentTime }
        sessionData.lap[lapnumber].strokes = []
        updateLapMetrics(metrics)
        addMetricsToStrokesArray(metrics)
        break
      case (metrics.metricsContext.isSessionStop):
        updateLapMetrics(metrics)
        addMetricsToStrokesArray(metrics)
        calculateLapMetrics(metrics)
        postExerciseHR = null
        postExerciseHR = []
        createTcxFile()
        measureRecoveryHR()
        break
      case (metrics.metricsContext.isPauseStart):
        updateLapMetrics(metrics)
        addMetricsToStrokesArray(metrics)
        calculateLapMetrics(metrics)
        powerSeries.reset()
        speedSeries.reset()
        heartrateSeries.reset()
        postExerciseHR = null
        postExerciseHR = []
        createTcxFile()
        measureRecoveryHR()
        break
      case (metrics.metricsContext.isPauseEnd):
        lapnumber++
        sessionData.lap[lapnumber] = { startTime: currentTime }
        sessionData.lap[lapnumber].strokes = []
        addMetricsToStrokesArray(metrics)
        break
      case (metrics.metricsContext.isIntervalStart):
        // Please note: we deliberatly add the metrics twice as it marks both the end of the old interval and the start of a new one
        updateLapMetrics(metrics)
        intervalEndMetrics = { ...metrics }
        intervalEndMetrics.intervalAndPauseMovingTime = metrics.totalMovingTime - sessionData.lap[lapnumber].strokes[0].totalMovingTime
        addMetricsToStrokesArray(intervalEndMetrics)
        calculateLapMetrics(metrics)
        powerSeries.reset()
        speedSeries.reset()
        heartrateSeries.reset()
        lapnumber++
        // We need to calculate the start time of the interval, as delay in message handling can cause weird effects here
        startTime = new Date(sessionData.lap[lapnumber - 1].startTime.getTime() + intervalEndMetrics.intervalAndPauseMovingTime * 1000)
        sessionData.lap[lapnumber] = { startTime }
        sessionData.lap[lapnumber].strokes = []
        addMetricsToStrokesArray(metrics)
        break
      case (metrics.metricsContext.isDriveStart):
        updateLapMetrics(metrics)
        addMetricsToStrokesArray(metrics)
        break
//      ToDo: Resolve rounding issue, resolve interval counting
//      Additional issue: shouldn't we mark interval ends instead of starts (symmetric to splits)
//      Perhaps manage the conversion to interval numbering and workout distance here
//      case (metrics.metricsContext.isSplitEnd):
//        addMetricsToStrokesArray(metrics)
//        break
    }
    lastMetrics = metrics
  }

  function addMetricsToStrokesArray (metrics) {
    addHeartRateToMetrics(metrics)
    sessionData.lap[lapnumber].strokes.push(metrics)
    allDataHasBeenWritten = false
  }

  function updateLapMetrics (metrics) {
    if (metrics.cyclePower !== undefined && metrics.cyclePower > 0) { powerSeries.push(metrics.cyclePower) }
    if (metrics.cycleLinearVelocity !== undefined && metrics.cycleLinearVelocity > 0) { speedSeries.push(metrics.cycleLinearVelocity) }
    if (heartRate !== undefined && heartRate > 0) { heartrateSeries.push(heartRate) }
  }

  function calculateLapMetrics (metrics) {
    sessionData.lap[lapnumber].totalMovingTime = metrics.totalMovingTime - sessionData.lap[lapnumber].strokes[0].totalMovingTime
    sessionData.lap[lapnumber].totalLinearDistance = metrics.totalLinearDistance - sessionData.lap[lapnumber].strokes[0].totalLinearDistance
    sessionData.lap[lapnumber].totalCalories = metrics.totalCalories - sessionData.lap[lapnumber].strokes[0].totalCalories
    sessionData.lap[lapnumber].numberOfStrokes = sessionData.lap[lapnumber].strokes.length
    sessionData.lap[lapnumber].averageStrokeRate = 60 * (sessionData.lap[lapnumber].numberOfStrokes / sessionData.lap[lapnumber].totalMovingTime)
    sessionData.lap[lapnumber].averageVelocity = sessionData.lap[lapnumber].totalLinearDistance / sessionData.lap[lapnumber].totalMovingTime
    sessionData.lap[lapnumber].averagePower = powerSeries.average()
    sessionData.lap[lapnumber].maximumPower = powerSeries.maximum()
    sessionData.lap[lapnumber].averageSpeed = speedSeries.average()
    sessionData.lap[lapnumber].maximumSpeed = speedSeries.maximum()
    sessionData.lap[lapnumber].averageHeartrate = heartrateSeries.average()
    sessionData.lap[lapnumber].maximumHeartrate = heartrateSeries.maximum()
  }

  function addHeartRateToMetrics (metrics) {
    if (heartRate !== undefined) {
      metrics.heartrate = heartRate
    } else {
      metrics.heartrate = undefined
    }
  }

  // initiated when a new heart rate value is received from heart rate sensor
  async function recordHeartRate (value) {
    heartRate = value.heartrate
  }

  async function createTcxFile () {
    // Do not write again if not needed
    if (allDataHasBeenWritten) return

    // we need at least two strokes and ten seconds to generate a valid tcx file
    if (!minimumNumberOfStrokesHaveCompleted() || !minimumRecordingTimeHasPassed()) {
      log.info('tcx file has not been written, as there were not enough strokes recorded (minimum 10 seconds and two strokes)')
      return
    }

    const tcxRecord = await activeWorkoutToTcx()
    if (tcxRecord === undefined) {
      log.error('error creating tcx file')
      return
    }
    await createFile(tcxRecord.tcx, `${filename}`, config.gzipTcxFiles)
    allDataHasBeenWritten = true
    log.info(`Garmin tcx data has been written as ${filename}`)
  }

  async function activeWorkoutToTcx () {
    // Be aware! This function is also exposed to the Strava recorder!
    const tcx = await workoutToTcx(sessionData)

    return {
      tcx,
      filename
    }
  }

  async function workoutToTcx (workout) {
    let tcxData = []
    tcxData += '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    tcxData += '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:ns2="http://www.garmin.com/xmlschemas/ActivityExtension/v2">\n'
    tcxData += await createActivity(sessionData)
    tcxData += '</TrainingCenterDatabase>\n'
    return tcxData
  }

  async function createActivity (workout) {
    let tcxData = []
    tcxData += '  <Activities>\n'
    tcxData += '    <Activity Sport="Other">\n'
    tcxData += `      <Id>${workout.startTime.toISOString()}</Id>\n`
    let i = 0
    while (i < workout.lap.length) {
      tcxData += await createLap(workout.lap[i])
      i++
    }
    tcxData += await createNotes(workout)
    tcxData += await createAuthor()
    tcxData += '    </Activity>\n'
    tcxData += '  </Activities>\n'
    return tcxData
  }

  async function createLap (lapdata) {
    let tcxData = []
    tcxData += `      <Lap StartTime="${lapdata.startTime.toISOString()}">\n`
    tcxData += `        <TotalTimeSeconds>${lapdata.totalMovingTime.toFixed(1)}</TotalTimeSeconds>\n`
    tcxData += `        <DistanceMeters>${lapdata.totalLinearDistance.toFixed(1)}</DistanceMeters>\n`
    tcxData += `        <MaximumSpeed>${lapdata.maximumSpeed.toFixed(2)}</MaximumSpeed>\n`
    tcxData += `        <Calories>${Math.round(lapdata.totalCalories)}</Calories>\n`
    if (lapdata.averageHeartrate > 0 && lapdata.maximumHeartrate > 0) {
      tcxData += `        <AverageHeartRateBpm>${Math.round(lapdata.averageHeartrate.toFixed(0))}</AverageHeartRateBpm>\n`
      tcxData += `        <MaximumHeartRateBpm>${Math.round(lapdata.maximumHeartrate.toFixed(0))}</MaximumHeartRateBpm>\n`
    }
    tcxData += '        <Intensity>Active</Intensity>\n'
    tcxData += `        <Cadence>${lapdata.averageStrokeRate.toFixed(0)}</Cadence>\n`
    tcxData += '        <TriggerMethod>Manual</TriggerMethod>\n'
    tcxData += '        <Track>\n'
    // Add the strokes
    let i = 0
    while (i < lapdata.strokes.length) {
      tcxData += await createTrackPoint(lapdata.startTime, lapdata.strokes[i])
      i++
    }
    tcxData += '        </Track>\n'
    tcxData += '        <Extensions>\n'
    tcxData += '          <ns2:LX>\n'
    tcxData += `            <ns2:Steps>${lapdata.numberOfStrokes.toFixed(0)}</ns2:Steps>\n`
    tcxData += `            <ns2:AvgSpeed>${lapdata.averageSpeed.toFixed(2)}</ns2:AvgSpeed>\n`
    tcxData += `            <ns2:AvgWatts>${lapdata.averagePower.toFixed(0)}</ns2:AvgWatts>\n`
    tcxData += `            <ns2:MaxWatts>${lapdata.maximumPower.toFixed(0)}</ns2:MaxWatts>\n`
    tcxData += '          </ns2:LX>\n'
    tcxData += '        </Extensions>\n'
    tcxData += '      </Lap>\n'
    return tcxData
  }

  async function createTrackPoint (offset, trackpoint) {
    const trackPointTime = new Date(offset.getTime() + trackpoint.intervalAndPauseMovingTime * 1000)

    let tcxData = []
    tcxData += '          <Trackpoint>\n'
    tcxData += `            <Time>${trackPointTime.toISOString()}</Time>\n`
    tcxData += `            <DistanceMeters>${trackpoint.totalLinearDistance.toFixed(2)}</DistanceMeters>\n`
    tcxData += `            <Cadence>${(trackpoint.cycleStrokeRate > 0 ? Math.round(trackpoint.cycleStrokeRate) : 0)}</Cadence>\n`
    if (trackpoint.cycleLinearVelocity > 0 || trackpoint.cyclePower > 0 || trackpoint.metricsContext.isPauseStart) {
      tcxData += '            <Extensions>\n'
      tcxData += '              <ns2:TPX>\n'
      if (trackpoint.cycleLinearVelocity > 0 || trackpoint.metricsContext.isPauseStart) {
        tcxData += `                <ns2:Speed>${(trackpoint.cycleLinearVelocity > 0 ? trackpoint.cycleLinearVelocity.toFixed(2) : 0)}</ns2:Speed>\n`
      }
      if (trackpoint.cyclePower > 0 || trackpoint.metricsContext.isPauseStart) {
        tcxData += `                <ns2:Watts>${(trackpoint.cyclePower > 0 ? Math.round(trackpoint.cyclePower) : 0)}</ns2:Watts>\n`
      }
      tcxData += '              </ns2:TPX>\n'
      tcxData += '            </Extensions>\n'
    }
    if (trackpoint.heartrate !== undefined) {
      tcxData += '            <HeartRateBpm>\n'
      tcxData += `              <Value>${trackpoint.heartrate}</Value>\n`
      tcxData += '            </HeartRateBpm>\n'
    }
    tcxData += '          </Trackpoint>\n'
    return tcxData
  }

  async function createNotes (workout) {
    let VO2maxoutput = 'UNDEFINED'
    const VO2max = createVO2max(config)
    const drag = createSeries()
    let i = 0
    let j = 0

    while (i < workout.lap.length) {
      j = 0
      while (j < workout.lap[i].strokes.length) {
        if (workout.lap[i].strokes[j].dragFactor !== undefined && workout.lap[i].strokes[j].dragFactor > 0) { drag.push(workout.lap[i].strokes[j].dragFactor) }
        j++
      }
      i++
    }

    // VO2Max calculation
    const VO2maxResult = VO2max.calculateVO2max(workout)
    if (VO2maxResult > 10 && VO2maxResult < 60) {
      VO2maxoutput = `${VO2maxResult.toFixed(1)} mL/(kg*min)`
    }

    // Addition of HRR data
    let hrrAdittion = ''
    if (postExerciseHR.length > 1 && (postExerciseHR[0] > (0.7 * config.userSettings.maxHR))) {
      // Recovery Heartrate is only defined when the last excercise HR is above 70% of the maximum Heartrate
      if (postExerciseHR.length === 2) {
        hrrAdittion = `, HRR1: ${postExerciseHR[1] - postExerciseHR[0]} (${postExerciseHR[1]} BPM)`
      }
      if (postExerciseHR.length === 3) {
        hrrAdittion = `, HRR1: ${postExerciseHR[1] - postExerciseHR[0]} (${postExerciseHR[1]} BPM), HRR2: ${postExerciseHR[2] - postExerciseHR[0]} (${postExerciseHR[2]} BPM)`
      }
      if (postExerciseHR.length >= 4) {
        hrrAdittion = `, HRR1: ${postExerciseHR[1] - postExerciseHR[0]} (${postExerciseHR[1]} BPM), HRR2: ${postExerciseHR[2] - postExerciseHR[0]} (${postExerciseHR[2]} BPM), HRR3: ${postExerciseHR[3] - postExerciseHR[0]} (${postExerciseHR[3]} BPM)`
      }
    }
    const tcxData = `      <Notes>Indoor Rowing, Drag factor: ${drag.average().toFixed(1)} 10-6 N*m*s2, Estimated VO2Max: ${VO2maxoutput}${hrrAdittion}</Notes>\n`
    return tcxData
  }

  async function createAuthor () {
    let versionArray = process.env.npm_package_version.split('.')
    if (versionArray.length < 3) versionArray = ['0', '0', '0']
    let tcxData = []
    tcxData += '  <Author xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="Application_t">\n'
    tcxData += '    <Name>Open Rowing Monitor</Name>\n'
    tcxData += '    <Build>\n'
    tcxData += '      <Version>\n'
    tcxData += `        <VersionMajor>${versionArray[0]}</VersionMajor>\n`
    tcxData += `        <VersionMinor>${versionArray[1]}</VersionMinor>\n`
    tcxData += `        <BuildMajor>${versionArray[2]}</BuildMajor>\n`
    tcxData += '        <BuildMinor>0</BuildMinor>\n'
    tcxData += '      </Version>\n'
    tcxData += '      <LangID>en</LangID>\n'
    tcxData += '      <PartNumber>OPE-NROWI-NG</PartNumber>\n'
    tcxData += '    </Build>\n'
    tcxData += '  </Author>\n'
    return tcxData
  }

  async function createFile (content, filename, compress = false) {
    if (compress) {
      const gzipContent = await gzip(content)
      try {
        await fs.writeFile(filename, gzipContent)
      } catch (err) {
        log.error(err)
      }
    } else {
      try {
        await fs.writeFile(filename, content)
      } catch (err) {
        log.error(err)
      }
    }
  }

  function measureRecoveryHR () {
    // This function is called when the rowing session is stopped. postExerciseHR[0] is the last measured excercise HR
    // Thus postExerciseHR[1] is Recovery HR after 1 min, etc..
    if (heartRate !== undefined && config.userSettings.restingHR <= heartRate && heartRate <= config.userSettings.maxHR) {
      log.debug(`*** HRR-${postExerciseHR.length}: ${heartRate}`)
      postExerciseHR.push(heartRate)
      if ((postExerciseHR.length > 1) && (postExerciseHR.length <= 4)) {
        // We skip reporting postExerciseHR[0] and only report measuring postExerciseHR[1], postExerciseHR[2], postExerciseHR[3]
        allDataHasBeenWritten = false
        createTcxFile()
      }
      if (postExerciseHR.length < 4) {
        // We haven't got three post-exercise HR measurements yet, let's schedule the next measurement
        setTimeout(measureRecoveryHR, 60000)
      } else {
        log.debug('*** Skipped HRR measurement')
      }
    }
  }

  function minimumRecordingTimeHasPassed () {
    const minimumRecordingTimeInSeconds = 10
    const noLaps = sessionData.lap.length
    if (sessionData.lap[noLaps - 1].strokes.length > 0) {
      const strokeTimeTotal = sessionData.lap[noLaps - 1].strokes[sessionData.lap[noLaps - 1].strokes.length - 1].totalMovingTime
      return (strokeTimeTotal > minimumRecordingTimeInSeconds)
    } else {
      return (false)
    }
  }

  function minimumNumberOfStrokesHaveCompleted () {
    const minimumNumberOfStrokes = 2
    const noLaps = sessionData.lap.length
    if (sessionData.lap[noLaps - 1].strokes.length > 0) {
      const noStrokes = sessionData.lap[noLaps - 1].strokes[sessionData.lap[noLaps - 1].strokes.length - 1].totalNumberOfStrokes
      return (noStrokes > minimumNumberOfStrokes)
    } else {
      return (false)
    }
  }

  return {
    handleCommand,
    setBaseFileName,
    recordRowingMetrics,
    recordHeartRate,
    activeWorkoutToTcx
  }
}
