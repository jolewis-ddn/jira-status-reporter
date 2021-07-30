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
      console.error(`Couldn't find db file (${dbFilename}).`)
      process.exit(10)
    }
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
    // startDate = new Date(startDate.setHours(0,0,0,0))
    // let startYMD = `${startDate.getFullYear()}-0${startDate.getMonth()+1}-${startDate.getDate()+1}`

    // endDate = new Date(endDate.setHours(0,0,0,0))
    // let endYMD = `${endDate.getFullYear()}-0${endDate.getMonth()+1}-${endDate.getDate()+1}`

    let startYMD = startDate
    let endYMD = endDate
    
    let prevRow, prevKey
    let processRow = false
    const componentsFound = []
    const results = {}
    
    let releaseFilter = ''
    let componentFilter = ''
    
    if (inComponent) {
      componentFilter = ` AND Component like '%${inComponent}%'`
    }
    
    if (inFixVersion) {
      releaseFilter = ` AND fixVersion='${inFixVersion}' `
    }
    
    const sql = `select * from 'story-stats' where ( date='${endYMD}' and key in (select key from 'story-stats' where date='${startYMD}' ${releaseFilter})) or (date='${startYMD}' ${releaseFilter}) order by key,date ASC`
    console.log(sql)

    console.log(`startDate: ${startDate}; startYMD: ${startYMD}`)
    console.log(`endDate: ${endDate}; endYMD: ${endYMD}`)

    const rows = this.db
      .prepare( sql ).all()

    rows.forEach((row) => {
      processRow = row.key == prevKey

      if (processRow) {
        let components = ['none']
        if (row.component) {
          components = row.component.split(',')
        }

        components.forEach((component) => {
          if (!componentsFound.includes(component)) {
            componentsFound.push(component)
          }

          if (!inComponent && component == inComponent) {
            if (!Object.keys(results).includes(component)) {
              results[component] = {
                count: 0,
                changed: 0,
                completed: 0,
                total: 0,
                data: [],
              }
            }

            results[component].count++
            if (
              row.total !== prevRow.total ||
              row.progress !== prevRow.progress
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
              results[component].data.push({
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

    let cleanResults = {}
    let data = {}
    // if (inComponent) {
    //   if (results[inComponent]) {
    //     if (results[inComponent].data.length > 0) {
    //       data = results[inComponent]['data']
    //     }
    //   } else {
    //     console.error(`Couldn't find component: ${inComponent}`)
    //     console.error(
    //       `Available components: \n\t${componentsFound
    //         .sort()
    //         .filter((x) => x !== 'none')
    //         .join(`\n\t`)}`
    //     )
    //     process.exit(1)
    //   }
    // }

  //   Object.keys(results)
  // .sort()
  // .forEach((component) => {
  //   cleanResults[component] = results[component]
  //   delete cleanResults[component][`data`]
  // })

    console.table( results)
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
}

module.exports = StoryStats
