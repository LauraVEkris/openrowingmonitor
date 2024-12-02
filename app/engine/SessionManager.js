'use strict'
/*
  Open Rowing Monitor, https://github.com/JaapvanEkris/openrowingmonitor

  This Module calculates the training specific metrics.
*/
import { EventEmitter } from 'events'
import { createRowingStatistics } from './RowingStatistics.js'
import { createWorkoutSegment } from './utils/workoutSegment.js'
import { createOLSLinearSeries } from './utils/OLSLinearSeries.js'
import { secondsToTimeString } from '../tools/Helper.js'

import loglevel from 'loglevel'
const log = loglevel.getLogger('RowingEngine')

export function createSessionManager (config) {
  const numOfDataPointsForAveraging = config.numOfPhasesForAveragingScreenData
  const emitter = new EventEmitter()
  const rowingStatistics = createRowingStatistics(config)
  let metrics
  let lastBroadcastedMetrics = {}
  let watchdogTimer
  const watchdogTimout = 1000 * config.rowerSettings.maximumStrokeTimeBeforePause // Pause timeout in miliseconds
  let sessionState = 'WaitingForStart'
  let lastSessionState = 'WaitingForStart'
  let intervalSettings = []
  let currentIntervalNumber = -1
  const interval = createWorkoutSegment()
  let noSpontaneousPauses = 0
  const intervalAndPause = createWorkoutSegment()
  const split = createWorkoutSegment()
  let splitNumber = 0
  const distanceOverTime = createOLSLinearSeries(Math.min(4, numOfDataPointsForAveraging))

  metrics = rowingStatistics.getMetrics()
  resetMetricsSessionContext(metrics)
  interval.setStart(metrics)
  intervalAndPause.setStart(metrics)
  split.setStart(metrics)
  emitMetrics(metrics)

  // This function handles all incomming commands. As all commands are broadasted to all application parts,
  // we need to filter here what the RowingEngine will react to and what it will ignore
  function handleCommand (commandName, data, client) {
    metrics = rowingStatistics.getMetrics()
    resetMetricsSessionContext(metrics)
    switch (commandName) {
      case ('updateIntervalSettings'):
        setIntervalParameters(data)
        break
      case ('start'):
        if (sessionState !== 'Rowing') {
          allowStartOrResumeTraining(metrics)
          sessionState = 'WaitingForStart'
        }
        break
      case ('startOrResume'):
        if (sessionState !== 'Rowing') {
          allowStartOrResumeTraining(metrics)
          sessionState = 'WaitingForStart'
        }
        break
      case ('pause'):
        pauseTraining()
        metrics = rowingStatistics.getMetrics() // as the pause button is forced, we need to fetch the zero'ed metrics
        metrics.metricsContext.isPauseStart = true
        sessionState = 'Paused'
        break
      case ('stop'):
        stopTraining()
        metrics.metricsContext.isSessionStop = true
        sessionState = 'Stopped'
        break
      case ('requestControl'):
        break
      case ('reset'):
        resetTraining()
        metrics.metricsContext.isPauseStart = true
        sessionState = 'WaitingForStart'
        break
      case 'switchBlePeripheralMode':
        break
      case 'switchAntPeripheralMode':
        break
      case 'switchHrmMode':
        break
      case 'refreshPeripheralConfig':
        break
      case 'authorizeStrava':
        break
      case 'uploadTraining':
        break
      case 'stravaAuthorizationCode':
        break
      case 'shutdown':
        stopTraining()
        metrics.metricsContext.isSessionStop = true
        sessionState = 'Stopped'
        break
      default:
        log.error(`Recieved unknown command: ${commandName}`)
    }
    emitMetrics(metrics)
    lastSessionState = sessionState
  }

  function allowStartOrResumeTraining (metrics) {
    rowingStatistics.allowStartOrResumeTraining()
    intervalAndPause.setStart(metrics)
    split.setStart(metrics)
    split.setEnd(interval.splitDistance(), 0)
  }

  function stopTraining () {
    clearTimeout(watchdogTimer)
    distanceOverTime.push(metrics.totalMovingTime, metrics.totalLinearDistance)
    rowingStatistics.stopTraining()
  }

  // clear the metrics in case the user pauses rowing
  function pauseTraining () {
    clearTimeout(watchdogTimer)
    distanceOverTime.push(metrics.totalMovingTime, metrics.totalLinearDistance)
    rowingStatistics.pauseTraining()
    noSpontaneousPauses++
  }

  function resetTraining () {
    stopTraining()
    rowingStatistics.resetTraining()
    rowingStatistics.allowResumeTraining()
    metrics = rowingStatistics.getMetrics()
    intervalSettings = null
    intervalSettings = []
    noSpontaneousPauses = 0
    currentIntervalNumber = -1
    splitNumber = 0
    distanceOverTime.reset()
    resetMetricsSessionContext(metrics)
    sessionState = 'WaitingForStart'
    lastSessionState = 'WaitingForStart'
    resetMetricsSessionContext(metrics)
    interval.setStart(metrics)
    intervalAndPause.setStart(metrics)
    split.setStart(metrics)
    emitMetrics(metrics)
  }

  function handleRotationImpulse (currentDt) {
    let temporaryDatapoint

    // Clear the watchdog as we got a currentDt, we'll set it at the end again
    clearTimeout(watchdogTimer)

    // Provide the rower with new data
    metrics = rowingStatistics.handleRotationImpulse(currentDt)
    resetMetricsSessionContext(metrics)

    if (metrics.metricsContext.isMoving && (metrics.metricsContext.isDriveStart || metrics.metricsContext.isRecoveryStart)) {
      distanceOverTime.push(metrics.totalMovingTime, metrics.totalLinearDistance)
    }

    // This is the core of the finite state machine that defines all state transitions
    switch (true) {
      case (lastSessionState === 'WaitingForStart' && metrics.strokeState === 'Drive'):
        allowStartOrResumeTraining(metrics)
        sessionState = 'Rowing'
        metrics.metricsContext.isIntervalStart = true
        metrics.metricsContext.isSessionStart = true
        break
      case (lastSessionState === 'WaitingForStart'):
        // We can't change into the "Rowing" state since we are waiting for a drive phase that didn't come
        break
      case (lastSessionState === 'Paused' && metrics.strokeState === 'Drive'):
        allowStartOrResumeTraining(metrics)
        sessionState = 'Rowing'
        metrics.metricsContext.isIntervalStart = true
        metrics.metricsContext.isPauseEnd = true
        break
      case (lastSessionState === 'Paused'):
        // We are in a paused state, and didn't see a drive, so nothing to do here
        break
      case (lastSessionState !== 'Stopped' && metrics.strokeState === 'Stopped'):
        // We do not need to refetch the metrics as RowingStatistics will already have zero-ed the metrics when strokeState = 'Stopped'
        // This is intended behaviour, as the rower/flywheel indicate the rower has stopped somehow
        stopTraining()
        sessionState = 'Stopped'
        metrics.metricsContext.isSessionStop = true
        break
      case (lastSessionState === 'Stopped'):
        // We are in a stopped state, and will remain there
        sessionState = 'Stopped'
        break
      case (lastSessionState === 'Rowing' && metrics.strokeState === 'WaitingForDrive'):
        // We do not need to refetch the metrics as RowingStatistics will already have zero-ed the metrics when strokeState = 'WaitingForDrive'
        // This is intended behaviour, as the rower/flywheel indicate the rower has paused somehow
        pauseTraining()
        sessionState = 'Paused'
        metrics.metricsContext.isPauseStart = true
        break
      case (lastSessionState === 'Rowing' && metrics.metricsContext.isMoving && interval.isEndReached(metrics) && isNextIntervalAvailable()):
        // As we typically overshoot our interval target, we project the intermediat value
        temporaryDatapoint = interval.interpolateEnd(lastBroadcastedMetrics, metrics)
        sessionState = 'Rowing'
        if (temporaryDatapoint.modified) {
          // The intermediate datapoint is actually different
          resetMetricsSessionContext(temporaryDatapoint)
          activateNextIntervalParameters(temporaryDatapoint)
          temporaryDatapoint.metricsContext.isIntervalStart = true
          temporaryDatapoint.metricsContext.isSplitEnd = true
          emitMetrics(temporaryDatapoint)
        } else {
          activateNextIntervalParameters(metrics)
          metrics.metricsContext.isIntervalStart = true
          metrics.metricsContext.isSplitEnd = true
        }
        break
      case (lastSessionState === 'Rowing' && metrics.metricsContext.isMoving && interval.isEndReached(metrics)):
        // Here we do NOT want zero the metrics, as we want to keep the metrics we had when we crossed the finishline
        stopTraining()
        sessionState = 'Stopped'
        temporaryDatapoint = interval.interpolateEnd(lastBroadcastedMetrics, metrics)
        if (temporaryDatapoint.modified) {
          resetMetricsSessionContext(temporaryDatapoint)
          temporaryDatapoint.metricsContext.isSessionStop = true
          emitMetrics(temporaryDatapoint)
        } else {
          metrics.metricsContext.isSessionStop = true
        }
        break
      case (lastSessionState === 'Rowing' && metrics.metricsContext.isMoving && split.isEndReached(metrics)):
        sessionState = 'Rowing'
        splitNumber++
        temporaryDatapoint = split.interpolateEnd(lastBroadcastedMetrics, metrics)
        if (temporaryDatapoint.modified) {
          split.setStart(temporaryDatapoint)
          resetMetricsSessionContext(temporaryDatapoint)
          temporaryDatapoint.metricsContext.isSplitEnd = true
          emitMetrics(temporaryDatapoint)
        } else {
          split.setStart(metrics)
          metrics.metricsContext.isSplitEnd = true
        }
        split.setEnd(interval.splitDistance(), 0)
        break
      case (lastSessionState === 'Rowing' && metrics.metricsContext.isMoving):
        sessionState = 'Rowing'
        break
      default:
        log.error(`Time: ${metrics.totalMovingTime}, combination of ${sessionState} and state ${metrics.strokeState()} found in the Rowing Statistics, which is not captured by Finite State Machine`)
    }
    emitMetrics(metrics)

    if (sessionState === 'Rowing' && metrics.metricsContext.isMoving) {
      watchdogTimer = setTimeout(onWatchdogTimeout, watchdogTimout)
    }
    lastSessionState = sessionState
    lastBroadcastedMetrics = { ...metrics }
  }

  // Basic metricContext structure
  function resetMetricsSessionContext (metricsToReset) {
    metricsToReset.metricsContext.isSessionStart = false
    metricsToReset.metricsContext.isIntervalStart = false
    metricsToReset.metricsContext.isSplitEnd = false
    metricsToReset.metricsContext.isPauseStart = false
    metricsToReset.metricsContext.isPauseEnd = false
    metricsToReset.metricsContext.isSessionStop = false
  }

  function setIntervalParameters (intervalParameters) {
    intervalSettings = intervalParameters
    currentIntervalNumber = -1
    if (intervalSettings.length > 0) {
      log.info(`Workout recieved with ${intervalSettings.length} interval(s)`)
      metrics = rowingStatistics.getMetrics()
      activateNextIntervalParameters(metrics)
      resetMetricsSessionContext(metrics)
      emitMetrics(metrics)
    } else {
      // intervalParameters were empty, lets log this odd situation
      log.error('Recieved workout containing no intervals')
    }
  }

  function isNextIntervalAvailable () {
    // This function tests whether there is a next interval available
    if (currentIntervalNumber > -1 && intervalSettings.length > 0 && intervalSettings.length > (currentIntervalNumber + 1)) {
      return true
    } else {
      return false
    }
  }

  function activateNextIntervalParameters (baseMetrics) {
    if (intervalSettings.length > 0 && intervalSettings.length > (currentIntervalNumber + 1)) {
      // This function sets the interval parameters in absolute distances/times
      // Thus the interval target always is a projected "finishline" from the current position
      interval.setStart(baseMetrics)
      intervalAndPause.setStart(baseMetrics)

      currentIntervalNumber++
      interval.setEnd((intervalSettings[currentIntervalNumber].targetDistance), (intervalSettings[currentIntervalNumber].targetTime))
      interval.setSplit(intervalSettings[currentIntervalNumber].splitdistance, 0)
      log.info(`Interval settings for interval ${currentIntervalNumber + 1} of ${intervalSettings.length}: Distance target ${interval.targetDistance()} meters, time target ${secondsToTimeString(interval.targetTime())} minutes, split at ${interval.splitDistance()} meters`)

      // As the interval has changed, we need to reset the split metrics
      split.setStart(baseMetrics)
      split.setEnd(interval.splitDistance(), 0)
    } else {
      log.error('Interval error: there is no next interval!')
    }
  }

  function emitMetrics (metricsToEmit) {
    enrichMetrics(metricsToEmit)
    emitter.emit('metricsUpdate', metricsToEmit)
  }

  function enrichMetrics (metricsToEnrich) {
    metricsToEnrich.sessiontype = interval.type()
    metricsToEnrich.sessionStatus = sessionState // ToDo: remove this naming change by changing the consumers
    metricsToEnrich.intervalNumber = Math.max(noSpontaneousPauses + currentIntervalNumber + 1, 0) // Interval number, for both planned and unplanned intervals
    metricsToEnrich.intervalMovingTime = interval.timeSinceStart(metricsToEnrich)
    metricsToEnrich.intervalTargetTime = interval.targetTime()
    metricsToEnrich.intervalAndPauseMovingTime = intervalAndPause.timeSinceStart(metricsToEnrich)
    metricsToEnrich.intervalLinearDistance = interval.distanceFromStart(metricsToEnrich)
    metricsToEnrich.intervalTargetDistance = interval.targetDistance()
    metricsToEnrich.intervalAndPauseLinearDistance = intervalAndPause.distanceFromStart(metricsToEnrich)
    metricsToEnrich.splitNumber = metrics.metricsContext.isSplitEnd ? splitNumber - 1 : splitNumber // This is needed to satisfy the RowingData recorder, it needs the start of the split to mark the end of the previous split
    metricsToEnrich.splitLinearDistance = metrics.metricsContext.isSplitEnd ? interval.splitDistance() : split.distanceFromStart(metricsToEnrich) // This is needed to satisfy the RowingData recorder
    metricsToEnrich.cycleProjectedEndTime = interval.endDistance() > 0 ? distanceOverTime.projectY(interval.endDistance()) : interval.endTime()
    metricsToEnrich.cycleProjectedEndLinearDistance = interval.endTime() > 0 ? distanceOverTime.projectX(interval.endTime()) : interval.endDistance()
  }

  function onWatchdogTimeout () {
    log.error(`Time: ${metrics.totalMovingTime}, Watchdog timout forces a hard stop due to exceeding the twice maximumStrokeTimeBeforePause (i.e. ${watchdogTimout} seconds) without drive/recovery change`)
    stopTraining()
    metrics = rowingStatistics.getMetrics()
    resetMetricsSessionContext(metrics)
    metrics.metricsContext.isSessionStop = true
    sessionState = 'Stopped'
    distanceOverTime.push(metrics.totalMovingTime, metrics.totalLinearDistance)
    emitMetrics(metrics)
  }

  function getMetrics () {
    // TESTING PURPOSSES ONLY!
    enrichMetrics(metrics)
    return metrics
  }

  return Object.assign(emitter, {
    handleCommand,
    handleRotationImpulse,
    getMetrics
  })
}
