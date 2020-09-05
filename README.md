# jira-status-reporter

Collection of node scripts to query, store, and report on Jira issues.

## Folders

* `./data/`: Where the database and all JSON files will be stored

## Contents

* `config.js`: Defines how you connect to Jira
* `JiraStatusReporter.js`: The main Javascript class
* `*.sh`: Shell-wrappers for the Javascript files
  * `pullDataForYesterday.sh` queries and stores all Jira issues by Status for the prior calendar day. All data is stored in `./data/*.json` files with the Status and date in the filename.
* `get*.js`: Query (and store) Jira issue details (counts or data)
  * `getIssueCounts*` only return a total number
  * `getIssues*` return the full Jira issue data
* `simple-server.js`: Run a local server for handling queries
* `jira-stats.sql`: Table definition for local jira stats

## Prerequisites
* sqlite3: for local stats storage
* node

## Dependencies
* Node modules
  * `jira-client`: Main Jira client tool
  * `commander`: For parsing command line options
  * `restify`: For `simple-server.js`
  * `debug`: For logging
  * `supports-color`: For `debug`
  * `date-fns`: For date manipulation
  * `ava`: For testing
  * `istanbul`: For test coverage
  * `rando.js`: For random chart IDs
* Working QuickChart server
  * See https://quickchart.io/ for instructions
  * Configure the server and port in the config.js file

## Features
* Graphical display of issue links (using Mermaid)
![Links with icon](./screenshots/Links-icons.png)
![Links without icons](./screenshots/Links-noicons.png)
* JSON/HTML list of projects (with or without issue type counts)
* JSON/HTML list of fields (standard & custom)
![Field list - sample](./screenshots/Field%20list%20example.png)

## Installation and Setup
* ```sh
  git clone https://github.com/jolewis-ddn/jira-status-reporter
  npm install
  
  mkdir data
	```
* Copy (or rename) `config.js-template` to `config.js`
* Update the values in `config.js` as appropriate
  * The `server.port` setting is only required if you run the local server
  * `fa` is optional and must include the full URL to your FontAwesome JavaScript kit - e.g. ,
    `"fa": "https://kit.fontawesome.com/0123456789.js"`
    * If you enable FontAwesome, you may wish to adjust the faIcons object to point to different icons.
  * All others are required
* Create the database
  * ```
    sqlite3 ./data/jira-stats.db
    >.read ./jira-stats.sql
    >.quit
    ```

## Optional Configuration: Multiple Jira Instances

* If you would like to run multiple instances pointing to different Jira servers, follow these steps:
  * Copy `.JiraStatusServer-template.json` to `.JiraStatusServer.json`
  * Update that file to set the "config" value to a valid file name in the current folder. That file must follow the same format as `jiraConfig.json`.
  * Run `JiraStatusServer` as outlined below. When the app starts up, it will see the new config file name and read that new file name for the configuration parameters.
    * If the new config file name in `.JiraStatusServer.json` does not exist, the app will fail to start.

**Notes**:
  * This is completely optional. If you only have a single Jira instance, you can simply use `jiraConfig.json` as-is.
  * Make sure you don't use the same port number in multiple config files - otherwise app startup will fail.

## Usage example

1. Collect status for a specific month: `./getIssueCountsByMonth.sh <month-number>` (e.g. `6` for June)
1. Collect stats for a specific status and month: `node getIssueCountsByStatusAndMonth.js -s ICEBOX -m 6`
1. Pull all Jira issue data for all statuses from yesterday and store as JSON files in `./data/`: `./pullDataForYesterday.sh`
    * ** Warning ** This can result in significant data storage, depending on your Jira project size
1. Run the status server (_from source_): 
  * Production: `npm run server`
  * Debug (nodemon - _recommended_): `set DEBUG=*,-nodemon* && npm run server-debug`
  * Debug: `set DEBUG=* && node JiraStatusServer.js`
  1. Open http://localhost:9999/chart to see the default chart (use server.port as set in `jiraConfig.json`)
1. Run the status server (_from binary_):
  * Debug: `set DEBUG=*` before running the app binary.
  * Run the binary for your platform (i.e. `JiraStatusServer-win.exe`, `JiraStatusServer-mac`, or `JiraStatusServer-linux`)

## Getting help
1. All node scripts have a help page: `node script.js --help`

## Development setup

To turn on debug output, set the `DEBUG` environment variable, like so:

```sh
set DEBUG=*
```

## Release History

* 0.0.1
    * Work in progress

## License

Distributed under the MIT license. See ``LICENSE`` for more information.

[https://github.com/jolewis-ddn/](https://github.com/jolewis-ddn/)
