"use strict";

const debug = require("debug")("JDR");

const fs = require("fs");
const glob = require("glob");
const path = require("path");

const utilities = require('./utilities');
const { convertSecondsToDays } = require("./jiraUtils");

const config = require('config')
const dataPath = config.has('dataPath') ? config.get('dataPath') : 'data'
const dataPathPrefix = '.' + path.sep + dataPath + path.sep

const NodeCache = require("node-cache");

// const JSR = require('./JiraStatusReporter')

const JiraDataCache = require("./JiraDataCache");
const { CANCELLED } = require("dns");

const sqlite3 = require("sqlite3").verbose();

const ALL_RELEASES = "ALL_RELEASES";
const NO_RELEASE = "NONE";

const DATABASE_FILENAME_DEFAULT = 'jira-stats.db'

const databaseFilename = config.has('dbFilename')
  ? config.dbFilename
  : DATABASE_FILENAME_DEFAULT
const databaseFullname = dataPathPrefix + databaseFilename

debug(`databaseFullname: ${databaseFullname}`)
/**
 * Save cached data
 *
 * @class JiraDataReader
 */
class JiraDataReader {
  constructor() {
    this.cache = new JiraDataCache()
    this.nodeCache = new NodeCache({ stdTTL: 60 * 24, checkperiod: 1200 })
    this.loaded = this.cache.isActive()
    this.REBUILD = 999
    this.UPDATE  = 500
    this.REFRESH = 10
    this.db = new sqlite3.Database(databaseFullname)
    // this.jsr = new JSR()

    return this
  }

  getCacheObject() {
    return this.cache
  }

  rebuild() {
    return this.REBUILD
  }

  update() {
    return this.UPDATE
  }

  refresh() {
    return this.REFRESH
  }

  async getItemsCreatedOnDate(d) {
    debug(`getItemsCreatedOnDate(${d}) called...`)
    return new Promise((resolve, reject) => {
      try {
        let createdDate
        if (typeof d == Date) {
          createdDate = d
        } else {
          createdDate = new Date(d)
        }
        createdDate.setDate(createdDate.getDate()+1)
        createdDate.setHours(0)
        createdDate.setMinutes(0)
        createdDate.setSeconds(0)
        
        const createdDateStr = `${createdDate.getFullYear()}-${utilities.padToTwoCharacters(createdDate.getMonth() + 1)}-${utilities.padToTwoCharacters(createdDate.getDate())}`
        
        let prevDay = new Date()
        prevDay.setDate(createdDate.getDate() - 1)
        const prevDayStr = `${prevDay.getFullYear()}-${utilities.padToTwoCharacters(prevDay.getMonth() + 1)}-${utilities.padToTwoCharacters(prevDay.getDate())}`
        debug(`prevDayStr = ${prevDayStr}`)
        
        const sql = `select key, total, min(date) as earliestDate from 'story-stats' where key in (select key from 'story-stats' where date='${createdDateStr}') and key not in (select key from 'story-stats' where date='${prevDayStr}') group by key order by key`
        debug(`sql: ${sql}`)

        this.db.all(sql, (dberr, rows) => {
          if (dberr) { reject(dberr) }
          resolve({ sql: sql, data: rows })
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Re-read the existing cache. The cache is not re-loaded or wiped.
   * Nov 25, 2020: Added database storage of daily summaries
   *
   * @param {number} [reloadType=this.REFRESH]
   * @returns Number of items processed
   * @memberof JiraDataReader
   */
  async reloadCache(reloadType = this.REFRESH) {
    debug(`reloadCache(${reloadType}) called...`)
    
    if (reloadType == this.REBUILD) {
      await this.clearCache()
    }

    let d = this.cache.getCache(true)
    let flist = glob.sync(dataPathPrefix + '*.json')
    let updates = 0
    debug(`Beginning db transaction...`)

    this.db.run('BEGIN')

    flist.forEach((fname) => {
      debug(`processing ${fname}...`)
      if (reloadType == this.REBUILD || !this.cache.containsFile(fname)) {
        try {
          updates += 1
          let raw = this._processFile(fname)
          d.push({
            fullname: fname,
            base: path.basename(fname, '.json'),
            status: this._parseStatusName(fname),
            date: this._parseFileDate(fname),
            total: raw.total,
            summary: raw.summary,
          })
        } catch (err) {
          console.error(`Error in reloadCache (while processing ${fname}): ${err.message}`)
        }
      }
      debug(`...done with ${fname}`)
    })

    debug(`Committing inserts to database...`)
    this.db.run('COMMIT')
    debug('...done committing')

    debug(`Saving cache (${updates} updates)`)
    this.cache.saveCache(d)
    this.loaded = this.cache.isActive()
    debug('...done saving updates')
    return updates
  }

  /**
   * Read the cache & return the summary field or thrown an error
   *
   * @returns Summary field value
   * @memberof JiraDataReader
   */
  getDataSummary() {
    debug('getDataSummary() called...')
    if (!this.loaded) {
      this.processAllFiles()
    }

    try {
      let summary = this.cache.readCache(true, false)
      debug(`... returning summary`)
      return summary
    } catch (err) {
      return err
    }
  }

  /**
   * List all the dates read into the cache.
   *
   * @returns Array of dates (or empty if the cache isn't loaded)
   * @memberof JiraDataReader
   */
  getDates() {
    debug('getDates() called...')
    if (this.loaded) {
      // if (!this.dates) {
      this.dates = []
      try {
        const interimCache = this.cache.readCache(true, false)
        interimCache.forEach((el, ndx) => {
          if (!this.dates.includes(el.date)) {
            this.dates.push(el.date)
          }
        })
      } catch (err) {
        debug(`... getDates() == Error during interimCache: ${err}`)
      }
      // }
      debug(`... getDates() == returning ${this.dates}`)
      return this.dates.sort()
    } else {
      debug('... getDates() == no data loaded')
      return []
    }
  }

  /**
   * Get the cache data values.
   *
   * @param {boolean} [typeFilter=false]
   * @returns Series data object ({['type': dataArray}) (or empty if the cache isn't loaded)
   * @memberof JiraDataReader
   */
  getSeriesData(typeFilter = false) {
    debug(`getSeriesData(${typeFilter}) called...`)
    if (this.loaded) {
      this.seriesData = {}
      this.cache.readCache(true, false).forEach((el, ndx) => {
        if (!(el.status in this.seriesData)) {
          this.seriesData[el.status] = []
        }
        if (typeFilter) {
          this.seriesData[el.status].push(el['summary'][typeFilter]['count'])
        } else {
          this.seriesData[el.status].push(el.total)
        }
      })
      debug(`... getSeriesData() returning ok`)
      return this.seriesData
    } else {
      debug('... getSeriesData() == no data loaded')
      return {}
    }
  }

  /**
   * List all the files read into the cache.
   *
   * @returns Array of filenames
   * @memberof JiraDataReader
   */
  getAllFiles() {
    if (!this.loaded) {
      this.processAllFiles()
    }
    return this.allFiles
  }

  /**
   * Empty the cache (both json and db). Does not re-build the cache.
   *
   * @returns JiraDataReader
   * @memberof JiraDataReader
   */
  async clearCache() {
    await this.db.run("DELETE FROM 'story-stats';")

    this.cache.makeCache()
    this.loaded = this.cache.isActive()
    return this
  }

  _parseStatusName(fname) {
    const bname = path.basename(fname, '.json')
    return bname.substring(0, bname.length - 11)
  }

  _parseFileDate(fname) {
    return fname.substring(fname.length - 15, fname.length - 5)
  }

  /**
   * Return a list of all the releases in the cache
   *
   * @returns {array} Release Names
   * @memberof JiraDataReader
   */
  async getReleaseListFromCache() {
    debug(`getReleaseList() called...`)
    return new Promise((resolve, reject) => {
      let sql = `SELECT distinct(fixVersion) FROM 'story-stats' ORDER BY fixVersion`
      this.db.all(sql, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          // debug(rows);
          resolve(rows.map((x) => x.fixVersion))
        }
      })
    })
  }

  /**
   * Return a list of all the releases in the cache
   *
   * @returns {array} Release Names
   * @memberof JiraDataReader
   */
  async getComponentList() {
    debug(`getComponentList() called...`)
    return new Promise((resolve, reject) => {
      let sql = `SELECT distinct(component) FROM 'story-stats' where component is not null ORDER BY component`
      this.db.all(sql, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          let cleanList = []
          const uglyList = rows.map((x) => x.component)
          uglyList.forEach((entry) => {
            // debug(`entry: `, entry)
            cleanList = cleanList.concat(entry.split(','))
          })
          resolve([...new Set(cleanList)].sort())
        }
      })
    })
  }

  /**
   * Return a list of all the dates in the cache db, in date order
   *
   * @memberof JiraDataReader
   */
  async getDateList(whereFilter = '') {
    return new Promise((resolve, reject) => {
      let sql = `select date from 'story-stats' ${whereFilter} group by date order by date`
      this.db.all(sql, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows.map((x) => x.date))
        }
      })
    })
  }

  /**
   * Return the full list of burndown stats from the database.
   *
   * @param {string} [releaseName=false]
   * @returns {object}
      {
        {
          <status>: [array of daily remaining values]
        }
        dates == [<list of all dates processed>]
      }
   * @memberof JiraDataReader
   */
  async getBurndownStats(releaseName = false, componentName = false) {
    debug(`getBurndownStats(${releaseName}) called...`)
    return new Promise((resolve, reject) => {
      let releaseNameFilter = ''
      if (releaseName) {
        releaseNameFilter = `WHERE fixVersion='${releaseName}'`
      }

      let componentNameFilter = ''
      if (componentName) {
        if (releaseName) {
          componentNameFilter = ` AND `
        } else {
          componentNameFilter = ` WHERE `
        }
        
        componentNameFilter += ` component ${
          componentName === 'NONE'
            ? 'is null'
            : "like '%" + componentName + "%'"
        }`
      }

      let sql = `SELECT status, date, sum(total)-sum(progress) as remaining FROM 'story-stats' ${releaseNameFilter} ${componentNameFilter} GROUP BY date, status ORDER BY status, date`
      debug(sql)

      this.db.all(sql, async (err, rows) => {
        if (err != null) {
          reject(err)
        } else {
          debug(`# of rows returned: `, rows.length)
          // Now that we have the data, it has to be reformatted per status
          // TODO: Fix implicit assumption that the first status has an entry for every day

          let burndownStatDaily = {}
          let burndownStatDates = await this.getDateList()

          /* Example results...
            { status: 'In Progress', date: '2020-11-01', remaining: 3513600 },
            { status: 'In Progress', date: '2020-11-02', remaining: 2513600 },
            { status: 'In Progress', date: '2020-11-03', remaining: 1513600 },
            { status: 'In Progress', date: '2020-11-04', remaining:  369600 },
            ...
            */
          rows.forEach((row) => {
            // debug(`in rows.forEach(`, row, `)`);
            // if (!burndownStatDates.includes(row.date)) {
            //   burndownStatDates.push(row.date);
            // }
            if (!Object.keys(burndownStatDaily).includes(row.status)) {
              // Build an array the same length as the dates array, filled with 0s
              burndownStatDaily[row.status] = Array(
                burndownStatDates.length
              ).fill(0)
            }
            // burndownStatDaily[row.status].push(
            //   convertSecondsToDays(row.remaining)
            // );
            burndownStatDaily[row.status][
              burndownStatDates.indexOf(row.date)
            ] = convertSecondsToDays(row.remaining)
          })
          resolve({ stats: burndownStatDaily, dates: burndownStatDates })
        }
      })
    })
  }

  /**
   * Read in the data file from local disk and store it in the cache.
   *
   * @param {string} fname Input filename
   * @returns {object} Summary data object
   * @memberof JiraDataReader
   */
  _processFile(fname) {
    debug(`_processFile(${fname}) called`)
    // TODO: Handle filterForRelease

    // The filename must be more than 16 characters long
    // Date + extension (.json) == 16 characters
    if (fname.length > 16) {
      // Log the filename and date
      this.lastFilename = fname
      this.lastFiledate = this._parseFileDate(fname)

      // debug(`lastFiledate: ${this.lastFiledate}`)

      let response = {}

      if (!this.nodeCache.has(fname)) {
        let data = fs.readFileSync(fname)
        this.lastData = JSON.parse(data)
        // debug(`this.lastData.total = ${this.lastData.total}`);
        // Summarize data
        // If the issue types are listed in the config file, use that list
        // Otherwise, use a hard-coded list
        // TODO: Pull the list of issue types from Jira
        let summary = {}
        if (config.has('issueTypes')) {
          debug(`>>> Pulling issue types from config file...`)
          config.get('issueTypes').forEach((it) => {
            summary[it] = { count: 0, issues: [] }
            if (it == 'Story') { // Add more details for Stories
              summary[it]['aggregateprogress'] = { progress: 0, total: 0 }
            }
          })
          debug(`>>> types (from the config file): `, summary)
        } else {
          debug(`>>> Using hard-coded issue types...`)
          // Get the data
          // TODO: Implement the jsr.getIssueTypes(true) call
          // const issueTypes = await this.jsr.getIssueTypes(true)
          // debug(issueTypes)
          summary = {
            Epic: { count: 0, issues: [] },
            Story: {
              count: 0,
              issues: [],
              aggregateprogress: { progress: 0, total: 0 },
            },
            Task: { count: 0, issues: [] },
            'Sub-task': { count: 0, issues: [] },
            Bug: { count: 0, issues: [] },
            Test: { count: 0, issues: [] },
            Requirement: { count: 0, issues: [] },
          }
        }

        // debug(`this.lastData.issues.length: ${this.lastData.issues.length}`)
        // Increment the counter and store the issue key
        this.lastData.issues.forEach((i) => {
          // Set the release to the first fixVersion name value
          // TODO: Handle multiple fixVersion values
          let release =
            i.fields.fixVersions.length > 0
              ? i.fields.fixVersions[0].name
              : 'NONE'

          if (i.fields.fixVersions.length > 1) {
            debug(
              `Not Handled: Multiple (${i.fields.fixVersions.length}) releases: `,
              release,
              i.fields.fixVersions,
              i.fields.issuetype.name
            )
          }

          // Save the component value
          // TODO: Handle multiple components
          let component = i.fields.components.length
            ? i.fields.components.map((c) => c.name).join(',')
            : null

          summary[i.fields.issuetype.name]['count'] += 1
          summary[i.fields.issuetype.name]['issues'].push(i.key)

          // Update the running total of progress (spent) and total work estimates
          // No aggregateprogress field indicates no estimated/spent time
          // Only store for Stories, not Epics or Sub-Tasks - to avoid double-counting
          if (
            i.fields.issuetype.name === 'Story' &&
            i.fields.aggregateprogress
          ) {
            summary[i.fields.issuetype.name].aggregateprogress.progress +=
              i.fields.aggregateprogress.progress
            summary[i.fields.issuetype.name].aggregateprogress.total +=
              i.fields.aggregateprogress.total

            // To only cache items with an estimate, uncomment this if... statement
            // if (
            //   i.fields.aggregateprogress.progress +
            //     i.fields.aggregateprogress.total >
            //   0
            // ) {
            // debug(`INSERT INTO 'story-stats' (key, date, status, fixVersion, progress, total) VALUES (${i.key}, ${this.lastFiledate}, ${i.fields.status.name}, ${release}, ${i.fields.aggregateprogress.progress}, ${i.fields.aggregateprogress.total})`)
            this.db.run(
              'INSERT INTO `story-stats` (key, date, status, fixVersion, component, progress, total) VALUES (?, ?, ?, ?, ?, ?, ?)',
              i.key,
              this.lastFiledate,
              i.fields.status.name,
              release,
              component,
              i.fields.aggregateprogress.progress,
              i.fields.aggregateprogress.total
            )
            // }
          }
        })

        response = {
          total: this.lastData.total,
          raw: this.lastData,
          summary: summary,
        }

        // debug(`Saving ${fname} data to cache`);
        this.nodeCache.set(fname, response)
      } else {
        // Get cache instead
        // debug(`Returning ${fname} data from cache`);
        response = this.nodeCache.get(fname)
      }
      return response
    } else {
      // Len <= 16
      throw new Error(`Invalid filename ${fname} (length: ${fname.length}`)
    }
  }
}

module.exports = JiraDataReader;
