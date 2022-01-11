/** @format */

'use strict'

const config = require('config')
const path = require('path')
const os = require('os')
const fs = require('fs')
const debug = require('debug')('StoryStats')

class StoryStats {
  constructor(dbFilename = `${config.dataPath}${path.sep}jira-stats.db`) {
    if (fs.existsSync(dbFilename)) {
      this.db = require('better-sqlite3')(dbFilename, { readonly: true })
    } else {
      console.error(`@16: Couldn't find db file (${dbFilename}).`)
      process.exit(10)
    }
  }

  getChangeStats(
    startDate,
    endDate,
    inComponent = false,
    inFixVersion = false
  ) {
    let prevRow, prevKey
    let processRow = false
    const componentsFound = []
    let results = {}

    let releaseFilter = ''
    let componentFilter = ''

    if (inComponent) {
      componentFilter = ` AND Component like '%${inComponent}%'`
    }

    if (inFixVersion) {
      releaseFilter = ` AND fixVersion='${inFixVersion}' `
    }

    // Additions
    const addSql = `select * from 'story-stats' where date='${endDate}' ${componentFilter} ${releaseFilter} and key not in (select key from 'story-stats' where date='${startDate}' ${componentFilter} ${releaseFilter}) group by key order by key,date ASC`
    debug(addSql)

    const addRows = this.db.prepare(addSql).all()
    addRows.forEach((row) => {
      let components = ['none']
      if (row.component) {
        components = row.component.split(',')
      }

      components.forEach((component) => {
        if (!inComponent || component == inComponent) {
          if (!Object.keys(results).includes(component)) {
            results[component] = {
              count: 0,
              changed: 0,
              completed: 0,
              total: 0,
              changes: [],
              additions: [],
            }
          }

          results[component].count++
          results[component].additions.push(row)
        }
      })
    })

    // Changes
    const changeSql = `select * from 'story-stats' where ( date='${endDate}' and key in (select key from 'story-stats' where date='${startDate}' ${componentFilter} ${releaseFilter})) or (date='${startDate}' ${componentFilter} ${releaseFilter}) order by key,date ASC`
    debug(changeSql)

    debug(`startDate: ${startDate}; startYMD: ${startDate}`)
    debug(`endDate: ${endDate}; endYMD: ${endDate}`)

    const rows = this.db.prepare(changeSql).all()

    debug(`Results count: `, rows.length)

    rows.forEach((row) => {
      processRow = row.key == prevKey

      if (processRow) {
        let components = ['none']
        if (row.component) {
          components = row.component.split(',')
        }

        components.forEach((component) => {
          // debug(`Processing Component: ${component}`)
          if (!componentsFound.includes(component)) {
            componentsFound.push(component)
          }

          if (!inComponent || component == inComponent) {
            // debug(`Continuing with inComponent ${inComponent}`)

            if (!Object.keys(results).includes(component)) {
              results[component] = {
                count: 0,
                changed: 0,
                completed: 0,
                total: 0,
                changes: [],
                additions: [],
              }
            }

            results[component].count++
            if (
              row.total !== prevRow.total ||
              row.progress !== prevRow.progress ||
              row.fixVersion !== prevRow.fixVersion ||
              row.status !== prevRow.status
            ) {
              results[component].changed++
            }
            results[component].completed += row.progress - prevRow.progress
            results[component].total += row.total

            // Change in data
            if (
              prevRow.progress !== row.progress ||
              prevRow.total !== row.total ||
              prevRow.status !== row.status ||
              prevRow.fixVersion !== row.fixVersion
            ) {
              results[component].changes.push({
                key: row.key,
                dates: [prevRow.date, row.date],
                progress:
                  prevRow.progress == row.progress
                    ? row.progress
                    : [prevRow.progress, row.progress],
                status:
                  prevRow.status == row.status
                    ? row.status
                    : [prevRow.status, row.status],
                total:
                  prevRow.total == row.total
                    ? row.total
                    : [prevRow.total, row.total],
                fixVersion:
                  prevRow.fixVersion == row.fixVersion
                    ? row.fixVersion
                    : [prevRow.fixVersion, row.fixVersion],
              })
            }
          }
        })
      }
      prevRow = row
      prevKey = row.key
    })

    return results
  }

  /**
   *Return a top-level list of the components, story count, story mod count, and expended and total time
   *
   * @param {Date} startDate
   * @param {Date} endDate
   * @param {String} [component=false]
   * @param {String} [fixVersion=false]
   * @memberof StoryStats
   */
  getSummaryReport(
    startDate,
    endDate,
    inComponent = false,
    inFixVersion = false
  ) {
    debug(`inComponent: ${inComponent}`)

    const changes = this.getChangeStats(
      startDate,
      endDate,
      inComponent,
      inFixVersion
    )

    return changes
  }

  /**
   * Fetch the list of seen Components
   *
   * @param {boolean} [forceRefresh=false] Always refresh the list?
   * @returns {array} List of components (alphabetically sorted)
   * @memberof StoryStats
   */
  getComponentList(forceRefresh = false) {
    if (forceRefresh || !this.components || this.components.length == 0) {
      this.components = []

      // Get the complete list of components in the db
      let results = this.db
        .prepare(
          `SELECT DISTINCT Component FROM 'story-stats' WHERE Component <> '' ORDER BY Component`
        )
        .all()

      results.forEach((c) => {
        if (c.component) {
          // Handle multiple components in one string
          let c2 = c.component.split(',')
          c2.forEach((c3) => {
            // Only add the component on first sighting
            if (!this.components.includes(c3)) {
              this.components.push(c3)
            }
          })
        }
      })
      this.components.sort()
    }
    return this.components
  }

  getFullDailyReport(releaseName) {
    const componentList = this.getComponentList()

    const sql = `select date as keyDate, (sum(total)/28800) as 'total (d)', component
      from 'story-stats'
      where fixVersion=?
      group by date,component`

    const rows = this.db.prepare(sql).all(releaseName)
    debug(`Results count: `, rows.length)

    let data = []
    rows.forEach((row) => {})
  }
}

module.exports = StoryStats
