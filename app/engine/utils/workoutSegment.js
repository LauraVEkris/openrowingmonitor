'use strict'
/*
  Open Rowing Monitor, https://github.com/JaapvanEkris/openrowingmonitor

  This Module supports the creation and use of workoutSegment
*/

export function createWorkoutSegment () {
  let _type = 'JustRow'
  let _startTime = 0
  let _startDistance = 0
  let _targetTime = 0
  let _targetDistance = 0
  let _endTime = 0
  let _endDistance = 0
  let _splitTime = 0
  let _splitDistance = 0

  function setStart (baseMetrics) {
    _startTime = baseMetrics.totalMovingTime
    _startDistance = baseMetrics.totalLinearDistance
    _type = 'JustRow'
    _endTime = 0
    _endDistance = 0
    _splitTime = 0
    _splitDistance = 0
  }

  function setEnd (targetDistance, targetTime) {
    switch (true) {
      case (targetDistance > 0):
        // A target distance is set
        _type = 'Distance'
        _targetTime = 0
        _targetDistance = targetDistance
        _endTime = 0
        _endDistance = _startDistance + targetDistance
        break
      case (targetTime > 0):
        // A target time is set
        _type = 'Time'
        _targetTime = targetTime
        _targetDistance = 0
        _endTime = _startTime + targetTime
        _endDistance = 0
        break
      default:
        _type = 'JustRow'
        _targetTime = 0
        _targetDistance = 0
        _endTime = 0
        _endDistance = 0
    }
  }

  function setSplit (splitDistance, splitTime) {
    switch (true) {
      case (splitDistance > 0):
        // A target distance is set
        _splitTime = 0
        _splitDistance = splitDistance
        break
      case (splitTime > 0):
        // A target time is set
        _splitTime = splitTime
        _splitDistance = 0
        break
      default:
        _splitTime = 0
        _splitDistance = 0
    }
  }

  // Returns the distance from te startpoint
  function distanceFromStart (baseMetrics) {
    if (_startDistance >= 0) {
      // We have exceeded the boundary
      return baseMetrics.totalLinearDistance - _startDistance
    } else {
      return NaN
    }
  }

  // Returns the distance to the endpoint
  function distanceToEnd (baseMetrics) {
    if (_endDistance > 0) {
      // We have exceeded the boundary
      return _endDistance - baseMetrics.totalLinearDistance
    } else {
      return NaN
    }
  }

  // Returns the time from the startpoint
  function timeSinceStart (baseMetrics) {
    if (_startTime >= 0) {
      // We have exceeded the boundary
      return baseMetrics.totalMovingTime - _startTime
    } else {
      return NaN
    }
  }

  // Returns the time to the endpoint
  function timeToEnd (baseMetrics) {
    if (_endTime > 0) {
      // We have exceeded the boundary
      return _endTime - baseMetrics.totalMovingTime
    } else {
      return NaN
    }
  }

  // Checks for reaching a boundary condition
  function isEndReached (baseMetrics) {
    if ((_endDistance > 0 && baseMetrics.totalLinearDistance >= _endDistance) || (_endTime > 0 && baseMetrics.totalMovingTime >= _endTime)) {
      // We have exceeded the boundary
      return true
    } else {
      return false
    }
  }

  function interpolateEnd (prevMetrics, currMetrics) {
    const projectedMetrics = { ...prevMetrics }
    let modified = false
    switch (true) {
      case (_endDistance > 0 && currMetrics.totalLinearDistance > _endDistance):
        // We are in a distance based interval, and overshot the targetDistance
        projectedMetrics.totalMovingTime = interpolatedTime(prevMetrics, currMetrics, _endDistance)
        projectedMetrics.totalLinearDistance = _endDistance
        modified = true
        break
      case (_endTime > 0 && currMetrics.totalMovingTime > _endTime):
        // We are in a time based interval, and overshot the targetTime
        projectedMetrics.totalLinearDistance = interpolatedDistance(prevMetrics, currMetrics, _endTime)
        projectedMetrics.totalMovingTime = _endTime
        modified = true
        break
      default:
        // Nothing to do
    }
    // Prevent the edge case where we trigger two strokes at milliseconds apart when using the interpolation function
    projectedMetrics.isDriveStart = false
    projectedMetrics.isRecoveryStart = false
    projectedMetrics.modified = modified
    return projectedMetrics
  }

  function interpolatedTime (prevMetrics, currMetrics, targetDistance) {
    if (prevMetrics.totalLinearDistance < targetDistance && targetDistance < currMetrics.totalLinearDistance) {
      // See https://en.wikipedia.org/wiki/Linear_interpolation
      return (prevMetrics.totalMovingTime + ((currMetrics.totalMovingTime - prevMetrics.totalMovingTime) * ((targetDistance - prevMetrics.totalLinearDistance) / (currMetrics.totalLinearDistance - prevMetrics.totalLinearDistance))))
    } else {
      return currMetrics.totalMovingTime
    }
  }

  function interpolatedDistance (prevMetrics, currMetrics, targetTime) {
    if (prevMetrics.totalMovingTime < targetTime && targetTime < currMetrics.totalMovingTime) {
      // See https://en.wikipedia.org/wiki/Linear_interpolation
      return (prevMetrics.totalLinearDistance + ((currMetrics.totalLinearDistance - prevMetrics.totalLinearDistance) * ((targetTime - prevMetrics.totalMovingTime) / (currMetrics.totalMovingTime - prevMetrics.totalMovingTime))))
    } else {
      return currMetrics.totalLinearDistance
    }
  }

  function reset () {
    _startTime = 0
    _startDistance = 0
    _type = 'JustRow'
    _targetTime = 0
    _targetDistance = 0
    _endTime = 0
    _endDistance = 0
    _splitTime = 0
    _splitDistance = 0
  }

  function endDistance () {
    return _endDistance
  }

  function endTime () {
    return _endTime
  }

  function splitDistance () {
    return _splitDistance
  }

  function splitTime () {
    return _splitTime
  }

  function targetDistance () {
    return _targetDistance
  }

  function targetTime () {
    return _targetTime
  }

  function type () {
    return _type
  }

  return {
    setStart,
    setEnd,
    setSplit,
    isEndReached,
    interpolateEnd,
    distanceFromStart,
    distanceToEnd,
    timeSinceStart,
    timeToEnd,
    setInterval,
    reset,
    type,
    endTime,
    endDistance,
    splitTime,
    splitDistance,
    targetTime,
    targetDistance
  }
}
