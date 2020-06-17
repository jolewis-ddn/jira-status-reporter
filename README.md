jira-status-reporter README

# jira-status-reporter
> Collect and report on Jira issue status

Collection of node scripts to query, store, and report on Jira issues.

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

## Installation and Setup
* ```sh
  git clone https://github.com/jolewis-ddn/jira-status-reporter
  npm install
	```
* Copy (or rename) `config.js-template` to `config.js`
* Update the values in `config.js` as appropriate
  * The `server.port` setting is only required if you run the local server
  * All others are required
* Create the database
  * ```
    sqlite3 ./data/jira-stats.db
    >.read ./jira-stats.sql
    >.quit
    ```

## Usage example

1. Collect status for a specific month: `./getIssueCountsByMonth.sh <month-number>` (e.g. `6` for June)
1. Collect stats for a specific status and month: `node getIssueCountsByStatusAndMonth.js -s ICEBOX -m 6`
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
