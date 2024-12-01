'use strict'
/*
  Open Rowing Monitor, https://github.com/JaapvanEkris/openrowingmonitor

  This Module captures the metrics of a rowing session and persists them.
*/
import log from 'loglevel'
import fs from 'fs/promises'
import { createLogRecorder } from './logRecorder.js'
import { createRawRecorder } from './rawRecorder.js'
import { createTCXRecorder } from './tcxRecorder.js'
import { createFITRecorder } from './fitRecorder.js'
import { createRowingDataRecorder } from './rowingDataRecorder.js'

export function createRecordingManager (config) {
  let startTime
  const logRecorder = createLogRecorder(config)
  const rawRecorder = createRawRecorder(config)
  const tcxRecorder = createTCXRecorder(config)
  const fitRecorder = createFITRecorder(config)
  const rowingDataRecorder = createRowingDataRecorder(config)

  // This function handles all incomming commands. As all commands are broadasted to all application parts,
  // we need to filter here what the WorkoutRecorder will react to and what it will ignore
  // For the 'start', 'startOrResume', 'pause' and 'stop' commands, we await the official rowingengine reaction
  async function handleCommand (commandName) {
    switch (commandName) {
      case ('start'):
        break
      case ('startOrResume'):
        break
      case ('pause'):
        break
      case ('stop'):
        break
      case ('requestControl'):
        break
      case ('reset'):
        startTime = undefined
        executeCommandsInParralel(commandName)
        break
      case 'blePeripheralMode':
        break
      case 'switchBlePeripheralMode':
        break
      case 'antPeripheralMode':
        break
      case 'switchAntPeripheralMode':
        break
      case 'hrmPeripheralMode':
        break
      case 'switchHrmMode':
        break
      case 'uploadTraining':
        break
      case 'stravaAuthorizationCode':
        break
      case 'shutdown':
        await executeCommandsInParralel(commandName)
        break
      default:
        log.error(`recordingMnager: Recieved unknown command: ${commandName}`)
    }
  }

  async function recordRotationImpulse (impulse) {
    if (startTime === undefined && (config.createRawDataFiles || config.createTcxFiles || config.createRowingDataFiles || config.createFitFiles)) {
      await nameFilesAndCreateDirectory()
    }
    if (config.createRawDataFiles) { await rawRecorder.recordRotationImpulse(impulse) }
  }

  async function recordMetrics (metrics) {
    if (startTime === undefined && (config.createRawDataFiles || config.createTcxFiles || config.createRowingDataFiles || config.createFitFiles)) {
      await nameFilesAndCreateDirectory()
    }
    logRecorder.recordRowingMetrics(metrics)
    if (config.createRawDataFiles) { rawRecorder.recordRowingMetrics(metrics) }
    if (config.createTcxFiles) { tcxRecorder.recordRowingMetrics(metrics) }
    if (config.createFitFiles) { fitRecorder.recordRowingMetrics(metrics) }
    if (config.createRowingDataFiles) { rowingDataRecorder.recordRowingMetrics(metrics) }
  }

  async function recordHeartRate (hrmData) {
    logRecorder.recordHeartRate(hrmData)
    if (config.createTcxFiles) { tcxRecorder.recordHeartRate(hrmData) }
    if (config.createFitFiles) { fitRecorder.recordHeartRate(hrmData) }
    if (config.createRowingDataFiles) { rowingDataRecorder.recordHeartRate(hrmData) }
  }

  async function setIntervalParameters (intervalParameters) {
    if (config.createFitFiles) { fitRecorder.setIntervalParameters(intervalParameters) }
  }

  async function executeCommandsInParralel (commandName) {
    const parallelCalls = []
    parallelCalls.push(logRecorder.handleCommand(commandName))
    if (config.createRawDataFiles) { parallelCalls.push(rawRecorder.handleCommand(commandName)) }
    if (config.createTcxFiles) { parallelCalls.push(tcxRecorder.handleCommand(commandName)) }
    if (config.createFitFiles) { parallelCalls.push(fitRecorder.handleCommand(commandName)) }
    if (config.createRowingDataFiles) { parallelCalls.push(rowingDataRecorder.handleCommand(commandName)) }
    await Promise.all(parallelCalls)
  }

  async function nameFilesAndCreateDirectory () {
    startTime = new Date()
    // Calculate the directory name and create it if needed
    const directory = `${config.dataDirectory}/recordings/${startTime.getFullYear()}/${(startTime.getMonth() + 1).toString().padStart(2, '0')}`
    try {
      await fs.mkdir(directory, { recursive: true })
    } catch (error) {
      if (error.code !== 'EEXIST') {
        log.error(`can not create directory ${directory}`, error)
      }
    }

    // Determine the base filename to be used by all recorders
    const stringifiedStartTime = startTime.toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..+/, '')
    const fileBaseName = `${directory}/${stringifiedStartTime}`
    if (config.createRawDataFiles) { rawRecorder.setBaseFileName(fileBaseName) }
    if (config.createTcxFiles) { tcxRecorder.setBaseFileName(fileBaseName) }
    if (config.createFitFiles) { fitRecorder.setBaseFileName(fileBaseName) }
    if (config.createRowingDataFiles) { rowingDataRecorder.setBaseFileName(fileBaseName) }
  }

  async function activeWorkoutToTcx () {
    await tcxRecorder.activeWorkoutToTcx()
  }

  return {
    handleCommand,
    setIntervalParameters,
    recordHeartRate,
    recordRotationImpulse,
    recordMetrics,
    activeWorkoutToTcx
  }
}
