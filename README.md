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


## Installation and Setup
* ```sh
  git clone https://github.com/jolewis-ddn/jira-status-reporter
  npm install
  
  mkdir data
	```
* Copy (or rename) `default-template.json` to `default.json`
  * Note: Other formats may be used. See ![node-config Configuration Files wiki page](https://github.com/lorenwest/node-config/wiki/Configuration-Files) for full details. The fields in default-template.json` must exist in whatever config file/format you choose.
* Update the values in `default.json` as appropriate
  * `fa` is optional and must include the full URL to your FontAwesome JavaScript kit - e.g. ,
    `"fa": "https://kit.fontawesome.com/0123456789.js"`
    * If you enable FontAwesome, you may wish to adjust the faIcons object to point to different icons.
  * All others fields are required
* Create the database
  * ```
    sqlite3 ./data/jira-stats.db
    >.read ./jira-stats.sql
    >.quit
    ```
* You can specify alternate configurations by setting NODE_ENV.
  * For example, if a config file named `Production.json` exists in the `config` directory, setting NODE_ENV to `Production` before running `JiraStatusServer.js` will pick up the values from `config/Production.json` (or `config/Production.yaml` or any other config file supported by `node-config` (see above).)
  
## Usage example

1. Collect status for a specific month: `./getIssueCountsByMonth.sh <month-number>` (e.g. `6` for June)
1. Collect stats for a specific status and month: `node getIssueCountsByStatusAndMonth.js -s ICEBOX -m 6`
1. Pull all Jira issue data for all statuses from yesterday and store as JSON files in `./data/`: `./pullDataForYesterday.sh`
    * ** Warning ** This can result in significant data storage, depending on your Jira project size
1. Run the status server
  * Production: `npm run server`
  * Debug: `npm run server-debug`
  1. Open http://localhost:9999/chart to see the default chart (use server.port as set in your config file)

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
