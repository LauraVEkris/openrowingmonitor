'use strict'
/*
  Open Rowing Monitor, https://github.com/JaapvanEkris/openrowingmonitor

  This Module captures the metrics of a rowing session and persists them in the fit format.
*/
import log from 'loglevel'
import zlib from 'zlib'
import fs from 'fs/promises'
import { createSeries } from '../engine/utils/Series.js'
import { promisify } from 'util'
import { FitWriter } from '@markw65/fit-file-writer'

const gzip = promisify(zlib.gzip)

export function createFITRecorder (config) {
  const lapPowerSeries = createSeries()
  const lapSpeedSeries = createSeries()
  const lapStrokerateSeries = createSeries()
  const lapStrokedistanceSeries = createSeries()
  const lapHeartrateSeries = createSeries()
  const sessionPowerSeries = createSeries()
  const sessionSpeedSeries = createSeries()
  const sessionStrokerateSeries = createSeries()
  const sessionStrokedistanceSeries = createSeries()
  const sessionHeartrateSeries = createSeries()
  let filename
  let heartRate = 0
  let sessionData
  let lapnumber = 0
  let lastMetrics
  let allDataHasBeenWritten

  // This function handles all incomming commands. Here, the recordingmanager will have filtered
  // all unneccessary commands for us, so we only need to react to 'reset' and 'shutdown'
  async function handleCommand (commandName) {
    switch (commandName) {
      case ('reset'):
        if (lastMetrics.totalMovingTime > sessionData.lap[lapnumber].strokes[sessionData.lap[lapnumber].strokes.length - 1].totalMovingTime) {
          updateLapAndSessionMetrics(lastMetrics)
          addMetricsToStrokesArray(lastMetrics)
        }
        await createFitFile()
        heartRate = 0
        lapnumber = 0
        resetSessionMetrics()
        resetLapMetrics()
        sessionData = null
        break
      case 'shutdown':
        if (lastMetrics.totalMovingTime > sessionData.lap[lapnumber].strokes[sessionData.lap[lapnumber].strokes.length - 1].totalMovingTime) {
          updateLapAndSessionMetrics(lastMetrics)
          addMetricsToStrokesArray(lastMetrics)
        }
        await createFitFile()
        break
      default:
        log.error(`fitRecorder: Recieved unknown command: ${commandName}`)
    }
  }

  function setBaseFileName (baseFileName) {
    filename = `${baseFileName}_rowing.fit`
    log.info(`Garmin fit-file will be saved as ${filename} (after the session)`)
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
        startLap(lapnumber, currentTime)
        addMetricsToStrokesArray(metrics)
        break
      case (metrics.metricsContext.isSessionStop):
        updateLapAndSessionMetrics(metrics)
        addMetricsToStrokesArray(metrics)
        calculateLapMetrics(metrics)
        calculateSessionMetrics(metrics)
        createFitFile()
        break
      case (metrics.metricsContext.isPauseStart):
        updateLapAndSessionMetrics(metrics)
        addMetricsToStrokesArray(metrics)
        calculateLapMetrics(metrics)
        calculateSessionMetrics(metrics)
        resetLapMetrics()
        createFitFile()
        break
      case (metrics.metricsContext.isPauseEnd):
        lapnumber++
        startLap(lapnumber, currentTime)
        addMetricsToStrokesArray(metrics)
        break
      case (metrics.metricsContext.isIntervalStart):
        // Please note: we deliberatly add the metrics twice as it marks both the end of the old interval and the start of a new one
        updateLapAndSessionMetrics(metrics)
        intervalEndMetrics = { ...metrics }
        intervalEndMetrics.intervalAndPauseMovingTime = metrics.totalMovingTime - sessionData.lap[lapnumber].strokes[0].totalMovingTime
        addMetricsToStrokesArray(intervalEndMetrics)
        calculateLapMetrics(metrics)
        calculateSessionMetrics(metrics)
        resetLapMetrics()
        lapnumber++
        // We need to calculate the start time of the interval, as delay in message handling can cause weird effects here
        startTime = new Date(sessionData.lap[lapnumber - 1].startTime.getTime() + intervalEndMetrics.intervalAndPauseMovingTime * 1000)
        startLap(lapnumber, startTime)
        addMetricsToStrokesArray(metrics)
        break
      case (metrics.metricsContext.isDriveStart):
        updateLapAndSessionMetrics(metrics)
        addMetricsToStrokesArray(metrics)
        break
    }
    lastMetrics = metrics
  }

  function startLap (lapnumber, startTime) {
    sessionData.lap[lapnumber] = { startTime }
    sessionData.lap[lapnumber].lapNumber = lapnumber + 1
    sessionData.lap[lapnumber].strokes = []
  }

  function addMetricsToStrokesArray (metrics) {
    addHeartRateToMetrics(metrics)
    sessionData.lap[lapnumber].strokes.push(metrics)
    allDataHasBeenWritten = false
  }

  function updateLapAndSessionMetrics (metrics) {
    if (metrics.cyclePower !== undefined && metrics.cyclePower > 0) {
      lapPowerSeries.push(metrics.cyclePower)
      sessionPowerSeries.push(metrics.cyclePower)
    }
    if (metrics.cycleLinearVelocity !== undefined && metrics.cycleLinearVelocity > 0) {
      lapSpeedSeries.push(metrics.cycleLinearVelocity)
      sessionSpeedSeries.push(metrics.cycleLinearVelocity)
    }
    if (metrics.cycleStrokeRate !== undefined && metrics.cycleStrokeRate > 0) {
      lapStrokerateSeries.push(metrics.cycleStrokeRate)
      sessionStrokerateSeries.push(metrics.cycleStrokeRate)
    }
    if (metrics.cycleDistance !== undefined && metrics.cycleDistance > 0) {
      lapStrokedistanceSeries.push(metrics.cycleDistance)
      sessionStrokedistanceSeries.push(metrics.cycleDistance)
    }
    if (heartRate !== undefined && heartRate > 0) {
      lapHeartrateSeries.push(heartRate)
      sessionHeartrateSeries.push(heartRate)
    }
  }

  function calculateSessionMetrics (metrics) {
    sessionData.totalNoLaps = lapnumber + 1
    sessionData.totalMovingTime = metrics.totalMovingTime
    sessionData.totalLinearDistance = metrics.totalLinearDistance
    sessionData.totalNumberOfStrokes = metrics.totalNumberOfStrokes
    sessionData.endTime = new Date(sessionData.lap[lapnumber].startTime.getTime() + sessionData.lap[lapnumber].totalMovingTime * 1000)
  }

  function resetSessionMetrics () {
    sessionPowerSeries.reset()
    sessionSpeedSeries.reset()
    sessionStrokerateSeries.reset()
    sessionStrokedistanceSeries.reset()
    sessionHeartrateSeries.reset()
  }

  function calculateLapMetrics (metrics) {
    sessionData.lap[lapnumber].totalMovingTime = metrics.totalMovingTime - sessionData.lap[lapnumber].strokes[0].totalMovingTime
    sessionData.lap[lapnumber].totalLinearDistance = metrics.totalLinearDistance - sessionData.lap[lapnumber].strokes[0].totalLinearDistance
    sessionData.lap[lapnumber].totalCalories = metrics.totalCalories - sessionData.lap[lapnumber].strokes[0].totalCalories
    sessionData.lap[lapnumber].numberOfStrokes = sessionData.lap[lapnumber].strokes.length
    sessionData.lap[lapnumber].averageStrokeRate = lapStrokerateSeries.average()
    sessionData.lap[lapnumber].maximumStrokeRate = lapStrokerateSeries.maximum()
    sessionData.lap[lapnumber].averageStrokeDistance = lapStrokedistanceSeries.average()
    sessionData.lap[lapnumber].maximumStrokeDistance = lapStrokedistanceSeries.maximum()
    sessionData.lap[lapnumber].averagePower = lapPowerSeries.average()
    sessionData.lap[lapnumber].maximumPower = lapPowerSeries.maximum()
    sessionData.lap[lapnumber].averageSpeed = lapSpeedSeries.average()
    sessionData.lap[lapnumber].maximumSpeed = lapSpeedSeries.maximum()
    sessionData.lap[lapnumber].averageHeartrate = lapHeartrateSeries.average()
    sessionData.lap[lapnumber].maximumHeartrate = lapHeartrateSeries.maximum()
  }

  function resetLapMetrics () {
    lapPowerSeries.reset()
    lapSpeedSeries.reset()
    lapStrokerateSeries.reset()
    lapStrokedistanceSeries.reset()
    lapHeartrateSeries.reset()
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

  async function createFitFile () {
    // Do not write again if not needed
    if (allDataHasBeenWritten) return

    // we need at least two strokes and ten seconds to generate a valid FIT file
    if (!minimumNumberOfStrokesHaveCompleted() || !minimumRecordingTimeHasPassed()) {
      log.info('fit file has not been written, as there were not enough strokes recorded (minimum 10 seconds and two strokes)')
      return
    }

    const fitRecord = await workoutToFit(sessionData)
    if (fitRecord === undefined) {
      log.error('error creating fit file')
      return
    }
    await createFile(fitRecord, `${filename}`, config.gzipFitFiles)
    allDataHasBeenWritten = true
    log.info(`Garmin fit data has been written as ${filename}`)
  }

  async function workoutToFit (workout) {
    const fitWriter = new FitWriter()
    const versionNumber = parseInt(process.env.npm_package_version, 10)

    fitWriter.writeMessage(
      'file_id',
      {
        type: 'activity',
        manufacturer: 'garmin',
        product: 3943,
        time_created: fitWriter.time(workout.startTime)
      },
      null,
      true
    )

    fitWriter.writeMessage(
      'file_creator',
      {
        software_version: versionNumber
      },
      null,
      true
    )

    fitWriter.writeMessage(
      'device_info',
      {
        timestamp: fitWriter.time(workout.startTime),
        device_type: 'fitness_equipment',
        manufacturer: 'concept2',
        product: 8449
      },
      null,
      true
    )

    fitWriter.writeMessage(
      'event',
      {
        timestamp: fitWriter.time(workout.startTime),
        event: 'timer',
        event_type: 'start',
        event_group: 0
      },
      null,
      true
    )

    await createActivity(fitWriter, workout)

    fitWriter.writeMessage(
      'event',
      {
        timestamp: fitWriter.time(workout.endTime),
        event: 'timer',
        event_type: 'stop_all',
        event_group: 0
      },
      null,
      true
    )
    return fitWriter.finish()
  }

  async function createActivity (writer, workout) {
    writer.writeMessage(
      'sport',
      {
        sport: 'rowing',
        sub_sport: 'indoor_rowing',
        name: 'Row Indoor'
      },
      null,
      true
    )

    writer.writeMessage(
      'activity',
      {
        timestamp: writer.time(workout.startTime),
        local_timestamp: writer.time(workout.startTime) - workout.startTime.getTimezoneOffset() * 60,
        total_timer_time: workout.totalMovingTime,
        num_sessions: 1,
        type: 'manual'
      },
      null,
      true
    )

    writer.writeMessage(
      'session',
      {
        timestamp: writer.time(workout.endTime),
        message_index: 0,
        sport: 'rowing',
        sub_sport: 'indoor_rowing',
        start_time: writer.time(workout.startTime),
        total_elapsed_time: Math.abs(workout.endTime - workout.startTime) / 1000,
        total_moving_time: workout.totalMovingTime,
        total_distance: workout.totalLinearDistance,
        stroke_count: workout.totalNumberOfStrokes,
        avg_speed: sessionSpeedSeries.average(),
        max_speed: sessionSpeedSeries.maximum(),
        avg_power: sessionPowerSeries.average(),
        max_power: sessionPowerSeries.maximum(),
        avg_cadence: sessionStrokerateSeries.average(),
        max_cadence: sessionStrokerateSeries.maximum(),
        ...(sessionHeartrateSeries.minimum() > 0 ? { min_heart_rate: sessionHeartrateSeries.minimum() } : {}),
        ...(sessionHeartrateSeries.average() > 0 ? { avg_heart_rate: sessionHeartrateSeries.average() } : {}),
        ...(sessionHeartrateSeries.maximum() > 0 ? { max_heart_rate: sessionHeartrateSeries.maximum() } : {}),
        avg_stroke_distance: sessionStrokedistanceSeries.average(),
        num_laps: sessionData.totalNoLaps,
        first_lap_index: 0
      },
      null,
      true
    )

    // Write all laps
    let i = 0
    while (i < workout.lap.length) {
      await createLap(writer, workout.lap[i])
      i++
    }
  }

  async function createLap (writer, lapdata) {
    // Add the strokes
    let i = 0
    while (i < lapdata.strokes.length) {
      await createTrackPoint(writer, lapdata.startTime, lapdata.strokes[i])
      i++
    }

    writer.writeMessage(
      'lap',
      {
        timestamp: writer.time(lapdata.startTime),
        message_index: lapdata.lapNumber - 1,
        sport: 'rowing',
        sub_sport: 'indoor_rowing',
        start_time: writer.time(lapdata.startTime),
        total_elapsed_time: lapdata.totalMovingTime,
        total_timer_time: lapdata.totalMovingTime,
        total_distance: lapdata.totalLinearDistance,
        total_cycles: lapdata.numberOfStrokes,
        avg_cadence: lapdata.averageStrokeRate,
        max_cadence: lapdata.maximumStrokeRate,
        avg_stroke_distance: lapdata.averageStrokeDistance,
        total_calories: lapdata.totalCalories,
        avg_speed: lapdata.averageSpeed,
        max_speed: lapdata.maximumSpeed,
        avg_power: lapdata.averagePower,
        max_power: lapdata.maximumPower,
        ...(lapdata.averageHeartrate > 0 ? { avg_heart_rate: lapdata.averageHeartrate } : {}),
        ...(lapdata.maximumHeartrate > 0 ? { max_heart_rate: lapdata.maximumHeartrate } : {})
      },
      null,
      sessionData.totalNoLaps === lapdata.lapNumber
    )
  }

  async function createTrackPoint (writer, offset, trackpoint) {
    writer.writeMessage(
      'record',
      {
        timestamp: writer.time(offset.getTime() + trackpoint.intervalAndPauseMovingTime * 1000),
        distance: trackpoint.totalLinearDistance,
        ...(trackpoint.cycleLinearVelocity > 0 || trackpoint.metricsContext.isPauseStart ? { speed: trackpoint.cycleLinearVelocity } : {}),
        ...(trackpoint.cyclePower > 0 || trackpoint.metricsContext.isPauseStart ? { power: trackpoint.cyclePower } : {}),
        ...(trackpoint.cycleStrokeRate > 0 ? {  cadence: trackpoint.cycleStrokeRate } : {}),
        ...(trackpoint.cycleDistance > 0 ? {cycle_length16: trackpoint.cycleDistance } : {}),
        ...(trackpoint.dragFactor > 0 || trackpoint.dragFactor < 255 ? { resistance: trackpoint.dragFactor } : {}), // As the data is stored in an int8, we need to guard the maximum
        ...(trackpoint.heartrate !== undefined && trackpoint.heartrate > 0 ? { heart_rate: trackpoint.heartrate } : {})
      }
    )
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
    recordHeartRate
  }
}
