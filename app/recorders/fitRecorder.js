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
  let sessionData = {}
  sessionData.workoutplan = []
  sessionData.strokes = []
  sessionData.lap = []
  let lapnumber = 0
  let lastMetrics
  let allDataHasBeenWritten

  // This function handles all incomming commands. Here, the recordingmanager will have filtered
  // all unneccessary commands for us, so we only need to react to 'updateIntervalSettings', 'reset' and 'shutdown'
  async function handleCommand (commandName, data, client) {
    switch (commandName) {
      case ('updateIntervalSettings'):
        setIntervalParameters(data)
        break
      case ('reset'):
        if (lastMetrics.metricsContext.isMoving && lastMetrics.totalMovingTime > sessionData.strokes[sessionData.strokes.length - 1].totalMovingTime) {
          // We apperantly get a reset during session
          updateLapMetrics(lastMetrics)
          updateSessionMetrics(lastMetrics)
          addMetricsToStrokesArray(lastMetrics)
        }
        await createFitFile()
        heartRate = 0
        lapnumber = 0
        resetSessionMetrics()
        resetLapMetrics()
        sessionData = null
        sessionData = {}
        break
      case 'shutdown':
        if (lastMetrics.metricsContext.isMoving && lastMetrics.totalMovingTime > sessionData.strokes[sessionData.strokes.length - 1].totalMovingTime) {
          // We apperantly get a shutdown/crash during session
          updateLapMetrics(lastMetrics)
          updateSessionMetrics(lastMetrics)
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

  function setIntervalParameters (intervalParameters) {
    if (intervalParameters === undefined || intervalParameters.length === 0) { return }

    let i = 0
    while (i < intervalParameters.length) {
      sessionData.workoutplan[i] = { intervalnumber: i }
      switch (true) {
        case (intervalParameters[i].targetDistance > 0):
          // A target distance is set
          sessionData.workoutplan[i].type = 'distance'
          sessionData.workoutplan[i].targetTime = 0
          sessionData.workoutplan[i].targetDistance = intervalParameters[i].targetDistance
          break
        case (intervalParameters[i].targetTime > 0):
          // A target time is set
          sessionData.workoutplan[i].type = 'time'
          sessionData.workoutplan[i].targetTime = intervalParameters[i].targetTime
          sessionData.workoutplan[i].targetDistance = 0
          break
        default:
          sessionData.workoutplan[i].type = 'open'
          sessionData.workoutplan[i].targetTime = 0
          sessionData.workoutplan[i].targetDistance = 0
      }
      i++
    }
  }

  function recordRowingMetrics (metrics) {
    const currentTime = new Date()
    let startTime

    switch (true) {
      case (metrics.metricsContext.isSessionStart):
        sessionData.startTime = currentTime
        lapnumber = 0
        startLap(lapnumber, metrics, currentTime)
        addMetricsToStrokesArray(metrics)
        break
      case (metrics.metricsContext.isSessionStop):
        updateLapMetrics(metrics)
        updateSessionMetrics(metrics)
        addMetricsToStrokesArray(metrics)
        calculateLapMetrics(metrics)
        calculateSessionMetrics(metrics)
        createFitFile()
        break
      case (metrics.metricsContext.isPauseStart):
        updateLapMetrics(metrics)
        updateSessionMetrics(metrics)
        addMetricsToStrokesArray(metrics)
        calculateLapMetrics(metrics)
        calculateSessionMetrics(metrics)
        resetLapMetrics()
        createFitFile()
        break
      case (metrics.metricsContext.isPauseEnd):
        lapnumber++
        startLap(lapnumber, metrics, currentTime)
        addMetricsToStrokesArray(metrics)
        break
      case (metrics.metricsContext.isIntervalStart || metrics.metricsContext.isSplitEnd):
        if (metrics.metricsContext.isDriveStart) { addMetricsToStrokesArray(metrics) }
        updateLapMetrics(metrics)
        updateSessionMetrics(metrics)
        calculateLapMetrics(metrics)
        calculateSessionMetrics(metrics)
        resetLapMetrics()
        lapnumber++
        startTime = sessionData.lap[lapnumber - 1].endTime
        startLap(lapnumber, metrics, startTime)
        updateLapMetrics(metrics)
        break
      case (metrics.metricsContext.isDriveStart):
        updateLapMetrics(metrics)
        updateSessionMetrics(metrics)
        addMetricsToStrokesArray(metrics)
        break
    }
    lastMetrics = metrics
  }

  function addMetricsToStrokesArray (metrics) {
    addHeartRateToMetrics(metrics)
    metrics.timeStamp = new Date(sessionData.lap[lapnumber].startTime.getTime() + (metrics.totalMovingTime - sessionData.lap[lapnumber].totalMovingTimeAtStart) * 1000)
    sessionData.strokes.push(metrics)
    allDataHasBeenWritten = false
  }

  function startLap (lapnumber, metrics, startTime) {
    sessionData.lap[lapnumber] = { totalMovingTimeAtStart: metrics.totalMovingTime }
    sessionData.lap[lapnumber].totalLinearDistanceAtStart = metrics.totalLinearDistance
    sessionData.lap[lapnumber].totalCaloriesAtStart = metrics.totalCalories
    sessionData.lap[lapnumber].totalNumberOfStrokesAtStart = metrics.totalNumberOfStrokes
    sessionData.lap[lapnumber].startTime = startTime
    sessionData.lap[lapnumber].lapNumber = lapnumber + 1
  }

  function updateLapMetrics (metrics) {
    if (metrics.cyclePower !== undefined && metrics.cyclePower > 0) { lapPowerSeries.push(metrics.cyclePower) }
    if (metrics.cycleLinearVelocity !== undefined && metrics.cycleLinearVelocity > 0) { lapSpeedSeries.push(metrics.cycleLinearVelocity) }
    if (metrics.cycleStrokeRate !== undefined && metrics.cycleStrokeRate > 0) { lapStrokerateSeries.push(metrics.cycleStrokeRate) }
    if (metrics.cycleDistance !== undefined && metrics.cycleDistance > 0) { lapStrokedistanceSeries.push(metrics.cycleDistance) }
    if (heartRate !== undefined && heartRate > 0) { lapHeartrateSeries.push(heartRate) }
  }

  function calculateLapMetrics (metrics) {
    // We need to calculate the end time of the interval based on the time passed in the interval, as delay in message handling can cause weird effects here
    sessionData.lap[lapnumber].totalMovingTime = metrics.totalMovingTime - sessionData.lap[lapnumber].totalMovingTimeAtStart
    sessionData.lap[lapnumber].endTime = new Date(sessionData.lap[lapnumber].startTime.getTime() + sessionData.lap[lapnumber].totalMovingTime * 1000)
    sessionData.lap[lapnumber].totalLinearDistance = metrics.totalLinearDistance - sessionData.lap[lapnumber].totalLinearDistanceAtStart
    sessionData.lap[lapnumber].totalCalories = metrics.totalCalories - sessionData.lap[lapnumber].totalCaloriesAtStart
    sessionData.lap[lapnumber].numberOfStrokes = metrics.totalNumberOfStrokes - sessionData.lap[lapnumber].totalNumberOfStrokesAtStart
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

  function updateSessionMetrics (metrics) {
    if (metrics.cyclePower !== undefined && metrics.cyclePower > 0) { sessionPowerSeries.push(metrics.cyclePower) }
    if (metrics.cycleLinearVelocity !== undefined && metrics.cycleLinearVelocity > 0) { sessionSpeedSeries.push(metrics.cycleLinearVelocity) }
    if (metrics.cycleStrokeRate !== undefined && metrics.cycleStrokeRate > 0) { sessionStrokerateSeries.push(metrics.cycleStrokeRate) }
    if (metrics.cycleDistance !== undefined && metrics.cycleDistance > 0) { sessionStrokedistanceSeries.push(metrics.cycleDistance) }
    if (heartRate !== undefined && heartRate > 0) { sessionHeartrateSeries.push(heartRate) }
  }

  function calculateSessionMetrics (metrics) {
    sessionData.totalNoLaps = lapnumber + 1
    sessionData.totalMovingTime = metrics.totalMovingTime
    sessionData.totalLinearDistance = metrics.totalLinearDistance
    sessionData.totalNumberOfStrokes = metrics.totalNumberOfStrokes
    sessionData.endTime = sessionData.lap[lapnumber].endTime
  }

  function resetSessionMetrics () {
    sessionPowerSeries.reset()
    sessionSpeedSeries.reset()
    sessionStrokerateSeries.reset()
    sessionStrokedistanceSeries.reset()
    sessionHeartrateSeries.reset()
  }

  // initiated when a new heart rate value is received from heart rate sensor
  async function recordHeartRate (value) {
    heartRate = value.heartrate
  }

  function addHeartRateToMetrics (metrics) {
    if (heartRate !== undefined && heartRate > 0) {
      metrics.heartrate = heartRate
    } else {
      metrics.heartrate = undefined
    }
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
        time_created: fitWriter.time(workout.startTime),
        type: 'activity',
        manufacturer: 'concept2',
        product: 0,
        number: 0
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
        device_index: 0,
        device_type: 0,
        manufacturer: 'concept2'
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

    await createWorkoutSteps(fitWriter, workout)

    fitWriter.writeMessage(
      'split',
      {
        start_time: fitWriter.time(workout.startTime),
        split_type: 'intervalActive',
        total_elapsed_time: Math.abs(workout.endTime - workout.startTime) / 1000,
        total_moving_time: workout.totalMovingTime,
        total_timer_time: workout.totalMovingTime,
        total_distance: workout.totalLinearDistance,
        avg_speed: sessionSpeedSeries.average(),
        max_speed: sessionSpeedSeries.maximum(),
        end_time: fitWriter.time(workout.endTime)
      },
      null,
      true
    )

    fitWriter.writeMessage(
      'event',
      {
        timestamp: fitWriter.time(workout.endTime),
        event: 'timer',
        event_type: 'stopAll',
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
        sub_sport: 'indoorRowing',
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
        event: 'activity',
        event_type: 'stop',
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
        sub_sport: 'indoorRowing',
        event: 'session',
        event_type: 'stop',
        trigger: 'activityEnd',
        start_time: writer.time(workout.startTime),
        total_elapsed_time: Math.abs(workout.endTime - workout.startTime) / 1000,
        total_moving_time: workout.totalMovingTime,
        total_distance: workout.totalLinearDistance,
        total_cycles: workout.totalNumberOfStrokes,
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

    // Write all records
    i = 0
    while (i < workout.strokes.length) {
      await createTrackPoint(writer, workout.strokes[i])
      i++
    }
  }

  async function createLap (writer, lapdata) {
    writer.writeMessage(
      'lap',
      {
        timestamp: writer.time(lapdata.startTime),
        message_index: lapdata.lapNumber - 1,
        sport: 'rowing',
        sub_sport: 'indoorRowing',
        event: 'lap',
        event_type: 'stop',
        intensity: 'active',
        ...(sessionData.totalNoLaps === lapdata.lapNumber ? { lap_trigger: 'sessionEnd' } : { lap_trigger: 'fitnessEquipment' }),
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

  async function createTrackPoint (writer, trackpoint) {
    writer.writeMessage(
      'record',
      {
        timestamp: writer.time(trackpoint.timeStamp),
        distance: trackpoint.totalLinearDistance,
        total_cycles: trackpoint.totalNumberOfStrokes,
        activity_type: 'fitnessEquipment',
        ...(trackpoint.cycleLinearVelocity > 0 || trackpoint.metricsContext.isPauseStart ? { speed: trackpoint.cycleLinearVelocity } : {}),
        ...(trackpoint.cyclePower > 0 || trackpoint.metricsContext.isPauseStart ? { power: trackpoint.cyclePower } : {}),
        ...(trackpoint.cycleStrokeRate > 0 ? { cadence: trackpoint.cycleStrokeRate } : {}),
        ...(trackpoint.cycleDistance > 0 ? { cycle_length16: trackpoint.cycleDistance } : {}),
        ...(trackpoint.dragFactor > 0 || trackpoint.dragFactor < 255 ? { resistance: trackpoint.dragFactor } : {}), // As the data is stored in an int8, we need to guard the maximum
        ...(trackpoint.heartrate !== undefined && trackpoint.heartrate > 0 ? { heart_rate: trackpoint.heartrate } : {})
      }
    )
  }

  async function createWorkoutSteps (writer, workout) {
    writer.writeMessage(
      'workout',
      {
        sport: 'rowing',
        sub_sport: 'indoorRowing',
        capabilities: 'fitnessEquipment',
        num_valid_steps: workout.workoutplan.length,
        wkt_name: `Indoor rowing ${workout.totalLinearDistance / 1000}K`
      },
      null,
      true
    )

    let i = 0
    while (i < workout.workoutplan.length) {
      switch (workout.workoutplan[i].type) {
        case ('distance'):
          // A target distance is set
          writer.writeMessage(
            'workout_step',
            {
              message_index: i,
              duration_type: 'distance',
              duration_value: workout.workoutplan[i].targetDistance,
              intensity: 'active'
            },
            null,
            true
          )
          break
        case ('time'):
          // A target time is set
          writer.writeMessage(
            'workout_step',
            {
              message_index: i,
              duration_type: 'time',
              duration_value: workout.workoutplan[i].targetTime,
              intensity: 'active'
            },
            null,
            true
          )
          break
        case ('open'):
          // A target time is set
          writer.writeMessage(
            'workout_step',
            {
              message_index: i,
              duration_type: 'open',
              intensity: 'active'
            },
            null,
            true
          )
          break
        default:
          // Nothing to do here
      }
      i++
    }
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
    const strokeTimeTotal = sessionData.strokes[sessionData.strokes.length - 1].totalMovingTime
    return (strokeTimeTotal > minimumRecordingTimeInSeconds)
  }

  function minimumNumberOfStrokesHaveCompleted () {
    const minimumNumberOfStrokes = 2
    const noStrokes = sessionData.strokes.length
    return (noStrokes > minimumNumberOfStrokes)
  }

  return {
    handleCommand,
    setBaseFileName,
    setIntervalParameters,
    recordRowingMetrics,
    recordHeartRate
  }
}
