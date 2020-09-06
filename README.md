# jira-status-reporter

Collection of node scripts to query, store, and report on Jira issues.

## Features
* Graphical display of issue links (using Mermaid)
![Links with icon](./screenshots/Links-icons.png)
![Links without icons](./screenshots/Links-noicons.png)
* JSON/HTML list of projects (with or without issue type counts)
![Project list - sample](./screenshots/Project%20list%20example.png)
* JSON/HTML list of fields (standard & custom)
![Field list - sample](./screenshots/Field%20list%20example.png)

## Installation and Setup
### For live queries
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
### For cached queries - _optional_
* Create the database
  * ```
    sqlite3 ./data/jira-stats.db
    >.read ./jira-stats.sql
    >.quit
    ```

## Endpoints
* `/`: no-op
### Configuration
* `/config`: Current config
* `/fields`: All Jira fields (standard and custom)
### Issues
* `/chart`: Visualize timeseries data using cache
* `/dashboard`: Data visualization of current status (no cache)
* `/epics`: Visualize Epic status (includes linked issues)
* `/filter`: Visualize issue status using existing Jira filter
* `/links`: Visualize issue links
* `/report`: Simple data report on issue statuses over time (epic count, open issue count, updates this month/week, etc.)
### Cache
* `/cache`: Current in-memory cache
* `/datafiles`: List of data files in cache
* `/dates`: All dates covered by cache
* `/homedir`: The current root cache folder
* `/rebuild-cache`: Delete and recreate the cache from source data
* `/refresh-cache`: Update the cache with new source data files
* `/reread-cache`: Re-read the cache from disk
* `/reset`: Re-initialize the cache
* `/series`: Issue counts by status
* `/wipe-cache`: Delete the cache

## Usage example

1. Collect status for a specific month: `./getIssueCountsByMonth.sh <month-number>` (e.g. `6` for June)
1. Collect stats for a specific status and month: `node getIssueCountsByStatusAndMonth.js -s ICEBOX -m 6`
1. Pull all Jira issue data for all statuses from yesterday and store as JSON files in `./data/`: `./pullDataForYesterday.sh`
    * ** Warning ** This can result in significant data storage, depending on your Jira project size
1. Run the status server
  * Production: `npm run server`
  * Debug: `npm run server-debug`
  1. Open http://localhost:9999/chart to see the default chart (use server.port as set in your config file)

* You can specify alternate configurations by setting NODE_ENV.
  * For example, if a config file named `Production.json` exists in the `config` directory, setting NODE_ENV to `Production` before running `JiraStatusServer.js` will pick up the values from `config/Production.json` (or `config/Production.yaml` or any other config file supported by `node-config` (see above).)

## Getting help
1. All node scripts have a help page: `node script.js --help`

## Development setup

To turn on debug output, set the `DEBUG` environment variable, like so:

```sh
set DEBUG=*
```

## Folders

* `./data/`: Where the database and all JSON files will be stored
* `./.cache/`: Project data cache

## Main Files

* `JiraStatusServer.js`: Run a local server for handling queries
* `JiraStatusReporter.js`: The main Javascript class
* `*.sh`: Shell-wrappers for the Javascript files
  * `pullDataForYesterday.sh` queries and stores all Jira issues by Status for the prior calendar day. All data is stored in `./data/*.json` files with the Status and date in the filename.
* `get*.js`: Query (and store) Jira issue details (counts or data)
  * `getIssueCounts*` only return a total number
  * `getIssues*` return the full Jira issue data
* `jira-stats.sql`: Table definition for local jira stats

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
  * `node-config`: Manages configuration
* Working QuickChart server
  * See https://quickchart.io/ for instructions
  * Configure the server and port in the config.js file

## License

Distributed under the MIT license. See ``LICENSE`` for more information.

[https://github.com/jolewis-ddn/](https://github.com/jolewis-ddn/)
