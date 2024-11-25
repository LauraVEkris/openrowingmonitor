# Intergations with other services

For services we distinguish between two types of functionality:

*  **Download workout**: here OpenRowingMonitor will fetch the planned workout parameters (target distance, intervals, etc.) from the service before the session and will program the monitor accordingly

* **Upload results**: here OpenRowingMonitor uploads the result of your rowing session (i.e. total time rowed, pace, stroke rate, etc.) to the service after your session has completed

Looking at the individual services, we see the following:

| Service | Download workout | Upload results | Remarks |
|---|---|---|---|
| File system | No | Yes | |
| Strava | No | Yes | |
| RowsAndAll.com | No | Yes | Upoad only, currently requires batch script |
| Rowingdata | No | Yes | Upoad only, currently requires batch script |
| Intervals.icu | No | Yes | Upoad only, currently requires batch script |

In the following sections we describe their pro's and con's, as well as their current limitations with OpenRowingMonitor, and how to set it up.

## File system

OpenRowingMonitor supports the following exports, which can be obtained via the network share:

* **Garmin FIT files**: These are binairy files that contain the most interesting metrics of a rowing session. Most modern training analysis tools will accept a FIT-file. You can manually upload these files to training platforms like [Strava](https://www.strava.com), [Garmin Connect](https://connect.garmin.com), [Intervals.icu](https://intervals.icu/), [RowsAndAll](https://rowsandall.com/) or [Trainingpeaks](https://trainingpeaks.com) to track your training sessions;

* **Training Center XML files (TCX)**: These are XML-files that contain the most essential metrics of a rowing session. Most training analysis tools will accept a tcx-file. You can upload these files to training platforms like [Strava](https://www.strava.com), [Garmin Connect](https://connect.garmin.com), [Intervals.icu](https://intervals.icu/), [RowsAndAll](https://rowsandall.com/) or [Trainingpeaks](https://trainingpeaks.com) to track your training sessions;

* **RowingData** files, which are comma-seperated files with all metrics Open Rowing Monitor can produce. These can be  uploaded to [RowsAndAll](https://rowsandall.com/) for a webbased analysis (including dynamic in-stroke metrics). The csv-files can also be processed manually in Excel, allowing your own custom analysis. Please note that for visualising in-stroke metrics in [RowsAndAll](https://rowsandall.com/) (i.e. force, power and handle speed curves), you need their yearly subscription.

 The Open rowing Monitor installer can set up a network share that contains all training data so it is easy to grab the files from there and manually upload them to the training platform of your choice.

## Strava

Uploading your sessions to [Strava](https://www.strava.com) is an integrated feature. Strava can handle both tcx- and fit-files, but it will only display the data from the tcx-file.

## RowsAndAll.com

Uploading to [RowsAndAll](https://rowsandall.com/) can be automated through their e-mail interface, see [this description](https://rowsandall.com/rowers/developers/).

## Rowingdata

[RowingData](https://pypi.org/project/rowingdata/) is an app that can be installed on your Raspberry Pi, allowing you to automatically have an analysis platform as well.

## Intervals.icu

[Intervals.icu](https://intervals.icu/)
